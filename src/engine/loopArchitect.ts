import type {
  RackConfig, Coolant, LoopArchitecture, SecondaryLoop, PlatformId,
  ThermalResult, PowerResult, ClusterThermalSummary,
} from '../types';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';

// Minimum inlet range overlap to consider platforms compatible on one loop (°C)
const MIN_RANGE_OVERLAP_C = 3;

// Bypass flow as fraction of design flow (for minimum flow protection)
const BYPASS_FLOW_FRACTION = 0.25;

// Buffer tank switchover time target (seconds)
const SWITCHOVER_TIME_S = 30;

// Standard DN pipe sizes for reference (same as hydraulicCalculator)
const DN_SIZES: [string, number][] = [
  ['DN25', 27.9], ['DN32', 36.0], ['DN40', 41.3], ['DN50', 54.5],
  ['DN65', 70.3], ['DN80', 80.9], ['DN100', 105.3], ['DN125', 130.0],
  ['DN150', 155.1], ['DN200', 206.5],
];

const MAX_VELOCITY_MPS = 1.8;

function selectDnSize(flow_Lpm: number): string {
  const flow_m3s = flow_Lpm / 60000;
  for (const [dn, d_mm] of DN_SIZES) {
    const d_m = d_mm / 1000;
    const area = Math.PI * Math.pow(d_m / 2, 2);
    const v = flow_m3s / area;
    if (v <= MAX_VELOCITY_MPS) return dn;
  }
  return DN_SIZES[DN_SIZES.length - 1][0];
}

interface PlatformGroup {
  platformIds: PlatformId[];
  rackIds: string[];
  range: [number, number];
  totalFlow: number;
  totalHeat: number;
}

/**
 * Group platforms by compatible inlet temperature ranges.
 * Platforms whose inlet ranges overlap by at least MIN_RANGE_OVERLAP_C are grouped together.
 */
function groupByCompatibleRanges(
  racks: RackConfig[],
  thermal: ThermalResult,
  power: PowerResult,
): PlatformGroup[] {
  // Build per-rack info
  const rackInfos: {
    rackId: string;
    platformId: PlatformId;
    range: [number, number];
    flow: number;
    heat: number;
  }[] = [];

  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (!platform || platform.coolingType !== 'liquid') continue;

    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    const effectiveRange: [number, number] = oem?.inletTempRangeOverride_C ?? platform.inletTempRange_C;

    const thermalRack = thermal.perRack.find(r => r.rackId === rack.id);
    const powerRack = power.perRack.find(r => r.rackId === rack.id);

    rackInfos.push({
      rackId: rack.id,
      platformId: rack.slot.platformId,
      range: effectiveRange,
      flow: thermalRack?.flow_Lpm ?? 0,
      heat: powerRack?.liquid_kW ?? 0,
    });
  }

  if (rackInfos.length === 0) return [];

  // Greedy grouping: try to fit racks into existing groups
  const groups: PlatformGroup[] = [];

  for (const info of rackInfos) {
    let bestGroup: PlatformGroup | null = null;
    let bestOverlap = 0;

    for (const group of groups) {
      const overlapMin = Math.max(group.range[0], info.range[0]);
      const overlapMax = Math.min(group.range[1], info.range[1]);
      const overlap = overlapMax - overlapMin;
      if (overlap >= MIN_RANGE_OVERLAP_C && overlap > bestOverlap) {
        bestGroup = group;
        bestOverlap = overlap;
      }
    }

    if (bestGroup) {
      // Add to existing group, narrow the range
      bestGroup.rackIds.push(info.rackId);
      if (!bestGroup.platformIds.includes(info.platformId)) {
        bestGroup.platformIds.push(info.platformId);
      }
      bestGroup.range = [
        Math.max(bestGroup.range[0], info.range[0]),
        Math.min(bestGroup.range[1], info.range[1]),
      ];
      bestGroup.totalFlow += info.flow;
      bestGroup.totalHeat += info.heat;
    } else {
      // New group
      groups.push({
        platformIds: [info.platformId],
        rackIds: [info.rackId],
        range: [...info.range],
        totalFlow: info.flow,
        totalHeat: info.heat,
      });
    }
  }

  return groups;
}

