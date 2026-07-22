import React, { useEffect } from 'react';
import AppMap from './components/Map';
import Dashboard from './components/Dashboard';
import { useStore } from './store/useStore';

function App() {
  const updateShipments = useStore(state => state.updateShipments);
  
  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket('ws://localhost:8000/ws/live-tracking');
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          updateShipments(data);
        }
      } catch (error) {
        console.error("Error parsing websocket message:", error);
      }
    };

    ws.onopen = () => console.log("WebSocket connected");
    ws.onclose = () => console.log("WebSocket disconnected");
    ws.onerror = (error) => console.error("WebSocket error:", error);

    return () => {
      ws.close();
    };
  }, [updateShipments]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 font-sans">
      <AppMap />
      <Dashboard />
    </div>
  );
}

export default App;
