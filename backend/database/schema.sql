-- Section 4: Database Schema (PostgreSQL + PostGIS)
-- Bengaluru Hyper-Local Logistics Engine
-- Geospatial tables for dark stores, orders, riders, and weather zones

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Comment on extension
COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Rider status enumeration
CREATE TYPE rider_status AS ENUM ('available', 'busy', 'offline', 'maintenance');

-- Order status enumeration  
CREATE TYPE order_status AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled',
    'failed'
);

-- Route status enumeration
CREATE TYPE route_status AS ENUM ('optimal', 'delayed', 'high_delay', 'gridlock');

-- Weather alert level
CREATE TYPE weather_alert_level AS ENUM ('normal', 'warning', 'severe');

-- Traffic severity
CREATE TYPE traffic_severity AS ENUM ('normal', 'low', 'medium', 'high');

-- ============================================================================
-- DARK STORES TABLE (Hub-and-Spoke Centers)
-- ============================================================================

CREATE TABLE dark_stores (
    store_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Geospatial location (Point geometry in WGS84)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::GEOMETRY)) STORED,
    longitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
    
    -- Delivery parameters
    delivery_radius_km DOUBLE PRECISION DEFAULT 3.0 CHECK (delivery_radius_km > 0),
    max_delivery_time_minutes INTEGER DEFAULT 30,
    
    -- Operational status
    is_active BOOLEAN DEFAULT TRUE,
    operating_hours_start TIME DEFAULT '09:00:00',
    operating_hours_end TIME DEFAULT '22:00:00',
    
    -- Capacity metrics
    max_concurrent_orders INTEGER DEFAULT 50,
    current_active_orders INTEGER DEFAULT 0,
    
    -- Contact information
    manager_name VARCHAR(255),
    manager_phone VARCHAR(20),
    address TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast geospatial queries (find stores within radius)
CREATE INDEX idx_dark_stores_location ON dark_stores USING GIST (location);

-- Index for active stores
CREATE INDEX idx_dark_stores_active ON dark_stores (is_active) WHERE is_active = TRUE;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dark_stores_updated_at
    BEFORE UPDATE ON dark_stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RIDERS TABLE (Delivery Partners)
-- ============================================================================

CREATE TABLE riders (
    rider_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    
    -- Current location (updated via GPS telemetry)
    current_location GEOGRAPHY(POINT, 4326),
    latitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(current_location::GEOMETRY)) STORED,
    longitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(current_location::geometry)) STORED,
    
    -- Status and availability
    status rider_status DEFAULT 'offline',
    is_accepting_orders BOOLEAN DEFAULT FALSE,
    
    -- Vehicle information
    vehicle_type VARCHAR(50) DEFAULT 'two_wheeler', -- two_wheeler, bike, ev
    vehicle_number VARCHAR(20),
    
    -- EV-specific fields
    battery_level DECIMAL(5, 2) CHECK (battery_level >= 0 AND battery_level <= 100),
    charging_station_id VARCHAR(50),
    
    -- Capacity constraints
    max_concurrent_deliveries INTEGER DEFAULT 3,
    current_deliveries INTEGER DEFAULT 0,
    max_weight_capacity_kg DECIMAL(5, 2) DEFAULT 20.0,
    
    -- Assigned dark store (home base)
    home_store_id VARCHAR(50) REFERENCES dark_stores(store_id),
    
    -- Performance metrics
    total_deliveries INTEGER DEFAULT 0,
    avg_delivery_time_minutes DECIMAL(5, 2),
    rating DECIMAL(3, 2) DEFAULT 5.0,
    
    -- Last known position timestamp
    last_location_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding nearby riders
CREATE INDEX idx_riders_location ON riders USING GIST (current_location) WHERE status = 'available';

-- Index for riders by status
CREATE INDEX idx_riders_status ON riders (status);

-- Index for riders accepting orders
CREATE INDEX idx_riders_accepting ON riders (is_accepting_orders) WHERE is_accepting_orders = TRUE;

-- Composite index for efficient allocation queries
CREATE INDEX idx_riders_store_status ON riders (home_store_id, status) 
    WHERE status = 'available' AND is_accepting_orders = TRUE;

-- Trigger for updating location timestamp
CREATE OR REPLACE FUNCTION update_rider_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_location IS DISTINCT FROM OLD.current_location THEN
        NEW.last_location_update = CURRENT_TIMESTAMP;
    END IF;
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_riders_location_update
    BEFORE UPDATE ON riders
    FOR EACH ROW
    EXECUTE FUNCTION update_rider_location_timestamp();

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================

