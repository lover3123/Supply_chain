import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';

const INITIAL_VIEW_STATE = {
  longitude: 10,
  latitude: 20,
  zoom: 1.5,
};

export default function AppMap() {
  const shipmentsMap = useStore(state => state.shipments);
  const shipments = Object.values(shipmentsMap);

  const markers = useMemo(() => {
    return shipments.map(shipment => {
      const isHighRisk = (shipment.anomaly_score || 0) > 0.8;
      const isWarning = (shipment.anomaly_score || 0) > 0.4;
      const color = isHighRisk ? '#ef4444' : isWarning ? '#eab308' : '#22c55e';
      
      return (
        <div
          key={shipment.shipment_id}
          style={{
            position: 'absolute',
            left: `${((shipment.location.lng + 180) / 360) * 100}%`,
            top: `${((90 - shipment.location.lat) / 180) * 100}%`,
            width: isHighRisk ? '16px' : '10px',
            height: isHighRisk ? '16px' : '10px',
            backgroundColor: color,
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transform: 'translate(-50%, -50%)',
            cursor: 'pointer',
            transition: 'all 0.5s ease',
          }}
          title={`${shipment.shipment_id.slice(0, 8)} - ${shipment.location.name || 'Unknown'} (${shipment.current_state.status})`}
        />
      );
    });
  }, [shipments]);

  return (
    <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden">
      {/* Simple world map background */}
      <div 
        className="w-full h-full opacity-30"
        style={{
          backgroundImage: 'url("https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Shipment markers */}
      {markers}
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur-md rounded-lg p-3 text-xs text-white">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white"></div>
          <span>Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500 border border-white"></div>
          <span>High Risk</span>
        </div>
      </div>
    </div>
  );
}
