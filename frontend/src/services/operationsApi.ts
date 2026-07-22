const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...init?.headers }, ...init });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export interface RouteEvaluationResponse {
  shipmentId: string;
  currentRoute: GeoJSON.Feature<GeoJSON.LineString>;
  proposedRoute: GeoJSON.Feature<GeoJSON.LineString>;
  riskIndex: number;
  delayMinutes: number;
  surchargeInr: number;
  decisionMode: 'auto-execute' | 'hitl';
  provider: string;
  surchargeBreakdown: { extraDistanceFuel: number; rainSurge: number };
}

export const operationsApi = {
  status: () => request<{ provider: string; darkStores: unknown[] }>('/api/v1/operations/status'),
  evaluateRoute: (orderId = 'BLR-QC-1042') => request<RouteEvaluationResponse>(`/api/v1/routes/evaluate/${orderId}`),
  isochrone: (storeId: string) => request<GeoJSON.FeatureCollection>(`/api/v1/dark-stores/${storeId}/isochrone?minutes=10`),
  updateSimulation: (simulation: { rainfallMmHr: number; sector: string; gridlockedCorridors: string[] }) => request('/api/v1/simulations/disruption', { method: 'POST', body: JSON.stringify({ rainfall_mm_hr: simulation.rainfallMmHr, sector: simulation.sector, gridlocked_corridors: simulation.gridlockedCorridors }) }),
  recordDecision: (shipmentId: string, decision: string) => request('/api/v1/reroutes/decision', { method: 'POST', body: JSON.stringify({ shipment_id: shipmentId, decision: decision === 'backup' ? 'backup_store_assigned' : decision, operator_id: 'demo-dispatcher' }) }),
};
