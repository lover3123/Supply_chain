import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { useStore } from '../store/useStore';

// Bengaluru coordinates and bounds - Hyper-local focus
const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];
const BENGALURU_BOUNDS: L.LatLngBoundsExpression = [
  [12.8300, 77.4500], // Southwest corner (Mysore Road area)
  [13.1200, 77.8000]  // Northeast corner (Whitefield area)
];

// Key Bengaluru locations for dark stores
const DARK_STORE_LOCATIONS = [
  { id: 'DS001', name: 'Koramangala Hub', lat: 12.9352, lng: 77.6245, radius: 3000 },
  { id: 'DS002', name: 'Indiranagar Hub', lat: 12.9716, lng: 77.6412, radius: 2500 },
  { id: 'DS003', name: 'HSR Layout Hub', lat: 12.9081, lng: 77.6476, radius: 3500 },
  { id: 'DS004', name: 'Whitefield Hub', lat: 12.9698, lng: 77.7499, radius: 4000 },
  { id: 'DS005', name: 'BTM Layout Hub', lat: 12.9165, lng: 77.6101, radius: 3000 },
  { id: 'DS006', name: 'Jayanagar Hub', lat: 12.9250, lng: 77.5938, radius: 2800 },
];

// Bengaluru traffic bottleneck zones
const TRAFFIC_ZONES = [
  { name: 'Silk Board Junction', lat: 12.9176, lng: 77.6244, severity: 'high' },
  { name: 'ORR Bellandur', lat: 12.9352, lng: 77.6168, severity: 'high' },
  { name: 'Marathahalli Bridge', lat: 12.9591, lng: 77.6977, severity: 'medium' },
  { name: 'Hebbal Flyover', lat: 13.0350, lng: 77.5970, severity: 'medium' },
  { name: 'MG Road Traffic', lat: 12.9716, lng: 77.5946, severity: 'low' },
];

// Weather overlay state
interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  condition: string;
  alertLevel: 'normal' | 'warning' | 'severe';
}

// Helper component to update map view when needed
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

