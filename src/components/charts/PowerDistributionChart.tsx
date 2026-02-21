import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { PowerResult } from '../../types';
import type { UnitSystem } from '../../types';

interface Props {
  data: PowerResult['perRack'];
  unitSystem: UnitSystem;
}

export function PowerDistributionChart({ data, unitSystem }: Props) {
  const chartData = data
    .filter(d => d.it_kW > 0)
    .map((d, i) => ({
      name: `R${i + 1}`,
      liquid: unitSystem === 'imperial' ? d.liquid_kW * 3412.14 / 1000 : d.liquid_kW,
      air: unitSystem === 'imperial' ? d.air_kW * 3412.14 / 1000 : d.air_kW,
    }));

  const unit = unitSystem === 'imperial' ? 'kBTU/h' : 'kW';

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>;
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
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="liquid" name={`Liquid (${unit})`} fill="#06b6d4" stackId="power" radius={[0, 0, 0, 0]} />
        <Bar dataKey="air" name={`Air (${unit})`} fill="#f59e0b" stackId="power" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
