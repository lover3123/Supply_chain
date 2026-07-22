import React from 'react';
import { CloudRain, RadioTower, ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStore } from '../store/useStore';

const corridors = ['Outer Ring Road', 'Silk Board', 'Hebbal Flyover'];

export function SimulationPanel() {
  const simulation = useStore(state => state.simulation);
  const setSimulation = useStore(state => state.setSimulation);
  const toggleCorridor = (corridor) => setSimulation({ gridlockedCorridors: simulation.gridlockedCorridors.includes(corridor) ? simulation.gridlockedCorridors.filter(item => item !== corridor) : [...simulation.gridlockedCorridors, corridor] });
  return <div className="rounded-2xl border border-slate-700 bg-[#111827]/95 p-4 shadow-xl backdrop-blur-md"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-white"><CloudRain size={16} className="text-cyan-300" /><h2 className="text-sm font-bold">Disruption simulator</h2></div><p className="mt-1 text-[11px] text-slate-500">Test predictive signals in real time</p></div><span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] font-bold uppercase text-cyan-300">Live</span></div><div className="mt-4"><div className="flex justify-between text-xs"><span className="text-slate-400">Monsoon downpour · {simulation.sector}</span><span className="font-bold text-cyan-300">{simulation.rainfallMmHr} mm/hr</span></div><input aria-label="Rainfall intensity" type="range" min="0" max="50" value={simulation.rainfallMmHr} onChange={event => setSimulation({ rainfallMmHr: Number(event.target.value) })} className="mt-3 w-full accent-cyan-300" /><div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>0 clear</span><span>25 warning</span><span>50 flood</span></div></div><select value={simulation.sector} onChange={event => setSimulation({ sector: event.target.value })} className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"><option>East Zone</option><option>Whitefield</option><option>Central Bengaluru</option></select><div className="mt-4 space-y-2"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500"><RadioTower size={13} /> Corridor gridlock</div>{corridors.map(corridor => { const active = simulation.gridlockedCorridors.includes(corridor); return <button key={corridor} onClick={() => toggleCorridor(corridor)} className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-left text-xs text-slate-300 hover:border-slate-600"><span>{corridor}</span>{active ? <ToggleRight size={20} className="text-rose-400" /> : <ToggleLeft size={20} className="text-slate-600" />}</button>; })}</div></div>;
}

export function DisruptionAlertStream({ onOpen }) {
  const simulation = useStore(state => state.simulation);
  const highRain = simulation.rainfallMmHr >= 15;
  const alerts = [
    { title: `PREDICTIVE ALERT: Waterlogging risk detected at Bellandur ORR underpass in +18 mins.`, meta: '14 active riders impacted', color: 'rose' },
    ...(highRain ? [{ title: `WEATHER MODEL: ${simulation.rainfallMmHr} mm/hr rain forecast across ${simulation.sector}.`, meta: 'Coverage radius contracting', color: 'amber' }] : []),
    ...simulation.gridlockedCorridors.map(corridor => ({ title: `BOTTLENECK: ${corridor} speed collapse predicted.`, meta: 'Reroute evaluation queued', color: 'orange' })),
  ];
  return <div className="rounded-2xl border border-slate-700 bg-[#111827]/95 p-4 shadow-xl backdrop-blur-md"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-white"><ShieldAlert size={16} className="text-rose-300" /><h2 className="text-sm font-bold">Disruption stream</h2></div><span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Monitoring</span></div><div className="mt-3 space-y-2">{alerts.map((alert, index) => <button key={`${alert.title}-${index}`} onClick={onOpen} className="w-full rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left hover:border-slate-600"><div className={`text-xs font-semibold ${alert.color === 'rose' ? 'text-rose-200' : 'text-amber-200'}`}>{alert.title}</div><div className="mt-1 text-[11px] text-slate-500">{alert.meta} · now</div></button>)}</div></div>;
}
