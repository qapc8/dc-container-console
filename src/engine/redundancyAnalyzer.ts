import type {
  RackConfig, CduResult, PowerResult, Coolant,
  RedundancyAnalysis, RackThrottleInfo, HeatRejectionResult,
} from '../types';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';

/**
 * Thermal mass / time-to-throttle: t = (V × ρ × Cp × ΔT_max) / Q_heat
 * V: coolant volume (L → m³), ρ: density (kg/m³), Cp: J/(kg·K), Q: heat (W)
 */
function calculateTimeToThrottle(
  coolantVolume_L: number,
  density_kgL: number,
  specificHeat_JkgK: number,
  tempBudget_C: number,
  heatLoad_kW: number,
): number {
  if (heatLoad_kW <= 0 || coolantVolume_L <= 0) return Infinity;
  const volume_m3 = coolantVolume_L / 1000;
  const density_kgm3 = density_kgL * 1000;
  const heatLoad_W = heatLoad_kW * 1000;
  return (volume_m3 * density_kgm3 * specificHeat_JkgK * tempBudget_C) / heatLoad_W;
}

export function analyzeRedundancy(
  racks: RackConfig[],
  cdu: CduResult,
  power: PowerResult,
  coolant: Coolant,
  heatRejection: HeatRejectionResult,
  ambientTemp_C: number,
): RedundancyAnalysis {
  const totalLoad = power.totalLiquidHeat_kW;

  // CDU failure: lose one CDU, what remains?
  const remainingCdus = cdu.totalCount - 1;
  const remainingCapacity = remainingCdus * cdu.selectedSize_kW;
  const deficit = Math.max(0, totalLoad - remainingCapacity);
  const canSurvive = remainingCapacity >= totalLoad;

  // Per-rack time-to-throttle analysis
  const perRackThrottle: RackThrottleInfo[] = [];

  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (!platform || platform.coolingType !== 'liquid') continue;

    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    const platformName = `${platform.name}${oem ? ` (${oem.oemName})` : ''}`;

    const powerRack = power.perRack.find(r => r.rackId === rack.id);
    const heatLoad = powerRack?.liquid_kW ?? 0;

    // Total coolant volume for this rack
    const coolantVolume = platform.coolantVolumePerUnit_L * rack.slot.nodeCount;

    // Temperature budget: use max allowed ΔT for the platform
    const tempBudget = platform.maxDeltaT_C > 0 ? platform.maxDeltaT_C : 15;

    const timeToThrottle = calculateTimeToThrottle(
      coolantVolume,
      coolant.density_kgL,
      coolant.specificHeat_JkgK,
      tempBudget,
      heatLoad,
    );

    perRackThrottle.push({
      rackId: rack.id,
      platformName,
      coolantVolume_L: coolantVolume,
      heatLoad_kW: heatLoad,
      tempBudget_C: tempBudget,
      timeToThrottle_s: timeToThrottle === Infinity ? 9999 : timeToThrottle,
    });
  }

  // Shed order: sort by time-to-throttle ascending (most urgent first)
  const sorted = [...perRackThrottle].sort((a, b) => a.timeToThrottle_s - b.timeToThrottle_s);
  const shedOrder = sorted.map(r => r.rackId);

  // Maintenance window: max ambient temp where N-1 CDUs handle full load
  // With dry cooler, capacity derates as ambient increases
  // Simplified: assume linear derating from design ambient to inlet temp
  let maintenanceMaxAmbient = ambientTemp_C;
  let maintenanceFeasible = canSurvive;

  if (heatRejection.method === 'dry-cooler' && heatRejection.dryCoolerSpec) {
    const spec = heatRejection.dryCoolerSpec;
    // The dry cooler is sized at design ambient. At higher temps it derates.
    // N-1 CDU capacity must exceed load after derating.
    // Derating factor ~3% per °C above design
    if (remainingCapacity > totalLoad) {
      const surplusFraction = (remainingCapacity - totalLoad) / remainingCapacity;
      const degreesOfMargin = surplusFraction / 0.03;
      maintenanceMaxAmbient = spec.designAmbient_C + degreesOfMargin;
      maintenanceFeasible = true;
    } else {
      maintenanceFeasible = false;
    }
  }

  return {
    cduFailureScenario: {
      totalLoad_kW: totalLoad,
      remainingCapacity_kW: remainingCapacity,
      deficit_kW: deficit,
      canSurvive,
      perRackThrottle,
      shedOrder,
    },
    maintenanceWindow: {
      maxAmbient_C: maintenanceMaxAmbient,
      feasible: maintenanceFeasible,
    },
  };
}
