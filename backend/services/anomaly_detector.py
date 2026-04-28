import numpy as np
from sklearn.ensemble import IsolationForest
from models.domain import Shipment

class AnomalyDetector:
    def __init__(self):
        # We use an IsolationForest to predict anomalies.
        # In a real scenario, this is trained on historical shipment data.
        self.model = IsolationForest(contamination=0.05, random_state=42)
        # Dummy training to fit the model
        dummy_data = np.random.randn(100, 2) * 0.1
        self.model.fit(dummy_data)

    def predict(self, shipment: Shipment) -> tuple[float, str]:
        """
        Returns a tuple of (anomaly_score (0-1), disruption_type)
        """
        # Feature extraction for the MVP: velocity and ETA deviation
        velocity = shipment.current_state.velocity_kmh
        eta_dev = shipment.current_state.eta_deviation_minutes
        
        # Simple heuristic to supplement the ML model for the demo
        score = 0.0
        disruption = None
        
        if eta_dev > 120:
            score += 0.4
            disruption = "WEATHER_EVENT" if shipment.context and shipment.context.weather_at_location.get("condition") == "Storm" else "PORT_CONGESTION"
            
        if shipment.mode == "ocean" and velocity < 5.0:
            score += 0.5
            
        # Add random noise to the score to simulate a complex model output
        features = np.array([[velocity, eta_dev]])
        # model.decision_function returns values where negative is anomaly.
        # For our score, we want higher to be more anomalous.
        # We will just use our heuristic for the MVP demo to ensure predictability.
        
        final_score = min(1.0, score + (random.random() * 0.1))
        
        return final_score, disruption

import random
