import { Droplets, Thermometer, Shield, AlertTriangle, CheckCircle, Zap, Fan, Snowflake, Wind } from 'lucide-react';
import { useConfigStore } from '../../store/configStore';
import { coolants } from '../../data/coolants';
import { platformMap } from '../../data/serverPlatforms';
import { getOemChassis } from '../../data/oemConfigs';
import { RangeSlider } from '../common/RangeSlider';
import type { CoolantId, CduRedundancy } from '../../types';
import { useMemo } from 'react';

/** Compute the compatible inlet temperature range across all configured racks. */
function useRecommendedInletRange() {
  const racks = useConfigStore(s => s.racks);

  return useMemo(() => {
    let overlapMin = -Infinity;
    let overlapMax = Infinity;
    let hasLiquid = false;
    const platformRanges: { name: string; range: [number, number] }[] = [];
    const seen = new Set<string>();

    for (const rack of racks) {
      if (!rack.slot) continue;
      const platform = platformMap.get(rack.slot.platformId);
      if (!platform || platform.coolingType !== 'liquid') continue;
      hasLiquid = true;

      const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
      const effectiveRange: [number, number] = oem?.inletTempRangeOverride_C ?? platform.inletTempRange_C;

      overlapMin = Math.max(overlapMin, effectiveRange[0]);
      overlapMax = Math.min(overlapMax, effectiveRange[1]);

      const key = `${rack.slot.platformId}__${rack.slot.oemId}`;
      if (!seen.has(key)) {
        seen.add(key);
        platformRanges.push({
          name: `${platform.name}${oem ? ` (${oem.oemName})` : ''}`,
          range: effectiveRange,
        });
      }
    }

    if (!hasLiquid) return null;

    const feasible = overlapMin <= overlapMax;
    const recommended = feasible
      ? Math.round((overlapMin + overlapMax) / 2)
      : null;

    return {
      overlapMin,
      overlapMax,
      feasible,
      recommended,
      platformRanges,
    };
  }, [racks]);
}

