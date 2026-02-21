import type {
  RackConfig, CoolingLoopCompatibility, ValidationWarning,
  ThermalResult, PowerResult, CompatibilityAlert, CoolingType,
  AshraeWaterClass, AshraeWClassResult, PlatformId,
} from '../types';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';

/**
 * ASHRAE TC 9.9 (2021) liquid cooling water class definitions.
 * W1: 2-17°C, W2: 2-27°C, W3: 2-32°C, W4: 2-45°C, W5: >45°C
 */
function getWaterClass(maxInletTemp_C: number): AshraeWaterClass {
  if (maxInletTemp_C <= 17) return 'W1';
  if (maxInletTemp_C <= 27) return 'W2';
  if (maxInletTemp_C <= 32) return 'W3';
  if (maxInletTemp_C <= 45) return 'W4';
  return 'W5';
}

function getFreeCoolingViability(wClass: AshraeWaterClass): AshraeWClassResult['freeCoolingViability'] {
  switch (wClass) {
    case 'W5': return 'excellent';
    case 'W4': return 'excellent';
    case 'W3': return 'good';
    case 'W2': return 'limited';
    case 'W1': return 'poor';
  }
}

/**
 * Evaluate ASHRAE water class for the system.
 * System W-class = most restrictive (lowest max temp) platform on the loop.
 */
