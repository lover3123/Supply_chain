import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useStore } from '../store/useStore';
import { DARK_STORE_LOCATIONS, TRAFFIC_ZONES, FLEET_TYPES } from '../data/mockData';

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];
const BENGALURU_BOUNDS: L.LatLngBoundsExpression = [
  [12.8300, 77.4500],
  [13.1200, 77.8000]
];

interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  alertLevel: 'normal' | 'warning' | 'severe';
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => { map.setView(center, zoom); }, [map, center, zoom]);
  return null;
}

function DarkStoreGeofence({ store }: { store: any }) {
  const setSelectedEntity = useStore(state => state.setSelectedEntity);
  return (
    <>
      <CircleMarker center={[store.lat, store.lng]} radius={store.radius / 500} pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.15, weight: 2, dashArray: '5,5' }} />
      <Marker position={[store.lat, store.lng]} icon={L.divIcon({ className: 'dark-store-marker', html: `<div style="width:24px;height:24px;background-color:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="color:white;font-weight:bold;font-size:14px;">🏪</span></div>`, iconSize: [24, 24], iconAnchor: [12, 12] })} eventHandlers={{ click: () => setSelectedEntity({ type: 'darkstore', id: store.id }) }}>
        <Popup><div className="p-2"><h3 className="font-bold text-sm">{store.name}</h3><p className="text-xs text-gray-600">Radius: {store.radius / 1000}km</p><p className="text-xs"><strong>Riders:</strong> {store.activeRiders}</p></div></Popup>
      </Marker>
    </>
  );
}

function TrafficZoneMarker({ zone, trafficState }: { zone: any; trafficState?: any }) {
  const severityColor = trafficState ? `rgb(${Math.floor(trafficState.congestionLevel * 255)}, ${Math.floor((1 - trafficState.congestionLevel) * 255)}, 0)` : (zone.severity === 'high' ? '#ef4444' : zone.severity === 'medium' ? '#f97316' : '#eab308');
  return (
    <CircleMarker key={zone.name} center={[zone.lat, zone.lng]} radius={8 + (trafficState?.congestionLevel || 0) * 5} pathOptions={{ color: severityColor, fillColor: severityColor, fillOpacity: 0.6, weight: 2 }}>
      <Popup><div className="p-2"><h3 className="font-bold text-sm">{zone.name}</h3><p className="text-xs" style={{ color: severityColor }}><strong>Congestion:</strong> {((trafficState?.congestionLevel || 0) * 100).toFixed(0)}%</p><p className="text-xs"><strong>Speed:</strong> {trafficState?.avgSpeed || 20} km/h</p></div></Popup>
    </CircleMarker>
  );
}

function WeatherWidget({ weather }: { weather: WeatherData | null }) {
  if (!weather) return null;
  const alertColors = { normal: 'bg-green-500', warning: 'bg-yellow-500', severe: 'bg-red-500' };
  return (
    <div className={`${alertColors[weather.alertLevel]} backdrop-blur-md rounded-lg p-3 text-white text-xs shadow-lg`} style={{ position: 'fixed', top: '12px', left: '12px', zIndex: 10000, minWidth: '200px', pointerEvents: 'auto' }}>
      <div className="font-bold mb-2 flex items-center gap-2"><span>🌤️</span> Bengaluru Weather</div>
      <div className="grid grid-cols-2 gap-2">
        <div><div className="opacity-80">Temperature</div><div className="font-bold">{Math.round(weather.temperature)}°C</div></div>
        <div><div className="opacity-80">Rainfall</div><div className="font-bold">{weather.rainfall.toFixed(1)} mm/hr</div></div>
        <div><div className="opacity-80">Humidity</div><div className="font-bold">{weather.humidity}%</div></div>
        <div><div className="opacity-80">Wind</div><div className="font-bold">{weather.windSpeed} km/h</div></div>
      </div>
      {weather.alertLevel !== 'normal' && <div className="mt-2 pt-2 border-t border-white/30"><div className="font-bold">⚠️ {weather.alertLevel === 'severe' ? 'HEAVY RAIN ALERT' : 'WEATHER ADVISORY'}</div></div>}
    </div>
  );
}

