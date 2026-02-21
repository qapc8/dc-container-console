import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { ThermalResult, UnitSystem } from '../../types';

interface Props {
  data: ThermalResult['perRack'];
  unitSystem: UnitSystem;
}

function toDisplay(celsius: number, units: UnitSystem): number {
  return units === 'imperial' ? celsius * 9 / 5 + 32 : celsius;
}

export function ThermalProfileChart({ data, unitSystem }: Props) {
  const chartData = data
    .filter(d => d.flow_Lpm > 0)
    .map((d, i) => ({
      name: `R${i + 1}`,
      inlet: toDisplay(d.inletTemp_C, unitSystem),
      outlet: toDisplay(d.outletTemp_C, unitSystem),
    }));

  const unit = unitSystem === 'imperial' ? '°F' : '°C';
  const warnTemp = toDisplay(40, unitSystem);

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No liquid-cooled racks</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}${unit}`]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={warnTemp} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `${warnTemp.toFixed(0)}${unit} limit`, fill: '#ef4444', fontSize: 10 }} />
        <Line type="monotone" dataKey="inlet" name={`Inlet (${unit})`} stroke="#06b6d4" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="outlet" name={`Outlet (${unit})`} stroke="#f97316" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
