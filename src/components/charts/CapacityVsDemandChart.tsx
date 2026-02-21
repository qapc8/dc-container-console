import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { PowerResult, CduResult, RackConfig, UnitSystem } from '../../types';

interface Props {
  power: PowerResult;
  cdu: CduResult;
  racks: RackConfig[];         // kept for Dashboard prop compatibility
  unitSystem: UnitSystem;
}

/**
 * Grouped bar chart: each rack's liquid heat demand vs CDU capacity allocation.
 * Reference line at average demand.
 */
export function CapacityVsDemandChart({ power, cdu, unitSystem }: Props) {
  const totalCduCapacity = cdu.selectedSize_kW * cdu.activeCount;
  const liquidRacks = power.perRack.filter(r => r.liquid_kW > 0);

  if (liquidRacks.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No liquid-cooled racks</div>;
  }

  const chartData = liquidRacks.map((r) => {
    const cduShare = power.totalLiquidHeat_kW > 0
      ? (r.liquid_kW / power.totalLiquidHeat_kW) * totalCduCapacity
      : 0;

    return {
      name: r.rackId.replace('rack-', 'R'),
      demand: unitSystem === 'imperial' ? r.liquid_kW * 3412.14 / 1000 : r.liquid_kW,
      capacity: unitSystem === 'imperial' ? cduShare * 3412.14 / 1000 : cduShare,
    };
  });

  const avgDemand = chartData.reduce((sum, d) => sum + d.demand, 0) / chartData.length;
  const unit = unitSystem === 'imperial' ? 'kBTU/h' : 'kW';

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
        <ReferenceLine
          y={avgDemand}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{ value: `Avg ${avgDemand.toFixed(0)} ${unit}`, fill: '#94a3b8', fontSize: 10, position: 'right' }}
        />
        <Bar dataKey="demand" name={`Heat Demand (${unit})`} fill="#f59e0b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="capacity" name={`CDU Allocation (${unit})`} fill="#06b6d4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
