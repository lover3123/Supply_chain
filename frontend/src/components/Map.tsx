import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useStore } from '../store/useStore';

// Karnataka coordinates and bounds
const KARNATAKA_CENTER: [number, number] = [15.3173, 75.7139];
const KARNATAKA_BOUNDS: L.LatLngBoundsExpression = [
  [11.0, 74.0], // Southwest corner
  [18.0, 78.0]  // Northeast corner
];

// Helper component to update map view when needed
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export default function AppMap() {
  const shipmentsMap = useStore(state => state.shipments);
  const shipments = Object.values(shipmentsMap);

  // Calculate route paths for polylines
  const routePaths = useMemo(() => {
    return shipments.flatMap((shipment) => {
      if (!shipment.route || shipment.route.length === 0) return [];
      
      const isHighRisk = (shipment.anomaly_score || 0) > 0.8;
      const color = isHighRisk ? '#ef4444' : '#3b82f6';
      const dashArray = shipment.mode === 'road' ? '5,5' : shipment.mode === 'air' ? '2,2' : '10,5';
      
      // Build array of lat/lng points for the route
      const positions: [number, number][] = [];
      
      // Add start point
      if (shipment.location?.lng && shipment.location?.lat) {
        positions.push([shipment.location.lat, shipment.location.lng]);
      }
      
      // Add route segment endpoints
      shipment.route.forEach(segment => {
        if (segment.end_location?.lng && segment.end_location?.lat) {
          positions.push([segment.end_location.lat, segment.end_location.lng]);
        }
      });
      
      if (positions.length < 2) return [];
      
      return [
        <Polyline
          key={`${shipment.shipment_id}-route`}
          positions={positions}
          color={color}
          weight={3}
          opacity={0.7}
          dashArray={dashArray}
        />
      ];
    });
  }, [shipments]);

  const markers = useMemo(() => {
    return shipments.map(shipment => {
      const isHighRisk = (shipment.anomaly_score || 0) > 0.8;
      const isWarning = (shipment.anomaly_score || 0) > 0.4;
      const color = isHighRisk ? '#ef4444' : isWarning ? '#eab308' : '#22c55e';
      
      // Create custom colored marker icon
      const coloredIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: ${isHighRisk ? '16px' : '10px'};
          height: ${isHighRisk ? '16px' : '10px'};
          background-color: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [isHighRisk ? 16 : 10, isHighRisk ? 16 : 10],
        iconAnchor: [isHighRisk ? 8 : 5, isHighRisk ? 8 : 5],
      });
      
      return (
        <Marker
          key={shipment.shipment_id}
          position={[shipment.location.lat, shipment.location.lng]}
          icon={coloredIcon}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold text-sm">{shipment.shipment_id.slice(0, 8)}</h3>
              <p className="text-xs text-gray-600">{shipment.location.name || 'Unknown Location'}</p>
              <p className="text-xs mt-1"><strong>Status:</strong> {shipment.current_state.status}</p>
              <p className="text-xs"><strong>Mode:</strong> {shipment.mode}</p>
              <p className="text-xs"><strong>Velocity:</strong> {shipment.current_state.velocity_kmh} km/h</p>
              {(shipment.anomaly_score || 0) > 0 && (
                <p className="text-xs mt-1"><strong>Risk Score:</strong> {(shipment.anomaly_score || 0).toFixed(2)}</p>
              )}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [shipments]);

  return (
    <MapContainer
      center={KARNATAKA_CENTER}
      zoom={8}
      minZoom={6}
      maxZoom={18}
      bounds={KARNATAKA_BOUNDS}
      className="w-full h-full"
      scrollWheelZoom={true}
      doubleClickZoom={true}
      dragging={true}
      zoomControl={false}
    >
      <MapUpdater center={KARNATAKA_CENTER} zoom={8} />
      
      {/* OpenStreetMap tiles - real roads and paths */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Route paths */}
      {routePaths}
      
      {/* Shipment markers */}
      {markers}
      
      {/* Zoom controls */}
      <div className="leaflet-control-zoom leaflet-bar leaflet-control" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
        <button
          className="leaflet-control-zoom-in"
          style={{
            backgroundColor: 'white',
            border: '2px solid rgba(0,0,0,0.2)',
            borderBottom: 'none',
            borderRadius: '4px 4px 0 0',
            padding: '5px 10px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'block',
            width: '100%',
          }}
          title="Zoom In"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          +
        </button>
        <button
          className="leaflet-control-zoom-out"
          style={{
            backgroundColor: 'white',
            border: '2px solid rgba(0,0,0,0.2)',
            borderRadius: '0 0 4px 4px',
            padding: '5px 10px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'block',
            width: '100%',
          }}
          title="Zoom Out"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          −
        </button>
      </div>
      
      {/* Legend */}
      <div 
        className="bg-slate-800/90 backdrop-blur-md rounded-lg p-3 text-xs text-white"
        style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000 }}
      >
        <div className="font-semibold mb-2">Status</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white"></div>
          <span>Warning</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full bg-red-500 border border-white"></div>
          <span>High Risk</span>
        </div>
        <div className="font-semibold mb-2">Transport Mode</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-0.5 bg-blue-500"></div>
          <span>Ocean</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-0.5 bg-blue-500" style={{borderBottom: '2px dashed #3b82f6'}}></div>
          <span>Air</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-blue-500" style={{borderBottom: '2px dotted #3b82f6'}}></div>
          <span>Road</span>
        </div>
      </div>
    </MapContainer>
  );
}
