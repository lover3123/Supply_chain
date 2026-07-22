import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';

// const INITIAL_VIEW_STATE = {
//   longitude: 10,
//   latitude: 20,
//   zoom: 1.5,
// };

export default function AppMap() {
  const shipmentsMap = useStore(state => state.shipments);
  const shipments = Object.values(shipmentsMap);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.min(Math.max(zoom + delta, 0.5), 5);
    setZoom(newZoom);
  }, [zoom]);
  
  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }, [panOffset]);
  
  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPanOffset({ x: newX, y: newY });
  }, [isDragging, dragStart]);
  
  // Handle mouse up to stop dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Handle mouse leave to stop dragging
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Reset view to initial state
  const handleResetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };
  
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
    <div 
      ref={mapContainerRef}
      className="absolute inset-0 z-0 bg-slate-900 overflow-hidden cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Map content with zoom and pan transform */}
      <div 
        className="w-full h-full relative"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
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
      </div>
      
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setZoom(prev => Math.min(prev + 0.5, 5))}
          className="bg-slate-800/80 backdrop-blur-md rounded-lg p-2 text-white hover:bg-slate-700 transition-colors shadow-lg"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))}
          className="bg-slate-800/80 backdrop-blur-md rounded-lg p-2 text-white hover:bg-slate-700 transition-colors shadow-lg"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="bg-slate-800/80 backdrop-blur-md rounded-lg p-2 text-white hover:bg-slate-700 transition-colors shadow-lg"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
      
      {/* Zoom level indicator */}
      <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur-md rounded-lg px-3 py-2 text-xs text-white">
        <span className="font-semibold">Zoom:</span> {(zoom * 100).toFixed(0)}%
      </div>
      
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
