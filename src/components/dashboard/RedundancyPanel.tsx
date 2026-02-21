import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import type { RedundancyAnalysis, UnitSystem } from '../../types';
import { formatPower, formatTemp } from '../../utils/format';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  redundancy: RedundancyAnalysis;
  unitSystem: UnitSystem;
}

export function RedundancyPanel({ redundancy, unitSystem }: Props) {
  const scenario = redundancy.cduFailureScenario;
  if (scenario.perRackThrottle.length === 0) return null;

  const capacityPct = scenario.totalLoad_kW > 0
    ? (scenario.remainingCapacity_kW / scenario.totalLoad_kW) * 100
    : 100;

  // Chart data: time-to-throttle per rack
  const chartData = scenario.perRackThrottle
    .sort((a, b) => a.timeToThrottle_s - b.timeToThrottle_s)
    .map(r => ({
      name: r.rackId,
      time: Math.min(r.timeToThrottle_s, 300), // cap at 5 min for display
      actualTime: r.timeToThrottle_s,
      platform: r.platformName,
    }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-200">Failure & Redundancy Analysis</h3>
        {scenario.canSurvive ? (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="w-3.5 h-3.5" /> N-1 survives
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" /> N-1 insufficient
          </span>
        )}
      </div>

      {/* CDU Failure Capacity */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">Total Load</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">
            {formatPower(scenario.totalLoad_kW, unitSystem)}
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">N-1 Capacity</div>
          <div className={`text-lg font-bold font-mono ${scenario.canSurvive ? 'text-green-400' : 'text-red-400'}`}>
            {formatPower(scenario.remainingCapacity_kW, unitSystem)}
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">Capacity Ratio</div>
          <div className={`text-lg font-bold font-mono ${capacityPct >= 100 ? 'text-green-400' : 'text-red-400'}`}>
            {capacityPct.toFixed(0)}%
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-[10px] text-slate-400 uppercase">Maint. Max Ambient</div>
          <div className={`text-lg font-bold font-mono ${redundancy.maintenanceWindow.feasible ? 'text-green-400' : 'text-red-400'}`}>
            {redundancy.maintenanceWindow.feasible
              ? formatTemp(redundancy.maintenanceWindow.maxAmbient_C, unitSystem)
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* Time-to-Throttle Chart */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Time to Throttle (CDU failure)
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: 'seconds', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(_value: number | undefined, _name?: string, props?: { payload?: { actualTime?: number; platform?: string } }) => [
                `${(props?.payload?.actualTime ?? 0).toFixed(1)}s — ${props?.payload?.platform ?? ''}`,
                'Time to Throttle',
              ]}
            />
            <Bar dataKey="time" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.actualTime < 30 ? '#ef4444' : entry.actualTime < 60 ? '#f59e0b' : '#22c55e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Shed Order Table */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Load Shed Priority (most urgent first)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-1.5 pr-2">#</th>
                <th className="text-left py-1.5 pr-2">Rack</th>
                <th className="text-left py-1.5 pr-2">Platform</th>
                <th className="text-right py-1.5 pr-2">Coolant Vol.</th>
                <th className="text-right py-1.5 pr-2">Heat Load</th>
                <th className="text-right py-1.5 pr-2">ΔT Budget</th>
                <th className="text-right py-1.5">Time</th>
              </tr>
            </thead>
            <tbody>
              {scenario.perRackThrottle
                .sort((a, b) => a.timeToThrottle_s - b.timeToThrottle_s)
                .map((r, i) => (
                  <tr key={r.rackId} className="border-b border-slate-700/50 text-slate-300">
                    <td className="py-1.5 pr-2 text-slate-500">{i + 1}</td>
                    <td className="py-1.5 pr-2 font-mono">{r.rackId}</td>
                    <td className="py-1.5 pr-2 truncate max-w-[140px]">{r.platformName}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{r.coolantVolume_L.toFixed(0)} L</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{r.heatLoad_kW.toFixed(1)} kW</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{r.tempBudget_C}°C</td>
                    <td className={`py-1.5 text-right font-mono font-medium ${
                      r.timeToThrottle_s < 30 ? 'text-red-400' : r.timeToThrottle_s < 60 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {r.timeToThrottle_s >= 9999 ? '∞' : `${r.timeToThrottle_s.toFixed(1)}s`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
