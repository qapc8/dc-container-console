import { Fan, Snowflake, Layers } from 'lucide-react';
import type { HeatRejectionResult, UnitSystem } from '../../types';
import { formatPower, formatTemp } from '../../utils/format';

interface Props {
  heatRejection: HeatRejectionResult;
  unitSystem: UnitSystem;
}

const methodBadge = {
  'dry-cooler': { label: 'Dry Cooler', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'chiller': { label: 'Chiller', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  'hybrid': { label: 'Hybrid', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

export function CoolingInfraPanel({ heatRejection, unitSystem }: Props) {
  const { method, dryCoolerSpec, chillerSpec, heatExchangerSpec } = heatRejection;
  const badge = methodBadge[method];

  // If no specs at all, fall back to basic display
  if (!dryCoolerSpec && !chillerSpec && !heatExchangerSpec) {
    return null;
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Fan className="w-4 h-4 text-cyan-500" />
        <h3 className="text-sm font-semibold text-slate-200">Cooling Infrastructure</h3>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Primary rejection method */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Primary Heat Rejection
          </h4>

          {dryCoolerSpec && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Fan className="w-3.5 h-3.5 text-green-400" />
                <span className="font-medium">Dry Cooler</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <SpecRow label="Capacity" value={formatPower(dryCoolerSpec.capacity_kW, unitSystem)} />
                <SpecRow label="Fan Count" value={`${dryCoolerSpec.fanCount}` } />
                <SpecRow label="Fan Power" value={formatPower(dryCoolerSpec.fanPower_kW, unitSystem)} />
                <SpecRow label="Approach" value={`${dryCoolerSpec.approachTemp_C}°C`} />
                <SpecRow label="Design Ambient" value={formatTemp(dryCoolerSpec.designAmbient_C, unitSystem)} />
                <SpecRow label="Derating" value={`${(dryCoolerSpec.deratingFactor * 100).toFixed(0)}%`}
                  highlight={dryCoolerSpec.deratingFactor < 0.8 ? 'warning' : undefined} />
                <SpecRow label="Fluid In" value={formatTemp(dryCoolerSpec.fluidInTemp_C, unitSystem)} />
                <SpecRow label="Fluid Out" value={formatTemp(dryCoolerSpec.fluidOutTemp_C, unitSystem)} />
              </div>
            </div>
          )}

          {chillerSpec && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Snowflake className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-medium">Chiller</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <SpecRow label="Capacity" value={formatPower(chillerSpec.capacity_kW, unitSystem)} />
                <SpecRow label="COP" value={chillerSpec.cop.toFixed(1)} />
                <SpecRow label="EER" value={chillerSpec.eer.toFixed(1)} />
                <SpecRow label="Compressor" value={formatPower(chillerSpec.compressorPower_kW, unitSystem)} />
                <SpecRow label="Evap Temp" value={formatTemp(chillerSpec.evapTemp_C, unitSystem)} />
                <SpecRow label="Evap Approach" value={`${chillerSpec.evapApproach_C}°C`} />
                <SpecRow label="Condenser" value={formatTemp(chillerSpec.condenserTemp_C, unitSystem)} />
                <SpecRow label="Cond. Approach" value={`${chillerSpec.condenserApproach_C}°C`} />
                <SpecRow label="Refrigerant" value={chillerSpec.refrigerant} />
              </div>
            </div>
          )}
        </div>

        {/* Heat exchanger spec */}
        {heatExchangerSpec && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Heat Exchanger
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-medium capitalize">{heatExchangerSpec.type} Type</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <SpecRow label="Capacity" value={formatPower(heatExchangerSpec.capacity_kW, unitSystem)} />
                <SpecRow label="Approach" value={`${heatExchangerSpec.approach_C.toFixed(1)}°C`} />
                <SpecRow label="Primary In" value={formatTemp(heatExchangerSpec.primaryInTemp_C, unitSystem)} />
                <SpecRow label="Primary Out" value={formatTemp(heatExchangerSpec.primaryOutTemp_C, unitSystem)} />
                <SpecRow label="Secondary In" value={formatTemp(heatExchangerSpec.secondaryInTemp_C, unitSystem)} />
                <SpecRow label="Secondary Out" value={formatTemp(heatExchangerSpec.secondaryOutTemp_C, unitSystem)} />
                <SpecRow label="Est. Area" value={`${heatExchangerSpec.estimatedArea_m2.toFixed(1)} m²`} />
                <SpecRow label="Footprint" value={`${heatExchangerSpec.estimatedFootprint_m2.toFixed(2)} m²`} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SpecRow({ label, value, highlight }: { label: string; value: string; highlight?: 'warning' | 'critical' }) {
  const valueColor = highlight === 'critical' ? 'text-red-400'
    : highlight === 'warning' ? 'text-yellow-400'
    : 'text-slate-200';

  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${valueColor}`}>{value}</span>
    </>
  );
}