CREATE TABLE orders (
    order_id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    
    -- Delivery location
    delivery_location GEOGRAPHY(POINT, 4326) NOT NULL,
    delivery_latitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(delivery_location::GEOMETRY)) STORED,
    delivery_longitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(delivery_location::geometry)) STORED,
    delivery_address TEXT NOT NULL,
    delivery_instructions TEXT,
    
    -- Source dark store
    dark_store_id VARCHAR(50) NOT NULL REFERENCES dark_stores(store_id),
    
    -- Order details
    items_count INTEGER DEFAULT 1,
    total_weight_kg DECIMAL(5, 2),
    order_value DECIMAL(10, 2),
    
    -- Status tracking
    status order_status DEFAULT 'pending',
    
    -- Time tracking
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    preparation_started_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Promise tracking
    promised_delivery_minutes INTEGER DEFAULT 30,
    estimated_delivery_at TIMESTAMP WITH TIME ZONE,
    actual_delivery_minutes INTEGER,
    
    -- Assigned rider
    assigned_rider_id VARCHAR(50) REFERENCES riders(rider_id),
    
    -- Route information
    route_polyline GEOGRAPHY(LINESTRING, 4326),
    route_distance_km DECIMAL(6, 2),
    base_eta_minutes INTEGER,
    adjusted_eta_minutes INTEGER,
    traffic_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    weather_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    
    -- Weather conditions at order time
    weather_condition VARCHAR(50),
    rainfall_mm DECIMAL(5, 2),
    temperature_celsius DECIMAL(5, 2),
    
    -- Cancellation info
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding orders by location
CREATE INDEX idx_orders_delivery_location ON orders USING GIST (delivery_location);

-- Index for active orders
CREATE INDEX idx_orders_status ON orders (status) 
    WHERE status IN ('pending', 'confirmed', 'preparing', 'picked_up', 'in_transit');

-- Index for orders by dark store
CREATE INDEX idx_orders_dark_store ON orders (dark_store_id, status);

-- Index for orders by rider
CREATE INDEX idx_orders_rider ON orders (assigned_rider_id) 
    WHERE assigned_rider_id IS NOT NULL AND status IN ('picked_up', 'in_transit');

-- Index for delayed orders
CREATE INDEX idx_orders_delayed ON orders (estimated_delivery_at) 
    WHERE status = 'in_transit' AND estimated_delivery_at < CURRENT_TIMESTAMP;

-- ============================================================================
-- WEATHER ZONES TABLE (Micro-climate tracking)
-- ============================================================================

CREATE TABLE weather_zones (
    zone_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Zone boundary (Polygon geometry)
    boundary GEOGRAPHY(POLYGON, 4326) NOT NULL,
    center_point GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_Centroid(boundary)) STORED,
    
    -- Current weather conditions
    temperature_celsius DECIMAL(5, 2),
    humidity_percent DECIMAL(5, 2),
    rainfall_mm_hr DECIMAL(6, 2) DEFAULT 0,
    wind_speed_kmh DECIMAL(5, 2),
    weather_condition VARCHAR(100),
    
    -- Alert levels
    alert_level weather_alert_level DEFAULT 'normal',
    waterlogging_risk BOOLEAN DEFAULT FALSE,
    heat_alert BOOLEAN DEFAULT FALSE,
    
    -- Traffic impact
    traffic_severity traffic_severity DEFAULT 'normal',
    avg_traffic_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    
    -- Delivery adjustments
    speed_limit_kmh INTEGER DEFAULT 60,
    eta_buffer_minutes INTEGER DEFAULT 0,
    surcharge_percent DECIMAL(5, 2) DEFAULT 0,
    
    -- Last update from weather API
    last_weather_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding weather zone by point
CREATE INDEX idx_weather_zones_boundary ON weather_zones USING GIST (boundary);

-- Index for zones with alerts
CREATE INDEX idx_weather_zones_alerts ON weather_zones (alert_level) 
    WHERE alert_level IN ('warning', 'severe');

-- Index for high rainfall zones
CREATE INDEX idx_weather_zones_rainfall ON weather_zones (rainfall_mm_hr) 
    WHERE rainfall_mm_hr > 5;

