import { DollarSign } from 'lucide-react';
import type { CostResult } from '../../types';
import { formatCurrency } from '../../utils/format';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';

interface Props {
  cost: CostResult | null;
  unitSystem: string;
  electricityRate: number;
  onElectricityRateChange: (rate: number) => void;
}

const CAPEX_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#64748b'];
const OPEX_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6'];

export function CostPanel({ cost, electricityRate, onElectricityRateChange }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-green-400" />
        <h3 className="text-sm font-semibold text-slate-200">Cost Estimation (TCO)</h3>
      </div>

      {/* Electricity Rate Input */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs text-slate-400">Electricity rate:</label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">$</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={electricityRate}
            onChange={e => onElectricityRateChange(parseFloat(e.target.value) || 0)}
            className="w-20 bg-slate-700 text-slate-200 text-sm rounded px-2 py-1 border border-slate-600 focus:border-cyan-500 focus:outline-none font-mono"
          />
          <span className="text-xs text-slate-500">/kWh</span>
        </div>
      </div>

      {cost && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">CAPEX</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {formatCurrency(cost.capex.total)}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">OPEX/yr</div>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {formatCurrency(cost.opexAnnual.total)}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">5-Year TCO</div>
              <div className="text-lg font-bold text-green-400 font-mono">
                {formatCurrency(cost.tco5Year)}
              </div>
              <div className="text-[10px] text-slate-500">{(cost.discountRate * 100).toFixed(0)}% discount rate</div>
            </div>
            <div className="bg-slate-700/50 rounded p-2">
              <div className="text-[10px] text-slate-400 uppercase">Per GPU-Hour</div>
              <div className="text-lg font-bold text-purple-400 font-mono">
                {cost.costPerGpuHour > 0 ? `$${cost.costPerGpuHour.toFixed(4)}` : 'N/A'}
              </div>
              <div className="text-[10px] text-slate-500">cooling OPEX only</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CAPEX Breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">CAPEX Breakdown</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'CDUs', value: cost.capex.cdus },
                      { name: 'Piping', value: cost.capex.piping },
                      { name: 'Manifolds', value: cost.capex.manifolds },
                      { name: 'Dry Cooler', value: cost.capex.dryCooler },
                      { name: 'Chiller', value: cost.capex.chiller },
                      { name: 'Controls', value: cost.capex.controls },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {[
                      { name: 'CDUs', value: cost.capex.cdus },
                      { name: 'Piping', value: cost.capex.piping },
                      { name: 'Manifolds', value: cost.capex.manifolds },
                      { name: 'Dry Cooler', value: cost.capex.dryCooler },
                      { name: 'Chiller', value: cost.capex.chiller },
                      { name: 'Controls', value: cost.capex.controls },
                    ].filter(d => d.value > 0).map((_, i) => (
                      <Cell key={i} fill={CAPEX_COLORS[i % CAPEX_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number | undefined) => [formatCurrency(value ?? 0)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* OPEX Breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Annual OPEX</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={[
                    { name: 'Electricity', value: cost.opexAnnual.electricity },
                    { name: 'Coolant', value: cost.opexAnnual.coolantReplacement },
                    { name: 'Maintenance', value: cost.opexAnnual.maintenance },
                  ]}
                >
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number | undefined) => [formatCurrency(value ?? 0)]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[0, 1, 2].map(i => (
                      <Cell key={i} fill={OPEX_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {!cost && (
        <p className="text-xs text-slate-500">Set an electricity rate above to see cost estimation.</p>
      )}
    </div>
  );
}
