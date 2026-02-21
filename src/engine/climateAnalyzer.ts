import type {
  ClimateProfile, PowerResult, HeatRejectionResult, HydraulicResult,
  AnnualPueResult, MonthlySummary,
} from '../types';

// Distribution loss fraction (must match pueEstimator.ts)
const DISTRIBUTION_LOSS_FRACTION = 0.04;

// Heat exchanger approach temperature for free cooling (°C)
const FREE_COOLING_APPROACH_C = 8;

// Chiller COP (matches heatRejection.ts)
const CHILLER_COP = 4.0;

// Fan power as fraction of heat rejection capacity (dry cooler)
const FAN_POWER_FRACTION = 0.03;

// Month names for summary
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Compute cooling power at a given ambient temperature.
 * Free cooling when ambient < returnTemp - approach; otherwise chiller assists.
 */
function coolingPowerAtAmbient(
  ambientTemp_C: number,
  returnTemp_C: number,
  totalHeat_kW: number,
  pumpPower_kW: number,
): { coolingPower_kW: number; isFreeCooling: boolean } {
  const freeCoolingPossible = ambientTemp_C < returnTemp_C - FREE_COOLING_APPROACH_C;

  if (freeCoolingPossible) {
    // Dry cooler only: fan power
    const fanPower = totalHeat_kW * FAN_POWER_FRACTION;
    return { coolingPower_kW: pumpPower_kW + fanPower, isFreeCooling: true };
  } else {
    // Chiller required
    const compressorPower = totalHeat_kW / CHILLER_COP;
    const fanPower = totalHeat_kW * FAN_POWER_FRACTION;
    return { coolingPower_kW: pumpPower_kW + compressorPower + fanPower, isFreeCooling: false };
  }
}

export function analyzeClimate(
  profile: ClimateProfile,
  power: PowerResult,
  _heatRejection: HeatRejectionResult,
  hydraulic: HydraulicResult,
  _inletTemp_C: number,
  returnTemp_C: number,
): AnnualPueResult {
  const itPower = power.totalIT_kW;
  const totalHeat = power.totalLiquidHeat_kW + power.totalAirHeat_kW;
  const pumpPower = hydraulic.pumpPower_kW;
  const distributionLoss = itPower * DISTRIBUTION_LOSS_FRACTION;

  if (itPower <= 0) {
    return {
      locationName: profile.locationName,
      annualPue: 1.0,
      freeCoolingHours: 0,
      chillerHours: 0,
      annualEnergy_MWh: 0,
      monthlySummary: MONTHS.map(m => ({
        month: m, avgAmbient_C: 0, avgPue: 1.0, freeCoolingHours: 0, chillerHours: 0,
      })),
    };
  }

  let totalFreeCoolingHours = 0;
  let totalChillerHours = 0;
  let weightedPueSum = 0;
  let totalHours = 0;
  let totalEnergy_kWh = 0;

  // Monthly accumulation (approximate: distribute bins across months proportionally)
  const monthlyData = MONTHS.map(() => ({
    hours: 0, pueWeightedSum: 0, ambientWeightedSum: 0,
    freeCoolingHours: 0, chillerHours: 0,
  }));

  for (const bin of profile.temperatureBins) {
    const binMidTemp = (bin.tempMin_C + bin.tempMax_C) / 2;
    const binHours = bin.hours;
    if (binHours <= 0) continue;

    const { coolingPower_kW, isFreeCooling } = coolingPowerAtAmbient(
      binMidTemp, returnTemp_C, totalHeat, pumpPower,
    );

    const facilityPower = itPower + coolingPower_kW + distributionLoss;
    const binPue = facilityPower / itPower;

    weightedPueSum += binPue * binHours;
    totalHours += binHours;
    totalEnergy_kWh += facilityPower * binHours;

    if (isFreeCooling) {
      totalFreeCoolingHours += binHours;
    } else {
      totalChillerHours += binHours;
    }

    // Distribute this bin's hours across months (proportional allocation)
    const hoursPerMonth = binHours / 12;
    for (let m = 0; m < 12; m++) {
      monthlyData[m].hours += hoursPerMonth;
      monthlyData[m].pueWeightedSum += binPue * hoursPerMonth;
      monthlyData[m].ambientWeightedSum += binMidTemp * hoursPerMonth;
      if (isFreeCooling) {
        monthlyData[m].freeCoolingHours += hoursPerMonth;
      } else {
        monthlyData[m].chillerHours += hoursPerMonth;
      }
    }
  }

  const annualPue = totalHours > 0 ? weightedPueSum / totalHours : 1.0;
  const annualEnergy_MWh = totalEnergy_kWh / 1000;

  const monthlySummary: MonthlySummary[] = MONTHS.map((month, m) => ({
    month,
    avgAmbient_C: monthlyData[m].hours > 0 ? monthlyData[m].ambientWeightedSum / monthlyData[m].hours : 0,
    avgPue: monthlyData[m].hours > 0 ? monthlyData[m].pueWeightedSum / monthlyData[m].hours : 1.0,
    freeCoolingHours: Math.round(monthlyData[m].freeCoolingHours),
    chillerHours: Math.round(monthlyData[m].chillerHours),
  }));

  return {
    locationName: profile.locationName,
    annualPue,
    freeCoolingHours: Math.round(totalFreeCoolingHours),
    chillerHours: Math.round(totalChillerHours),
    annualEnergy_MWh,
    monthlySummary,
  };
}
