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
}

interface AppState {
  shipments: Record<string, Shipment>;
  updateShipments: (shipments: Shipment[]) => void;
}

export const useStore = create<AppState>((set) => ({
  shipments: {},
  updateShipments: (newShipments) => set((state) => {
    const updated = { ...state.shipments };
    newShipments.forEach(s => {
      updated[s.shipment_id] = s;
    });
    return { shipments: updated };
  }),
}));
