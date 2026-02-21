import { Thermometer } from 'lucide-react';
import type { ClusterThermalSummary, UnitSystem } from '../../types';
import { formatTemp, formatFlow, formatVolume } from '../../utils/format';

interface Props {
  clusterThermal: ClusterThermalSummary;
  unitSystem: UnitSystem;
}

export function ClusterThermalPanel({ clusterThermal, unitSystem }: Props) {
  const {
    supplyTemp_C,
    weightedReturnTemp_C,
    totalDeltaT_C,
    totalFlow_Lpm,
    estimatedCoolantVolume_L,
    perRackContribution,
  } = clusterThermal;

  if (perRackContribution.length === 0) return null;

  const sorted = [...perRackContribution].sort((a, b) => b.heatLoad_kW - a.heatLoad_kW);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Thermometer className="w-4 h-4 text-cyan-500" />
        <h3 className="text-sm font-semibold text-slate-200">Cluster Thermal Summary</h3>
      </div>

      {/* Horizontal pipe visualization */}
      <div className="mb-4 px-2">
        <div className="relative h-12 flex items-center">
          {/* Supply pipe */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-orange-400 opacity-60" />

          {/* Supply label */}
          <div className="absolute left-0 -top-1 text-[10px] font-mono text-blue-400">
            Supply {formatTemp(supplyTemp_C, unitSystem)}
          </div>

          {/* Return label */}
          <div className="absolute right-0 -top-1 text-[10px] font-mono text-orange-400">
            Return {formatTemp(weightedReturnTemp_C, unitSystem)}
          </div>

          {/* Flow direction arrows */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-white/60 text-xs tracking-widest">
            &#x25B6; &#x25B6; &#x25B6;
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="text-center">
          <div className="text-[10px] text-slate-400 uppercase">Total ΔT</div>
          <div className="text-lg font-mono font-bold text-cyan-400">{totalDeltaT_C.toFixed(1)}°C</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-400 uppercase">Total Flow</div>
          <div className="text-lg font-mono font-bold text-cyan-400">{formatFlow(totalFlow_Lpm, unitSystem)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-400 uppercase">Coolant Volume</div>
          <div className="text-lg font-mono font-bold text-cyan-400">{formatVolume(estimatedCoolantVolume_L, unitSystem)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-slate-400 uppercase">Active Racks</div>
          <div className="text-lg font-mono font-bold text-cyan-400">{perRackContribution.length}</div>
        </div>
      </div>

      {/* Per-rack contribution table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left py-1.5 pr-3">Rack</th>
              <th className="text-left py-1.5 pr-3">Platform</th>
              <th className="text-right py-1.5 pr-3">Heat Load</th>
              <th className="text-right py-1.5">Share</th>
              <th className="py-1.5 pl-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.rackId} className="border-b border-slate-700/50">
                <td className="py-1.5 pr-3 text-slate-300 font-mono">{r.rackId}</td>
                <td className="py-1.5 pr-3 text-slate-300 truncate max-w-[140px]">{r.platformName}</td>
                <td className="py-1.5 pr-3 text-right text-slate-200 font-mono">{r.heatLoad_kW.toFixed(1)} kW</td>
                <td className="py-1.5 text-right text-slate-400 font-mono">{(r.fractionOfTotal * 100).toFixed(1)}%</td>
                <td className="py-1.5 pl-3">
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${Math.min(r.fractionOfTotal * 100, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
