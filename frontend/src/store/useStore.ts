import { create } from 'zustand';

export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

export interface Shipment {
  shipment_id: string;
  timestamp: string;
  location: Location;
  mode: string;
  current_state: {
    status: string;
    velocity_kmh: number;
    eta_deviation_minutes: number;
  };
  anomaly_score?: number;
  disruption_type?: string;
  route?: Array<{
    end_location?: Location;
  }>;
}

export interface Rider {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  currentLocation: Location;
  vehicleType: string;
  rating: number;
  deliveriesToday: number;
}

export interface DarkStore {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  activeRiders: number;
}

export interface TrafficState {
  zoneId: string;
  congestionLevel: number;
  avgSpeed: number;
  incident?: string;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  alertLevel: 'normal' | 'warning' | 'severe';
}

export interface SelectedEntity {
  type: 'rider' | 'darkstore' | 'shipment';
  id: string;
}

export interface DisruptionSimulation {
  rainfallMmHr: number;
  sector: 'East Zone' | 'Whitefield' | 'Central Bengaluru';
  gridlockedCorridors: string[];
}

interface AppState {
  shipments: Record<string, Shipment>;
  riders: Rider[];
  darkStores: DarkStore[];
  trafficStates: TrafficState[];
  weather: WeatherData | null;
  selectedEntity: SelectedEntity | null;
  simulation: DisruptionSimulation;
  activeReroute: { shipmentId: string; status: 'pending' | 'approved' | 'overridden' | 'backup' } | null;
  updateShipments: (shipments: Shipment[]) => void;
  setRiders: (riders: Rider[]) => void;
  setDarkStores: (darkStores: DarkStore[]) => void;
  setTrafficStates: (trafficStates: TrafficState[]) => void;
  setWeather: (weather: WeatherData) => void;
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setSimulation: (simulation: Partial<DisruptionSimulation>) => void;
  setActiveReroute: (reroute: AppState['activeReroute']) => void;
}

export const useStore = create<AppState>((set) => ({
  shipments: {},
  riders: [],
  darkStores: [],
  trafficStates: [],
  weather: null,
  selectedEntity: null,
  simulation: { rainfallMmHr: 18, sector: 'Whitefield', gridlockedCorridors: ['Outer Ring Road'] },
  activeReroute: null,
  updateShipments: (newShipments) => set((state) => {
    const updated = { ...state.shipments };
    newShipments.forEach((shipment) => {
      updated[shipment.shipment_id] = shipment;
    });
    return { shipments: updated };
  }),
  setRiders: (riders) => set({ riders }),
  setDarkStores: (darkStores) => set({ darkStores }),
  setTrafficStates: (trafficStates) => set({ trafficStates }),
  setWeather: (weather) => set({ weather }),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setSimulation: (simulation) => set((state) => ({ simulation: { ...state.simulation, ...simulation } })),
  setActiveReroute: (activeReroute) => set({ activeReroute }),
}));