export function ContainerSettings() {
  const {
    ambientTemp_C, coolantId, inletTemp_C, cduRedundancy,
    setAmbientTemp, setCoolant, setInletTemp, setCduRedundancy,
  } = useConfigStore();

  const inletRange = useRecommendedInletRange();
  const inletInRange = inletRange?.feasible
    ? inletTemp_C >= inletRange.overlapMin && inletTemp_C <= inletRange.overlapMax
    : false;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Thermometer className="w-4 h-4 text-cyan-500" />
        Container Settings
      </h3>

      <RangeSlider
        label="Ambient Temperature"
        value={ambientTemp_C}
        min={-10}
        max={50}
        unit="°C"
        onChange={setAmbientTemp}
      />

      <div className="space-y-1">
        <label className="text-sm text-slate-400 flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5" />
          Coolant
        </label>
        <select
          value={coolantId}
          onChange={(e) => setCoolant(e.target.value as CoolantId)}
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
        >
          {coolants.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <RangeSlider
          label="Coolant Inlet Temperature"
          value={inletTemp_C}
          min={5}
          max={40}
          unit="°C"
          onChange={setInletTemp}
        />

        {/* Recommended inlet range based on configured platforms */}
        {inletRange && (
          <div className="mt-2 space-y-1.5">
            {inletRange.feasible ? (
              <>
                <div className="flex items-center gap-1.5 text-xs">
                  {inletInRange ? (
                    <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                  )}
                  <span className="text-slate-400">Recommended:</span>
                  <span className={`font-mono font-medium ${inletInRange ? 'text-green-400' : 'text-yellow-400'}`}>
                    {inletRange.overlapMin}–{inletRange.overlapMax}°C
                  </span>
                  {!inletInRange && (
                    <button
                      onClick={() => inletRange.recommended != null && setInletTemp(inletRange.recommended)}
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-0.5"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      Set to {inletRange.recommended}°C
                    </button>
                  )}
                </div>
                {/* Per-platform range breakdown */}
                {inletRange.platformRanges.length > 1 && (
                  <div className="space-y-0.5">
                    {inletRange.platformRanges.map((p, i) => {
                      const pInRange = inletTemp_C >= p.range[0] && inletTemp_C <= p.range[1];
                      return (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 truncate mr-2">{p.name}</span>
                          <span className={`font-mono shrink-0 ${pInRange ? 'text-slate-400' : 'text-red-400'}`}>
                            {p.range[0]}–{p.range[1]}°C
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-start gap-1.5 text-xs bg-red-500/10 rounded p-2">
                <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-red-400 font-medium">No compatible inlet range</span>
                  <p className="text-red-400/70 mt-0.5">
                    The configured platforms have non-overlapping inlet temperature requirements. Consider separate cooling loops.
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {inletRange.platformRanges.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="text-red-400/60 truncate mr-2">{p.name}</span>
                        <span className="font-mono text-red-400/80">{p.range[0]}–{p.range[1]}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm text-slate-400 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          CDU Redundancy
        </label>
        <div className="flex gap-2">
          {(['n+1', '2n'] as CduRedundancy[]).map(r => (
            <button
              key={r}
              onClick={() => setCduRedundancy(r)}
              className={`flex-1 px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                cduRedundancy === r
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Recommended Equipment Specs */}
      <RecommendedEquipment />
    </div>
  );
}

function RecommendedEquipment() {
  const results = useConfigStore(s => s.results);

  if (!results || results.power.totalIT_kW <= 0) return null;

  const { heatRejection, cdu, hydraulic } = results;
  const { method, dryCoolerSpec, chillerSpec } = heatRejection;

  const methodInfo = {
    'dry-cooler': { label: 'Dry Cooler', icon: Fan, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
    'chiller': { label: 'Chiller', icon: Snowflake, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
    'hybrid': { label: 'Hybrid (Dry + Trim Chiller)', icon: Wind, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  }[method];

  const Icon = methodInfo.icon;

  return (
    <div className="border-t border-slate-700 pt-4 space-y-3">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
        <Fan className="w-3 h-3" />
        Recommended Equipment
      </h4>

      {/* Method badge */}
      <div className={`rounded border p-2.5 ${methodInfo.bg}`}>
        <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
          <Icon className={`w-3.5 h-3.5 ${methodInfo.color}`} />
          <span className={methodInfo.color}>{methodInfo.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <span className="text-slate-500">Rejection Capacity</span>
          <span className="font-mono text-slate-300">{heatRejection.capacity_kW.toFixed(0)} kW</span>

          <span className="text-slate-500">Total Cooling Power</span>
          <span className="font-mono text-slate-300">{heatRejection.totalPower_kW.toFixed(1)} kW</span>

          {/* Dry cooler specs */}
          {dryCoolerSpec && (
            <>
              <span className="text-slate-500">Fan Count</span>
              <span className="font-mono text-slate-300">{dryCoolerSpec.fanCount} fans</span>

              <span className="text-slate-500">Fan Power</span>
              <span className="font-mono text-slate-300">{dryCoolerSpec.fanPower_kW.toFixed(1)} kW</span>

              <span className="text-slate-500">Approach Temp</span>
              <span className="font-mono text-slate-300">{dryCoolerSpec.approachTemp_C}°C</span>

              {dryCoolerSpec.deratingFactor < 0.95 && (
                <>
                  <span className="text-slate-500">Derating</span>
                  <span className={`font-mono ${dryCoolerSpec.deratingFactor < 0.8 ? 'text-yellow-400' : 'text-slate-300'}`}>
                    {(dryCoolerSpec.deratingFactor * 100).toFixed(0)}%
                  </span>
                </>
              )}
            </>
          )}

          {/* Chiller specs */}
          {chillerSpec && (
            <>
              <span className="text-slate-500">Chiller Capacity</span>
              <span className="font-mono text-slate-300">{chillerSpec.capacity_kW.toFixed(0)} kW</span>

              <span className="text-slate-500">COP</span>
              <span className="font-mono text-slate-300">{chillerSpec.cop.toFixed(1)}</span>

              <span className="text-slate-500">EER</span>
              <span className="font-mono text-slate-300">{chillerSpec.eer.toFixed(1)}</span>

              <span className="text-slate-500">Compressor</span>
              <span className="font-mono text-slate-300">{chillerSpec.compressorPower_kW.toFixed(1)} kW</span>

              <span className="text-slate-500">Refrigerant</span>
              <span className="font-mono text-slate-300">{chillerSpec.refrigerant}</span>

              <span className="text-slate-500">Evap Temp</span>
              <span className="font-mono text-slate-300">{chillerSpec.evapTemp_C.toFixed(0)}°C</span>

              <span className="text-slate-500">Condenser Temp</span>
              <span className="font-mono text-slate-300">{chillerSpec.condenserTemp_C.toFixed(0)}°C</span>
            </>
          )}
        </div>
      </div>

      {/* CDU summary */}
      <div className="rounded border border-slate-600 bg-slate-700/30 p-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400 mb-2">
          <Droplets className="w-3.5 h-3.5" />
          CDU Sizing
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <span className="text-slate-500">Units</span>
          <span className="font-mono text-slate-300">{cdu.activeCount} active + {cdu.redundantCount} standby</span>

          <span className="text-slate-500">Per Unit</span>
          <span className="font-mono text-slate-300">{cdu.selectedSize_kW} kW</span>

          <span className="text-slate-500">Pump Power</span>
          <span className="font-mono text-slate-300">{hydraulic.pumpPower_kW.toFixed(1)} kW</span>

          <span className="text-slate-500">Header Pipe</span>
          <span className="font-mono text-slate-300">{hydraulic.headerDn} ({hydraulic.headerDiameter_mm.toFixed(0)} mm)</span>

          <span className="text-slate-500">System ΔP</span>
          <span className="font-mono text-slate-300">{hydraulic.totalSystemDp_bar.toFixed(2)} bar</span>
        </div>
      </div>

      {/* Compatibility note */}
      {method === 'chiller' && (
        <div className="flex items-start gap-1.5 text-[10px] text-amber-400/80 bg-amber-500/5 rounded p-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>Ambient too warm for free cooling. Consider raising inlet temp or choosing a cooler site.</span>
        </div>
      )}
      {method === 'hybrid' && (
        <div className="flex items-start gap-1.5 text-[10px] text-yellow-400/80 bg-yellow-500/5 rounded p-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>Marginal for dry cooling. Trim chiller handles peak ambient conditions.</span>
        </div>
      )}
    </div>
  );
}
