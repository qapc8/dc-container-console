import type {
  RackConfig, CoolantId, CduRedundancy,
  FullCalculationResult, ValidationWarning,
  ClimateProfile,
} from '../types';
import { coolantMap } from '../data/coolants';
import { calculatePower } from './powerCalculator';
import { calculateThermal, calculateClusterThermal } from './thermalCalculator';
import { sizeCdu } from './cduSizer';
import { estimatePue } from './pueEstimator';
import { fitContainer } from './containerFitter';
import { sizeHeatRejection } from './heatRejection';
import { evaluateCoolingLoopCompat, evaluateAshraeWClass } from './coolingCompat';
import { calculateHydraulic } from './hydraulicCalculator';
import { calculatePartialLoad } from './partialLoadCalculator';
import { designLoopArchitecture } from './loopArchitect';
import { analyzeRedundancy } from './redundancyAnalyzer';
import { analyzeClimate } from './climateAnalyzer';
import { estimateCost } from './costEstimator';

export function runCalculations(
  racks: RackConfig[],
  coolantId: CoolantId,
  inletTemp_C: number,
  ambientTemp_C: number,
  cduRedundancy: CduRedundancy,
  climateProfile?: ClimateProfile | null,
  electricityRate?: number,
): FullCalculationResult {
  const coolant = coolantMap.get(coolantId)!;

  // 1. Power
  const power = calculatePower(racks);

  // 2. Thermal
  const thermal = calculateThermal(racks, coolant, inletTemp_C);

  // 3. Cluster thermal aggregation
  const clusterThermal = calculateClusterThermal(thermal, power, coolant, inletTemp_C, racks);

  // 4. CDU sizing
  const cdu = sizeCdu(power.totalLiquidHeat_kW, cduRedundancy);

  // 5. Heat rejection
  const heatRejection = sizeHeatRejection(
    power.totalLiquidHeat_kW,
    power.totalAirHeat_kW,
    ambientTemp_C,
    inletTemp_C,
    clusterThermal.weightedReturnTemp_C,
  );

  // 6. Hydraulic analysis (Tier 1)
  const hydraulic = calculateHydraulic(racks, coolant, thermal, power);

  // 7. PUE — now uses hydraulic pump power instead of flat CDU pump estimate
  const pue = estimatePue(
    power.totalIT_kW,
    hydraulic.pumpPower_kW > 0 ? hydraulic.pumpPower_kW : cdu.totalPumpPower_kW,
    heatRejection.totalPower_kW,
  );

  // 8. Partial load analysis (Tier 1)
  const partialLoad = calculatePartialLoad(
    racks, coolant, power, thermal, hydraulic, heatRejection.totalPower_kW,
  );

  // 9. ASHRAE W-class (Tier 1)
  const ashraeWClass = evaluateAshraeWClass(racks);

  // 10. Loop architecture (Tier 1)
  const loopArchitecture = designLoopArchitecture(racks, coolant, inletTemp_C, thermal, power, clusterThermal);

  // 11. Container fit
  const containerResult = fitContainer(racks, cdu.widthUsed_m);

  // 12. Cooling loop compatibility
  const coolingCompat = evaluateCoolingLoopCompat(racks, inletTemp_C, thermal, power);

  // 13. Redundancy analysis (Tier 2)
  const redundancy = analyzeRedundancy(racks, cdu, power, coolant, heatRejection, ambientTemp_C);

  // 14. Climate analysis (Tier 2, optional)
  const climate = climateProfile
    ? analyzeClimate(climateProfile, power, heatRejection, hydraulic, inletTemp_C, clusterThermal.weightedReturnTemp_C)
    : null;

  // 15. Cost estimation (Tier 2, optional)
  const cost = electricityRate != null
    ? estimateCost(cdu, heatRejection, hydraulic, power, racks, climate, clusterThermal, electricityRate)
    : null;

  // 16. Validation warnings
  const warnings = [
    ...generateWarnings(power, thermal, containerResult, cdu),
    ...coolingCompat.warnings,
    ...generateHydraulicWarnings(hydraulic),
    ...generateRedundancyWarnings(redundancy),
  ];

  return {
    power, thermal, clusterThermal, cdu, pue,
    container: containerResult, heatRejection, coolingCompat, warnings,
    hydraulic, partialLoad, loopArchitecture, ashraeWClass,
    redundancy, climate, cost,
  };
}

function generateHydraulicWarnings(hydraulic: FullCalculationResult['hydraulic']): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (hydraulic.flowImbalanceRisk) {
    warnings.push({
      severity: 'warning',
      category: 'hydraulic',
      message: 'Flow imbalance risk: branch pressure drops differ by >50% — consider balancing valves',
    });
  }

  for (const vw of hydraulic.velocityWarnings) {
    warnings.push({
      severity: 'warning',
      category: 'hydraulic',
      message: `${vw.location}: velocity ${vw.velocity_mps.toFixed(2)} m/s exceeds ${vw.limit_mps} m/s ASHRAE erosion limit`,
    });
  }

  if (hydraulic.reynoldsNumber > 0 && hydraulic.reynoldsNumber < 2300) {
    warnings.push({
      severity: 'warning',
      category: 'hydraulic',
      message: `Header flow is laminar (Re=${hydraulic.reynoldsNumber.toFixed(0)}) — poor heat transfer in cold plates`,
    });
  }

  return warnings;
}