export function designLoopArchitecture(
  racks: RackConfig[],
  coolant: Coolant,
  inletTemp_C: number,
  thermal: ThermalResult,
  power: PowerResult,
  clusterThermal: ClusterThermalSummary,
): LoopArchitecture {
  const groups = groupByCompatibleRanges(racks, thermal, power);

  if (groups.length === 0) {
    return {
      topology: 'single-loop',
      primaryLoop: {
        supplyTemp_C: inletTemp_C,
        returnTemp_C: inletTemp_C,
        totalFlow_Lpm: 0,
        pipeDiameter_mm: 'N/A',
      },
      secondaryLoops: [],
      bufferTank_L: 0,
      bypassFlow_Lpm: 0,
      reason: 'No liquid-cooled racks configured',
    };
  }

  const totalFlow = thermal.totalFlow_Lpm;
  const totalHeat = power.totalLiquidHeat_kW;
  const returnTemp = clusterThermal.weightedReturnTemp_C;

  // Single loop if all platforms are compatible
  if (groups.length === 1) {
    const bypassFlow = totalFlow * BYPASS_FLOW_FRACTION;
    const bufferTank = calculateBufferTank(totalHeat, coolant, 15);

    return {
      topology: 'single-loop',
      primaryLoop: {
        supplyTemp_C: inletTemp_C,
        returnTemp_C: returnTemp,
        totalFlow_Lpm: totalFlow,
        pipeDiameter_mm: selectDnSize(totalFlow),
      },
      secondaryLoops: [],
      bufferTank_L: bufferTank,
      bypassFlow_Lpm: bypassFlow,
      reason: 'All platforms have compatible inlet temperature ranges — single loop sufficient',
    };
  }

  // Primary/secondary topology
  const secondaryLoops: SecondaryLoop[] = groups.map((group, idx) => {
    const requiredInlet = Math.min(Math.max(inletTemp_C, group.range[0]), group.range[1]);
    const mixingValveRequired = Math.abs(requiredInlet - inletTemp_C) > 1;

    const platformNames = group.platformIds
      .map(id => platformMap.get(id)?.name ?? id)
      .join(' + ');

    return {
      id: `secondary-${idx + 1}`,
      name: `Loop ${idx + 1}: ${platformNames}`,
      platformIds: group.platformIds,
      rackIds: group.rackIds,
      inletTempRange_C: group.range,
      requiredInletTemp_C: requiredInlet,
      totalFlow_Lpm: group.totalFlow,
      totalHeat_kW: group.totalHeat,
      pipeDiameter_mm: selectDnSize(group.totalFlow),
      mixingValveRequired,
    };
  });

  const bypassFlow = totalFlow * BYPASS_FLOW_FRACTION;
  const bufferTank = calculateBufferTank(totalHeat, coolant, 15);

  return {
    topology: 'primary-secondary',
    primaryLoop: {
      supplyTemp_C: inletTemp_C,
      returnTemp_C: returnTemp,
      totalFlow_Lpm: totalFlow + bypassFlow,
      pipeDiameter_mm: selectDnSize(totalFlow + bypassFlow),
    },
    secondaryLoops,
    bufferTank_L: bufferTank,
    bypassFlow_Lpm: bypassFlow,
    reason: `${groups.length} incompatible platform groups detected — primary/secondary topology recommended for independent temperature control`,
  };
}

/**
 * Buffer tank volume: V = Q_kW × t_switchover / (Cp × ΔT_max × ρ)
 * Ensures enough thermal mass for CDU failover.
 */
function calculateBufferTank(
  heatLoad_kW: number,
  coolant: Coolant,
  maxDeltaT_C: number,
): number {
  if (heatLoad_kW <= 0) return 0;
  const heatLoad_W = heatLoad_kW * 1000;
  const volume_m3 = (heatLoad_W * SWITCHOVER_TIME_S) /
    (coolant.specificHeat_JkgK * maxDeltaT_C * coolant.density_kgL * 1000);
  return volume_m3 * 1000; // m³ → liters
}
