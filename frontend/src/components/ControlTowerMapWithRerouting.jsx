import React, { useMemo, useState } from 'react';
import { Circle, CircleMarker, GeoJSON, MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { riskColor, evaluateReroute } from '../services/PredictiveRoutingEngine';
import { DARK_STORE_LOCATIONS, TRAFFIC_ZONES } from '../data/mockData';
import { useStore } from '../store/useStore';

const CENTER = [12.9716, 77.5946];
const FALLBACK_CURRENT_ROUTE = [[12.9176, 77.6244], [12.9352, 77.6168], [12.9591, 77.6977], [12.9698, 77.7499]];
const FALLBACK_ALTERNATIVE_ROUTE = [[12.9176, 77.6244], [12.9081, 77.6476], [12.932, 77.685], [12.9698, 77.7499]];
const CORRIDOR_COORDINATES = { 'Outer Ring Road': [12.9352, 77.6168], 'Silk Board': [12.9176, 77.6244], 'Hebbal Flyover': [13.035, 77.597] };

function MapViewReset() {
  const map = useMap();
  React.useEffect(() => { map.setView(CENTER, 12); }, [map]);
  return null;
}

const storeIcon = (label) => L.divIcon({ className: 'tower-marker', html: `<div class="hub-marker"><span class="hub-marker__pulse"></span><span class="hub-marker__core">▣</span></div><span class="tower-label">${label}</span>`, iconSize: [108, 32], iconAnchor: [12, 12] });
const riderIcon = (speed) => L.divIcon({ className: 'tower-marker', html: `<div class="rider-marker"><span class="rider-marker__arrow">➤</span></div><span class="speed-badge">${Math.round(speed)} km/h</span>`, iconSize: [96, 30], iconAnchor: [10, 10] });
const hazardIcon = L.divIcon({ className: 'tower-marker', html: '<span class="hazard-callout">⚠ Bellandur Waterlogging Risk</span>', iconSize: [180, 30], iconAnchor: [20, 28] });

export default function ControlTowerMapWithRerouting({ onOpenApproval, evaluation: suppliedEvaluation, routeEvaluation, isochrones }) {
  const simulation = useStore(state => state.simulation);
  const setActiveReroute = useStore(state => state.setActiveReroute);
  const [showAlternative, setShowAlternative] = useState(true);
  const baselineSegments = useMemo(() => [{ id: 'orr', lengthKm: 3.2, predictedSpeedKmh: simulation.gridlockedCorridors.length ? 8 : 24, baselineSpeedKmh: 32, weatherSeverityMmHr: simulation.rainfallMmHr, riskIndex: simulation.gridlockedCorridors.length ? 0.92 : 0.58 }], [simulation]);
  const proposedSegments = useMemo(() => [{ id: 'hsr', lengthKm: 4.1, predictedSpeedKmh: 28, baselineSpeedKmh: 32, weatherSeverityMmHr: simulation.rainfallMmHr * 0.4, riskIndex: 0.24 }], [simulation]);
  const computedEvaluation = useMemo(() => evaluateReroute(baselineSegments, proposedSegments, simulation.gridlockedCorridors.length ? 185 : 92), [baselineSegments, proposedSegments, simulation]);
  const evaluation = suppliedEvaluation ?? computedEvaluation;
  const routeRisk = routeEvaluation?.riskIndex ?? Math.min(1, 0.35 + simulation.rainfallMmHr / 70 + simulation.gridlockedCorridors.length * 0.22);
  const routeColor = riskColor(routeRisk, simulation.rainfallMmHr, simulation.gridlockedCorridors.length > 0);
  const isFallback = routeEvaluation?.provider === 'demo-fallback';

  React.useEffect(() => {
    if (evaluation.shouldEvaluate) setActiveReroute({ shipmentId: routeEvaluation?.shipmentId ?? 'BLR-QC-1042', status: 'pending' });
  }, [evaluation.shouldEvaluate, routeEvaluation?.shipmentId, setActiveReroute]);

  return <MapContainer center={CENTER} zoom={12} minZoom={10} maxZoom={18} className="h-full w-full" zoomControl={false}>
    <MapViewReset />
    <TileLayer attribution="© OpenStreetMap © CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
    {DARK_STORE_LOCATIONS.map(store => <React.Fragment key={store.id}>
      {isochrones?.[store.id] ? <GeoJSON data={isochrones[store.id]} style={{ color: '#35d39a', fillColor: '#35d39a', fillOpacity: 0.08, weight: 1.5, dashArray: '4 4' }} /> : <Circle center={[store.lat, store.lng]} radius={store.radius} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.04, weight: 1, dashArray: '4 4' }} />}
      <Marker position={[store.lat, store.lng]} icon={storeIcon(store.name.replace(' Hub', ''))}><Popup><strong>{store.name}</strong><br />{store.activeRiders} active riders<br /><span className="text-xs">10-minute road coverage</span></Popup></Marker>
    </React.Fragment>)}
    {TRAFFIC_ZONES.map(zone => { const active = simulation.gridlockedCorridors.some(item => zone.name.toLowerCase().includes(item.toLowerCase().split(' ')[0])); const color = active ? '#f0445a' : riskColor(zone.severity === 'high' ? 0.8 : 0.55, simulation.rainfallMmHr); return <CircleMarker key={zone.id} center={[zone.lat, zone.lng]} radius={active ? 15 : 9} pathOptions={{ color, fillColor: color, fillOpacity: 0.72, weight: 2 }}><Popup><strong>{zone.name}</strong><br />{active ? 'GRIDLOCK INJECTED' : 'Predictive congestion'}</Popup></CircleMarker>; })}
    {Object.entries(CORRIDOR_COORDINATES).map(([name, position]) => simulation.gridlockedCorridors.includes(name) ? <CircleMarker key={name} center={position} radius={31} pathOptions={{ color: '#f0445a', fillColor: '#f0445a', fillOpacity: 0.18, weight: 3, className: 'corridor-glow' }} /> : null)}
    {routeEvaluation?.currentRoute ? <GeoJSON data={routeEvaluation.currentRoute} style={{ color: routeColor, weight: 7, opacity: 0.95 }} /> : <Polyline positions={FALLBACK_CURRENT_ROUTE} color={routeColor} weight={6} opacity={0.9} />}
    {showAlternative ? routeEvaluation?.proposedRoute ? <GeoJSON data={routeEvaluation.proposedRoute} style={{ color: '#35d39a', weight: 5, opacity: 0.95, dashArray: '9 8' }} /> : <Polyline positions={FALLBACK_ALTERNATIVE_ROUTE} color="#35d39a" weight={5} opacity={0.9} dashArray="9 8" /> : null}
    <Marker position={[12.9352, 77.6168]} icon={hazardIcon} />
    <Marker position={[12.9352, 77.6168]} icon={riderIcon(simulation.gridlockedCorridors.length ? 8 : 24)}><Popup><strong>Rider R-1042</strong><br />Speed: {simulation.gridlockedCorridors.length ? 8 : 24} km/h<br />Route status: {evaluation.mode === 'hitl' ? 'Approval required' : 'Auto-execute'}</Popup></Marker>
    <div className="pointer-events-auto absolute bottom-5 left-5 z-[1000] rounded-xl border border-slate-700/90 bg-slate-900/90 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur-md"><div className="mb-2 font-bold uppercase tracking-widest text-slate-200">Route layers</div><button onClick={() => setShowAlternative(value => !value)} className="flex items-center gap-2 font-medium text-slate-100 hover:text-white"><span className="h-1 w-6 rounded bg-rose-400" /> Disrupted path (current)</button><button onClick={() => setShowAlternative(value => !value)} className="mt-2 flex items-center gap-2 font-medium text-slate-100 hover:text-white"><span className="h-1 w-6 rounded border-t-2 border-dashed border-emerald-300" /> {showAlternative ? 'Dynamic reroute (proposed)' : 'Show dynamic reroute'}</button>{isFallback ? <p className="mt-2 max-w-48 text-[10px] text-amber-200">Preview geometry — add ORS_API_KEY for road-snapped routes.</p> : <p className="mt-2 text-[10px] text-emerald-200">Road geometry: OpenRouteService</p>}</div>
    <div className="pointer-events-auto absolute right-5 top-5 z-[1000] w-56 rounded-xl border border-slate-800/80 bg-slate-900/90 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur-md"><div className="flex justify-between"><span className="font-medium text-slate-200">Predicted route cost</span><span className="font-bold text-white">{Math.round(evaluation.baseline.totalCostMinutes)}m</span></div><div className="mt-2 flex justify-between"><span className="font-medium text-slate-200">SLA buffer</span><span className={evaluation.shouldEvaluate ? 'font-bold text-rose-200' : 'font-bold text-emerald-200'}>{evaluation.shouldEvaluate ? `-${evaluation.deltaEtaMinutes}m` : 'Protected'}</span></div>{evaluation.shouldEvaluate ? <button onClick={onOpenApproval} className="mt-3 w-full rounded-lg bg-rose-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-rose-300">Review reroute</button> : null}</div>
  </MapContainer>;
}
