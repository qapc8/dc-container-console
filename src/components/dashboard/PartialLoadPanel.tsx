import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import type { PartialLoadResult, UnitSystem } from '../../types';
import { formatPower } from '../../utils/format';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface Props {
  partialLoad: PartialLoadResult;
  unitSystem: UnitSystem;
}

export function PartialLoadPanel({ partialLoad, unitSystem }: Props) {
  if (partialLoad.loadScenarios.length === 0) return null;

  const chartData = partialLoad.loadScenarios.map(s => ({
    load: `${s.loadPercent}%`,
    pue: s.pue,
    pumpPower: s.pumpPower_kW,
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-slate-200">Partial Load & Turndown</h3>
        <span className="text-xs text-slate-500">Pump affinity laws applied</span>
      </div>

      {/* PUE vs Load Chart */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          PUE vs Load
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="load" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v: number) => v.toFixed(3)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(value: number | undefined, name?: string) => [
                name === 'pue' ? (value ?? 0).toFixed(4) : `${(value ?? 0).toFixed(1)} kW`,
                name === 'pue' ? 'PUE' : 'Pump Power',
              ]}
            />
            <Line
              type="monotone"
              dataKey="pue"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ fill: '#a78bfa', r: 4 }}
              name="pue"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Scenarios Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left py-1.5 pr-2">Load</th>
              <th className="text-right py-1.5 pr-2">IT Power</th>
              <th className="text-right py-1.5 pr-2">Flow</th>
              <th className="text-right py-1.5 pr-2">Pump Speed</th>
              <th className="text-right py-1.5 pr-2">Pump Power</th>
              <th className="text-right py-1.5 pr-2">PUE</th>
              <th className="text-center py-1.5">Reynolds</th>
            </tr>
          </thead>
          <tbody>
            {partialLoad.loadScenarios.map(s => (
              <tr key={s.loadPercent} className="border-b border-slate-700/50 text-slate-300">
                <td className="py-1.5 pr-2 font-mono font-medium text-purple-400">{s.loadPercent}%</td>
                <td className="py-1.5 pr-2 text-right font-mono">{formatPower(s.itPower_kW, unitSystem)}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{s.flow_Lpm.toFixed(0)} L/min</td>
                <td className="py-1.5 pr-2 text-right font-mono">{s.pumpSpeedPercent.toFixed(0)}%</td>
                <td className="py-1.5 pr-2 text-right font-mono">{s.pumpPower_kW.toFixed(2)} kW</td>
                <td className="py-1.5 pr-2 text-right font-mono font-medium text-cyan-400">{s.pue.toFixed(4)}</td>
                <td className="py-1.5 text-center">
                  {s.laminarRisk ? (
                    <span className="inline-flex items-center gap-1 text-yellow-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="font-mono">{s.reynoldsNumber.toFixed(0)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      <span className="font-mono">{s.reynoldsNumber.toFixed(0)}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[10px] text-slate-500">
        Pump power follows affinity laws: P ∝ N³. At 50% flow, pump power = 12.5% of design.
        Reynolds &lt; 2300 indicates laminar flow risk in cold plate channels.
      </div>
    </div>
  );
}
