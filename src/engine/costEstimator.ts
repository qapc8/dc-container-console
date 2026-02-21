import type {
  CduResult, HeatRejectionResult, HydraulicResult, PowerResult,
  RackConfig, AnnualPueResult, ClusterThermalSummary, CostResult, CapexBreakdown,
} from '../types';
import { platformMap } from '../data/serverPlatforms';

// CAPEX unit costs
const CDU_COST_PER_KW = 500;          // $/kW of CDU capacity
const CDU_BASE_COST = 30000;           // base per CDU
const PIPING_COST_PER_M = 300;         // $/m installed
const MANIFOLD_COST_PER_RACK = 8000;   // $/rack position
const DRY_COOLER_COST_PER_KW = 400;    // $/kW
const CHILLER_COST_PER_KW = 600;       // $/kW
const CONTROLS_COST = 30000;           // flat for BMS/controls

// OPEX
const COOLANT_COST_PER_L = 5;          // $/L for PG mix
const COOLANT_REPLACEMENT_YEARS = 3;   // replace every N years
const MAINTENANCE_LABOR_PER_CDU = 5000; // $/year per CDU

// Piping estimate: header + branch runs
const HEADER_LENGTH_M = 30;
const BRANCH_LENGTH_PER_RACK_M = 6;

// Discount rate for NPV
const DEFAULT_DISCOUNT_RATE = 0.08;

// TCO horizon
const TCO_YEARS = 5;

export function estimateCost(
  cdu: CduResult,
  heatRejection: HeatRejectionResult,
  hydraulic: HydraulicResult,
  power: PowerResult,
  racks: RackConfig[],
  climate: AnnualPueResult | null,
  clusterThermal: ClusterThermalSummary,
  electricityRate: number, // $/kWh
  discountRate: number = DEFAULT_DISCOUNT_RATE,
): CostResult {
  const liquidRackCount = racks.filter(r => {
    if (!r.slot) return false;
    const p = platformMap.get(r.slot.platformId);
    return p && p.coolingType === 'liquid';
  }).length;

  // --- CAPEX ---
  const cduCost = cdu.totalCount * (CDU_BASE_COST + cdu.selectedSize_kW * CDU_COST_PER_KW);
  const pipingLength = HEADER_LENGTH_M + liquidRackCount * BRANCH_LENGTH_PER_RACK_M;
  const pipingCost = pipingLength * PIPING_COST_PER_M;
  const manifoldCost = liquidRackCount * MANIFOLD_COST_PER_RACK;

  let dryCoolerCost = 0;
  let chillerCost = 0;
  if (heatRejection.method === 'dry-cooler' && heatRejection.dryCoolerSpec) {
    dryCoolerCost = heatRejection.dryCoolerSpec.capacity_kW * DRY_COOLER_COST_PER_KW;
  } else if (heatRejection.method === 'chiller' && heatRejection.chillerSpec) {
    chillerCost = heatRejection.chillerSpec.capacity_kW * CHILLER_COST_PER_KW;
  } else if (heatRejection.method === 'hybrid') {
    if (heatRejection.dryCoolerSpec) {
      dryCoolerCost = heatRejection.dryCoolerSpec.capacity_kW * DRY_COOLER_COST_PER_KW;
    }
    if (heatRejection.chillerSpec) {
      chillerCost = heatRejection.chillerSpec.capacity_kW * CHILLER_COST_PER_KW;
    }
  }

  const capexTotal = cduCost + pipingCost + manifoldCost + dryCoolerCost + chillerCost + CONTROLS_COST;

  const capex: CapexBreakdown = {
    cdus: cduCost,
    piping: pipingCost,
    manifolds: manifoldCost,
    dryCooler: dryCoolerCost,
    chiller: chillerCost,
    controls: CONTROLS_COST,
    total: capexTotal,
  };

  // --- OPEX ---
  // Electricity: use climate annual energy if available, else estimate from PUE
  let annualEnergy_MWh: number;
  if (climate) {
    annualEnergy_MWh = climate.annualEnergy_MWh;
  } else {
    // Approximate: facility power × 8760 hours
    const coolingPower = hydraulic.pumpPower_kW + heatRejection.totalPower_kW;
    const distributionLoss = power.totalIT_kW * 0.04;
    const facilityPower = power.totalIT_kW + coolingPower + distributionLoss;
    annualEnergy_MWh = facilityPower * 8760 / 1000;
  }

  // Only count cooling-related electricity (not IT load — that's the customer's cost)
  const coolingEnergyFraction = climate
    ? 1 - (power.totalIT_kW * 8760 / 1000) / Math.max(climate.annualEnergy_MWh, 1)
    : (hydraulic.pumpPower_kW + heatRejection.totalPower_kW + power.totalIT_kW * 0.04) /
      Math.max(power.totalIT_kW + hydraulic.pumpPower_kW + heatRejection.totalPower_kW + power.totalIT_kW * 0.04, 1);

  const coolingElectricity = annualEnergy_MWh * coolingEnergyFraction * 1000 * electricityRate;

  // Coolant replacement
  const coolantVolume = clusterThermal.estimatedCoolantVolume_L;
  const coolantReplacement = (coolantVolume * COOLANT_COST_PER_L) / COOLANT_REPLACEMENT_YEARS;

  // Maintenance labor
  const maintenanceCost = cdu.totalCount * MAINTENANCE_LABOR_PER_CDU;

  const opexAnnual = {
    electricity: coolingElectricity,
    coolantReplacement,
    maintenance: maintenanceCost,
    total: coolingElectricity + coolantReplacement + maintenanceCost,
  };

  // --- TCO 5-year (NPV) ---
  let tco = capexTotal;
  for (let year = 1; year <= TCO_YEARS; year++) {
    tco += opexAnnual.total / Math.pow(1 + discountRate, year);
  }

  // --- Per-GPU-hour cooling cost ---
  let gpuCount = 0;
  for (const rack of racks) {
    if (!rack.slot) continue;
    const platform = platformMap.get(rack.slot.platformId);
    if (platform?.gpuCount) {
      gpuCount += platform.gpuCount * rack.slot.nodeCount;
    }
  }
  const costPerGpuHour = gpuCount > 0
    ? opexAnnual.total / (gpuCount * 8760)
    : 0;

  return {
    capex,
    opexAnnual,
    tco5Year: tco,
    costPerGpuHour,
    discountRate,
    electricityRate,
  };
}
