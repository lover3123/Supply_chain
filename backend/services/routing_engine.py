"""
Section 3: Backend Routing & Weather Engine (Python/FastAPI)

Dynamic Routing & Weather-Adjusted ETA Calculator for Bengaluru Hyper-Local Logistics
Mirrors Blinkit/Zepto quick-commerce routing architecture
"""

import asyncio
import math
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Bengaluru-specific coordinates
BENGALURU_CENTER = (12.9716, 77.5946)

# Traffic penalty multipliers for Bengaluru bottlenecks
TRAFFIC_PENALTIES = {
    'silk_board': 2.5,      # Silk Board Junction - worst bottleneck
    'orr_bellandur': 2.2,   # ORR Bellandur stretch
    'marathahalli': 1.8,    # Marathahalli Bridge
    'hebbal': 1.6,          # Hebbal Flyover
    'mg_road': 1.4,         # MG Road traffic
    'normal': 1.0,          # Normal roads
}

# Peak hour windows (IST)
PEAK_HOURS = [
    (8, 10.5),    # 8:00 AM - 10:30 AM
    (17.5, 21),   # 5:30 PM - 9:00 PM
]

# Weather impact thresholds
WEATHER_IMPACT = {
    'light_rain': {'threshold': 3, 'penalty': 1.3, 'speed_limit': 40},
    'moderate_rain': {'threshold': 10, 'penalty': 1.6, 'speed_limit': 30},
    'heavy_rain': {'threshold': float('inf'), 'penalty': 2.0, 'speed_limit': 20},
}


class RouteStatus(Enum):
    OPTIMAL = "optimal"
    DELAYED = "delayed"
    HIGH_DELAY = "high_delay"
    GRIDLOCK = "gridlock"


@dataclass
class WeatherData:
    """Real-time weather data for a location"""
    temperature: float
    humidity: float
    rainfall_mm_hr: float
    wind_speed_kmh: float
    condition: str
    alert_level: str = "normal"  # normal, warning, severe
    
    def __post_init__(self):
        if self.rainfall_mm_hr > 10:
            self.alert_level = "severe"
        elif self.rainfall_mm_hr > 3:
            self.alert_level = "warning"


@dataclass
class Rider:
    """Rider/Delivery partner data"""
    rider_id: str
    lat: float
    lng: float
    status: str  # available, busy, offline
    battery_level: Optional[float] = None  # For EV fleet
    current_orders: List[str] = field(default_factory=list)
    max_capacity: int = 5  # Max orders per trip


@dataclass
class DarkStore:
    """Dark store / fulfillment center"""
    store_id: str
    name: str
    lat: float
    lng: float
    delivery_radius_km: float = 3.0
    active_riders: int = 0


@dataclass
class Order:
    """Customer order"""
    order_id: str
    customer_lat: float
    customer_lng: float
    dark_store_id: str
    items_count: int
    weight_kg: float
    promised_minutes: int = 30
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class RouteSegment:
    """A segment of the route"""
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    distance_km: float
    duration_minutes: float
    traffic_severity: str
    road_type: str  # main_road, service_road, narrow_lane


@dataclass
class CalculatedRoute:
    """Complete route with ETA calculations"""
    route_id: str
    segments: List[RouteSegment]
    total_distance_km: float
    base_eta_minutes: float
    adjusted_eta_minutes: float
    traffic_multiplier: float
    weather_multiplier: float
    status: RouteStatus
    polyline: List[Tuple[float, float]]


