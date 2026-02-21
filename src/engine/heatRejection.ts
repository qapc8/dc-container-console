import type { HeatRejectionResult, ChillerSpec, HeatExchangerSpec, DryCoolerSpec } from '../types';

// Approach temperature for dry cooler (°C)
const DRY_COOLER_APPROACH = 8;

// Fan power as fraction of heat rejected
const DRY_COOLER_FAN_FRACTION = 0.03;  // ~3%

// Chiller COP (coefficient of performance)
const CHILLER_COP = 4.0;

// Heat exchanger overall heat transfer coefficient (kW/m²K) for plate type
const HX_U_COEFFICIENT = 3;

/**
 * Heat rejection method selection:
 * - Dry cooler if T_ambient < T_inlet - approach
 * - Chiller if T_ambient >= T_inlet - approach
 * - Hybrid if marginal (within 3°C)
 *
 * Now also builds detailed equipment specs (DryCoolerSpec, ChillerSpec, HeatExchangerSpec).
 */
export function sizeHeatRejection(
  totalLiquidHeat_kW: number,
  totalAirHeat_kW: number,
  ambientTemp_C: number,
  inletTemp_C: number,
  coolantReturnTemp_C?: number,
): HeatRejectionResult {
  if (totalLiquidHeat_kW + totalAirHeat_kW <= 0) {
    return {
      method: 'dry-cooler',
      capacity_kW: 0,
      fanPower_kW: 0,
      compressorPower_kW: 0,
      totalPower_kW: 0,
      approachTemp_C: DRY_COOLER_APPROACH,
    };
  }

  const totalHeat = totalLiquidHeat_kW + totalAirHeat_kW;
  const margin = inletTemp_C - DRY_COOLER_APPROACH - ambientTemp_C;
  const designCapacity = totalHeat * 1.15; // 15% margin
  const returnTemp = coolantReturnTemp_C ?? (inletTemp_C + 12); // fallback estimate

  let method: HeatRejectionResult['method'];
  let fanPower: number;
  let compressorPower: number;
  let chillerSpec: ChillerSpec | undefined;
  let heatExchangerSpec: HeatExchangerSpec | undefined;
  let dryCoolerSpec: DryCoolerSpec | undefined;

  if (margin > 3) {
    // Dry cooler is sufficient
    method = 'dry-cooler';
    fanPower = totalHeat * DRY_COOLER_FAN_FRACTION;
    compressorPower = 0;

    dryCoolerSpec = buildDryCoolerSpec(designCapacity, totalHeat, ambientTemp_C, returnTemp, inletTemp_C);
    heatExchangerSpec = buildHeatExchangerSpec(designCapacity, returnTemp, inletTemp_C, ambientTemp_C, ambientTemp_C + DRY_COOLER_APPROACH);
  } else if (margin > 0) {
    // Marginal — hybrid (dry cooler + trim chiller)
    method = 'hybrid';
    const dryFraction = 0.7;
    fanPower = totalHeat * dryFraction * DRY_COOLER_FAN_FRACTION;
    compressorPower = (totalHeat * (1 - dryFraction)) / CHILLER_COP;

    const dryCapacity = designCapacity * dryFraction;
    const chillerCapacity = designCapacity * (1 - dryFraction);

    dryCoolerSpec = buildDryCoolerSpec(dryCapacity, totalHeat * dryFraction, ambientTemp_C, returnTemp, inletTemp_C);
    chillerSpec = buildChillerSpec(chillerCapacity, compressorPower, inletTemp_C, ambientTemp_C);
    heatExchangerSpec = buildHeatExchangerSpec(dryCapacity, returnTemp, inletTemp_C, ambientTemp_C, ambientTemp_C + DRY_COOLER_APPROACH);
  } else {
    // Chiller required
    method = 'chiller';
    fanPower = totalHeat * DRY_COOLER_FAN_FRACTION * 0.5; // condenser fans
    compressorPower = totalHeat / CHILLER_COP;

    chillerSpec = buildChillerSpec(designCapacity, compressorPower, inletTemp_C, ambientTemp_C);
  }

  return {
    method,
    capacity_kW: designCapacity,
    fanPower_kW: fanPower,
    compressorPower_kW: compressorPower,
    totalPower_kW: fanPower + compressorPower,
    approachTemp_C: DRY_COOLER_APPROACH,
    chillerSpec,
    heatExchangerSpec,
    dryCoolerSpec,
  };
}

function buildDryCoolerSpec(
  capacity_kW: number,
  heatLoad_kW: number,
  ambientTemp_C: number,
  fluidInTemp_C: number,
  fluidOutTemp_C: number,
): DryCoolerSpec {
  const fanCount = Math.max(2, Math.ceil(capacity_kW / 100));
  const fanPower = heatLoad_kW * DRY_COOLER_FAN_FRACTION;
  const deratingFactor = Math.max(0.5, 1 - (ambientTemp_C - 35) * 0.03);

  return {
    capacity_kW,
    fanCount,
    fanPower_kW: fanPower,
    approachTemp_C: DRY_COOLER_APPROACH,
    designAmbient_C: 35,
    deratingFactor,
    fluidInTemp_C,
    fluidOutTemp_C,
  };
}

function buildChillerSpec(
  capacity_kW: number,
  compressorPower_kW: number,
  inletTemp_C: number,
  ambientTemp_C: number,
): ChillerSpec {
  const evapApproach = 3;
  const condenserApproach = 10;
  const evapTemp = inletTemp_C - evapApproach;
  const condenserTemp = ambientTemp_C + condenserApproach;

  return {
    capacity_kW,
    cop: CHILLER_COP,
    eer: CHILLER_COP * 3.412,
    compressorPower_kW,
    evapTemp_C: evapTemp,
    evapApproach_C: evapApproach,
    condenserTemp_C: condenserTemp,
    condenserApproach_C: condenserApproach,
    refrigerant: 'R-410A',
  };
}

function buildHeatExchangerSpec(
  capacity_kW: number,
  primaryInTemp_C: number,
  primaryOutTemp_C: number,
  secondaryInTemp_C: number,
  secondaryOutTemp_C: number,
): HeatExchangerSpec {
  const approach = Math.min(
    Math.abs(primaryOutTemp_C - secondaryInTemp_C),
    Math.abs(primaryInTemp_C - secondaryOutTemp_C),
  );

  // LMTD calculation
  const dt1 = primaryInTemp_C - secondaryOutTemp_C;
  const dt2 = primaryOutTemp_C - secondaryInTemp_C;
  const lmtd = (dt1 !== dt2 && dt1 > 0 && dt2 > 0)
    ? (dt1 - dt2) / Math.log(dt1 / dt2)
    : Math.max(dt1, dt2, 1);

  // Area = Q / (U × LMTD)
  const estimatedArea = lmtd > 0 ? capacity_kW / (HX_U_COEFFICIENT * lmtd) : 0;
  // Plate HX footprint: roughly area / 50 (compact stacking)
  const estimatedFootprint = estimatedArea / 50;

  return {
    type: 'plate',
    capacity_kW,
    primaryInTemp_C,
    primaryOutTemp_C,
    secondaryInTemp_C,
    secondaryOutTemp_C,
    approach_C: Math.max(approach, 0),
    estimatedArea_m2: estimatedArea,
    estimatedFootprint_m2: Math.max(estimatedFootprint, 0.1),
  };
}
