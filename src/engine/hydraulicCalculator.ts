import type {
  RackConfig, Coolant, HydraulicResult, VelocityWarning, RackBranchDp,
  ThermalResult, PowerResult,
} from '../types';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';

// Standard DN pipe sizes: [DN label, inner diameter mm]
const DN_SIZES: [string, number][] = [
  ['DN25', 27.9],
  ['DN32', 36.0],
  ['DN40', 41.3],
  ['DN50', 54.5],
  ['DN65', 70.3],
  ['DN80', 80.9],
  ['DN100', 105.3],
  ['DN125', 130.0],
  ['DN150', 155.1],
  ['DN200', 206.5],
];

// ASHRAE erosion velocity limit (m/s)
const MAX_VELOCITY_MPS = 1.8;

// Fitting loss as fraction of pipe+coldplate losses
const FITTING_LOSS_FRACTION = 0.15;

// CDU pressure drop (typical)
const CDU_DP_BAR = 0.5;

// Manifold pressure drop per rack position (bar)
const MANIFOLD_DP_PER_RACK_BAR = 0.02;

// Pipe roughness for steel/copper (mm)
const PIPE_ROUGHNESS_MM = 0.045;

// Average piping run length per rack (meters, supply + return)
const PIPE_LENGTH_PER_RACK_M = 6;

// Header pipe length (meters, total supply + return headers)
const HEADER_PIPE_LENGTH_M = 30;

// Pump efficiency
const PUMP_EFFICIENCY = 0.65;

/**
 * Churchill equation for Darcy friction factor (valid for all flow regimes).
 */
function churchillFrictionFactor(Re: number, relativeRoughness: number): number {
  if (Re <= 0) return 0;
  const A = Math.pow(2.457 * Math.log(1 / (Math.pow(7 / Re, 0.9) + 0.27 * relativeRoughness)), 16);
  const B = Math.pow(37530 / Re, 16);
  const f = 8 * Math.pow(
    Math.pow(8 / Re, 12) + 1 / Math.pow(A + B, 1.5),
    1 / 12,
  );
  return f;
}

/**
 * Select the smallest standard DN pipe size that keeps velocity under the limit.
 */
function selectPipeSize(flow_m3s: number, maxVelocity: number): { dn: string; diameter_mm: number; velocity_mps: number } {
  for (const [dn, d_mm] of DN_SIZES) {
    const d_m = d_mm / 1000;
    const area = Math.PI * Math.pow(d_m / 2, 2);
    const v = flow_m3s / area;
    if (v <= maxVelocity) {
      return { dn, diameter_mm: d_mm, velocity_mps: v };
    }
  }
  // If nothing fits, use the largest
  const last = DN_SIZES[DN_SIZES.length - 1];
  const d_m = last[1] / 1000;
  const area = Math.PI * Math.pow(d_m / 2, 2);
  return { dn: last[0], diameter_mm: last[1], velocity_mps: flow_m3s / area };
}

/**
 * Darcy-Weisbach pressure drop in bar.
 * ΔP = f × (L/D) × (ρv²/2)
 */
function darcyWeisbachDp(
  frictionFactor: number, length_m: number, diameter_m: number,
  density_kgm3: number, velocity_mps: number,
): number {
  if (diameter_m <= 0 || velocity_mps <= 0) return 0;
  const dp_Pa = frictionFactor * (length_m / diameter_m) * (density_kgm3 * velocity_mps * velocity_mps / 2);
  return dp_Pa / 100000; // Pa to bar
}

