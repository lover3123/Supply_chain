import React, { useEffect } from 'react';
import ControlTowerMap from './components/ControlTowerMap';
import Dashboard from './components/Dashboard';
import { useStore } from './store/useStore';
import { DARK_STORE_LOCATIONS, MOCK_RIDERS, MOCK_TRAFFIC_STATES, MOCK_WEATHER } from './data/mockData';

function App() {
  const updateShipments = useStore(state => state.updateShipments);
  const setRiders = useStore(state => state.setRiders);
  const setTrafficStates = useStore(state => state.setTrafficStates);
  const setDarkStores = useStore(state => state.setDarkStores);
  const setWeather = useStore(state => state.setWeather);

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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 font-sans">
      <ControlTowerMap />
      <Dashboard />
    </div>
  );
}

export default App;
