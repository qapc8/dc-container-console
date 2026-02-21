import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SavedConfig, UnitSystem } from '../../types';

interface Props {
  configs: SavedConfig[];
  unitSystem: UnitSystem;
}


export function ComparisonCharts({ configs, unitSystem }: Props) {
  const powerData = configs.map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name,
    'IT Power': c.results.power.totalIT_kW,
    'Wall Power': c.results.pue.totalFacilityPower_kW,
  }));

  const pueData = configs.map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name,
    PUE: c.results.pue.pue,
  }));

  const flowData = configs.map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name,
    'Flow Rate': unitSystem === 'imperial'
      ? c.results.thermal.totalFlow_Lpm * 0.264172
      : c.results.thermal.totalFlow_Lpm,
  }));

  const flowUnit = unitSystem === 'imperial' ? 'GPM' : 'L/min';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Power Comparison</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={powerData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(value: number | undefined) => `${(value ?? 0).toFixed(1)} kW`}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="IT Power" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Wall Power" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">PUE Comparison</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pueData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[1, 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(value: number | undefined) => (value ?? 0).toFixed(3)}
            />
            <Bar dataKey="PUE" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Flow Rate Comparison</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={flowData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              formatter={(value: number | undefined) => `${(value ?? 0).toFixed(1)} ${flowUnit}`}
            />
            <Bar dataKey="Flow Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
