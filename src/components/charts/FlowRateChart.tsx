import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ThermalResult, UnitSystem } from '../../types';

interface Props {
  data: ThermalResult['perRack'];
  unitSystem: UnitSystem;
}

export function FlowRateChart({ data, unitSystem }: Props) {
  const chartData = data
    .filter(d => d.flow_Lpm > 0)
    .map((d, i) => ({
      name: `R${i + 1}`,
      flow: unitSystem === 'imperial' ? d.flow_Lpm * 0.264172 : d.flow_Lpm,
    }));

  const unit = unitSystem === 'imperial' ? 'GPM' : 'L/min';

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No liquid-cooled racks</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)} ${unit}`]}
        />
        <Bar dataKey="flow" name={`Flow (${unit})`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
