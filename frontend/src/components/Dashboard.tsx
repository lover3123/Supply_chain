import React from 'react';
import { AlertTriangle, TrendingUp, Anchor, Activity } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Dashboard() {
  const shipmentsMap = useStore(state => state.shipments);
  const shipments = Object.values(shipmentsMap);
  
  const activeCount = shipments.length;
  const delayedCount = shipments.filter(s => s.current_state.eta_deviation_minutes > 120).length;
  const highRiskCount = shipments.filter(s => (s.anomaly_score || 0) > 0.8).length;

  return (
    <div className="absolute top-4 left-4 z-10 w-80 space-y-4">
      {/* Overview Panel */}
      <div className="bg-card/80 backdrop-blur-md border border-slate-700 rounded-xl p-4 shadow-xl">
        <h1 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="text-primary" /> SCRE Dashboard
        </h1>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-semibold uppercase">Active Shipments</p>
            <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs font-semibold uppercase">High Risk</p>
            <p className="text-2xl font-bold text-destructive mt-1">{highRiskCount}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 col-span-2 flex items-center justify-between">
             <div>
                <p className="text-slate-400 text-xs font-semibold uppercase">Delayed {'>'} 2h</p>
                <p className="text-2xl font-bold text-yellow-500 mt-1">{delayedCount}</p>
             </div>
             <TrendingUp className="text-yellow-500/50 h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Disruption Alerts Panel */}
      {highRiskCount > 0 && (
        <div className="bg-card/90 backdrop-blur-md border border-destructive/50 rounded-xl p-4 shadow-xl">
          <h2 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
            <AlertTriangle size={16} /> Active Disruptions
          </h2>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {shipments.filter(s => (s.anomaly_score || 0) > 0.8).map(s => (
              <div key={s.shipment_id} className="bg-destructive/10 border border-destructive/20 rounded p-2 text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-mono text-xs text-slate-300">#{s.shipment_id.slice(0, 8)}</span>
                  <span className="text-xs font-bold text-destructive px-1.5 py-0.5 rounded bg-destructive/20">
                    {(s.anomaly_score || 0).toFixed(2)} Risk
                  </span>
                </div>
                <p className="text-white font-medium">{s.disruption_type || 'Unknown Anomaly'}</p>
                <p className="text-slate-400 text-xs mt-1">Location: {s.location.name || 'At Sea'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
