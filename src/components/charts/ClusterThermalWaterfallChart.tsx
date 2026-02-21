import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ClusterThermalSummary, UnitSystem } from '../../types';

interface Props {
  clusterThermal: ClusterThermalSummary;
  unitSystem: UnitSystem;
}

/**
 * Waterfall bar chart: supply temp → per-rack ΔT contributions → return temp.
 * Uses invisible base bars + colored delta bars for the floating effect.
 */
export function ClusterThermalWaterfallChart({ clusterThermal }: Props) {
  const { supplyTemp_C, weightedReturnTemp_C, perRackContribution } = clusterThermal;

  if (perRackContribution.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>;
  }

  // Sort by heat load descending
  const sorted = [...perRackContribution].sort((a, b) => b.heatLoad_kW - a.heatLoad_kW);
  const totalHeat = sorted.reduce((sum, r) => sum + r.heatLoad_kW, 0);
  const totalDeltaT = weightedReturnTemp_C - supplyTemp_C;

  // Build waterfall data: supply → each rack's contribution → return
  let runningTemp = supplyTemp_C;
  const chartData: { name: string; base: number; delta: number; isEndpoint: boolean }[] = [];

  chartData.push({
    name: 'Supply',
    base: 0,
    delta: supplyTemp_C,
    isEndpoint: true,
  });

  for (const rack of sorted) {
    const rackDelta = totalHeat > 0 ? (rack.heatLoad_kW / totalHeat) * totalDeltaT : 0;
    chartData.push({
      name: rack.rackId.replace('rack-', 'R'),
      base: runningTemp,
      delta: rackDelta,
      isEndpoint: false,
    });
    runningTemp += rackDelta;
  }

  chartData.push({
    name: 'Return',
    base: 0,
    delta: weightedReturnTemp_C,
    isEndpoint: true,
  });

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          domain={[0, Math.ceil(weightedReturnTemp_C + 5)]}
          label={{ value: '°C', position: 'insideTopLeft', fill: '#94a3b8', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(value: number | undefined, name?: string) => {
            if (name === 'base') return [null, null];
            return [`${(value ?? 0).toFixed(1)}°C`, 'ΔT'];
          }}
        />
        {/* Invisible base bar */}
        <Bar dataKey="base" stackId="waterfall" fill="transparent" />
        {/* Visible delta bar */}
        <Bar dataKey="delta" stackId="waterfall" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isEndpoint ? '#06b6d4' : '#f59e0b'}
              opacity={entry.isEndpoint ? 0.8 : 0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
