import React, { useEffect, useMemo, useState } from 'react';
import ControlTowerMapWithRerouting from './components/ControlTowerMapWithRerouting';
import Dashboard from './components/Dashboard';
import HITLApprovalModal from './components/HITLApprovalModal';
import { SimulationPanel } from './components/DisruptionPanels';
import { useStore } from './store/useStore';
import { DARK_STORE_LOCATIONS, MOCK_RIDERS, MOCK_TRAFFIC_STATES, MOCK_WEATHER } from './data/mockData';
import { evaluateReroute } from './services/PredictiveRoutingEngine';
import { operationsApi, type RouteEvaluationResponse } from './services/operationsApi';

function App() {
  const updateShipments = useStore(state => state.updateShipments);
  const setRiders = useStore(state => state.setRiders);
  const setTrafficStates = useStore(state => state.setTrafficStates);
  const setDarkStores = useStore(state => state.setDarkStores);
  const setWeather = useStore(state => state.setWeather);
  const simulation = useStore(state => state.simulation);
  const activeReroute = useStore(state => state.activeReroute);
  const setActiveReroute = useStore(state => state.setActiveReroute);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [routeEvaluation, setRouteEvaluation] = useState<RouteEvaluationResponse | null>(null);
  const [isochrones, setIsochrones] = useState<Record<string, GeoJSON.FeatureCollection>>({});

  const evaluation = useMemo(() => {
    const isGridlocked = simulation.gridlockedCorridors.length > 0;
    return evaluateReroute(
      [{ id: 'orr-bellandur', lengthKm: 8.4, predictedSpeedKmh: isGridlocked ? 8 : 24, baselineSpeedKmh: 32, weatherSeverityMmHr: simulation.rainfallMmHr, riskIndex: isGridlocked ? 0.92 : 0.58, corridor: 'Outer Ring Road' }],
      [{ id: 'hsr-sarjapur', lengthKm: 9.9, predictedSpeedKmh: 28, baselineSpeedKmh: 32, weatherSeverityMmHr: simulation.rainfallMmHr * 0.4, riskIndex: 0.24, corridor: 'Sarjapur Road' }],
      isGridlocked ? 185 : 92,
    );
  }, [simulation]);

  const displayedEvaluation = useMemo(() => {
    if (!routeEvaluation) return evaluation;
    const riskLevel = routeEvaluation.riskIndex >= 0.75 ? 'high' : routeEvaluation.riskIndex >= 0.45 ? 'medium' : 'low';
    return {
      ...evaluation,
      deltaEtaMinutes: Math.round(routeEvaluation.delayMinutes),
      surchargeCostInr: routeEvaluation.surchargeInr,
      riskLevel,
      mode: routeEvaluation.decisionMode,
      shouldEvaluate: routeEvaluation.delayMinutes > 10,
      surchargeBreakdown: routeEvaluation.surchargeBreakdown,
      reasons: routeEvaluation.decisionMode === 'hitl' ? ['Backend route evaluation requires dispatcher authorization.'] : ['Backend route evaluation is safe for automatic execution.'],
    };
  }, [evaluation, routeEvaluation]);

  useEffect(() => {
    setRiders(MOCK_RIDERS);
    setTrafficStates(MOCK_TRAFFIC_STATES);
    setDarkStores(DARK_STORE_LOCATIONS);
    setWeather(MOCK_WEATHER);
  }, [setRiders, setTrafficStates, setDarkStores, setWeather]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/live-tracking');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          updateShipments(data);
        }
      } catch (error) {
        console.error('Error parsing websocket message:', error);
      }
    };

    ws.onopen = () => console.log('WebSocket connected');
    ws.onclose = () => console.log('WebSocket disconnected');
    ws.onerror = (error) => console.error('WebSocket error:', error);

    return () => {
      ws.close();
    };
  }, [updateShipments]);

  useEffect(() => {
    let active = true;
    const refreshOperationalMap = async () => {
      try {
        const [latestRoute, ...coverage] = await Promise.all([
          operationsApi.evaluateRoute(),
          ...DARK_STORE_LOCATIONS.map(store => operationsApi.isochrone(store.id)),
        ]);
        if (!active) return;
        setRouteEvaluation(latestRoute);
        setIsochrones(Object.fromEntries(DARK_STORE_LOCATIONS.map((store, index) => [store.id, coverage[index]])));
      } catch (error) {
        console.warn('Operational routing API unavailable; displaying the local preview.', error);
      }
    };
    void refreshOperationalMap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void operationsApi.updateSimulation(simulation)
        .then(() => operationsApi.evaluateRoute())
        .then(setRouteEvaluation)
        .catch(error => console.warn('Simulation backend unavailable.', error));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [simulation]);

  useEffect(() => {
    if (displayedEvaluation.shouldEvaluate && displayedEvaluation.mode === 'hitl' && !activeReroute) {
      setActiveReroute({ shipmentId: 'BLR-QC-1042', status: 'pending' });
    }
  }, [activeReroute, displayedEvaluation.mode, displayedEvaluation.shouldEvaluate, setActiveReroute]);

  const handleDecision = async (status: 'approved' | 'overridden' | 'backup') => {
    try {
      await operationsApi.recordDecision(activeReroute?.shipmentId ?? 'BLR-QC-1042', status);
    } catch (error) {
      console.warn('Decision is visible locally but could not be sent to the backend.', error);
    }
    setActiveReroute({ shipmentId: activeReroute?.shipmentId ?? 'BLR-QC-1042', status });
    setIsApprovalOpen(false);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 font-sans">
      <ControlTowerMapWithRerouting evaluation={displayedEvaluation} routeEvaluation={routeEvaluation} isochrones={isochrones} onOpenApproval={() => setIsApprovalOpen(true)} />
      <Dashboard evaluation={displayedEvaluation} onOpenApproval={() => setIsApprovalOpen(true)} />
      <div className="absolute bottom-5 right-5 z-[1000] w-[min(22rem,calc(100vw-2.5rem))]">
        <SimulationPanel />
      </div>
      {isApprovalOpen ? <HITLApprovalModal evaluation={displayedEvaluation} shipmentId={activeReroute?.shipmentId ?? 'BLR-QC-1042'} onDecision={handleDecision} onClose={() => setIsApprovalOpen(false)} /> : null}
    </div>
  );
}

export default App;
