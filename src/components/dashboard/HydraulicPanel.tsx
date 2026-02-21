import { Pipette, AlertTriangle, CheckCircle } from 'lucide-react';
import type { HydraulicResult, UnitSystem } from '../../types';
import { formatPressure } from '../../utils/format';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  hydraulic: HydraulicResult;
  unitSystem: UnitSystem;
}

const DP_COLORS: Record<string, string> = {
  'Cold Plates': '#06b6d4',
  'Manifold': '#8b5cf6',
  'Piping': '#3b82f6',
  'CDU': '#f59e0b',
  'Fittings': '#ef4444',
};

export function HydraulicPanel({ hydraulic, unitSystem }: Props) {
  if (hydraulic.totalSystemDp_bar <= 0) return null;

  const budgetData = [
    { name: 'Cold Plates', value: hydraulic.dpBudget.coldPlates_bar },
    { name: 'Manifold', value: hydraulic.dpBudget.manifold_bar },
    { name: 'Piping', value: hydraulic.dpBudget.piping_bar },
    { name: 'CDU', value: hydraulic.dpBudget.cdu_bar },
    { name: 'Fittings', value: hydraulic.dpBudget.fittings_bar },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Pipette className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-200">Hydraulic Design</h3>
        {hydraulic.flowImbalanceRisk && (
          <span className="flex items-center gap-1 text-xs text-yellow-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Flow imbalance risk
          </span>
        )}
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">System ΔP</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">
            {formatPressure(hydraulic.totalSystemDp_bar, unitSystem)}
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">Pump Head</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">
            {hydraulic.pumpHead_m.toFixed(1)} m
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">Pump Power</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">
            {hydraulic.pumpPower_kW.toFixed(1)} kW
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">Header Pipe</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">
            {hydraulic.headerDn}
          </div>
          <div className="text-[10px] text-slate-500">{hydraulic.headerDiameter_mm.toFixed(0)} mm ID</div>
        </div>
      </div>

      {/* Velocity & Reynolds */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Header velocity:</span>
          <span className={`font-mono font-medium ${hydraulic.pipeVelocity_mps > 1.8 ? 'text-red-400' : 'text-green-400'}`}>
            {hydraulic.pipeVelocity_mps.toFixed(2)} m/s
          </span>
          {hydraulic.pipeVelocity_mps <= 1.8 ? (
            <CheckCircle className="w-3 h-3 text-green-400" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-red-400" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Reynolds:</span>
          <span className={`font-mono font-medium ${hydraulic.reynoldsNumber < 2300 ? 'text-yellow-400' : 'text-green-400'}`}>
            {hydraulic.reynoldsNumber.toFixed(0)}
          </span>
          <span className="text-slate-500">
            ({hydraulic.reynoldsNumber < 2300 ? 'laminar — risk' : 'turbulent'})
          </span>
        </div>
      </div>

      {/* Pressure Drop Budget Chart */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Pressure Drop Budget
        </h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={budgetData} layout="vertical">
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(value: number | undefined) => [formatPressure(value ?? 0, unitSystem)]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {budgetData.map((entry) => (
                <Cell key={entry.name} fill={DP_COLORS[entry.name] ?? '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-rack branch ΔP table */}
      {hydraulic.perRackBranch.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Per-Rack Branch ΔP
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-1.5 pr-2">Rack</th>
                  <th className="text-left py-1.5 pr-2">Platform</th>
                  <th className="text-right py-1.5 pr-2">Cold Plate</th>
                  <th className="text-right py-1.5 pr-2">Piping</th>
                  <th className="text-right py-1.5 pr-2">Total</th>
                  <th className="text-right py-1.5">Flow</th>
                </tr>
              </thead>
              <tbody>
                {hydraulic.perRackBranch.map(b => (
                  <tr key={b.rackId} className="border-b border-slate-700/50 text-slate-300">
                    <td className="py-1.5 pr-2 font-mono">{b.rackId}</td>
                    <td className="py-1.5 pr-2 truncate max-w-[140px]">{b.platformName}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{formatPressure(b.coldPlate_bar, unitSystem)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{formatPressure(b.piping_bar, unitSystem)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono font-medium text-cyan-400">{formatPressure(b.total_bar, unitSystem)}</td>
                    <td className="py-1.5 text-right font-mono">{b.flow_Lpm.toFixed(1)} L/min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Velocity warnings */}
      {hydraulic.velocityWarnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {hydraulic.velocityWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs bg-red-500/10 text-red-400 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{w.location}: velocity {w.velocity_mps.toFixed(2)} m/s exceeds {w.limit_mps} m/s ASHRAE erosion limit</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
