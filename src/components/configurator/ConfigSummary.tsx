import {
  CheckCircle, XCircle, AlertTriangle, Droplets, Fan, Snowflake,
  Wind, Thermometer, Gauge, Zap, ArrowRight,
} from 'lucide-react';
import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { platformMap } from '../../data/serverPlatforms';
import { getOemChassis } from '../../data/oemConfigs';
import { formatPower, formatFlow, formatTemp, formatPressure } from '../../utils/format';

/**
 * Appears below the rack grid once every rack has a server type assigned.
 * Shows whether the mix works together + recommended cooling specs.
 */
export function ConfigSummary() {
  const racks = useConfigStore(s => s.racks);
  const results = useConfigStore(s => s.results);
  const inletTemp_C = useConfigStore(s => s.inletTemp_C);
  const ambientTemp_C = useConfigStore(s => s.ambientTemp_C);
  const unitSystem = useUiStore(s => s.unitSystem);

  // Only show when every rack has a server assigned
  const allPopulated = racks.length > 0 && racks.every(r => r.slot !== null);
  if (!allPopulated || !results) return null;

  const { power, thermal, cdu, heatRejection, hydraulic, coolingCompat, ashraeWClass, loopArchitecture } = results;

  // Build platform mix summary
  const platformCounts = new Map<string, { name: string; count: number; cooling: string }>();
  for (const rack of racks) {
    if (!rack.slot) continue;
    const p = platformMap.get(rack.slot.platformId);
    if (!p) continue;
    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    const key = `${rack.slot.platformId}__${rack.slot.oemId}`;
    const existing = platformCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      platformCounts.set(key, {
        name: `${p.name}${oem ? ` (${oem.oemName})` : ''}`,
        count: 1,
        cooling: p.coolingType,
      });
    }
  }
  const platforms = Array.from(platformCounts.values());
  const isMixed = platforms.length > 1;
  const hasLiquid = platforms.some(p => p.cooling === 'liquid');
  const feasible = coolingCompat.sharedLoopFeasible;
  const inletRange = coolingCompat.constrainedInletRange_C;
  const inletInRange = inletRange
    ? inletTemp_C >= inletRange[0] && inletTemp_C <= inletRange[1]
    : !hasLiquid; // air-only is always fine

  const criticalAlerts = coolingCompat.alerts.filter(a => a.severity === 'critical');
  const warningAlerts = coolingCompat.alerts.filter(a => a.severity === 'warning');

  const methodLabel = heatRejection.method === 'dry-cooler' ? 'Dry Cooler'
    : heatRejection.method === 'chiller' ? 'Chiller'
    : 'Hybrid (Dry Cooler + Trim Chiller)';

  const methodColor = heatRejection.method === 'dry-cooler' ? 'text-green-400'
    : heatRejection.method === 'chiller' ? 'text-blue-400'
    : 'text-yellow-400';

  const methodBg = heatRejection.method === 'dry-cooler' ? 'border-green-500/30 bg-green-500/5'
    : heatRejection.method === 'chiller' ? 'border-blue-500/30 bg-blue-500/5'
    : 'border-yellow-500/30 bg-yellow-500/5';

  const MethodIcon = heatRejection.method === 'dry-cooler' ? Fan
    : heatRejection.method === 'chiller' ? Snowflake
    : Wind;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header — compatibility verdict */}
      <div className={`px-4 py-3 flex items-center gap-3 ${
        feasible && inletInRange
          ? 'bg-green-500/10 border-b border-green-500/20'
          : feasible
            ? 'bg-yellow-500/10 border-b border-yellow-500/20'
            : 'bg-red-500/10 border-b border-red-500/20'
      }`}>
        {feasible && inletInRange ? (
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
        ) : feasible ? (
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
        )}
        <div>
          <div className={`text-sm font-semibold ${
            feasible && inletInRange ? 'text-green-400'
              : feasible ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {feasible && inletInRange
              ? 'This configuration works — shared cooling loop is feasible'
              : feasible
                ? 'Compatible, but inlet temperature needs adjustment'
                : 'Incompatible — platforms cannot share a single cooling loop'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {platforms.map((p, i) => (
              <span key={i}>
                {i > 0 && ' + '}
                <span className="text-slate-300">{p.count}x {p.name}</span>
              </span>
            ))}
          </div>
        </div>
        {ashraeWClass && ashraeWClass.perPlatform.length > 0 && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${
            ashraeWClass.systemClass === 'W1' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            : ashraeWClass.systemClass === 'W2' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
            : ashraeWClass.systemClass === 'W3' ? 'bg-green-500/20 text-green-400 border-green-500/30'
            : ashraeWClass.systemClass === 'W4' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            : 'bg-red-500/20 text-red-400 border-red-500/30'
          }`}>
            ASHRAE {ashraeWClass.systemClass}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Inlet temperature guidance */}
        {hasLiquid && inletRange && (
          <div className="flex items-center gap-3 text-xs">
            <Thermometer className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex-1">
              <span className="text-slate-400">Required inlet range: </span>
              <span className="font-mono text-cyan-400 font-medium">{inletRange[0]}°C – {inletRange[1]}°C</span>
              <span className="text-slate-600 mx-2">|</span>
              <span className="text-slate-400">Current: </span>
              <span className={`font-mono font-medium ${inletInRange ? 'text-green-400' : 'text-red-400'}`}>
                {inletTemp_C}°C
              </span>
              {!inletInRange && (
                <span className="text-red-400/70 ml-1">(out of range)</span>
              )}
            </div>
          </div>
        )}

        {/* Alerts — only show if there are issues */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="space-y-1.5">
            {criticalAlerts.map((a, i) => (
              <div key={`c-${i}`} className="flex items-start gap-2 text-xs bg-red-500/10 text-red-400 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{a.message}</span>
              </div>
            ))}
            {warningAlerts.slice(0, 3).map((a, i) => (
              <div key={`w-${i}`} className="flex items-start gap-2 text-xs bg-yellow-500/10 text-yellow-400 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{a.message}</span>
              </div>
            ))}
            {warningAlerts.length > 3 && (
              <div className="text-[10px] text-slate-500 pl-6">
                +{warningAlerts.length - 3} more warnings — see Dashboard for details
              </div>
            )}
          </div>
        )}

        {/* Incompatible — stop here with guidance */}
        {!feasible && (
          <div className="text-xs text-slate-400 bg-slate-700/30 rounded p-3 space-y-2">
            <p>These platforms have non-overlapping inlet temperature requirements and cannot share a single cooling loop.</p>
            <p className="font-medium text-slate-300">Options:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Use a primary/secondary loop architecture (see Loop Architecture in Dashboard)</li>
              <li>Replace one platform type to achieve overlap</li>
              <li>Deploy in separate containers</li>
            </ul>
            {isMixed && coolingCompat.platformsInLoop.length > 1 && (
              <div className="mt-2 space-y-0.5">
                {coolingCompat.platformsInLoop.map((p, i) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span className="text-slate-500">{p.name}</span>
                    <span className="font-mono text-red-400/80">{p.requiredRange_C[0]}–{p.requiredRange_C[1]}°C</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === Recommended Cooling Specs (only when feasible) === */}
        {feasible && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Recommended Cooling Specs
            </h4>

            {/* Three-column spec grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Heat Rejection */}
              <div className={`rounded border p-3 ${methodBg}`}>
                <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
                  <MethodIcon className={`w-3.5 h-3.5 ${methodColor}`} />
                  <span className={methodColor}>{methodLabel}</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <SpecRow label="Capacity" value={formatPower(heatRejection.capacity_kW, unitSystem)} />
                  <SpecRow label="Total Power" value={formatPower(heatRejection.totalPower_kW, unitSystem)} />
                  {heatRejection.dryCoolerSpec && (
                    <>
                      <SpecRow label="Fans" value={`${heatRejection.dryCoolerSpec.fanCount}`} />
                      <SpecRow label="Approach" value={`${heatRejection.dryCoolerSpec.approachTemp_C}°C`} />
                    </>
                  )}
                  {heatRejection.chillerSpec && (
                    <>
                      <SpecRow label="COP" value={heatRejection.chillerSpec.cop.toFixed(1)} />
                      <SpecRow label="Compressor" value={formatPower(heatRejection.chillerSpec.compressorPower_kW, unitSystem)} />
                      <SpecRow label="Refrigerant" value={heatRejection.chillerSpec.refrigerant} />
                    </>
                  )}
                </div>
              </div>

              {/* CDU */}
              <div className="rounded border border-blue-500/30 bg-blue-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400 mb-2">
                  <Droplets className="w-3.5 h-3.5" />
                  CDU Array
                </div>
                <div className="space-y-1 text-[10px]">
                  <SpecRow label="Units" value={`${cdu.activeCount} active + ${cdu.redundantCount} standby`} />
                  <SpecRow label="Per Unit" value={formatPower(cdu.selectedSize_kW, unitSystem)} />
                  <SpecRow label="Total Capacity" value={formatPower(cdu.selectedSize_kW * cdu.activeCount, unitSystem)} />
                  <SpecRow label="Total Flow" value={formatFlow(thermal.totalFlow_Lpm, unitSystem)} />
                </div>
              </div>

              {/* Hydraulic */}
              <div className="rounded border border-purple-500/30 bg-purple-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-purple-400 mb-2">
                  <Gauge className="w-3.5 h-3.5" />
                  Hydraulic Design
                </div>
                <div className="space-y-1 text-[10px]">
                  <SpecRow label="Header Pipe" value={`${hydraulic.headerDn} (${hydraulic.headerDiameter_mm.toFixed(0)} mm)`} />
                  <SpecRow label="System ΔP" value={formatPressure(hydraulic.totalSystemDp_bar, unitSystem)} />
                  <SpecRow label="Pump Head" value={`${hydraulic.pumpHead_m.toFixed(1)} m`} />
                  <SpecRow label="Pump Power" value={formatPower(hydraulic.pumpPower_kW, unitSystem)} />
                </div>
              </div>
            </div>

            {/* Power summary bar */}
            <div className="flex items-center gap-2 text-xs bg-slate-700/30 rounded p-2.5 flex-wrap">
              <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span className="text-slate-400">IT Power:</span>
              <span className="font-mono text-slate-200 font-medium">{formatPower(power.totalIT_kW, unitSystem)}</span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-slate-400">Wall Power:</span>
              <span className="font-mono text-slate-200 font-medium">{formatPower(results.pue.totalFacilityPower_kW, unitSystem)}</span>
              <span className="text-slate-600 mx-1">|</span>
              <span className="text-slate-400">PUE:</span>
              <span className="font-mono text-cyan-400 font-medium">{results.pue.pue.toFixed(3)}</span>

              {/* Loop topology */}
              {loopArchitecture.topology === 'primary-secondary' && (
                <>
                  <span className="text-slate-600 mx-1">|</span>
                  <span className="text-amber-400 text-[10px]">Primary/secondary loop recommended</span>
                </>
              )}
            </div>

            {/* Ambient context */}
            {heatRejection.method === 'chiller' && (
              <div className="flex items-start gap-2 text-[10px] text-amber-400/80 bg-amber-500/5 rounded p-2">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  At {formatTemp(ambientTemp_C, unitSystem)} ambient, a chiller is required. Free cooling is not viable.
                  Lowering ambient (cooler site) or raising inlet temp may enable dry cooler operation.
                </span>
              </div>
            )}
            {heatRejection.method === 'dry-cooler' && (
              <div className="flex items-start gap-2 text-[10px] text-green-400/80 bg-green-500/5 rounded p-2">
                <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  Free cooling viable at {formatTemp(ambientTemp_C, unitSystem)} ambient — no chiller needed.
                  Lowest energy cost configuration.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-300">{value}</span>
    </div>
  );
}
