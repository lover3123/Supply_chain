import asyncio
import random
import uuid
from datetime import datetime, timezone
from models.domain import Shipment, Location, CurrentState, Context, RouteSegment, TelemetryHistory

# Global state for MVP
ACTIVE_SHIPMENTS = {}

ROUTES = [
    # Ocean Routes
    [
        RouteSegment(from_node="Shanghai", to_node="Busan", mode="ocean", carrier="MAERSK", estimated_duration_hours=48),
        RouteSegment(from_node="Busan", to_node="LA/Long Beach", mode="ocean", carrier="MAERSK", estimated_duration_hours=240)
    ],
    [
        RouteSegment(from_node="Shenzhen", to_node="Singapore", mode="ocean", carrier="MSC", estimated_duration_hours=96),
        RouteSegment(from_node="Singapore", to_node="Rotterdam", mode="ocean", carrier="MSC", estimated_duration_hours=480)
    ],
    # Air Routes
    [
        RouteSegment(from_node="Hong Kong", to_node="Anchorage", mode="air", carrier="FedEx", estimated_duration_hours=10),
        RouteSegment(from_node="Anchorage", to_node="Memphis", mode="air", carrier="FedEx", estimated_duration_hours=6)
    ],
    # Road Routes
    [
        RouteSegment(from_node="Rotterdam", to_node="Berlin", mode="road", carrier="DHL", estimated_duration_hours=8),
        RouteSegment(from_node="Berlin", to_node="Warsaw", mode="road", carrier="DHL", estimated_duration_hours=7)
    ],
    [
        RouteSegment(from_node="LA/Long Beach", to_node="Phoenix", mode="road", carrier="UPS", estimated_duration_hours=6),
        RouteSegment(from_node="Phoenix", to_node="Dallas", mode="road", carrier="UPS", estimated_duration_hours=12)
    ]
]

CITIES = {
    "Shanghai": {"lat": 31.2304, "lng": 121.4737},
    "Busan": {"lat": 35.1796, "lng": 129.0756},
    "LA/Long Beach": {"lat": 33.7701, "lng": -118.1937},
    "Shenzhen": {"lat": 22.5431, "lng": 114.0579},
    "Singapore": {"lat": 1.3521, "lng": 103.8198},
    "Rotterdam": {"lat": 51.9225, "lng": 4.4791},
    "Hong Kong": {"lat": 22.3193, "lng": 114.1694},
    "Anchorage": {"lat": 61.2181, "lng": -149.9003},
    "Memphis": {"lat": 35.1495, "lng": -90.0490},
    "Tokyo": {"lat": 35.6762, "lng": 139.6503},
    "Dubai": {"lat": 25.2048, "lng": 55.2708},
    "Berlin": {"lat": 52.5200, "lng": 13.4050},
    "Warsaw": {"lat": 52.2297, "lng": 21.0122},
    "Phoenix": {"lat": 33.4484, "lng": -112.0740},
    "Dallas": {"lat": 32.7767, "lng": -96.7970}
}

def generate_initial_shipments(num_shipments=100):
    for _ in range(num_shipments):
        import copy
        route = copy.deepcopy(random.choice(ROUTES))
        for segment in route:
            start = CITIES.get(segment.from_node)
            end = CITIES.get(segment.to_node)
            if start and end:
                segment.start_location = Location(lat=start["lat"], lng=start["lng"], name=segment.from_node)
                segment.end_location = Location(lat=end["lat"], lng=end["lng"], name=segment.to_node)
                
        start_city = route[0].from_node
        coords = CITIES[start_city]
        
        velocity = random.uniform(20.0, 40.0) if route[0].mode == "ocean" else random.uniform(800.0, 900.0)
        eta_dev = random.randint(-60, 60)
        
        # Pre-populate some history
        history = [
            TelemetryHistory(
                timestamp=datetime.now(timezone.utc),
                velocity_kmh=velocity,
                eta_deviation_minutes=eta_dev,
                status="in_transit"
            )
        ]
        
        shipment = Shipment(
            shipment_id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc),
            location=Location(lat=coords["lat"], lng=coords["lng"], name=start_city),
            mode=route[0].mode,
            current_state=CurrentState(
                status="in_transit",
                velocity_kmh=velocity,
                eta_deviation_minutes=eta_dev
            ),
            context=Context(
                weather_at_location={"condition": "Clear", "temp": 25},
                port_congestion_index=random.uniform(0.1, 0.9),
                carrier_reliability_score=random.uniform(0.7, 0.99)
            ),
            route=route,
            telemetry_history=history
        )
        ACTIVE_SHIPMENTS[shipment.shipment_id] = shipment

async def simulate_telemetry_stream(anomaly_detector, route_optimizer, broadcast_callback):
    """Background task to simulate moving shipments and detecting disruptions."""
    while True:
        await asyncio.sleep(2) # Update every 2 seconds for the demo
        
        updated_shipments = []
        for s_id, shipment in ACTIVE_SHIPMENTS.items():
            # Randomly move the shipment towards the destination slightly
            current_leg = shipment.route[0] if shipment.route else None
            if current_leg:
                dest = CITIES[current_leg.to_node]
                # Simple interpolation
                shipment.location.lat += (dest["lat"] - shipment.location.lat) * 0.05
                shipment.location.lng += (dest["lng"] - shipment.location.lng) * 0.05
                
                # Randomize velocity slightly
                shipment.current_state.velocity_kmh *= random.uniform(0.9, 1.1)
                
                # Inject a random disruption (1% chance)
                if random.random() < 0.01:
                    shipment.current_state.eta_deviation_minutes += random.randint(120, 1440)
                    shipment.context.weather_at_location = {"condition": "Storm", "temp": 15}
                    shipment.current_state.velocity_kmh *= 0.2 # Slow down significantly
                
            shipment.timestamp = datetime.now(timezone.utc)
            
            # Append to history
            shipment.telemetry_history.append(
                TelemetryHistory(
                    timestamp=datetime.now(timezone.utc),
                    velocity_kmh=shipment.current_state.velocity_kmh,
                    eta_deviation_minutes=shipment.current_state.eta_deviation_minutes,
                    status=shipment.current_state.status
                )
            )
            # keep only last 50 points to prevent memory bloat
            if len(shipment.telemetry_history) > 50:
                shipment.telemetry_history.pop(0)
            
            # 1. Anomaly Detection
            score, disruption_type = anomaly_detector.predict(shipment)
            shipment.anomaly_score = score
            shipment.disruption_type = disruption_type
            
            # 2. Route Optimization (if anomaly score is high)
            if score > 0.8:
                decision = route_optimizer.optimize(shipment)
                if decision and decision.proposed_action.type == "REROUTE":
                    # Populate coordinates for the new route
                    new_route = decision.proposed_action.new_route
                    for segment in new_route:
                        start = CITIES.get(segment.from_node)
                        end = CITIES.get(segment.to_node)
                        if start and end:
                            segment.start_location = Location(lat=start["lat"], lng=start["lng"], name=segment.from_node)
                            segment.end_location = Location(lat=end["lat"], lng=end["lng"], name=segment.to_node)

                    # For demo: just apply the reroute immediately
                    shipment.route = new_route
                    shipment.current_state.status = "rerouted"
                    
            updated_shipments.append(shipment.model_dump(mode='json'))
            
        # Broadcast via websocket
        if broadcast_callback:
            await broadcast_callback(updated_shipments)
