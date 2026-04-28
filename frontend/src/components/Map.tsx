import React, { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore } from '../store/useStore';

const INITIAL_VIEW_STATE = {
  longitude: 10,
  latitude: 20,
  zoom: 1,
  pitch: 0,
  bearing: 0
};

export default function AppMap() {
  const shipmentsMap = useStore(state => state.shipments);
  const shipments = Object.values(shipmentsMap);

  const layers = useMemo(() => {
    return [
      new ScatterplotLayer({
        id: 'shipments-layer',
        data: shipments,
        getPosition: d => [d.location.lng, d.location.lat],
        getFillColor: d => {
          if ((d.anomaly_score || 0) > 0.8) return [239, 68, 68, 255]; // Red for high risk
          if ((d.anomaly_score || 0) > 0.4) return [234, 179, 8, 255]; // Yellow for warning
          return [34, 197, 94, 255]; // Green for good
        },
        getRadius: d => ((d.anomaly_score || 0) > 0.8) ? 300000 : 150000,
        radiusMinPixels: 4,
        radiusMaxPixels: 15,
        transitions: {
          getPosition: 1000
        }
      })
    ];
  }, [shipments]);

  return (
    <div className="absolute inset-0 z-0">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        />
      </DeckGL>
    </div>
  );
}
