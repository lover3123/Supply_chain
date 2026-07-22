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
  
  // Group shipments by route to draw paths
  const routePaths = useMemo(() => {
    const paths: JSX.Element[] = [];
    
    shipments.forEach((shipment) => {
      if (!shipment.route || shipment.route.length === 0) return;
      
      // Draw route path lines
      const routeKey = `${shipment.shipment_id}-route`;
      const points: string[] = [];
      
      // Add start point
      if (shipment.location?.lng && shipment.location?.lat) {
        points.push(`${((shipment.location.lng + 180) / 360) * 100}%,${((90 - shipment.location.lat) / 180) * 100}%`);
      }
      
      // Add route segment endpoints
      shipment.route.forEach(segment => {
        if (segment.end_location?.lng && segment.end_location?.lat) {
          points.push(`${((segment.end_location.lng + 180) / 360) * 100}%,${((90 - segment.end_location.lat) / 180) * 100}%`);
        }
      });
      
      if (points.length > 1) {
        const isHighRisk = (shipment.anomaly_score || 0) > 0.8;
        const strokeColor = isHighRisk ? '#ef4444' : '#3b82f6';
        
        // Create SVG path for the route
        const pathElements = [];
        for (let i = 0; i < points.length - 1; i++) {
          const [x1, y1] = points[i].split(',');
          const [x2, y2] = points[i + 1].split(',');
          
          pathElements.push(
            <line
              key={`${routeKey}-segment-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeColor}
              strokeWidth="2"
              strokeOpacity="0.6"
              strokeDasharray={shipment.mode === 'road' ? '5,5' : shipment.mode === 'air' ? '2,2' : '10,5'}
              className="transition-all duration-1000"
            />
          );
        }
        
        paths.push(
          <svg key={routeKey} className="absolute inset-0 w-full h-full pointer-events-none">
            {pathElements}
          </svg>
        );
      }
    });
    
    return paths;
  }, [shipments]);

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
            zIndex: 10,
          }}
          title={`${shipment.shipment_id.slice(0, 8)} - ${shipment.location.name || 'Unknown'} (${shipment.current_state.status}) - Mode: ${shipment.mode}`}
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
      {/* Route paths */}
      {routePaths}
      {/* Shipment markers */}
      {markers}
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur-md rounded-lg p-3 text-xs text-white">
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
    </div>
  );
}