-- Function to find weather zone for a given location
CREATE OR REPLACE FUNCTION get_weather_zone_for_location(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS TABLE (
    zone_id VARCHAR,
    name VARCHAR,
    alert_level weather_alert_level,
    rainfall_mm_hr DECIMAL,
    traffic_severity traffic_severity,
    eta_buffer_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wz.zone_id::VARCHAR,
        wz.name::VARCHAR,
        wz.alert_level,
        wz.rainfall_mm_hr,
        wz.traffic_severity,
        wz.eta_buffer_minutes
    FROM weather_zones wz
    WHERE ST_Contains(
        wz.boundary, 
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY
    )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GPS TELEMETRY TABLE (Historical tracking)
-- ============================================================================

CREATE TABLE rider_gps_history (
    id BIGSERIAL PRIMARY KEY,
    rider_id VARCHAR(50) NOT NULL REFERENCES riders(rider_id),
    
    -- Location data
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- Telemetry data
    speed_kmh DECIMAL(5, 2),
    heading_degrees INTEGER,
    accuracy_meters DECIMAL(5, 2),
    battery_level DECIMAL(5, 2),
    
    -- Timestamp
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Order context (if on delivery)
    order_id VARCHAR(50) REFERENCES orders(order_id)
);

-- Partition by date for performance (example for one month)
-- In production, use declarative partitioning
CREATE INDEX idx_gps_history_rider_time ON rider_gps_history (rider_id, recorded_at DESC);
CREATE INDEX idx_gps_history_location ON rider_gps_history USING GIST (location);

-- ============================================================================
-- TRAFFIC BOTTLENECKS TABLE (Bengaluru-specific)
-- ============================================================================

CREATE TABLE traffic_bottlenecks (
    bottleneck_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Location
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    affected_radius_meters INTEGER DEFAULT 500,
    
    -- Traffic characteristics
    base_severity traffic_severity DEFAULT 'medium',
    peak_hour_multiplier DECIMAL(4, 2) DEFAULT 1.5,
    current_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    
    -- Peak hours (stored as JSON for flexibility)
    peak_hours JSONB DEFAULT '[{"start": "08:00", "end": "10:30"}, {"start": "17:30", "end": "21:00"}]'::jsonb,
    
    -- Road type
    road_type VARCHAR(50), -- flyover, service_road, main_road, underpass
    
    -- Active status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding nearby bottlenecks
CREATE INDEX idx_bottlenecks_location ON traffic_bottlenecks USING GIST (location);

-- Insert Bengaluru-specific bottlenecks
INSERT INTO traffic_bottlenecks (bottleneck_id, name, location, base_severity, peak_hour_multiplier, road_type) VALUES
('BN001', 'Silk Board Junction', ST_SetSRID(ST_MakePoint(77.6244, 12.9176), 4326)::GEOGRAPHY, 'high', 2.5, 'flyover'),
('BN002', 'ORR Bellandur', ST_SetSRID(ST_MakePoint(77.6168, 12.9352), 4326)::GEOGRAPHY, 'high', 2.2, 'main_road'),
('BN003', 'Marathahalli Bridge', ST_SetSRID(ST_MakePoint(77.6977, 12.9591), 4326)::GEOGRAPHY, 'medium', 1.8, 'flyover'),
('BN004', 'Hebbal Flyover', ST_SetSRID(ST_MakePoint(77.5970, 13.0350), 4326)::GEOGRAPHY, 'medium', 1.6, 'flyover'),
('BN005', 'MG Road Traffic', ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::GEOGRAPHY, 'low', 1.4, 'main_road')
ON CONFLICT (bottleneck_id) DO NOTHING;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Available riders near dark stores
CREATE VIEW v_available_riders_by_store AS
SELECT 
    ds.store_id,
    ds.name AS store_name,
    r.rider_id,
    r.name AS rider_name,
    r.vehicle_type,
    r.battery_level,
    r.current_deliveries,
    ST_Distance(ds.location, r.current_location) / 1000 AS distance_km,
    r.last_location_update
FROM dark_stores ds
CROSS JOIN LATERAL (
    SELECT * FROM riders
    WHERE home_store_id = ds.store_id
      AND status = 'available'
      AND is_accepting_orders = TRUE
    ORDER BY ds.location <-> current_location
    LIMIT 10
) r
WHERE ds.is_active = TRUE;

-- View: Active orders with ETA
CREATE VIEW v_active_orders_with_eta AS
SELECT 
    o.order_id,
    o.customer_name,
    o.dark_store_id,
    o.assigned_rider_id,
    o.status,
    o.promised_delivery_minutes,
    o.estimated_delivery_at,
    o.adjusted_eta_minutes,
    o.traffic_multiplier,
    o.weather_multiplier,
    CASE 
        WHEN o.estimated_delivery_at < CURRENT_TIMESTAMP THEN 'DELAYED'
        WHEN o.estimated_delivery_at < CURRENT_TIMESTAMP + INTERVAL '10 minutes' THEN 'AT_RISK'
        ELSE 'ON_TIME'
    END AS delivery_status,
    EXTRACT(EPOCH FROM (o.estimated_delivery_at - CURRENT_TIMESTAMP)) / 60 AS minutes_remaining
FROM orders o
WHERE o.status IN ('confirmed', 'preparing', 'picked_up', 'in_transit');

-- View: Weather-impacted zones
CREATE VIEW v_weather_impacted_zones AS
SELECT 
    zone_id,
    name,
    alert_level,
    rainfall_mm_hr,
    traffic_severity,
    speed_limit_kmh,
    eta_buffer_minutes,
    surcharge_percent,
    CASE 
        WHEN rainfall_mm_hr > 10 THEN 'HEAVY_RAIN'
        WHEN rainfall_mm_hr > 3 THEN 'MODERATE_RAIN'
        WHEN temperature_celsius > 40 THEN 'EXTREME_HEAT'
        ELSE 'NORMAL'
    END AS impact_type
FROM weather_zones
WHERE alert_level IN ('warning', 'severe')
   OR rainfall_mm_hr > 3
   OR temperature_celsius > 40;

-- ============================================================================
-- SAMPLE DATA FOR DEMO
-- ============================================================================

-- Insert sample dark stores in Bengaluru
INSERT INTO dark_stores (store_id, name, location, delivery_radius_km, is_active) VALUES
('DS001', 'Koramangala Hub', ST_SetSRID(ST_MakePoint(77.6245, 12.9352), 4326)::GEOGRAPHY, 3.0, TRUE),
('DS002', 'Indiranagar Hub', ST_SetSRID(ST_MakePoint(77.6412, 12.9716), 4326)::GEOGRAPHY, 2.5, TRUE),
('DS003', 'HSR Layout Hub', ST_SetSRID(ST_MakePoint(77.6476, 12.9081), 4326)::GEOGRAPHY, 3.5, TRUE),
('DS004', 'Whitefield Hub', ST_SetSRID(ST_MakePoint(77.7499, 12.9698), 4326)::GEOGRAPHY, 4.0, TRUE),
('DS005', 'BTM Layout Hub', ST_SetSRID(ST_MakePoint(77.6101, 12.9165), 4326)::GEOGRAPHY, 3.0, TRUE),
('DS006', 'Jayanagar Hub', ST_SetSRID(ST_MakePoint(77.5938, 12.9250), 4326)::GEOGRAPHY, 2.8, TRUE)
ON CONFLICT (store_id) DO NOTHING;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function: Calculate delivery radius based on time (isochrone)
CREATE OR REPLACE FUNCTION calculate_isochrone_radius(
    max_minutes INTEGER,
    avg_speed_kmh DECIMAL DEFAULT 40.0,
    prep_time_minutes INTEGER DEFAULT 5
)
RETURNS DECIMAL AS $$
DECLARE
    travel_time DECIMAL;
    radius_km DECIMAL;
BEGIN
    -- Available travel time after preparation
    travel_time := max_minutes - prep_time_minutes;
    
    -- Radius = (speed * time) / 2 (for round trip consideration)
    radius_km := (avg_speed_kmh * travel_time / 60.0) / 2.0;
    
    RETURN radius_km;
END;
$$ LANGUAGE plpgsql;

-- Function: Find nearest available rider to a location
CREATE OR REPLACE FUNCTION find_nearest_rider(
    target_lat DOUBLE PRECISION,
    target_lng DOUBLE PRECISION,
    max_distance_km DECIMAL DEFAULT 5.0
)
RETURNS TABLE (
    rider_id VARCHAR,
    rider_name VARCHAR,
    vehicle_type VARCHAR,
    distance_km DECIMAL,
    battery_level DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.rider_id::VARCHAR,
        r.name::VARCHAR,
        r.vehicle_type::VARCHAR,
        (ST_Distance(
            r.current_location,
            ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::GEOGRAPHY
        ) / 1000)::DECIMAL AS distance_km,
        r.battery_level
    FROM riders r
    WHERE r.status = 'available'
      AND r.is_accepting_orders = TRUE
      AND ST_DWithin(
          r.current_location,
          ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::GEOGRAPHY,
          max_distance_km * 1000
      )
    ORDER BY r.current_location <-> ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::GEOGRAPHY
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO logistics_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO logistics_app;
