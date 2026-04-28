from models.domain import Shipment, RouteDecision, RouteDecisionAction, RouteSegment

class RouteOptimizer:
    def __init__(self):
        # A predefined graph of alternate routes for the MVP demo
        self.alternatives = {
            "Shanghai": {
                "LA/Long Beach": [
                    # Ocean -> Air multimodal
                    RouteSegment(from_node="Shanghai", to_node="Tokyo", mode="ocean", carrier="MSC", estimated_duration_hours=48),
                    RouteSegment(from_node="Tokyo", to_node="LA/Long Beach", mode="air", carrier="FedEx", estimated_duration_hours=12)
                ]
            },
            "Shenzhen": {
                "Rotterdam": [
                    RouteSegment(from_node="Shenzhen", to_node="Dubai", mode="air", carrier="Emirates", estimated_duration_hours=10),
                    RouteSegment(from_node="Dubai", to_node="Rotterdam", mode="air", carrier="Emirates", estimated_duration_hours=8)
                ]
            }
        }

    def optimize(self, shipment: Shipment) -> RouteDecision | None:
        """
        Calculates an alternative route if a disruption is detected.
        """
        if not shipment.route:
            return None

        start = shipment.route[0].from_node
        # Assuming the final destination is the end of the current route
        end = shipment.route[-1].to_node
        
        # Check if we have pre-computed alternatives for this O/D pair
        if start in self.alternatives and end in self.alternatives[start]:
            new_route = self.alternatives[start][end]
            
            return RouteDecision(
                shipment_id=shipment.shipment_id,
                decision_type="automatic_execution",
                confidence_score=0.96,
                proposed_action=RouteDecisionAction(
                    type="REROUTE",
                    new_route=new_route,
                    expected_impact={
                        "delay_saved_hours": 72,
                        "cost_increase_usd": 3500,
                        "reason": "Multimodal switch to air freight to avoid ocean congestion."
                    }
                ),
                alternatives=[]
            )
        return None
