from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal
from datetime import datetime

class Location(BaseModel):
    lat: float
    lng: float
    geohash: Optional[str] = None
    name: Optional[str] = None

class SensorReadings(BaseModel):
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None

class CurrentState(BaseModel):
    status: Literal["in_transit", "customs", "dwell", "last_mile", "delayed", "rerouted"]
    velocity_kmh: float
    eta_deviation_minutes: int
    sensor_readings: Optional[SensorReadings] = None

class Context(BaseModel):
    weather_at_location: Optional[Dict] = None
    port_congestion_index: Optional[float] = None
    carrier_reliability_score: Optional[float] = None

class RouteSegment(BaseModel):
    from_node: str
    to_node: str
    mode: str
    carrier: Optional[str] = None
    estimated_duration_hours: float
    start_location: Optional[Location] = None
    end_location: Optional[Location] = None

class TelemetryHistory(BaseModel):
    timestamp: datetime
    velocity_kmh: float
    eta_deviation_minutes: int
    status: str

class Shipment(BaseModel):
    shipment_id: str
    timestamp: datetime
    location: Location
    mode: Literal["ocean", "air", "road", "rail", "multimodal"]
    current_state: CurrentState
    context: Optional[Context] = None
    route: List[RouteSegment] = []
    anomaly_score: Optional[float] = 0.0
    disruption_type: Optional[str] = None
    telemetry_history: List[TelemetryHistory] = []

class RouteDecisionAction(BaseModel):
    type: Literal["REROUTE", "EXPEDITE", "HOLD"]
    new_route: Optional[List[RouteSegment]] = None
    expected_impact: Dict

class RouteDecision(BaseModel):
    shipment_id: str
    decision_type: Literal["automatic_execution", "recommendation"]
    confidence_score: float
    proposed_action: RouteDecisionAction
    alternatives: List[Dict] = []