export default function ControlTowerMap() {
  const shipmentsMap = useStore(state => state.shipments);
  const riders = useStore(state => state.riders);
  const weather = useStore(state => state.weather) as any;
  const trafficStates = useStore(state => state.trafficStates);
  const darkStores = useStore(state => state.darkStores);
  const setSelectedEntity = useStore(state => state.setSelectedEntity);
  const selectedEntity = useStore(state => state.selectedEntity);
  const shipments = Object.values(shipmentsMap);

  const routePaths = useMemo(() => shipments.flatMap(s => {
    if (!s.route || s.route.length === 0) return [];
    const score = s.anomaly_score || 0;
    const color = score > 0.7 ? '#ef4444' : score > 0.4 ? '#f97316' : '#22c55e';
    const positions: [number, number][] = [[s.location.lat, s.location.lng]];
    s.route.forEach(seg => { if (seg.end_location) positions.push([seg.end_location.lat, seg.end_location.lng]); });
    if (positions.length < 2) return [];
    return [<Polyline key={`${s.shipment_id}-route`} positions={positions} color={color} weight={4} opacity={0.8} dashArray="5,5" />];
  }), [shipments]);

  const riderMarkers = useMemo(() => riders.map(rider => {
    const vehicleInfo = FLEET_TYPES[rider.vehicleType as keyof typeof FLEET_TYPES];
    const isBusy = rider.status === 'busy';
    const color = isBusy ? '#f97316' : rider.status === 'available' ? '#22c55e' : '#6b7280';
    const icon = L.divIcon({ className: 'rider-marker', html: `<div style="width:${isBusy?18:14}px;height:${isBusy?18:14}px;background-color:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="color:white;font-size:10px;">${vehicleInfo?.icon||'🛵'}</span></div>`, iconSize: [isBusy?18:14, isBusy?18:14], iconAnchor: [isBusy?9:7, isBusy?9:7] });
    return (
      <Marker key={rider.id} position={[rider.currentLocation.lat, rider.currentLocation.lng]} icon={icon} eventHandlers={{ click: () => setSelectedEntity({ type: 'rider', id: rider.id }) }}>
        <Popup><div className="p-2 min-w-[180px]"><h3 className="font-bold text-sm">👤 {rider.name}</h3><p className="text-xs text-gray-600">{rider.id}</p><div className="mt-2 space-y-1"><p className="text-xs"><strong>Status:</strong> {rider.status.toUpperCase()}</p><p className="text-xs"><strong>Vehicle:</strong> {vehicleInfo?.type||'Two-Wheeler'}</p><p className="text-xs"><strong>Rating:</strong> ⭐ {rider.rating}</p><p className="text-xs"><strong>Deliveries:</strong> {rider.deliveriesToday}</p></div></div></Popup>
      </Marker>
    );
  }), [riders, setSelectedEntity]);

  const shipmentMarkers = useMemo(() => shipments.map(s => {
    const isHighRisk = (s.anomaly_score || 0) > 0.8;
    const color = isHighRisk ? '#ef4444' : (s.anomaly_score || 0) > 0.4 ? '#f97316' : '#22c55e';
    const icon = L.divIcon({ className: 'shipment-marker', html: `<div style="width:${isHighRisk?20:14}px;height:${isHighRisk?20:14}px;background-color:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`, iconSize: [isHighRisk?20:14, isHighRisk?20:14], iconAnchor: [isHighRisk?10:7, isHighRisk?10:7] });
    return (
      <Marker key={s.shipment_id} position={[s.location.lat, s.location.lng]} icon={icon}>
        <Popup><div className="p-2 min-w-[180px]"><h3 className="font-bold text-sm">📦 {s.shipment_id.slice(0,12)}</h3><p className="text-xs text-gray-600">{s.location.name||'On Route'}</p><div className="mt-2 space-y-1"><p className="text-xs"><strong>Status:</strong> {s.current_state.status}</p><p className="text-xs"><strong>Speed:</strong> {s.current_state.velocity_kmh} km/h</p><p className="text-xs"><strong>ETA:</strong> {s.current_state.eta_deviation_minutes > 0 ? '+' : ''}{s.current_state.eta_deviation_minutes} min</p></div></div></Popup>
      </Marker>
    );
  }), [shipments]);

  const trafficMarkers = useMemo(() => TRAFFIC_ZONES.map(zone => {
    const ts = trafficStates.find(t => t.zoneId === zone.id);
    return <TrafficZoneMarker key={zone.id} zone={zone} trafficState={ts} />;
  }), [trafficStates]);

  const darkStoreMarkers = useMemo(() => (darkStores.length > 0 ? darkStores : DARK_STORE_LOCATIONS).map(store => <DarkStoreGeofence key={store.id} store={store} />), [darkStores]);

  return (
    <>
      <WeatherWidget weather={weather} />
      {selectedEntity && (
        <div className="absolute top-4 right-4 z-[1001] bg-slate-800/95 backdrop-blur-md rounded-lg p-4 text-white shadow-xl max-w-sm">
          <div className="flex justify-between items-center mb-3"><h3 className="font-bold">{selectedEntity.type === 'rider' ? '👤 Rider' : selectedEntity.type === 'darkstore' ? '🏪 Dark Store' : 'Details'}</h3><button onClick={() => setSelectedEntity(null)} className="text-gray-400 hover:text-white">✕</button></div>
          <p className="text-sm text-gray-400">ID: {selectedEntity.id}</p>
        </div>
      )}
      <MapContainer center={BENGALURU_CENTER} zoom={12} minZoom={10} maxZoom={18} bounds={BENGALURU_BOUNDS} className="w-full h-full" scrollWheelZoom={true} doubleClickZoom={true} dragging={true} zoomControl={false}>
        <MapUpdater center={BENGALURU_CENTER} zoom={12} />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Mode"><TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" /></LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Streets"><TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite"><TileLayer attribution='Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer>
        </LayersControl>
        {darkStoreMarkers}{trafficMarkers}{routePaths}{riderMarkers}{shipmentMarkers}
        <div className="leaflet-control-zoom leaflet-bar leaflet-control bg-white rounded-lg shadow-lg overflow-hidden" style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000 }}>
          <button className="block w-10 h-10 text-xl font-bold text-gray-700 hover:bg-gray-100" title="Zoom In">+</button>
          <div className="border-t border-gray-300"></div>
          <button className="block w-10 h-10 text-xl font-bold text-gray-700 hover:bg-gray-100" title="Zoom Out">−</button>
        </div>
        <div className="bg-slate-800/95 backdrop-blur-md rounded-lg p-3 text-xs text-white shadow-xl" style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, minWidth: '160px' }}>
          <div className="font-semibold mb-2 border-b border-gray-600 pb-1">📍 Legend</div>
          <div className="font-semibold mt-2 mb-1 text-green-400">Dark Stores</div>
          <div className="flex items-center gap-2 mb-1"><div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-[8px]">🏪</div><span>Hub</span></div>
          <div className="font-semibold mt-2 mb-1 text-blue-400">Riders</div>
          <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div><span>Available</span></div>
          <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white"></div><span>Busy</span></div>
          <div className="font-semibold mt-2 mb-1 text-purple-400">Shipments</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span>On Time</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span>Delayed</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span>High Risk</span></div>
        </div>
      </MapContainer>
    </>
  );
}