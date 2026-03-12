import type { RackConfig, ThermalResult, PowerResult, ClusterThermalSummary, Coolant } from '../types';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';

/**
 * Core thermal equation: Q = ṁ × Cp × ΔT
 * Where ṁ = mass flow rate (kg/s), Cp = specific heat (J/(kg·K)), ΔT = temperature difference (°C)
 *
 * Flow rate: ṁ = Q / (Cp × ΔT), then L/min = (ṁ / density) × 60
 * Outlet temp: T_out = T_in + Q / (ṁ × Cp)
 */

export function calculateThermal(
  racks: RackConfig[],
  coolant: Coolant,
  inletTemp_C: number,
): ThermalResult {
  const perRack = racks.map(rack => {
    if (!rack.slot) {
      return { rackId: rack.id, flow_Lpm: 0, inletTemp_C: 0, outletTemp_C: 0, deltaT_C: 0 };
    }

    const platform = platformMap.get(rack.slot.platformId);
    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    if (!platform || platform.coolingType === 'air') {
      return { rackId: rack.id, flow_Lpm: 0, inletTemp_C: 0, outletTemp_C: 0, deltaT_C: 0 };
    }

    const basePower = platform.powerPerUnit_kW * rack.slot.nodeCount;
    const oemOverhead = oem ? oem.additionalPower_kW * rack.slot.nodeCount : 0;
    const liquidFraction = oem?.liquidFractionOverride ?? platform.liquidFraction;
    const liquidHeat_kW = (basePower + oemOverhead) * liquidFraction;
    const liquidHeat_W = liquidHeat_kW * 1000;

    // Use platform-specified flow rate
    const flow_Lpm = platform.flowPerUnit_Lpm * rack.slot.nodeCount;
    const flow_Ls = flow_Lpm / 60;
    const massFlow_kgs = flow_Ls * coolant.density_kgL;

    // T_out = T_in + Q / (ṁ × Cp)
    const deltaT = massFlow_kgs > 0 ? liquidHeat_W / (massFlow_kgs * coolant.specificHeat_JkgK) : 0;
    const outletTemp = inletTemp_C + deltaT;

    return {
      rackId: rack.id,
      flow_Lpm: flow_Lpm,
      inletTemp_C: inletTemp_C,
      outletTemp_C: outletTemp,
      deltaT_C: deltaT,
    };
  });

  const liquidRacks = perRack.filter(r => r.flow_Lpm > 0);
  const totalFlow = liquidRacks.reduce((sum, r) => sum + r.flow_Lpm, 0);
  const avgDeltaT = liquidRacks.length > 0
    ? liquidRacks.reduce((sum, r) => sum + r.deltaT_C, 0) / liquidRacks.length
    : 0;
  const maxOutlet = liquidRacks.length > 0
    ? Math.max(...liquidRacks.map(r => r.outletTemp_C))
    : 0;

  return {
    totalFlow_Lpm: totalFlow,
    perRack,
    avgDeltaT_C: avgDeltaT,
    maxOutletTemp_C: maxOutlet,
  };
}

/**
 * Aggregate cluster-level thermal picture from per-rack data.
 * Flow-weighted average return temp, total ΔT, coolant volume estimate,
 * and per-rack heat contribution breakdown.
 */
export function calculateClusterThermal(
  thermal: ThermalResult,
  power: PowerResult,
  _coolant: Coolant,
  inletTemp_C: number,
  racks: RackConfig[],
): ClusterThermalSummary {
  const liquidRacks = thermal.perRack.filter(r => r.flow_Lpm > 0);
  const totalFlow = liquidRacks.reduce((sum, r) => sum + r.flow_Lpm, 0);

  // Flow-weighted average return temp: Σ(outletTemp × flow) / Σ(flow)
  const weightedReturnTemp = totalFlow > 0
    ? liquidRacks.reduce((sum, r) => sum + r.outletTemp_C * r.flow_Lpm, 0) / totalFlow
    : inletTemp_C;

  const totalDeltaT = weightedReturnTemp - inletTemp_C;

  // Coolant volume estimate: sum of per-platform volumes + 30L baseline (headers/manifolds)
  const estimatedCoolantVolume = racks.reduce((sum, rack) => {
    if (!rack.slot) return sum;
    const p = platformMap.get(rack.slot.platformId);
    if (!p || p.coolingType !== 'liquid') return sum;
    return sum + p.coolantVolumePerUnit_L * rack.slot.nodeCount;
  }, 30);

  // Total liquid heat for fraction computation
  const totalLiquidHeat = power.totalLiquidHeat_kW;

  // Per-rack contribution
  const perRackContribution = racks.map(rack => {
    const powerEntry = power.perRack.find(p => p.rackId === rack.id);
    const liquidHeat = powerEntry?.liquid_kW ?? 0;
    const platform = rack.slot ? platformMap.get(rack.slot.platformId) : null;

    return {
      rackId: rack.id,
      platformName: platform?.name ?? 'Empty',
      heatLoad_kW: liquidHeat,
      fractionOfTotal: totalLiquidHeat > 0 ? liquidHeat / totalLiquidHeat : 0,
    };
  }).filter(r => r.heatLoad_kW > 0);

  return {
    supplyTemp_C: inletTemp_C,
    weightedReturnTemp_C: weightedReturnTemp,
    totalDeltaT_C: totalDeltaT,
    totalFlow_Lpm: totalFlow,
    estimatedCoolantVolume_L: estimatedCoolantVolume,
    perRackContribution,
  };
}

/**
 * Calculate required flow rate for a given heat load and desired ΔT.
 * Returns L/min.
 */
export function requiredFlowRate(
  heatLoad_kW: number,
  coolant: Coolant,
  deltaT_C: number,
): number {
  const heatLoad_W = heatLoad_kW * 1000;
  const massFlow_kgs = heatLoad_W / (coolant.specificHeat_JkgK * deltaT_C);
  return (massFlow_kgs / coolant.density_kgL) * 60;
}
