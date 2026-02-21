import { Thermometer, CheckCircle, XCircle, AlertTriangle, Droplets, Wind } from 'lucide-react';
import type { CoolingLoopCompatibility, ThermalResult, UnitSystem, CompatibilityAlert, AshraeWClassResult, RackConfig } from '../../types';
import { useConfigStore } from '../../store/configStore';
import { formatFlow } from '../../utils/format';

const W_CLASS_COLORS: Record<string, string> = {
  W1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  W2: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  W3: 'bg-green-500/20 text-green-400 border-green-500/30',
  W4: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  W5: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface Props {
  compat: CoolingLoopCompatibility;
  thermal?: ThermalResult;
  unitSystem?: UnitSystem;
  ashraeWClass?: AshraeWClassResult;
  racks?: RackConfig[];
}

export function CoolingCompatPanel({ compat, thermal, unitSystem = 'metric', ashraeWClass, racks }: Props) {
  const inletTemp = useConfigStore(s => s.inletTemp_C);

  if (compat.platformsInLoop.length === 0) {
    return null;
  }

  const range = compat.constrainedInletRange_C;
  const inletInRange = range
    ? inletTemp >= range[0] && inletTemp <= range[1]
    : false;

  // Group alerts by severity
  const criticalAlerts = compat.alerts.filter(a => a.severity === 'critical');
  const warningAlerts = compat.alerts.filter(a => a.severity === 'warning');

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Thermometer className="w-4 h-4 text-cyan-500" />
        <h3 className="text-sm font-semibold text-slate-200">Cooling Loop Compatibility</h3>
        {compat.sharedLoopFeasible ? (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="w-3.5 h-3.5" /> Shared loop OK
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <XCircle className="w-3.5 h-3.5" /> Incompatible
          </span>
        )}
        {ashraeWClass && ashraeWClass.perPlatform.length > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${W_CLASS_COLORS[ashraeWClass.systemClass] ?? ''}`}>
            ASHRAE {ashraeWClass.systemClass}
          </span>
        )}
      </div>

      {/* ASHRAE W-Class Details */}
      {ashraeWClass && ashraeWClass.perPlatform.length > 0 && (
        <div className="mb-4 bg-slate-700/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">ASHRAE Water Classification</h4>
            <span className="text-xs text-slate-400">
              Free cooling: <span className={`font-medium ${
                ashraeWClass.freeCoolingViability === 'excellent' || ashraeWClass.freeCoolingViability === 'good'
                  ? 'text-green-400' : ashraeWClass.freeCoolingViability === 'limited' ? 'text-yellow-400' : 'text-red-400'
              }`}>{ashraeWClass.freeCoolingViability}</span>
            </span>
          </div>
          <div className="space-y-1">
            {ashraeWClass.perPlatform.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-300 truncate mr-2">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">{p.inletRange_C[0]}–{p.inletRange_C[1]}°C</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${W_CLASS_COLORS[p.waterClass] ?? ''}`}>
                    {p.waterClass}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {ashraeWClass.perPlatform.length > 1 && (
            <div className="mt-2 text-[10px] text-slate-500">
              System class limited by {ashraeWClass.limitingPlatform} — most restrictive platform sets the system class
            </div>
          )}
        </div>
      )}

      {/* Visual range comparison */}
      <div className="space-y-2 mb-4">
        {compat.platformsInLoop.map((p, i) => {
          const globalMin = 0;
          const globalMax = 50;
          const leftPct = ((p.requiredRange_C[0] - globalMin) / (globalMax - globalMin)) * 100;
          const widthPct = ((p.requiredRange_C[1] - p.requiredRange_C[0]) / (globalMax - globalMin)) * 100;
          const inletPct = ((inletTemp - globalMin) / (globalMax - globalMin)) * 100;

          return (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 truncate mr-2">{p.name}</span>
                <span className="text-slate-500 font-mono shrink-0">
                  {p.requiredRange_C[0]}–{p.requiredRange_C[1]}°C
                  {p.maxDeltaT_C > 0 && <span className="text-slate-600 ml-1">(ΔT max {p.maxDeltaT_C}°C)</span>}
                </span>
              </div>
              <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="absolute h-full rounded-full bg-cyan-500/40 border border-cyan-500/60"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
                <div
                  className={`absolute top-0 w-0.5 h-full ${inletInRange ? 'bg-green-400' : 'bg-red-400'}`}
                  style={{ left: `${Math.max(0, Math.min(100, inletPct))}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Scale */}
        <div className="flex justify-between text-[10px] text-slate-600 px-1">
          <span>0°C</span>
          <span>10°C</span>
          <span>20°C</span>
          <span>30°C</span>
          <span>40°C</span>
          <span>50°C</span>
        </div>
      </div>

      {/* ΔT Budget Bars (per platform — filtered to matching racks only) */}
      {thermal && racks && compat.platformsInLoop.some(p => p.maxDeltaT_C > 0) && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">ΔT Budget</h4>
          <div className="space-y-1.5">
            {compat.platformsInLoop.filter(p => p.maxDeltaT_C > 0).map((p, i) => {
              // Find rack IDs that belong to THIS platform
              const rackIdsForPlatform = new Set(
                racks
                  .filter(r => r.slot && r.slot.platformId === p.platformId)
                  .map(r => r.id)
              );
              // Max ΔT only from racks of this platform
              const platformThermal = thermal.perRack.filter(
                r => r.flow_Lpm > 0 && rackIdsForPlatform.has(r.rackId)
              );
              const maxActualDelta = platformThermal.length > 0
                ? Math.max(...platformThermal.map(r => r.deltaT_C))
                : 0;
              const ratio = p.maxDeltaT_C > 0 ? maxActualDelta / p.maxDeltaT_C : 0;
              const exceeded = ratio > 1;

              return (
                <div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400 truncate">{p.name}</span>
                    <span className={`font-mono ${exceeded ? 'text-red-400' : ratio > 0.8 ? 'text-yellow-400' : 'text-slate-300'}`}>
                      {maxActualDelta.toFixed(1)} / {p.maxDeltaT_C}°C
                      {exceeded && <span className="text-red-400/60 ml-1">(flow/heat issue)</span>}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        exceeded ? 'bg-red-500' : ratio > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 text-[10px] text-slate-600">
            ΔT is determined by heat load and flow rate — independent of inlet temperature setting
          </div>
        </div>
      )}

      {/* Flow Balance */}
      {compat.flowBalanceSummary && (
        <div className="flex items-center gap-3 mb-4 text-xs">
          <Droplets className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Flow Balance:</span>
          <span className="font-mono text-slate-200">
            Supply {formatFlow(compat.flowBalanceSummary.totalSupply_Lpm, unitSystem)}
          </span>
          <span className="text-slate-600">/</span>
          <span className="font-mono text-slate-200">
            Demand {formatFlow(compat.flowBalanceSummary.totalDemand_Lpm, unitSystem)}
          </span>
        </div>
      )}

      {/* Mixed Cooling Warnings */}
      {compat.mixedCoolingRows.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <Wind className="w-3.5 h-3.5" />
            <span className="font-medium">Mixed Cooling Detected</span>
          </div>
          {compat.mixedCoolingRows.map((row, i) => (
            <div key={i} className="text-[11px] text-yellow-400/80 bg-yellow-500/10 rounded px-2 py-1">
              {row.rackId} ({row.coolingType}) ↔ {row.adjacentRackId} ({row.adjacentCoolingType}) at position {row.position}
            </div>
          ))}
        </div>
      )}

      {/* Constrained range */}
      {range && (
        <div className="text-xs space-y-1 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Compatible inlet range:</span>
            <span className="font-mono text-cyan-400 font-medium">{range[0]}°C – {range[1]}°C</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Current inlet temp:</span>
            <span className={`font-mono font-medium ${inletInRange ? 'text-green-400' : 'text-red-400'}`}>
              {inletTemp}°C {inletInRange ? '' : '(out of range!)'}
            </span>
          </div>
        </div>
      )}

      {/* Per-rack alerts grouped by severity */}
      {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
        <div className="space-y-1.5 mb-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Per-Rack Alerts</h4>
          {!inletInRange && range && (
            <div className="flex items-start gap-2 text-xs bg-amber-500/10 text-amber-400 rounded p-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Inlet temp {inletTemp}°C is outside the recommended {range[0]}–{range[1]}°C range — outlet temp alerts below may resolve by adjusting inlet
              </span>
            </div>
          )}
          {criticalAlerts.map((a, i) => (
            <AlertRow key={`c-${i}`} alert={a} />
          ))}
          {warningAlerts.map((a, i) => (
            <AlertRow key={`w-${i}`} alert={a} />
          ))}
        </div>
      )}

      {/* Legacy warnings */}
      {compat.warnings.length > 0 && (
        <div className="space-y-1.5">
          {compat.warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs rounded p-2 ${
              w.severity === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {!compat.sharedLoopFeasible && (
        <div className="mt-3 text-xs text-slate-500 leading-relaxed">
          These platforms cannot share a single cooling loop due to non-overlapping inlet temperature requirements.
          Consider using separate CDU loops or selecting platforms with compatible ranges.
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: CompatibilityAlert }) {
  const isCritical = alert.severity === 'critical';

  return (
    <div className={`flex items-start gap-2 text-xs rounded p-2 ${
      isCritical ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
    }`}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{alert.message}</span>
    </div>
  );
}
