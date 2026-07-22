import React from 'react';
import { AlertTriangle, ArrowRight, Check, Store, X } from 'lucide-react';

export default function HITLApprovalModal({ evaluation, shipmentId, onDecision, onClose }) {
  if (!evaluation) return null;
  const metric = (label, current, proposed, suffix = '') => (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white"><span>{current}{suffix}</span><ArrowRight size={13} className="text-slate-500" /><span className="text-emerald-300">{proposed}{suffix}</span></div>
    </div>
  );
  return <div className="fixed inset-0 z-[2000] flex justify-end bg-slate-950/50 backdrop-blur-[2px]" role="dialog" aria-modal="true">
    <aside className="h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-[#111827] p-5 shadow-2xl">
      <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-rose-300"><AlertTriangle size={17} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Dispatcher approval required</span></div><h2 className="mt-2 text-xl font-bold text-white">Reroute alert <span className="text-slate-500">#{shipmentId?.slice(0, 8)}</span></h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close"><X size={18} /></button></div>
      <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">{evaluation.reasons.join(' · ') || 'Route risk is above the operating threshold.'}</div>
      <div className="mt-5 grid grid-cols-2 gap-2">{metric('ETA impact', `${Math.round(evaluation.baseline.totalCostMinutes)}m`, `${Math.round(evaluation.proposed.totalCostMinutes)}m`)}{metric('Route distance', '8.4 km', `+${evaluation.extraKm} km`)}{metric('Toll / fuel', '₹42', `₹${evaluation.surchargeCostInr}`)}{metric('SLA recovery', '0%', `${evaluation.slaRecoveryPercent}%`)}</div>
      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/50 p-4"><div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500"><span>Current route</span><span className="text-rose-300">Risk {evaluation.riskLevel}</span></div><div className="mt-4 h-2 rounded-full bg-rose-500/70" /><div className="my-3 flex justify-between text-xs text-slate-400"><span>Silk Board → Bellandur</span><span>18:42 ETA</span></div><div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500"><span>Proposed alternative</span><span className="text-emerald-300">Protected</span></div><div className="mt-4 h-2 rounded-full bg-emerald-400" /><div className="mt-3 flex justify-between text-xs text-slate-400"><span>HSR → Sarjapur Road</span><span>18:55 ETA</span></div></div>
      {evaluation.surchargeBreakdown ? <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-200">₹{evaluation.surchargeBreakdown.extraDistanceFuel} extra-distance fuel + ₹{evaluation.surchargeBreakdown.rainSurge} rain surge = ₹{evaluation.surchargeCostInr} estimated surcharge</div> : null}
      <div className="mt-6 space-y-2"><button onClick={() => onDecision('approved')} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300"><Check size={16} /> Approve reroute</button><button onClick={() => onDecision('overridden')} className="w-full rounded-lg border border-slate-600 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800">Override &amp; keep current</button><button onClick={() => onDecision('backup')} className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/50 px-4 py-3 text-sm font-bold text-amber-200 hover:bg-amber-500/10"><Store size={16} /> Assign backup dark store</button></div>
      <p className="mt-5 text-center text-[11px] text-slate-500">Decision is logged to reroute_event_logs with operator identity and simulation context.</p>
    </aside>
  </div>;
}