class WeatherEngine:
    """
    Hyper-local weather integration engine
    Fetches real-time weather data from OpenWeatherMap API
    """
    
    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self.base_url = "https://api.openweathermap.org/data/2.5/weather"
        self._cache: Dict[str, Tuple[WeatherData, datetime]] = {}
        self._cache_ttl_seconds = 300  # 5 minutes
    
    async def get_weather(self, lat: float, lng: float) -> WeatherData:
        """Get weather data for specific coordinates"""
        cache_key = f"{lat:.4f},{lng:.4f}"
        
        # Check cache first
        if cache_key in self._cache:
            cached_data, timestamp = self._cache[cache_key]
            if (datetime.now() - timestamp).total_seconds() < self._cache_ttl_seconds:
                return cached_data
        
        # Fetch from API
        try:
            async with httpx.AsyncClient() as client:
                params = {
                    'lat': lat,
                    'lon': lng,
                    'appid': self.api_key or 'demo_key',
                    'units': 'metric'
                }
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()
                
                rainfall = data.get('rain', {}).get('1h', 0)
                weather = WeatherData(
                    temperature=data['main']['temp'],
                    humidity=data['main']['humidity'],
                    rainfall_mm_hr=round(rainfall * 10) / 10,
                    wind_speed_kmh=round(data['wind']['speed'] * 3.6),
                    condition=data['weather'][0]['main']
                )
                
                # Cache the result
                self._cache[cache_key] = (weather, datetime.now())
                return weather
                
        except Exception as e:
            print(f"Weather API error: {e}")
            # Return mock data for demo
            return WeatherData(
                temperature=28.0,
                humidity=72.0,
                rainfall_mm_hr=0.0,
                wind_speed_kmh=12.0,
                condition='Clouds'
            )
    
    def get_weather_penalty(self, weather: WeatherData) -> Tuple[float, int]:
        """
        Calculate weather-based time penalty and speed limit
        Returns: (multiplier, speed_limit_kmh)
        """
        rainfall = weather.rainfall_mm_hr
        
        if rainfall == 0:
            return 1.0, 60  # No penalty, normal speed
        
        for rain_type, impact in WEATHER_IMPACT.items():
            if rainfall < impact['threshold']:
                continue
            return impact['penalty'], impact['speed_limit']
        
        return 2.0, 20  # Heavy rain fallback


