import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { PueResult } from '../../types';

interface Props {
  pue: PueResult;
}

const COLORS = ['#06b6d4', '#f59e0b', '#8b5cf6'];

export function PueBreakdownChart({ pue }: Props) {
  if (pue.itPower_kW <= 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>;
  }

  const data = [
    { name: 'IT Power', value: pue.itPower_kW },
    { name: 'Cooling', value: pue.coolingPower_kW },
    { name: 'Distribution', value: pue.distributionLoss_kW },
  ].filter(d => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)} kW`]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