export function evaluateAshraeWClass(racks: RackConfig[]): AshraeWClassResult {
  const perPlatform: AshraeWClassResult['perPlatform'] = [];
  const seen = new Set<string>();

  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (!platform || platform.coolingType !== 'liquid') continue;

    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    const effectiveRange: [number, number] = oem?.inletTempRangeOverride_C ?? platform.inletTempRange_C;
    const key = `${rack.slot.platformId}__${rack.slot.oemId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const wClass = getWaterClass(effectiveRange[1]);
    perPlatform.push({
      platformId: rack.slot.platformId as PlatformId,
      name: `${platform.name}${oem ? ` (${oem.oemName})` : ''}`,
      waterClass: wClass,
      inletRange_C: effectiveRange,
    });
  }

  if (perPlatform.length === 0) {
    return {
      systemClass: 'W5',
      perPlatform: [],
      limitingPlatform: 'N/A',
      freeCoolingViability: 'excellent',
    };
  }

  // System class = most restrictive (lowest W number)
  const classOrder: AshraeWaterClass[] = ['W1', 'W2', 'W3', 'W4', 'W5'];
  let systemClassIdx = 4; // Start at W5
  let limitingPlatformName = '';

  for (const p of perPlatform) {
    const idx = classOrder.indexOf(p.waterClass);
    if (idx < systemClassIdx) {
      systemClassIdx = idx;
      limitingPlatformName = p.name;
    }
  }

  const systemClass = classOrder[systemClassIdx];

  return {
    systemClass,
    perPlatform,
    limitingPlatform: limitingPlatformName,
    freeCoolingViability: getFreeCoolingViability(systemClass),
  };
}

/**
 * Evaluates whether all liquid-cooled platforms in the container can share
 * a single cooling loop. Key constraint: coolant inlet temperature must
 * satisfy ALL platforms simultaneously.
 *
 * Enhanced with per-rack outlet temp checks, ΔT budget validation,
 * mixed-cooling detection, and flow balance summary.
 */
export function evaluateCoolingLoopCompat(
  racks: RackConfig[],
  currentInletTemp_C: number,
  thermal?: ThermalResult,
  power?: PowerResult,
): CoolingLoopCompatibility {
  const warnings: ValidationWarning[] = [];
  const alerts: CompatibilityAlert[] = [];

  // Collect unique liquid-cooled platforms with their effective ranges
  const seen = new Map<string, { platformId: string; name: string; range: [number, number]; maxDeltaT: number }>();

  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (!platform || platform.coolingType !== 'liquid') continue;

    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    const effectiveRange: [number, number] = oem?.inletTempRangeOverride_C ?? platform.inletTempRange_C;
    const key = `${rack.slot.platformId}__${rack.slot.oemId}`;

    if (!seen.has(key)) {
      seen.set(key, {
        platformId: rack.slot.platformId,
        name: `${platform.name} (${oem?.oemName ?? rack.slot.oemId})`,
        range: effectiveRange,
        maxDeltaT: platform.maxDeltaT_C,
      });
    }
  }

  const platformsInLoop = Array.from(seen.values()).map(p => ({
    platformId: p.platformId as any,
    name: p.name,
    requiredRange_C: p.range,
    maxDeltaT_C: p.maxDeltaT,
  }));

  // --- Per-rack outlet temp & ΔT budget checks ---
  if (thermal && power) {
    // Compute recommended range for inlet context
    let recMin = -Infinity;
    let recMax = Infinity;
    for (const p of platformsInLoop) {
      recMin = Math.max(recMin, p.requiredRange_C[0]);
      recMax = Math.min(recMax, p.requiredRange_C[1]);
    }
    const hasRecommended = recMin <= recMax;
    const recommendedMid = hasRecommended ? Math.round((recMin + recMax) / 2) : null;
    const inletOutOfRange = hasRecommended && (currentInletTemp_C < recMin || currentInletTemp_C > recMax);

    for (const rack of racks) {
      if (!rack.slot) continue;
      const platform = platformMap.get(rack.slot.platformId);
      if (!platform || platform.coolingType !== 'liquid') continue;

      const thermalRack = thermal.perRack.find(r => r.rackId === rack.id);
      if (!thermalRack || thermalRack.flow_Lpm <= 0) continue;

      // Outlet temp check — include inlet temp context
      if (thermalRack.outletTemp_C > 45) {
        // Would recommended inlet fix it?
        const outletAtRecommended = recommendedMid != null ? recommendedMid + thermalRack.deltaT_C : null;
        const fixable = outletAtRecommended != null && outletAtRecommended <= 45;
        const hint = inletOutOfRange && fixable
          ? ` (at recommended ${recommendedMid}°C inlet → ${outletAtRecommended.toFixed(1)}°C outlet)`
          : inletOutOfRange
            ? ` (inlet ${currentInletTemp_C}°C is outside recommended ${recMin}–${recMax}°C range)`
            : '';
        alerts.push({
          rackId: rack.id,
          alertType: 'outlet-temp-exceeded',
          severity: 'critical',
          message: `${rack.id}: outlet ${thermalRack.outletTemp_C.toFixed(1)}°C exceeds 45°C limit${hint}`,
          actualValue: thermalRack.outletTemp_C,
          limitValue: 45,
        });
      } else if (thermalRack.outletTemp_C > 40) {
        const outletAtRecommended = recommendedMid != null ? recommendedMid + thermalRack.deltaT_C : null;
        const fixable = outletAtRecommended != null && outletAtRecommended <= 40;
        const hint = inletOutOfRange && fixable
          ? ` (at recommended ${recommendedMid}°C inlet → ${outletAtRecommended.toFixed(1)}°C outlet)`
          : inletOutOfRange
            ? ` (inlet ${currentInletTemp_C}°C is outside recommended ${recMin}–${recMax}°C range)`
            : '';
        alerts.push({
          rackId: rack.id,
          alertType: 'outlet-temp-exceeded',
          severity: 'warning',
          message: `${rack.id}: outlet ${thermalRack.outletTemp_C.toFixed(1)}°C exceeds 40°C warning${hint}`,
          actualValue: thermalRack.outletTemp_C,
          limitValue: 40,
        });
      }

      // ΔT budget check — ΔT is independent of inlet temp (it's a flow/heat ratio)
      if (platform.maxDeltaT_C > 0 && thermalRack.deltaT_C > platform.maxDeltaT_C) {
        const overBy = thermalRack.deltaT_C - platform.maxDeltaT_C;
        alerts.push({
          rackId: rack.id,
          alertType: 'delta-t-exceeded',
          severity: overBy > 2 ? 'critical' : 'warning',
          message: `${rack.id}: ΔT ${thermalRack.deltaT_C.toFixed(1)}°C exceeds ${platform.name} max ${platform.maxDeltaT_C}°C — flow/heat imbalance (not inlet temp related)`,
          actualValue: thermalRack.deltaT_C,
          limitValue: platform.maxDeltaT_C,
        });
      }
    }
  }

  // --- Mixed cooling detection: flag adjacent liquid+air positions ---
  const mixedCoolingRows: CoolingLoopCompatibility['mixedCoolingRows'] = [];
  const rackCoolingTypes = new Map<number, { rackId: string; coolingType: CoolingType }>();

  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (!platform) continue;
    rackCoolingTypes.set(rack.position, { rackId: rack.id, coolingType: platform.coolingType });
  }

  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (!platform) continue;

    const adjacent = rackCoolingTypes.get(rack.position + 1);
    if (adjacent && adjacent.coolingType !== platform.coolingType) {
      mixedCoolingRows.push({
        position: rack.position,
        rackId: rack.id,
        coolingType: platform.coolingType,
        adjacentRackId: adjacent.rackId,
        adjacentCoolingType: adjacent.coolingType,
      });

      alerts.push({
        rackId: rack.id,
        alertType: 'mixed-cooling-row',
        severity: 'warning',
        message: `Adjacent racks ${rack.id} (${platform.coolingType}) and ${adjacent.rackId} (${adjacent.coolingType}) use different cooling methods`,
        actualValue: 0,
        limitValue: 0,
      });
    }
  }

  // --- Flow balance summary ---
  let flowBalanceSummary: CoolingLoopCompatibility['flowBalanceSummary'] = null;
  if (thermal) {
    const totalDemand = thermal.perRack.reduce((sum, r) => sum + r.flow_Lpm, 0);
    // Supply = demand in a closed loop, but we report both for UI
    flowBalanceSummary = {
      totalSupply_Lpm: totalDemand,
      totalDemand_Lpm: totalDemand,
    };
  }

  if (platformsInLoop.length <= 1) {
    const range: [number, number] | null = platformsInLoop.length === 1
      ? platformsInLoop[0].requiredRange_C
      : null;

    return {
      sharedLoopFeasible: true,
      constrainedInletRange_C: range,
      platformsInLoop,
      warnings,
      alerts,
      flowBalanceSummary,
      mixedCoolingRows,
    };
  }

  // Compute intersection of all inlet temp ranges
  let overlapMin = -Infinity;
  let overlapMax = Infinity;

  for (const p of platformsInLoop) {
    overlapMin = Math.max(overlapMin, p.requiredRange_C[0]);
    overlapMax = Math.min(overlapMax, p.requiredRange_C[1]);
  }

  const feasible = overlapMin <= overlapMax;
  const constrainedRange: [number, number] | null = feasible
    ? [overlapMin, overlapMax]
    : null;

  if (!feasible) {
    for (let i = 0; i < platformsInLoop.length; i++) {
      for (let j = i + 1; j < platformsInLoop.length; j++) {
        const a = platformsInLoop[i];
        const b = platformsInLoop[j];
        const localMin = Math.max(a.requiredRange_C[0], b.requiredRange_C[0]);
        const localMax = Math.min(a.requiredRange_C[1], b.requiredRange_C[1]);
        if (localMin > localMax) {
          warnings.push({
            severity: 'critical',
            category: 'cooling-compat',
            message: `Incompatible inlet temps: ${a.name} needs ${a.requiredRange_C[0]}-${a.requiredRange_C[1]}°C, ${b.name} needs ${b.requiredRange_C[0]}-${b.requiredRange_C[1]}°C — no overlap, cannot share cooling loop`,
          });
        }
      }
    }
  } else {
    if (currentInletTemp_C < overlapMin || currentInletTemp_C > overlapMax) {
      warnings.push({
        severity: 'warning',
        category: 'cooling-compat',
        message: `Current inlet temp ${currentInletTemp_C}°C is outside the shared-loop compatible range [${overlapMin}°C – ${overlapMax}°C]`,
      });
    }

    const rangeWidth = overlapMax - overlapMin;
    if (rangeWidth <= 3) {
      warnings.push({
        severity: 'warning',
        category: 'cooling-compat',
        message: `Shared-loop inlet range is very narrow: ${overlapMin}°C – ${overlapMax}°C (only ${rangeWidth}°C margin). Consider separating cooling loops.`,
      });
    }
  }

  // Add mixed-cooling row warnings to the warnings list
  if (mixedCoolingRows.length > 0) {
    warnings.push({
      severity: 'warning',
      category: 'mixed-cooling',
      message: `${mixedCoolingRows.length} adjacent rack pair(s) mix liquid and air cooling — may cause airflow conflicts`,
    });
  }

  return {
    sharedLoopFeasible: feasible,
    constrainedInletRange_C: constrainedRange,
    platformsInLoop,
    warnings,
    alerts,
    flowBalanceSummary,
    mixedCoolingRows,
  };
}