export function calculateHydraulic(
  racks: RackConfig[],
  coolant: Coolant,
  thermal: ThermalResult,
  _power: PowerResult,
): HydraulicResult {
  const velocityWarnings: VelocityWarning[] = [];
  const perRackBranch: RackBranchDp[] = [];

  // Coolant properties
  const density_kgm3 = coolant.density_kgL * 1000; // kg/L → kg/m³
  const viscosity_Pas = coolant.viscosity_cP / 1000; // cP → Pa·s

  // Total flow in m³/s
  const totalFlow_Lpm = thermal.totalFlow_Lpm;
  const totalFlow_m3s = totalFlow_Lpm / 60000; // L/min → m³/s

  if (totalFlow_m3s <= 0) {
    return {
      totalSystemDp_bar: 0,
      pumpHead_m: 0,
      pumpPower_kW: 0,
      headerDiameter_mm: 0,
      headerDn: 'N/A',
      pipeVelocity_mps: 0,
      reynoldsNumber: 0,
      perRackBranch: [],
      velocityWarnings: [],
      flowImbalanceRisk: false,
      dpBudget: { coldPlates_bar: 0, manifold_bar: 0, piping_bar: 0, cdu_bar: 0, fittings_bar: 0, total_bar: 0 },
    };
  }

  // Header pipe sizing
  const header = selectPipeSize(totalFlow_m3s, MAX_VELOCITY_MPS);
  if (header.velocity_mps > MAX_VELOCITY_MPS) {
    velocityWarnings.push({
      location: `Header (${header.dn})`,
      velocity_mps: header.velocity_mps,
      limit_mps: MAX_VELOCITY_MPS,
    });
  }

  // Header Reynolds number
  const header_d_m = header.diameter_mm / 1000;
  const headerRe = (density_kgm3 * header.velocity_mps * header_d_m) / viscosity_Pas;

  // Header friction and piping pressure drop
  const headerRelRoughness = (PIPE_ROUGHNESS_MM / 1000) / header_d_m;
  const headerFriction = churchillFrictionFactor(headerRe, headerRelRoughness);
  const headerPipeDp = darcyWeisbachDp(headerFriction, HEADER_PIPE_LENGTH_M, header_d_m, density_kgm3, header.velocity_mps);

  // Per-rack branch analysis
  let totalColdPlateDp = 0;
  let totalBranchPipingDp = 0;
  const liquidRacks = racks.filter(r => {
    if (!r.slot) return false;
    const p = platformMap.get(r.slot.platformId);
    return p && p.coolingType === 'liquid';
  });

  const liquidRackCount = liquidRacks.length;
  const manifoldDp = liquidRackCount * MANIFOLD_DP_PER_RACK_BAR;

  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (!platform || platform.coolingType !== 'liquid') continue;

    const thermalRack = thermal.perRack.find(r => r.rackId === rack.id);
    if (!thermalRack || thermalRack.flow_Lpm <= 0) continue;

    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    const platformName = `${platform.name}${oem ? ` (${oem.oemName})` : ''}`;

    // Cold plate ΔP: nodes connect in parallel to the rack manifold,
    // so rack ΔP = single node cold plate ΔP (not multiplied by node count)
    const coldPlateDp = platform.coldPlateDp_bar;

    // Branch pipe sizing (per-rack flow)
    const rackFlow_m3s = thermalRack.flow_Lpm / 60000;
    const branchPipe = selectPipeSize(rackFlow_m3s, MAX_VELOCITY_MPS);

    if (branchPipe.velocity_mps > MAX_VELOCITY_MPS) {
      velocityWarnings.push({
        location: `${rack.id} branch (${branchPipe.dn})`,
        velocity_mps: branchPipe.velocity_mps,
        limit_mps: MAX_VELOCITY_MPS,
      });
    }

    // Branch piping pressure drop
    const branch_d_m = branchPipe.diameter_mm / 1000;
    const branchRe = (density_kgm3 * branchPipe.velocity_mps * branch_d_m) / viscosity_Pas;
    const branchRelRoughness = (PIPE_ROUGHNESS_MM / 1000) / branch_d_m;
    const branchFriction = churchillFrictionFactor(branchRe, branchRelRoughness);
    const branchPipingDp = darcyWeisbachDp(branchFriction, PIPE_LENGTH_PER_RACK_M, branch_d_m, density_kgm3, branchPipe.velocity_mps);

    const branchTotalDp = coldPlateDp + branchPipingDp;

    perRackBranch.push({
      rackId: rack.id,
      platformName,
      coldPlate_bar: coldPlateDp,
      piping_bar: branchPipingDp,
      total_bar: branchTotalDp,
      flow_Lpm: thermalRack.flow_Lpm,
    });

    totalColdPlateDp = Math.max(totalColdPlateDp, coldPlateDp);
    totalBranchPipingDp = Math.max(totalBranchPipingDp, branchPipingDp);
  }

  // Flow imbalance risk: max branch dp / min branch dp > 1.5
  let flowImbalanceRisk = false;
  if (perRackBranch.length > 1) {
    const dpValues = perRackBranch.map(b => b.total_bar);
    const maxDp = Math.max(...dpValues);
    const minDp = Math.min(...dpValues);
    if (minDp > 0 && maxDp / minDp > 1.5) {
      flowImbalanceRisk = true;
    }
  }

  // Pressure drop budget (worst-case path through system)
  const fittingsDp = (totalColdPlateDp + totalBranchPipingDp + headerPipeDp + manifoldDp) * FITTING_LOSS_FRACTION;
  const totalSystemDp = totalColdPlateDp + manifoldDp + headerPipeDp + CDU_DP_BAR + fittingsDp;

  // Pump head in meters: H = ΔP / (ρg)
  const pumpHead_m = (totalSystemDp * 100000) / (density_kgm3 * 9.81);

  // Pump power: P = (Q × ΔP) / (η × 1000)
  // Q in m³/s, ΔP in Pa → W, then /1000 → kW
  const pumpPower_kW = (totalFlow_m3s * totalSystemDp * 100000) / (PUMP_EFFICIENCY * 1000);

  return {
    totalSystemDp_bar: totalSystemDp,
    pumpHead_m,
    pumpPower_kW,
    headerDiameter_mm: header.diameter_mm,
    headerDn: header.dn,
    pipeVelocity_mps: header.velocity_mps,
    reynoldsNumber: headerRe,
    perRackBranch,
    velocityWarnings,
    flowImbalanceRisk,
    dpBudget: {
      coldPlates_bar: totalColdPlateDp,
      manifold_bar: manifoldDp,
      piping_bar: headerPipeDp + totalBranchPipingDp,
      cdu_bar: CDU_DP_BAR,
      fittings_bar: fittingsDp,
      total_bar: totalSystemDp,
    },
  };
}
