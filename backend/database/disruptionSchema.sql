-- Preemptive Disruption Detection & Dynamic Rerouting Module
-- Run after backend/database/schema.sql on PostgreSQL 15 + PostGIS 3.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS weather_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name TEXT NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326) NOT NULL,
  rainfall_mm_hr NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (rainfall_mm_hr >= 0),
  severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('normal', 'warning', 'severe')),
  waterlogging_risk NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (waterlogging_risk BETWEEN 0 AND 1),
  speed_multiplier NUMERIC(5,3) NOT NULL DEFAULT 1 CHECK (speed_multiplier BETWEEN 0.1 AND 1),
  coverage_multiplier NUMERIC(5,3) NOT NULL DEFAULT 1 CHECK (coverage_multiplier BETWEEN 0.1 AND 1),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS weather_zones_boundary_gix ON weather_zones USING GIST (boundary);
CREATE INDEX IF NOT EXISTS weather_zones_active_idx ON weather_zones (expires_at, severity);

CREATE TABLE IF NOT EXISTS risk_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name TEXT NOT NULL,
  corridor TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  risk_index NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (risk_index BETWEEN 0 AND 1),
  predicted_speed_kmh NUMERIC(6,2),
  risk_type TEXT NOT NULL CHECK (risk_type IN ('congestion', 'waterlogging', 'roadwork', 'incident')),
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS risk_nodes_location_gix ON risk_nodes USING GIST (location);
CREATE INDEX IF NOT EXISTS risk_nodes_active_idx ON risk_nodes (active_until, risk_index DESC);

CREATE TABLE IF NOT EXISTS reroute_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id TEXT NOT NULL,
  rider_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('evaluated', 'auto_executed', 'approved', 'overridden', 'backup_store_assigned')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  predicted_delta_eta_minutes NUMERIC(8,2) NOT NULL,
  original_route GEOGRAPHY(LINESTRING, 4326),
  proposed_route GEOGRAPHY(LINESTRING, 4326),
  original_cost_minutes NUMERIC(8,2),
  proposed_cost_minutes NUMERIC(8,2),
  extra_distance_km NUMERIC(8,2),
  surcharge_cost_inr NUMERIC(10,2) NOT NULL DEFAULT 0,
  simulation_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  operator_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reroute_event_logs_shipment_idx ON reroute_event_logs (shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reroute_event_logs_created_idx ON reroute_event_logs (created_at DESC);

-- Active nodes influencing a route, ranked for W(e,t) aggregation in the routing service.
CREATE OR REPLACE FUNCTION get_route_risk_nodes(route GEOGRAPHY(LINESTRING, 4326), radius_m INTEGER DEFAULT 250)
RETURNS TABLE (node_id UUID, node_name TEXT, risk_index NUMERIC, predicted_speed_kmh NUMERIC, corridor TEXT)
LANGUAGE sql STABLE AS $$
  SELECT rn.id, rn.node_name, rn.risk_index, rn.predicted_speed_kmh, rn.corridor
  FROM risk_nodes rn
  WHERE rn.active_from <= now()
    AND (rn.active_until IS NULL OR rn.active_until > now())
    AND ST_DWithin(rn.location, route, radius_m)
  ORDER BY rn.risk_index DESC;
$$;

-- A simulator update changes operational multipliers without mutating zone geometry.
CREATE OR REPLACE FUNCTION apply_weather_simulation(zone_id UUID, rain NUMERIC, alert_severity TEXT)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE weather_zones
  SET rainfall_mm_hr = rain,
      severity = alert_severity,
      speed_multiplier = GREATEST(0.35, 1 - (rain / 100)),
      coverage_multiplier = GREATEST(0.45, 1 - (rain / 90)),
      observed_at = now()
  WHERE id = zone_id;
$$;

-- Bengaluru bootstrap risk nodes used by the live map and routing service.
INSERT INTO risk_nodes (node_name, corridor, location, risk_index, predicted_speed_kmh, risk_type, source)
VALUES
  ('Silk Board Junction', 'Silk Board', ST_SetSRID(ST_MakePoint(77.6244, 12.9176), 4326)::geography, 0.82, 9, 'congestion', 'bootstrap'),
  ('Bellandur ORR Underpass', 'Outer Ring Road', ST_SetSRID(ST_MakePoint(77.6168, 12.9352), 4326)::geography, 0.88, 11, 'waterlogging', 'bootstrap'),
  ('Marathahalli Bridge', 'Outer Ring Road', ST_SetSRID(ST_MakePoint(77.6977, 12.9591), 4326)::geography, 0.62, 18, 'congestion', 'bootstrap'),
  ('Hebbal Flyover', 'Hebbal Flyover', ST_SetSRID(ST_MakePoint(77.5970, 13.0350), 4326)::geography, 0.55, 22, 'congestion', 'bootstrap')
ON CONFLICT DO NOTHING;
