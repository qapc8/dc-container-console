import type { CduRedundancy, CduResult } from '../types';

// Standard CDU sizes available (kW)
const CDU_SIZES_KW = [50, 100, 150, 200, 250, 300, 350];

// Pump power as fraction of CDU capacity
const PUMP_POWER_FRACTION = 0.02; // ~2% of CDU capacity

// CDU footprint width in meters
const CDU_WIDTH_M = 0.6;

/**
 * CDU sizing: total CDU capacity >= liquid heat load × 1.2 (20% margin)
 */
export function sizeCdu(
  totalLiquidHeat_kW: number,
  redundancy: CduRedundancy,
): CduResult {
  if (totalLiquidHeat_kW <= 0) {
    return {
      requiredCapacity_kW: 0,
      selectedSize_kW: 0,
      activeCount: 0,
      redundantCount: 0,
      totalCount: 0,
      totalPumpPower_kW: 0,
      widthUsed_m: 0,
    };
  }

  const requiredCapacity = totalLiquidHeat_kW * 1.2;

  // Find smallest CDU size that minimizes total count
  let bestSize = CDU_SIZES_KW[CDU_SIZES_KW.length - 1];
  let bestCount = Math.ceil(requiredCapacity / bestSize);

  for (const size of CDU_SIZES_KW) {
    const count = Math.ceil(requiredCapacity / size);
    // Prefer fewer units of larger size, but not oversized
    if (count * size <= bestCount * bestSize * 1.3 && count <= bestCount + 1) {
      if (count <= bestCount) {
        bestSize = size;
        bestCount = count;
      }
    }
  }

  const activeCount = bestCount;
  const redundantCount = redundancy === '2n' ? activeCount : 1;
  const totalCount = activeCount + redundantCount;
  const pumpPowerPerCdu = bestSize * PUMP_POWER_FRACTION;
  const totalPumpPower = totalCount * pumpPowerPerCdu;

  return {
    requiredCapacity_kW: requiredCapacity,
    selectedSize_kW: bestSize,
    activeCount,
    redundantCount,
    totalCount,
    totalPumpPower_kW: totalPumpPower,
    widthUsed_m: totalCount * CDU_WIDTH_M,
  };
}
