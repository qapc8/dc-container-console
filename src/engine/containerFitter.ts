import type { RackConfig, ContainerFitResult } from '../types';
import { container40ft, RACK_WIDTH_M, RACK_GAP_M, CLEARANCE_M, RACK_WEIGHT_EMPTY_KG } from '../data/containerSpecs';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';

/**
 * Rack count fitting: floor((L_internal - 2×clearance - CDU_width) / (rack_width + gap))
 */
export function fitContainer(
  racks: RackConfig[],
  cduWidthUsed_m: number,
): ContainerFitResult {
  const L = container40ft.internalLength_m;
  const availableLength = L - 2 * CLEARANCE_M - cduWidthUsed_m;
  const maxRacks = Math.max(0, Math.floor(availableLength / (RACK_WIDTH_M + RACK_GAP_M)));

  const usedRacks = racks.filter(r => r.slot !== null).length;

  // Calculate weight
  let totalWeight = 0;
  const rackPositions: number[] = [];

  for (let i = 0; i < racks.length; i++) {
    const rack = racks[i];
    const xPos = CLEARANCE_M + i * (RACK_WIDTH_M + RACK_GAP_M);
    rackPositions.push(xPos);

    // Empty rack frame weight
    totalWeight += RACK_WEIGHT_EMPTY_KG;

    if (rack.slot) {
      const platform = platformMap.get(rack.slot.platformId);
      const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
      if (platform) {
        totalWeight += platform.weightPerUnit_kg * rack.slot.nodeCount;
        if (oem) {
          totalWeight += oem.weightOverhead_kg * rack.slot.nodeCount;
        }
      }
    }
  }

  // CDU weight estimate: ~200kg per CDU unit (rough)
  const cduCount = Math.ceil(cduWidthUsed_m / 0.6);
  totalWeight += cduCount * 200;

  // Aisle width: container internal width - rack depth
  // Racks on one side, aisle on the other
  const aisleWidth = container40ft.internalWidth_m - 1.2; // rack depth ~1.2m

  return {
    maxRacks,
    usedRacks,
    cduPositions: cduCount,
    aisleWidth_m: aisleWidth,
    totalWeight_kg: totalWeight,
    weightLimit_kg: container40ft.maxPayload_kg,
    overweight: totalWeight > container40ft.maxPayload_kg,
    rackPositions_m: rackPositions,
  };
}