function generateRedundancyWarnings(redundancy: FullCalculationResult['redundancy']): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!redundancy.cduFailureScenario.canSurvive) {
    warnings.push({
      severity: 'critical',
      category: 'redundancy',
      message: `CDU failure: remaining capacity (${redundancy.cduFailureScenario.remainingCapacity_kW.toFixed(0)} kW) insufficient for load (${redundancy.cduFailureScenario.totalLoad_kW.toFixed(0)} kW)`,
    });
  }

  const fastThrottleRacks = redundancy.cduFailureScenario.perRackThrottle.filter(r => r.timeToThrottle_s < 30);
  if (fastThrottleRacks.length > 0) {
    warnings.push({
      severity: 'warning',
      category: 'redundancy',
      message: `${fastThrottleRacks.length} rack(s) reach thermal throttle in <30s during CDU failure`,
    });
  }

  return warnings;
}

function generateWarnings(
  power: FullCalculationResult['power'],
  thermal: FullCalculationResult['thermal'],
  container: FullCalculationResult['container'],
  cdu: FullCalculationResult['cdu'],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Weight
  if (container.overweight) {
    warnings.push({
      severity: 'critical',
      category: 'weight',
      message: `Container overweight: ${(container.totalWeight_kg / 1000).toFixed(1)}t exceeds ${(container.weightLimit_kg / 1000).toFixed(1)}t payload limit`,
    });
  } else if (container.totalWeight_kg > container.weightLimit_kg * 0.9) {
    warnings.push({
      severity: 'warning',
      category: 'weight',
      message: `Weight at ${((container.totalWeight_kg / container.weightLimit_kg) * 100).toFixed(0)}% of payload limit`,
    });
  }

  // Space
  if (container.usedRacks > container.maxRacks) {
    warnings.push({
      severity: 'critical',
      category: 'space',
      message: `Too many racks: ${container.usedRacks} configured but only ${container.maxRacks} fit in container`,
    });
  }

  // Power density
  if (power.peakRack_kW > 150) {
    warnings.push({
      severity: 'critical',
      category: 'power',
      message: `Peak rack power ${power.peakRack_kW.toFixed(0)} kW exceeds typical utility feed capacity`,
    });
  }

  // Thermal
  if (thermal.maxOutletTemp_C > 45) {
    warnings.push({
      severity: 'critical',
      category: 'thermal',
      message: `Max outlet temperature ${thermal.maxOutletTemp_C.toFixed(1)}°C exceeds safe limit (45°C)`,
    });
  } else if (thermal.maxOutletTemp_C > 40) {
    warnings.push({
      severity: 'warning',
      category: 'thermal',
      message: `Max outlet temperature ${thermal.maxOutletTemp_C.toFixed(1)}°C approaching limit`,
    });
  }

  // Flow
  if (thermal.totalFlow_Lpm > 2000) {
    warnings.push({
      severity: 'warning',
      category: 'flow',
      message: `Total flow rate ${thermal.totalFlow_Lpm.toFixed(0)} L/min — verify manifold sizing`,
    });
  }

  // Total power
  const maxContainerPower = 2000; // 2MW typical max
  if (power.totalIT_kW > maxContainerPower) {
    warnings.push({
      severity: 'warning',
      category: 'power',
      message: `Total IT power ${(power.totalIT_kW / 1000).toFixed(2)} MW — verify utility connection`,
    });
  }

  // CDU capacity check
  if (cdu.requiredCapacity_kW > 0 && cdu.selectedSize_kW * cdu.activeCount < cdu.requiredCapacity_kW * 0.95) {
    warnings.push({
      severity: 'warning',
      category: 'thermal',
      message: `CDU active capacity may be marginal for heat load`,
    });
  }

  // Aisle width
  if (container.aisleWidth_m < 0.6 && container.usedRacks > 0) {
    warnings.push({
      severity: 'warning',
      category: 'space',
      message: `Aisle width ${(container.aisleWidth_m * 100).toFixed(0)}cm below recommended 60cm minimum`,
    });
  }

  return warnings;
}

export { calculatePower } from './powerCalculator';
export { calculateThermal, calculateClusterThermal, requiredFlowRate } from './thermalCalculator';
export { sizeCdu } from './cduSizer';
export { estimatePue } from './pueEstimator';
export { fitContainer } from './containerFitter';
export { sizeHeatRejection } from './heatRejection';
export { evaluateCoolingLoopCompat, evaluateAshraeWClass } from './coolingCompat';
export { calculateHydraulic } from './hydraulicCalculator';
export { calculatePartialLoad } from './partialLoadCalculator';
export { designLoopArchitecture } from './loopArchitect';
export { analyzeRedundancy } from './redundancyAnalyzer';
export { analyzeClimate } from './climateAnalyzer';
export { estimateCost } from './costEstimator';
