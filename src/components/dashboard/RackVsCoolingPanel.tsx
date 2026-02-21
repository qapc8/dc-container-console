import { Server } from 'lucide-react';
import type { PowerResult, ThermalResult, CduResult, RackConfig, UnitSystem } from '../../types';
import { platformMap } from '../../data/serverPlatforms';
import { formatPower, formatFlow, formatTemp } from '../../utils/format';

interface Props {
  power: PowerResult;
  thermal: ThermalResult;
  cdu: CduResult;
  racks: RackConfig[];
  unitSystem: UnitSystem;
}

export function RackVsCoolingPanel({ power, thermal, cdu, racks, unitSystem }: Props) {
  // Only show populated racks
  const activeRacks = racks.filter(r => r.slot !== null);
  if (activeRacks.length === 0) return null;

  const totalCduCapacity = cdu.selectedSize_kW * cdu.activeCount;
  const liquidRackCount = power.perRack.filter(r => r.liquid_kW > 0).length;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-4 h-4 text-cyan-500" />
        <h3 className="text-sm font-semibold text-slate-200">Rack vs Cooling Capacity</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left py-1.5 pr-2">Rack</th>
              <th className="text-left py-1.5 pr-2">Platform</th>
              <th className="text-right py-1.5 pr-2">Heat Load</th>
              <th className="text-right py-1.5 pr-2">CDU Share</th>
              <th className="text-right py-1.5 pr-2">Flow</th>
              <th className="text-right py-1.5 pr-2">Inlet</th>
              <th className="text-right py-1.5 pr-2">Outlet</th>
              <th className="text-center py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {activeRacks.map(rack => {
              const powerEntry = power.perRack.find(p => p.rackId === rack.id);
              const thermalEntry = thermal.perRack.find(t => t.rackId === rack.id);
              const platform = rack.slot ? platformMap.get(rack.slot.platformId) : null;

              const liquidHeat = powerEntry?.liquid_kW ?? 0;
              const flow = thermalEntry?.flow_Lpm ?? 0;
              const inlet = thermalEntry?.inletTemp_C ?? 0;
              const outlet = thermalEntry?.outletTemp_C ?? 0;

              // CDU capacity share: proportional to liquid heat load
              const cduShare = liquidRackCount > 0 && liquidHeat > 0
                ? (liquidHeat / power.totalLiquidHeat_kW) * totalCduCapacity
                : 0;

              const isLiquid = platform?.coolingType === 'liquid';
              const outletWarn = outlet > 40 && outlet <= 45;
              const outletCritical = outlet > 45;
              const capacityOk = cduShare >= liquidHeat;

              let status: 'ok' | 'warning' | 'critical' = 'ok';
              if (outletCritical || (!capacityOk && isLiquid)) status = 'critical';
              else if (outletWarn) status = 'warning';

              return (
                <tr key={rack.id} className="border-b border-slate-700/50">
                  <td className="py-1.5 pr-2 text-slate-300 font-mono">{rack.id}</td>
                  <td className="py-1.5 pr-2 text-slate-300 truncate max-w-[120px]">
                    {platform?.name ?? '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-200">
                    {isLiquid ? formatPower(liquidHeat, unitSystem) : '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-200">
                    {isLiquid ? formatPower(cduShare, unitSystem) : '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-200">
                    {flow > 0 ? formatFlow(flow, unitSystem) : '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-200">
                    {inlet > 0 ? formatTemp(inlet, unitSystem) : '—'}
                  </td>
                  <td className={`py-1.5 pr-2 text-right font-mono ${
                    outletCritical ? 'text-red-400' : outletWarn ? 'text-yellow-400' : 'text-slate-200'
                  }`}>
                    {outlet > 0 ? formatTemp(outlet, unitSystem) : '—'}
                  </td>
                  <td className="py-1.5 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      status === 'critical' ? 'bg-red-400 animate-pulse'
                      : status === 'warning' ? 'bg-yellow-400'
                      : 'bg-green-400'
                    }`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
