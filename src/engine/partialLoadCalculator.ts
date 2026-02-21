import type {
  Coolant, PartialLoadResult, LoadScenario,
  PowerResult, ThermalResult, HydraulicResult,
} from '../types';

// Load points to evaluate
const LOAD_POINTS = [0.25, 0.50, 0.75, 1.0];

// Distribution loss fraction (matches pueEstimator.ts)
const DISTRIBUTION_LOSS_FRACTION = 0.04;

/**
 * Pump affinity laws: power scales with cube of speed ratio.
 * P₂/P₁ = (N₂/N₁)³, and N₂/N₁ ≈ Q₂/Q₁ for centrifugal pumps.
 */
function pumpPowerAtFlow(designPower_kW: number, flowRatio: number): number {
  return designPower_kW * Math.pow(flowRatio, 3);
}

/**
 * Estimate Reynolds number for the system at a given flow rate.
 * Uses header pipe parameters as representative.
 */
function estimateReynolds(
  flow_Lpm: number,
  headerDiameter_mm: number,
  coolant: { density_kgL: number; viscosity_cP: number },
): number {
  if (headerDiameter_mm <= 0 || flow_Lpm <= 0) return 0;
  const flow_m3s = flow_Lpm / 60000;
  const d_m = headerDiameter_mm / 1000;
  const area = Math.PI * Math.pow(d_m / 2, 2);
  const v = flow_m3s / area;
  const density_kgm3 = coolant.density_kgL * 1000;
  const viscosity_Pas = coolant.viscosity_cP / 1000;
  return (density_kgm3 * v * d_m) / viscosity_Pas;
}

export function calculatePartialLoad(
  _racks: unknown,
  coolant: Coolant,
  designPower: PowerResult,
  designThermal: ThermalResult,
  hydraulic: HydraulicResult,
  heatRejectionPower_kW: number,
): PartialLoadResult {
  const designPumpPower = hydraulic.pumpPower_kW;
  const designFlow = designThermal.totalFlow_Lpm;
  const designIT = designPower.totalIT_kW;

  if (designIT <= 0 || designFlow <= 0) {
    return {
      designPumpPower_kW: 0,
      loadScenarios: LOAD_POINTS.map(lp => ({
        loadPercent: lp * 100,
        itPower_kW: 0,
        flow_Lpm: 0,
        pumpSpeedPercent: lp * 100,
        pumpPower_kW: 0,
        pue: 1.0,
        reynoldsNumber: 0,
        laminarRisk: false,
      })),
    };
  }

  const loadScenarios: LoadScenario[] = LOAD_POINTS.map(loadFactor => {
    const itPower = designIT * loadFactor;
    const flow = designFlow * loadFactor;
    const pumpPower = pumpPowerAtFlow(designPumpPower, loadFactor);

    // Heat rejection power scales roughly linearly with load
    const hrPower = heatRejectionPower_kW * loadFactor;

    // PUE at this load point
    const coolingPower = pumpPower + hrPower;
    const distributionLoss = itPower * DISTRIBUTION_LOSS_FRACTION;
    const totalFacility = itPower + coolingPower + distributionLoss;
    const pue = itPower > 0 ? totalFacility / itPower : 1.0;

    // Reynolds check at partial flow
    const re = estimateReynolds(flow, hydraulic.headerDiameter_mm, coolant);
    const laminarRisk = re > 0 && re < 2300;

    return {
      loadPercent: loadFactor * 100,
      itPower_kW: itPower,
      flow_Lpm: flow,
      pumpSpeedPercent: loadFactor * 100,
      pumpPower_kW: pumpPower,
      pue,
      reynoldsNumber: re,
      laminarRisk,
    };
  });

  return {
    designPumpPower_kW: designPumpPower,
    loadScenarios,
  };
}