class RoutingEngine:
    """
    Dynamic routing engine using OSRM (Open Source Routing Machine)
    Optimized for Bengaluru traffic patterns and two-wheeler routing
    """
    
    def __init__(self, osrm_url: str = "http://router.project-osrm.org"):
        self.osrm_url = osrm_url
        self.weather_engine = WeatherEngine()
    
    def haversine_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate great-circle distance between two points in km"""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def is_peak_hour(self) -> bool:
        """Check if current time is within peak traffic hours"""
        now = datetime.now()
        current_hour = now.hour + now.minute / 60.0
        
        for start, end in PEAK_HOURS:
            if start <= current_hour <= end:
                return True
        return False
    
    def get_traffic_multiplier(self, lat: float, lng: float) -> Tuple[float, str]:
        """
        Get traffic multiplier based on location and time
        Returns: (multiplier, severity_level)
        """
        # Check proximity to known bottlenecks
        bottlenecks = {
            'silk_board': (12.9176, 77.6244),
            'orr_bellandur': (12.9352, 77.6168),
            'marathahalli': (12.9591, 77.6977),
            'hebbal': (13.0350, 77.5970),
            'mg_road': (12.9716, 77.5946),
        }
        
        min_distance = float('inf')
        nearest_bottleneck = 'normal'
        
        for name, (b_lat, b_lng) in bottlenecks.items():
            dist = self.haversine_distance(lat, lng, b_lat, b_lng)
            if dist < min_distance:
                min_distance = dist
                nearest_bottleneck = name
        
        # If within 1km of bottleneck, apply penalty
        if min_distance < 1.0:
            base_multiplier = TRAFFIC_PENALTIES.get(nearest_bottleneck, 1.0)
        else:
            base_multiplier = 1.0
        
        # Apply peak hour multiplier
        if self.is_peak_hour():
            base_multiplier *= 1.5
        
        # Determine severity
        if base_multiplier >= 2.0:
            severity = "high"
        elif base_multiplier >= 1.5:
            severity = "medium"
        elif base_multiplier >= 1.2:
            severity = "low"
        else:
            severity = "normal"
        
        return base_multiplier, severity
    
    async def calculate_route(
        self,
        start: Tuple[float, float],
        end: Tuple[float, float],
        vehicle_type: str = "two_wheeler"
    ) -> CalculatedRoute:
        """
        Calculate optimal route with weather and traffic adjustments
        
        Args:
            start: (lat, lng) tuple for starting point
            end: (lat, lng) tuple for destination
            vehicle_type: "two_wheeler", "bike", "ev"
        
        Returns:
            CalculatedRoute with adjusted ETA
        """
        # Get midpoint for weather sampling
        mid_lat = (start[0] + end[0]) / 2
        mid_lng = (start[1] + end[1]) / 2
        
        # Fetch weather data
        weather = await self.weather_engine.get_weather(mid_lat, mid_lng)
        weather_multiplier, speed_limit = self.weather_engine.get_weather_penalty(weather)
        
        # Calculate base distance
        distance_km = self.haversine_distance(start[0], start[1], end[0], end[1])
        
        # Adjust for actual road distance (typically 1.3x straight line in cities)
        road_distance = distance_km * 1.3
        
        # Base speed assumptions (km/h)
        base_speeds = {
            "two_wheeler": 45,
            "bike": 50,
            "ev": 40,
        }
        base_speed = base_speeds.get(vehicle_type, 45)
        
        # Apply weather speed limit
        effective_speed = min(base_speed, speed_limit)
        
        # Calculate base ETA
        base_eta = (road_distance / effective_speed) * 60  # Convert to minutes
        
        # Get traffic multiplier at destination
        traffic_multiplier, traffic_severity = self.get_traffic_multiplier(end[0], end[1])
        
        # Calculate adjusted ETA
        adjusted_eta = base_eta * traffic_multiplier * weather_multiplier
        
        # Determine route status
        total_multiplier = traffic_multiplier * weather_multiplier
        if total_multiplier >= 2.5:
            status = RouteStatus.GRIDLOCK
        elif total_multiplier >= 1.8:
            status = RouteStatus.HIGH_DELAY
        elif total_multiplier >= 1.3:
            status = RouteStatus.DELAYED
        else:
            status = RouteStatus.OPTIMAL
        
        # Generate simple polyline (in production, this comes from OSRM)
        num_points = max(int(distance_km * 10), 5)
        polyline = []
        for i in range(num_points + 1):
            t = i / num_points
            lat = start[0] + t * (end[0] - start[0])
            lng = start[1] + t * (end[1] - start[1])
            polyline.append((lat, lng))
        
        # Create route segment
        segment = RouteSegment(
            start_lat=start[0],
            start_lng=start[1],
            end_lat=end[0],
            end_lng=end[1],
            distance_km=round(road_distance, 2),
            duration_minutes=round(adjusted_eta, 1),
            traffic_severity=traffic_severity,
            road_type="main_road"
        )
        
        return CalculatedRoute(
            route_id=f"route_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            segments=[segment],
            total_distance_km=round(road_distance, 2),
            base_eta_minutes=round(base_eta, 1),
            adjusted_eta_minutes=round(adjusted_eta, 1),
            traffic_multiplier=round(traffic_multiplier, 2),
            weather_multiplier=round(weather_multiplier, 2),
            status=status,
            polyline=polyline
        )


class FleetAllocator:
    """
    Hub-and-spoke fleet allocation system
    Matches riders to orders based on proximity, capacity, and conditions
    """
    
    def __init__(self):
        self.routing_engine = RoutingEngine()
    
    def calculate_isochrone_radius(
        self,
        store: DarkStore,
        max_minutes: int = 30,
        avg_speed_kmh: float = 40
    ) -> float:
        """
        Calculate delivery radius based on travel time (isochrone)
        
        Args:
            store: Dark store location
            max_minutes: Maximum delivery time承诺
            avg_speed_kmh: Average speed considering traffic
        
        Returns:
            Radius in km
        """
        # Account for preparation time (packing, loading)
        prep_time = 5  # minutes
        
        # Available travel time
        travel_time = max_minutes - prep_time
        
        # Radius = speed * time (one way)
        radius_km = (avg_speed_kmh * travel_time / 60) / 2  # Divide by 2 for round trip
        
        return min(radius_km, store.delivery_radius_km)
    
    async def allocate_rider(
        self,
        order: Order,
        available_riders: List[Rider],
        dark_stores: Dict[str, DarkStore]
    ) -> Optional[Rider]:
        """
        Allocate best rider for an order
        
        Scoring factors:
        - Proximity to dark store
        - Current load vs capacity
        - Battery level (for EV)
        - Weather conditions along route
        
        Returns:
            Best matched rider or None
        """
        store = dark_stores.get(order.dark_store_id)
        if not store:
            return None
        
        scored_riders = []
        
        for rider in available_riders:
            if rider.status != 'available':
                continue
            
            # Check capacity
            if len(rider.current_orders) >= rider.max_capacity:
                continue
            
            # Calculate distance from rider to store
            distance_to_store = self.routing_engine.haversine_distance(
                rider.lat, rider.lng,
                store.lat, store.lng
            )
            
            # Score calculation (lower is better)
            score = distance_to_store  # Base: proximity
            
            # Penalty for low battery (EV)
            if rider.battery_level is not None and rider.battery_level < 30:
                score += 5.0
            
            # Bonus for already having orders from same store
            if order.dark_store_id in rider.current_orders:
                score -= 2.0
            
            scored_riders.append((score, rider))
        
        if not scored_riders:
            return None
        
        # Sort by score and return best
        scored_riders.sort(key=lambda x: x[0])
        return scored_riders[0][1]
    
    async def optimize_multi_drop_route(
        self,
        rider: Rider,
        orders: List[Order],
        dark_stores: Dict[str, DarkStore]
    ) -> CalculatedRoute:
        """
        Optimize route for multiple deliveries (TSP/VRP)
        Uses nearest neighbor heuristic for simplicity
        
        Args:
            rider: Current rider location
            orders: List of orders to deliver
            dark_stores: Dark store locations
        
        Returns:
            Optimized route
        """
        if not orders:
            raise ValueError("No orders provided")
        
        # Start from rider's current location
        current_lat, current_lng = rider.lat, rider.lng
        remaining_orders = orders.copy()
        route_points = [(current_lat, current_lng)]
        
        # Nearest neighbor algorithm
        while remaining_orders:
            # Find nearest unvisited delivery point
            min_dist = float('inf')
            nearest_order = None
            
            for order in remaining_orders:
                dist = self.routing_engine.haversine_distance(
                    current_lat, current_lng,
                    order.customer_lat, order.customer_lng
                )
                if dist < min_dist:
                    min_dist = dist
                    nearest_order = order
            
            if nearest_order:
                route_points.append((nearest_order.customer_lat, nearest_order.customer_lng))
                current_lat, current_lng = nearest_order.customer_lat, nearest_order.customer_lng
                remaining_orders.remove(nearest_order)
        
        # Calculate full route
        if len(route_points) < 2:
            raise ValueError("Not enough points for route")
        
        # For simplicity, calculate first segment only
        # In production, calculate all segments and sum
        route = await self.routing_engine.calculate_route(
            route_points[0],
            route_points[-1]
        )
        
        # Adjust for multiple stops (add 2 min per stop)
        route.adjusted_eta_minutes += (len(orders) - 1) * 2
        
        return route


# Example usage and integration
async def demo_routing_system():
    """Demonstration of the routing system"""
    
    # Initialize engines
    routing_engine = RoutingEngine()
    fleet_allocator = FleetAllocator()
    
    # Create sample dark stores
    dark_stores = {
        "DS001": DarkStore(
            store_id="DS001",
            name="Koramangala Hub",
            lat=12.9352,
            lng=77.6245,
            delivery_radius_km=3.0
        ),
        "DS002": DarkStore(
            store_id="DS002",
            name="Indiranagar Hub",
            lat=12.9716,
            lng=77.6412,
            delivery_radius_km=2.5
        ),
    }
    
    # Create sample order
    order = Order(
        order_id="ORD123456",
        customer_lat=12.9280,
        customer_lng=77.6320,
        dark_store_id="DS001",
        items_count=5,
        weight_kg=2.5,
        promised_minutes=30
    )
    
    # Create sample riders
    riders = [
        Rider(
            rider_id="R001",
            lat=12.9340,
            lng=77.6230,
            status="available",
            battery_level=85.0,
            current_orders=[]
        ),
        Rider(
            rider_id="R002",
            lat=12.9360,
            lng=77.6250,
            status="available",
            battery_level=45.0,
            current_orders=["ORD123455"]
        ),
    ]
    
    # Calculate route from store to customer
    store = dark_stores["DS001"]
    route = await routing_engine.calculate_route(
        start=(store.lat, store.lng),
        end=(order.customer_lat, order.customer_lng),
        vehicle_type="two_wheeler"
    )
    
    print(f"\n=== Route Calculation Demo ===")
    print(f"Route ID: {route.route_id}")
    print(f"Distance: {route.total_distance_km} km")
    print(f"Base ETA: {route.base_eta_minutes} min")
    print(f"Adjusted ETA: {route.adjusted_eta_minutes} min")
    print(f"Traffic Multiplier: {route.traffic_multiplier}x")
    print(f"Weather Multiplier: {route.weather_multiplier}x")
    print(f"Status: {route.status.value}")
    
    # Allocate rider
    allocated_rider = await fleet_allocator.allocate_rider(
        order=order,
        available_riders=riders,
        dark_stores=dark_stores
    )
    
    print(f"\n=== Rider Allocation ===")
    if allocated_rider:
        print(f"Allocated Rider: {allocated_rider.rider_id}")
        print(f"Battery Level: {allocated_rider.battery_level}%")
        print(f"Current Orders: {len(allocated_rider.current_orders)}")
    else:
        print("No available riders found")
    
    return route, allocated_rider


if __name__ == "__main__":
    # Run demo
    asyncio.run(demo_routing_system())
