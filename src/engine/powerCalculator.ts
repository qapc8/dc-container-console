import type { RackConfig, PowerResult } from '../types';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';

export function calculatePower(racks: RackConfig[]): PowerResult {
  const perRack = racks.map(rack => {
    if (!rack.slot) {
      return { rackId: rack.id, it_kW: 0, liquid_kW: 0, air_kW: 0 };
    }

    const platform = platformMap.get(rack.slot.platformId);
    const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
    if (!platform) {
      return { rackId: rack.id, it_kW: 0, liquid_kW: 0, air_kW: 0 };
    }

    const basePower = platform.powerPerUnit_kW * rack.slot.nodeCount;
    const oemOverhead = oem ? oem.additionalPower_kW * rack.slot.nodeCount : 0;
    const totalIT = basePower + oemOverhead;
    // OEM may override the liquid fraction (e.g. Dell 70% vs Supermicro 98%)
    const liquidFraction = oem?.liquidFractionOverride ?? platform.liquidFraction;
    const liquidHeat = totalIT * liquidFraction;
    const airHeat = totalIT * (1 - liquidFraction);

    return {
      rackId: rack.id,
      it_kW: totalIT,
      liquid_kW: liquidHeat,
      air_kW: airHeat,
    };
  });

  const totalIT = perRack.reduce((sum, r) => sum + r.it_kW, 0);
  const totalLiquid = perRack.reduce((sum, r) => sum + r.liquid_kW, 0);
  const totalAir = perRack.reduce((sum, r) => sum + r.air_kW, 0);
  const activePowers = perRack.filter(r => r.it_kW > 0).map(r => r.it_kW);

  return {
    totalIT_kW: totalIT,
    totalLiquidHeat_kW: totalLiquid,
    totalAirHeat_kW: totalAir,
    perRack,
    peakRack_kW: activePowers.length > 0 ? Math.max(...activePowers) : 0,
    avgRack_kW: activePowers.length > 0 ? totalIT / activePowers.length : 0,
  };
}
