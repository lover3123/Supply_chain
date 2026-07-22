from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import asyncio
import json
from datetime import datetime, timezone
from typing import Literal

from .services.ingestion import generate_initial_shipments, simulate_telemetry_stream, ACTIVE_SHIPMENTS
from .services.anomaly_detector import AnomalyDetector
from .services.route_optimizer import RouteOptimizer
from .services.operational_routing import OperationalRoutingService

app = FastAPI(title="SCRE API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: list[dict]):
        if not self.active_connections:
            return
        
        # Convert datetime objects to string using a custom json dumps if needed,
        # but pydantic model_dump(mode='json') handles datetime automatically.
        msg_str = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(msg_str)
            except Exception as e:
                print(f"Error sending message: {e}")

manager = ConnectionManager()
anomaly_detector = AnomalyDetector()
route_optimizer = RouteOptimizer()
operational_routing = OperationalRoutingService()

DARK_STORE_CATALOG = {
    "DS001": {"id": "DS001", "name": "Koramangala Hub", "lat": 12.9352, "lng": 77.6245, "activeRiders": 12},
    "DS002": {"id": "DS002", "name": "Indiranagar Hub", "lat": 12.9716, "lng": 77.6412, "activeRiders": 9},
    "DS003": {"id": "DS003", "name": "HSR Layout Hub", "lat": 12.9081, "lng": 77.6476, "activeRiders": 14},
    "DS004": {"id": "DS004", "name": "Whitefield Hub", "lat": 12.9698, "lng": 77.7499, "activeRiders": 11},
}
OPERATIONS_ORDERS: dict[str, dict] = {}
REROUTE_LOGS: list[dict] = []
SIMULATION = {"rainfallMmHr": 0, "sector": "Whitefield", "gridlockedCorridors": []}


class CoordinatePayload(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class CreateOrderPayload(BaseModel):
    order_id: str
    dark_store_id: str
    destination: CoordinatePayload
    rider_id: str | None = None
    customer_name: str = "Demo customer"
    promised_minutes: int = Field(default=30, ge=10, le=90)


class TelemetryPayload(BaseModel):
    location: CoordinatePayload
    speed_kmh: float = Field(ge=0, le=120)
    heading_degrees: int = Field(default=0, ge=0, le=359)


class SimulationPayload(BaseModel):
    rainfall_mm_hr: float = Field(ge=0, le=50)
    sector: str = "Whitefield"
    gridlocked_corridors: list[str] = []


class RerouteDecisionPayload(BaseModel):
    shipment_id: str
    decision: Literal["approved", "overridden", "backup_store_assigned"]
    operator_id: str = "demo-dispatcher"


def risk_context() -> tuple[float, float]:
    rain = SIMULATION["rainfallMmHr"]
    gridlock = len(SIMULATION["gridlockedCorridors"])
    risk = min(1.0, rain / 50 + gridlock * 0.28)
    coverage_multiplier = max(0.45, 1 - rain / 90 - gridlock * 0.08)
    return risk, coverage_multiplier


async def evaluate_operational_order(order: dict) -> dict:
    store = DARK_STORE_CATALOG[order["dark_store_id"]]
    start = (store["lat"], store["lng"])
    end = (order["destination"]["lat"], order["destination"]["lng"])
    current_route = await operational_routing.route(start, end)
    proposed_route = await operational_routing.route((12.9081, 77.6476), end, alternatives=True)
    summary = current_route.get("properties", {}).get("summary", {})
    base_minutes = round(summary.get("duration", 0) / 60, 1)
    distance_km = round(summary.get("distance", 0) / 1000, 2)
    risk, _ = risk_context()
    delay_minutes = round(base_minutes * (risk * 1.4), 1)
    surcharge = round(max(0, distance_km - 3) * 12 + SIMULATION["rainfallMmHr"] * 2.5, 0)
    hitl = risk >= 0.75 or delay_minutes > 30 or surcharge > 150
    return {
        "shipmentId": order["order_id"], "currentRoute": current_route, "proposedRoute": proposed_route,
        "riskIndex": risk, "delayMinutes": delay_minutes, "surchargeInr": surcharge,
        "decisionMode": "hitl" if hitl else "auto-execute", "provider": operational_routing.provider_status,
        "surchargeBreakdown": {"extraDistanceFuel": round(max(0, distance_km - 3) * 12, 0), "rainSurge": round(SIMULATION["rainfallMmHr"] * 2.5, 0)},
    }

@app.on_event("startup")
async def startup_event():
    # Initialize some shipments
    generate_initial_shipments(50)
    if not OPERATIONS_ORDERS:
        OPERATIONS_ORDERS["BLR-QC-1042"] = {
            "order_id": "BLR-QC-1042", "dark_store_id": "DS004",
            "destination": {"lat": 12.9591, "lng": 77.6977}, "rider_id": "R003",
            "customer_name": "Whitefield demo order", "promised_minutes": 30,
            "status": "in_transit", "created_at": datetime.now(timezone.utc).isoformat(),
        }
    # Start the simulation background task
    asyncio.create_task(simulate_telemetry_stream(anomaly_detector, route_optimizer, manager.broadcast))

@app.get("/api/v1/network/health")
async def get_network_health():
    # Return mock node congestion scores
    return {
        "nodes": {
            "Shanghai": 0.8,
            "LA/Long Beach": 0.9,
            "Rotterdam": 0.4
        }
    }

@app.get("/api/v1/shipments")
async def get_shipments():
    return [s.model_dump(mode='json') for s in ACTIVE_SHIPMENTS.values()]


@app.get("/api/v1/operations/status")
async def operations_status():
    return {"provider": operational_routing.provider_status, "orders": len(OPERATIONS_ORDERS), "simulation": SIMULATION, "darkStores": list(DARK_STORE_CATALOG.values())}


@app.get("/api/v1/orders")
async def get_operational_orders():
    return list(OPERATIONS_ORDERS.values())


@app.post("/api/v1/orders", status_code=201)
async def create_operational_order(payload: CreateOrderPayload):
    if payload.dark_store_id not in DARK_STORE_CATALOG:
        raise HTTPException(status_code=404, detail="Unknown dark store")
    if payload.order_id in OPERATIONS_ORDERS:
        raise HTTPException(status_code=409, detail="Order ID already exists")
    order = {
        "order_id": payload.order_id, "dark_store_id": payload.dark_store_id,
        "destination": payload.destination.model_dump(), "rider_id": payload.rider_id,
        "customer_name": payload.customer_name, "promised_minutes": payload.promised_minutes,
        "status": "in_transit", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    OPERATIONS_ORDERS[payload.order_id] = order
    await manager.broadcast([{"type": "order_created", "order": order}])
    return order


@app.get("/api/v1/routes/evaluate/{order_id}")
async def evaluate_route(order_id: str):
    order = OPERATIONS_ORDERS.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return await evaluate_operational_order(order)


@app.get("/api/v1/dark-stores/{store_id}/isochrone")
async def get_isochrone(store_id: str, minutes: int = 10):
    store = DARK_STORE_CATALOG.get(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Dark store not found")
    if not 3 <= minutes <= 30:
        raise HTTPException(status_code=422, detail="Minutes must be between 3 and 30")
    _, coverage_multiplier = risk_context()
    return await operational_routing.isochrone((store["lat"], store["lng"]), minutes, coverage_multiplier)


@app.post("/api/v1/simulations/disruption")
async def set_disruption_simulation(payload: SimulationPayload):
    SIMULATION.update({"rainfallMmHr": payload.rainfall_mm_hr, "sector": payload.sector, "gridlockedCorridors": payload.gridlocked_corridors})
    await manager.broadcast([{"type": "simulation_updated", "simulation": SIMULATION}])
    return SIMULATION


@app.post("/api/v1/riders/{rider_id}/telemetry")
async def ingest_rider_telemetry(rider_id: str, payload: TelemetryPayload):
    event = {"type": "rider_telemetry", "riderId": rider_id, **payload.model_dump(), "receivedAt": datetime.now(timezone.utc).isoformat()}
    await manager.broadcast([event])
    return event


@app.post("/api/v1/reroutes/decision")
async def record_reroute_decision(payload: RerouteDecisionPayload):
    log = {**payload.model_dump(), "createdAt": datetime.now(timezone.utc).isoformat(), "simulation": SIMULATION.copy()}
    REROUTE_LOGS.append(log)
    await manager.broadcast([{"type": "reroute_decision", "decision": log}])
    return log


@app.get("/api/v1/reroutes/logs")
async def reroute_logs():
    return REROUTE_LOGS[-100:]

@app.websocket("/ws/live-tracking")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
