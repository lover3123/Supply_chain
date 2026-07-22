import React, { useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Route, ShieldAlert, TimerReset } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DisruptionAlertStream } from './DisruptionPanels';

interface DashboardProps {
  evaluation: {
    deltaEtaMinutes: number;
    slaRecoveryPercent: number;
    mode: 'auto-execute' | 'hitl';
    riskLevel: string;
    surchargeCostInr: number;
    shouldEvaluate: boolean;
    surchargeBreakdown?: { extraDistanceFuel: number; rainSurge: number };
  };
  onOpenApproval: () => void;
}

export default function Dashboard({ evaluation, onOpenApproval }: DashboardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const shipmentsMap = useStore(state => state.shipments);
  const activeReroute = useStore(state => state.activeReroute);
  const activeCount = Math.max(Object.keys(shipmentsMap).length, 14);
  const delayedCount = evaluation.shouldEvaluate ? 4 : 1;
  const riskLabel = evaluation.riskLevel.toUpperCase();

  return (
    <div className={`pointer-events-none absolute left-5 top-5 z-[1000] ${collapsed ? 'w-11' : 'w-[min(22rem,calc(100vw-2.5rem))]'} transition-[width] duration-200`}>
      <button onClick={() => setCollapsed(value => !value)} className="pointer-events-auto absolute -right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 shadow-lg hover:bg-slate-800" aria-label={collapsed ? 'Expand dashboard panels' : 'Collapse dashboard panels'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      {collapsed ? <div className="pointer-events-auto rounded-xl border border-slate-700 bg-slate-900/90 p-2 shadow-xl backdrop-blur-md"><Activity size={18} className="text-cyan-200" /></div> : <div className="space-y-3">
      <div className="pointer-events-auto rounded-2xl border border-slate-700 bg-[#111827]/95 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div><div className="flex items-center gap-2 text-white"><Activity size={18} className="text-cyan-300" /><h1 className="text-base font-bold">Bengaluru Control Tower</h1></div><p className="mt-1 text-[11px] text-slate-500">Preemptive disruption detection · ST-GNN ETA forecast</p></div>
          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">SYSTEM LIVE</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-slate-900/80 p-2.5"><p className="text-[10px] font-bold uppercase text-slate-500">Riders</p><p className="mt-1 text-xl font-bold text-white">{activeCount}</p></div>
          <div className="rounded-lg bg-slate-900/80 p-2.5"><p className="text-[10px] font-bold uppercase text-slate-500">At risk</p><p className="mt-1 text-xl font-bold text-rose-300">{delayedCount}</p></div>
          <div className="rounded-lg bg-slate-900/80 p-2.5"><p className="text-[10px] font-bold uppercase text-slate-500">SLA save</p><p className="mt-1 text-xl font-bold text-emerald-300">{evaluation.slaRecoveryPercent}%</p></div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold text-white"><Route size={15} className="text-amber-300" /> Reroute analytics</div><span className={evaluation.mode === 'hitl' ? 'text-[10px] font-bold text-rose-300' : 'text-[10px] font-bold text-emerald-300'}>{evaluation.mode === 'hitl' ? 'HITL REQUIRED' : 'AUTO-EXECUTE'}</span></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-[10px] text-slate-300">Δ ETA</p><p className="text-sm font-bold text-white">+{evaluation.deltaEtaMinutes}m</p></div><div><p className="text-[10px] text-slate-300">Risk</p><p className="text-sm font-bold text-rose-200">{riskLabel}</p></div><div><p className="text-[10px] text-slate-300">Surcharge</p><p className="text-sm font-bold text-white">₹{evaluation.surchargeCostInr}</p></div></div>
          {evaluation.surchargeBreakdown ? <p className="mt-2 text-[11px] text-slate-200">₹{evaluation.surchargeBreakdown.extraDistanceFuel} extra-distance fuel + ₹{evaluation.surchargeBreakdown.rainSurge} rain surge</p> : null}
          {evaluation.shouldEvaluate ? <button onClick={onOpenApproval} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-400 px-3 py-2 text-xs font-bold text-slate-950"><ShieldAlert size={14} /> Review dispatcher decision</button> : null}
        </div>
        {activeReroute && activeReroute.status !== 'pending' ? <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2 text-xs text-emerald-200"><TimerReset size={14} /> Reroute {activeReroute.status.replace('_', ' ')} and logged.</div> : null}
      </div>
      <div className="pointer-events-auto"><DisruptionAlertStream onOpen={onOpenApproval} /></div>
      </div>}
    </div>
  );
}
