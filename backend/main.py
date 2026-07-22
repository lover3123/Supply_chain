from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json

from .services.ingestion import generate_initial_shipments, simulate_telemetry_stream, ACTIVE_SHIPMENTS
from .services.anomaly_detector import AnomalyDetector
from .services.route_optimizer import RouteOptimizer

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

@app.on_event("startup")
async def startup_event():
    # Initialize some shipments
    generate_initial_shipments(50)
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

@app.websocket("/ws/live-tracking")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
