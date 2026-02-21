import type { PueResult } from '../types';

// Distribution loss as fraction of IT power (PDU, UPS, cabling)
const DISTRIBUTION_LOSS_FRACTION = 0.04;  // ~4%

/**
 * PUE = (IT_power + cooling_power + distribution_loss) / IT_power
 */
export function estimatePue(
  itPower_kW: number,
  cduPumpPower_kW: number,
  heatRejectionPower_kW: number,
): PueResult {
  if (itPower_kW <= 0) {
    return {
      pue: 1.0,
      itPower_kW: 0,
      coolingPower_kW: 0,
      distributionLoss_kW: 0,
      totalFacilityPower_kW: 0,
    };
  }

  const coolingPower = cduPumpPower_kW + heatRejectionPower_kW;
  const distributionLoss = itPower_kW * DISTRIBUTION_LOSS_FRACTION;
  const totalFacility = itPower_kW + coolingPower + distributionLoss;
  const pue = totalFacility / itPower_kW;

  return {
    pue,
    itPower_kW: itPower_kW,
    coolingPower_kW: coolingPower,
    distributionLoss_kW: distributionLoss,
    totalFacilityPower_kW: totalFacility,
  };
}