// Dark Store Geofence Component
function DarkStoreGeofence({ store }: { store: typeof DARK_STORE_LOCATIONS[0] }) {
  const map = useMap();
  
  return (
    <>
      <CircleMarker
        center={[store.lat, store.lng]}
        radius={store.radius / 500} // Scale radius for visual representation
        pathOptions={{
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '5,5',
        }}
      />
      <Marker
        position={[store.lat, store.lng]}
        icon={L.divIcon({
          className: 'dark-store-marker',
          html: `<div style="
            width: 24px;
            height: 24px;
            background-color: #22c55e;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
          "><span style="color: white; font-weight: bold; font-size: 14px;">🏪</span></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })}
      >
        <Popup>
          <div className="p-2">
            <h3 className="font-bold text-sm">{store.name}</h3>
            <p className="text-xs text-gray-600">Delivery Radius: {store.radius / 1000}km</p>
            <p className="text-xs mt-1"><strong>Status:</strong> Active</p>
            <p className="text-xs"><strong>Active Riders:</strong> {Math.floor(Math.random() * 15) + 5}</p>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

// Traffic Zone Marker Component
function TrafficZoneMarker({ zone }: { zone: typeof TRAFFIC_ZONES[0] }) {
  const colorMap = {
    high: '#ef4444',
    medium: '#f97316',
    low: '#eab308',
  };

  return (
    <CircleMarker
      key={zone.name}
      center={[zone.lat, zone.lng]}
      radius={8}
      pathOptions={{
        color: colorMap[zone.severity],
        fillColor: colorMap[zone.severity],
        fillOpacity: 0.6,
        weight: 2,
      }}
    >
      <Popup>
        <div className="p-2">
          <h3 className="font-bold text-sm">{zone.name}</h3>
          <p className="text-xs" style={{ color: colorMap[zone.severity] }}>
            <strong>Traffic:</strong> {zone.severity.toUpperCase()}</p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

// Weather Widget Component
function WeatherWidget({ weather }: { weather: WeatherData | null }) {
  if (!weather) return null;

  const alertColors = {
    normal: 'bg-green-500',
    warning: 'bg-yellow-500',
    severe: 'bg-red-500',
  };

  return (
    <div 
      className={`${alertColors[weather.alertLevel]} backdrop-blur-md rounded-lg p-3 text-white text-xs shadow-lg`}
      style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000, minWidth: '200px' }}
    >
      <div className="font-bold mb-2 flex items-center gap-2">
        <span>🌤️</span> Bengaluru Weather
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="opacity-80">Temperature</div>
          <div className="font-bold">{weather.temperature}°C</div>
        </div>
        <div>
          <div className="opacity-80">Rainfall</div>
          <div className="font-bold">{weather.rainfall} mm/hr</div>
        </div>
        <div>
          <div className="opacity-80">Humidity</div>
          <div className="font-bold">{weather.humidity}%</div>
        </div>
        <div>
          <div className="opacity-80">Wind</div>
          <div className="font-bold">{weather.windSpeed} km/h</div>
        </div>
      </div>
      {weather.alertLevel !== 'normal' && (
        <div className="mt-2 pt-2 border-t border-white/30">
          <div className="font-bold">
            ⚠️ {weather.alertLevel === 'severe' ? 'HEAVY RAINFALL ALERT' : 'WEATHER ADVISORY'}
          </div>
          <div className="text-xs opacity-90">
            {weather.alertLevel === 'severe' 
              ? 'Delivery times may increase by 15-40 mins'
              : 'Moderate delays expected'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppMap() {
  const shipmentsMap = useStore(state => state.shipments);
  const shipments = Object.values(shipmentsMap);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Fetch weather data for Bengaluru
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Using OpenWeatherMap API - replace with your API key
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo_key';
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?lat=12.9716&lon=77.5946&appid=${apiKey}&units=metric`
        );
        
        const data = response.data;
        const rainfall = data.rain?.['1h'] || 0;
        
        let alertLevel: WeatherData['alertLevel'] = 'normal';
        if (rainfall > 10) alertLevel = 'severe';
        else if (rainfall > 3) alertLevel = 'warning';

        setWeather({
          temperature: Math.round(data.main.temp),
          humidity: data.main.humidity,
          rainfall: Math.round(rainfall * 10) / 10,
          windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
          condition: data.weather[0].main,
          alertLevel,
        });
      } catch (error) {
        console.error('Error fetching weather:', error);
        // Fallback mock data for demo
        setWeather({
          temperature: 28,
          humidity: 72,
          rainfall: Math.random() > 0.7 ? Math.random() * 15 : 0,
          windSpeed: 12,
          condition: 'Clouds',
          alertLevel: 'normal',
        });
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 300000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Calculate route paths with weather-adjusted colors
  const routePaths = useMemo(() => {
    return shipments.flatMap((shipment) => {
      if (!shipment.route || shipment.route.length === 0) return [];
      
      // Determine route color based on anomaly score and weather
      const anomalyScore = shipment.anomaly_score || 0;
      const rainPenalty = weather && weather.rainfall > 5 ? 0.2 : 0;
      const adjustedScore = Math.min(anomalyScore + rainPenalty, 1.0);
      
      let color = '#22c55e'; // Green - Optimal
      if (adjustedScore > 0.7) color = '#ef4444'; // Red - High delay/gridlock
      else if (adjustedScore > 0.4) color = '#f97316'; // Orange - Traffic/Rain delayed
      
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
          weight={4}
          opacity={0.8}
          dashArray={dashArray}
        />
      ];
    });
  }, [shipments, weather]);

  const markers = useMemo(() => {
    return shipments.map(shipment => {
      const isHighRisk = (shipment.anomaly_score || 0) > 0.8;
      const isWarning = (shipment.anomaly_score || 0) > 0.4;
      const color = isHighRisk ? '#ef4444' : isWarning ? '#f97316' : '#22c55e';
      
      // Create custom colored marker icon for riders
      const coloredIcon = L.divIcon({
        className: 'rider-marker',
        html: `<div style="
          width: ${isHighRisk ? '20px' : '14px'};
          height: ${isHighRisk ? '20px' : '14px'};
          background-color: ${color};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        "><span style="color: white; font-size: ${isHighRisk ? '12px' : '8px'};">🛵</span></div>`,
        iconSize: [isHighRisk ? 20 : 14, isHighRisk ? 20 : 14],
        iconAnchor: [isHighRisk ? 10 : 7, isHighRisk ? 10 : 7],
      });
      
      return (
        <Marker
          key={shipment.shipment_id}
          position={[shipment.location.lat, shipment.location.lng]}
          icon={coloredIcon}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h3 className="font-bold text-sm">Rider: {shipment.shipment_id.slice(0, 8)}</h3>
              <p className="text-xs text-gray-600">{shipment.location.name || 'On Route'}</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs"><strong>Status:</strong> {shipment.current_state.status}</p>
                <p className="text-xs"><strong>Mode:</strong> 🛵 Two-Wheeler</p>
                <p className="text-xs"><strong>Speed:</strong> {shipment.current_state.velocity_kmh} km/h</p>
                <p className="text-xs"><strong>ETA Deviation:</strong> 
                  <span className={shipment.current_state.eta_deviation_minutes > 5 ? 'text-red-500' : 'text-green-500'}>
                    {' '}{shipment.current_state.eta_deviation_minutes > 0 ? '+' : ''}{shipment.current_state.eta_deviation_minutes} min
                  </span>
                </p>
                {(shipment.anomaly_score || 0) > 0 && (
                  <p className="text-xs mt-1"><strong>Delay Risk:</strong> {(shipment.anomaly_score || 0).toFixed(2)}</p>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [shipments]);

  return (
    <>
      <WeatherWidget weather={weather} />
      
      <MapContainer
        center={BENGALURU_CENTER}
        zoom={12}
        minZoom={10}
        maxZoom={18}
        bounds={BENGALURU_BOUNDS}
        className="w-full h-full"
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        zoomControl={false}
      >
        <MapUpdater center={BENGALURU_CENTER} zoom={12} />
        
        {/* Dark mode map tiles - CartoDB Dark Matter for modern look */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Mode">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Streets">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        {/* Dark Store Geofences */}
        {DARK_STORE_LOCATIONS.map(store => (
          <DarkStoreGeofence key={store.id} store={store} />
        ))}
        
        {/* Traffic Zone Markers */}
        {TRAFFIC_ZONES.map(zone => (
          <TrafficZoneMarker key={zone.name} zone={zone} />
        ))}
        
        {/* Route paths */}
        {routePaths}
        
        {/* Rider/Delivery markers */}
        {markers}
        
        {/* Zoom controls */}
        <div 
          className="leaflet-control-zoom leaflet-bar leaflet-control bg-white rounded-lg shadow-lg overflow-hidden" 
          style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000 }}
        >
          <button
            className="block w-10 h-10 text-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            title="Zoom In"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            +
          </button>
          <div className="border-t border-gray-300"></div>
          <button
            className="block w-10 h-10 text-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            title="Zoom Out"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            −
          </button>
        </div>
        
        {/* Enhanced Legend */}
        <div 
          className="bg-slate-800/95 backdrop-blur-md rounded-lg p-3 text-xs text-white shadow-xl"
          style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, minWidth: '180px' }}
        >
          <div className="font-semibold mb-2 border-b border-gray-600 pb-1">📍 Map Legend</div>
          
          <div className="font-semibold mt-2 mb-1 text-green-400">Dark Stores</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-[8px]">🏪</div>
            <span>Hub (3-5km radius)</span>
          </div>
          
          <div className="font-semibold mt-2 mb-1 text-blue-400">Riders</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
            <span>Normal Speed</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white"></div>
            <span>Traffic Delay</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
            <span>High Delay/Rain</span>
          </div>
          
          <div className="font-semibold mt-2 mb-1 text-red-400">Traffic Zones</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-red-500 opacity-80"></div>
            <span>High Congestion</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-orange-500 opacity-80"></div>
            <span>Moderate Traffic</span>
          </div>
          
          <div className="font-semibold mt-2 mb-1 text-yellow-400">Route Status</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-1 bg-green-500"></div>
            <span>Optimal Path</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-1 bg-orange-500"></div>
            <span>Traffic/Rain Delay</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 bg-red-500"></div>
            <span>Gridlock/High Risk</span>
          </div>
        </div>
        
        {/* Quick Stats Panel */}
        <div 
          className="bg-slate-800/95 backdrop-blur-md rounded-lg p-3 text-xs text-white shadow-xl"
          style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, minWidth: '180px' }}
        >
          <div className="font-semibold mb-2 border-b border-gray-600 pb-1">⚡ Live Operations</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="opacity-70">Active Riders</div>
              <div className="font-bold text-lg text-green-400">{shipments.length}</div>
            </div>
            <div>
              <div className="opacity-70">Dark Stores</div>
              <div className="font-bold text-lg text-blue-400">{DARK_STORE_LOCATIONS.length}</div>
            </div>
            <div>
              <div className="opacity-70">Avg ETA</div>
              <div className="font-bold text-lg text-yellow-400">
                {shipments.length > 0 
                  ? Math.round(shipments.reduce((acc, s) => acc + Math.abs(s.current_state.eta_deviation_minutes), 0) / shipments.length)
                  : 0} min
              </div>
            </div>
            <div>
              <div className="opacity-70">Coverage</div>
              <div className="font-bold text-lg text-purple-400">~450 km²</div>
            </div>
          </div>
        </div>
      </MapContainer>
    </>
  );
}
