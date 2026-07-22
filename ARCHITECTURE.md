# Bengaluru Hyper-Local Logistics Engine - Complete Implementation

A production-grade, Indian hyper-local logistics and supply chain engine optimized for high-density metropolitan markets (specifically Bengaluru, Karnataka, India). This system mirrors the architecture used by platforms like Blinkit, Zepto, Flipkart Minutes, and Rapido.

---

## Table of Contents

1. [System Architecture Diagram & Data Pipeline](#section-1-system-architecture-diagram--data-pipeline)
2. [Real-time Interactive Map Component](#section-2-real-time-interactive-map-component)
3. [Backend Routing & Weather Engine](#section-3-backend-routing--weather-engine)
4. [Database Schema (PostgreSQL + PostGIS)](#section-4-database-schema-postgresql--postgis)

---

## Section 1: System Architecture Diagram & Data Pipeline

### End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA PIPELINE ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Rider      │     │   Customer   │     │   Dark       │     │   Weather    │
│   Mobile App │     │   Mobile App │     │   Store      │     │   Services   │
│   (GPS)      │     │   (Orders)   │     │   Dashboard  │     │   (OWM/IMD)│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ WebSocket          │ REST API           │ WebSocket          │ REST API
       │ MQTT               │                    │                    │
       ▼                    ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Gateway Layer                                 │
│                      (FastAPI + Socket.IO + Redis)                          │
└─────────────────────────────────────────────────────────────────────────────┘
       │                    │                    │
       │ Telemetry Stream   │ Order Events       │ Weather Updates
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Message Queue (Redis Streams)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ GPS Points  │  │ Order Events│  │ Weather     │  │ Traffic     │        │
│  │ Stream      │  │ Stream      │  │ Stream      │  │ Stream      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Real-time Processing Engine                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Map Matching    │  │ ETA Calculator  │  │ Weather Impact  │             │
│  │ (OSRM)          │  │ (Dynamic)       │  │ Engine          │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│  ┌─────────────────┐  ┌─────────────────┐                                  │
│  │ Route Optimizer │  │ Fleet Allocator │                                  │
│  │ (VRP/TSP)       │  │ (Hub-and-Spoke) │                                  │
│  └─────────────────┘  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL + PostGIS Database                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ dark_stores │  │ orders      │  │ riders      │  │ weather_    │        │
│  │ (Point)     │  │ (LineString)│  │ (Point)     │  │ zones       │        │
│  │             │  │             │  │             │  │ (Polygon)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Frontend Rendering (React + Leaflet)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Dark Mode   │  │ Rider       │  │ Dynamic     │  │ Weather     │        │
│  │ Map Tiles   │  │ Markers     │  │ Routes      │  │ Overlay     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1.1 Data Ingestion Layer
- **WebSocket Server**: Real-time GPS telemetry from rider apps (10Hz frequency)
- **REST API**: Order creation, customer updates, dark store management
- **Weather Polling**: OpenWeatherMap API calls every 5 minutes for Bengaluru zones
- **Traffic Data**: OSRM traffic overlay integration

#### 1.2 Processing Pipeline
- **Map Matching**: Snap noisy GPS coordinates to OSM road network using OSRM
- **ETA Calculation**: Dynamic algorithm with traffic/weather penalties
- **Route Optimization**: VRP solver for multi-drop deliveries
- **Fleet Allocation**: Hub-and-spoke matching based on proximity and capacity

#### 1.3 Storage Layer
- **PostgreSQL + PostGIS**: Geospatial queries, historical tracking
- **Redis**: Real-time caching, pub/sub for live updates
- **TimescaleDB** (optional): Time-series GPS data for analytics

#### 1.4 Client Layer
- **React + Leaflet**: Interactive map with real-time updates
- **Socket.IO Client**: Live position streaming
- **Weather Widget**: Ambient conditions display

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript + Leaflet | Map rendering, UI components |
| Backend | FastAPI (Python 3.11+) | REST API, WebSocket server |
| Message Queue | Redis Streams | Real-time event processing |
| Database | PostgreSQL 15 + PostGIS 3.3 | Geospatial storage |
| Routing | OSRM (Self-hosted) | Fast path calculation |
| Weather | OpenWeatherMap API | Rain, temperature, wind data |
| Maps | Mapbox GL / OSM Tiles | Base map rendering |

---

## Section 2: Real-time Interactive Map Component (Frontend - React + Leaflet)

**Location:** `/workspace/frontend/src/components/Map.tsx`

### Features Implemented

#### 2.1 Bengaluru-Focused Map
- **Center Coordinates:** 12.9716°N, 77.5946°E (Bengaluru city center)
- **Bounds:** Restricted to Bengaluru metropolitan area
- **Zoom Levels:** 10-18 (street-level detail for hyper-local navigation)

#### 2.2 Dark Store Geofencing
- 6 operational dark stores across Bengaluru:
  - Koramangala Hub (3km radius)
  - Indiranagar Hub (2.5km radius)
  - HSR Layout Hub (3.5km radius)
  - Whitefield Hub (4km radius)
  - BTM Layout Hub (3km radius)
  - Jayanagar Hub (2.8km radius)
- Visual geofence circles showing delivery coverage
- Real-time rider count per hub

#### 2.3 Traffic Bottleneck Markers
- Silk Board Junction (high severity)
- ORR Bellandur (high severity)
- Marathahalli Bridge (medium severity)
- Hebbal Flyover (medium severity)
- MG Road Traffic (low severity)

#### 2.4 Weather Integration
- **API:** OpenWeatherMap integration
- **Metrics Displayed:**
  - Temperature (°C)
  - Rainfall (mm/hr)
  - Humidity (%)
  - Wind Speed (km/h)
- **Alert Levels:** Normal, Warning, Severe
- **Dynamic ETA Adjustments:** 
  - Light rain (>3mm/hr): +30% time, 40 km/h speed limit
  - Moderate rain (>10mm/hr): +60% time, 30 km/h speed limit
  - Heavy rain: +100% time, 20 km/h speed limit

#### 2.5 Route Visualization
- **Color Coding:**
  - Green (#22c55e): Optimal path
  - Orange (#f97316): Traffic/Rain delayed
  - Red (#ef4444): High delay/Gridlock
- **Weather-Adjusted Routing:** Routes recalculate based on real-time rainfall

#### 2.6 Rider Markers
- Two-wheeler icons with color-coded status
- Popup details: Speed, ETA deviation, delay risk score
- Animated position updates via WebSocket

#### 2.7 Map Layers
- Dark Mode (CartoDB Dark Matter) - Default
- Streets (OpenStreetMap)
- Satellite (Esri World Imagery)

#### 2.8 Live Operations Dashboard
- Active riders count
- Dark stores operational status
- Average ETA calculation
- Coverage area (~450 km²)

### Key Code Snippets

```typescript
// Weather-adjusted route coloring
const anomalyScore = shipment.anomaly_score || 0;
const rainPenalty = weather && weather.rainfall > 5 ? 0.2 : 0;
const adjustedScore = Math.min(anomalyScore + rainPenalty, 1.0);

let color = '#22c55e'; // Green - Optimal
if (adjustedScore > 0.7) color = '#ef4444'; // Red - Gridlock
else if (adjustedScore > 0.4) color = '#f97316'; // Orange - Delayed
```

```typescript
// Dark store geofence rendering
<CircleMarker
  center={[store.lat, store.lng]}
  radius={store.radius / 500}
  pathOptions={{
    color: '#22c55e',
    fillColor: '#22c55e',
    fillOpacity: 0.15,
    weight: 2,
    dashArray: '5,5',
  }}
/>
```

---

## Section 3: Backend Routing & Weather Engine (Python/FastAPI)

**Location:** `/workspace/backend/services/routing_engine.py`

### Core Classes

#### 3.1 WeatherEngine
```python
class WeatherEngine:
    """Hyper-local weather integration engine"""
    
    async def get_weather(self, lat: float, lng: float) -> WeatherData:
        """Fetch real-time weather from OpenWeatherMap API"""
        
    def get_weather_penalty(self, weather: WeatherData) -> Tuple[float, int]:
        """Calculate weather-based time penalty and speed limit"""
```

**Features:**
- 5-minute caching for API efficiency
- Automatic alert level classification
- Rainfall threshold detection

#### 3.2 RoutingEngine
```python
class RoutingEngine:
    """Dynamic routing using OSRM optimized for Bengaluru"""
    
    def get_traffic_multiplier(self, lat: float, lng: float) -> Tuple[float, str]:
        """Get traffic multiplier based on location and peak hours"""
        
    async def calculate_route(
        self,
        start: Tuple[float, float],
        end: Tuple[float, float],
        vehicle_type: str = "two_wheeler"
    ) -> CalculatedRoute:
        """Calculate optimal route with weather and traffic adjustments"""
```

**Traffic Multipliers (Bengaluru-specific):**
| Location | Multiplier | Peak Hour |
|----------|-----------|-----------|
| Silk Board | 2.5x | 2.5x × 1.5 = 3.75x |
| ORR Bellandur | 2.2x | 3.3x |
| Marathahalli | 1.8x | 2.7x |
| Hebbal | 1.6x | 2.4x |
| MG Road | 1.4x | 2.1x |

**Peak Hours (IST):**
- Morning: 8:00 AM - 10:30 AM
- Evening: 5:30 PM - 9:00 PM

#### 3.3 FleetAllocator
```python
class FleetAllocator:
    """Hub-and-spoke fleet allocation system"""
    
    def calculate_isochrone_radius(
        self,
        store: DarkStore,
        max_minutes: int = 30,
        avg_speed_kmh: float = 40
    ) -> float:
        """Calculate delivery radius based on travel time"""
        
    async def allocate_rider(
        self,
        order: Order,
        available_riders: List[Rider],
        dark_stores: Dict[str, DarkStore]
    ) -> Optional[Rider]:
        """Allocate best rider based on proximity, capacity, battery"""
```

**Allocation Scoring Factors:**
1. Distance to dark store (primary)
2. Battery level penalty (<30%: +5.0 score)
3. Existing orders bonus (-2.0 for same store)
4. Current load vs capacity

### Usage Example

```python
# Initialize engines
routing_engine = RoutingEngine()
fleet_allocator = FleetAllocator()

# Calculate route with weather adjustment
route = await routing_engine.calculate_route(
    start=(12.9352, 77.6245),  # Koramangala
    end=(12.9280, 77.6320),    # Customer location
    vehicle_type="two_wheeler"
)

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
```

---

## Section 4: Database Schema (PostgreSQL + PostGIS)

**Location:** `/workspace/backend/database/schema.sql`

### Tables Overview

#### 4.1 dark_stores
- **Geometry:** GEOGRAPHY(POINT, 4326)
- **Key Fields:** delivery_radius_km, max_delivery_time_minutes
- **Indexes:** GIST index on location for radius queries

#### 4.2 riders
- **Geometry:** GEOGRAPHY(POINT, 4326) with auto-updating timestamp
- **EV Support:** battery_level, charging_station_id
- **Capacity:** max_concurrent_deliveries, max_weight_capacity_kg
- **Indexes:** 
  - GIST on current_location (filtered by status='available')
  - Composite on (home_store_id, status)

#### 4.3 orders
- **Geometry:** delivery_location (POINT), route_polyline (LINESTRING)
- **ETA Tracking:** base_eta_minutes, adjusted_eta_minutes
- **Multipliers:** traffic_multiplier, weather_multiplier
- **Weather Context:** rainfall_mm, temperature_celsius at order time

#### 4.4 weather_zones
- **Geometry:** GEOGRAPHY(POLYGON, 4326) for micro-climate zones
- **Alerts:** alert_level, waterlogging_risk, heat_alert
- **Adjustments:** speed_limit_kmh, eta_buffer_minutes, surcharge_percent

#### 4.5 traffic_bottlenecks (Bengaluru-specific)
Pre-populated with 5 major bottlenecks:
- Silk Board Junction
- ORR Bellandur
- Marathahalli Bridge
- Hebbal Flyover
- MG Road Traffic

### Utility Functions

```sql
-- Find weather zone for a location
SELECT * FROM get_weather_zone_for_location(12.9716, 77.5946);

-- Calculate isochrone radius
SELECT calculate_isochrone_radius(30, 40.0, 5); -- Returns ~10km

-- Find nearest available rider
SELECT * FROM find_nearest_rider(12.9352, 77.6245, 5.0);
```

### Pre-built Views

```sql
-- Available riders by dark store
SELECT * FROM v_available_riders_by_store;

-- Active orders with delivery status
SELECT * FROM v_active_orders_with_eta;

-- Weather-impacted zones
SELECT * FROM v_weather_impacted_zones;
```

---

## Quick Start Guide

### Prerequisites
```bash
# Install Python dependencies
pip install fastapi uvicorn httpx asyncio

# Install Node.js dependencies
cd frontend && npm install

# PostgreSQL setup
psql -U postgres -c "CREATE EXTENSION postgis;"
psql -U postgres -d your_db -f backend/database/schema.sql
```

### Running the Application

```bash
# Start backend (FastAPI)
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Start frontend (React + Vite)
cd frontend
npm run dev

# Access the map
# Open http://localhost:5173 in browser
```

### Environment Variables

Create `.env` file in frontend directory:
```env
VITE_OPENWEATHER_API_KEY=your_openweathermap_api_key
VITE_WS_URL=ws://localhost:8000/ws/live-tracking
```

---

## Performance Considerations

1. **GPS Telemetry:** 10Hz frequency via WebSocket
2. **Weather Caching:** 5-minute TTL per zone
3. **Database Indexes:** GIST indexes for all geospatial queries
4. **Connection Pooling:** Redis for pub/sub and caching
5. **Route Calculation:** OSRM self-hosted for sub-100ms responses

---

## Bengaluru-Specific Optimizations

1. **Two-Wheeler Priority:** All routes optimized for motorcycle/scooter travel
2. **Flyover vs Service Road:** Distinguishes between elevated and ground-level routes
3. **Narrow Lane Navigation:** Accounts for HSR Layout sectors, BTM Layout blocks
4. **Monsoon Adaptation:** Dynamic speed limits during heavy rainfall
5. **Tech Corridor Focus:** Special handling for ORR, Silk Board, Bellandur, Whitefield

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ws/live-tracking` | WebSocket | Real-time rider position stream |
| `/api/v1/network/health` | GET | Network congestion scores |
| `/api/v1/shipments` | GET | All active shipments |
| `/api/v1/orders` | POST | Create new order |
| `/api/v1/route/calculate` | POST | Calculate route with ETA |
| `/api/v1/weather/current` | GET | Current weather for coordinates |

---

## License

Production-ready implementation for Indian hyper-local logistics platforms.

