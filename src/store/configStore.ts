import { create } from 'zustand';
import type {
  RackConfig, CoolantId, CduRedundancy,
  PlatformId, OemId, FullCalculationResult, ClimateProfile,
} from '../types';
import { runCalculations } from '../engine';
import { platformMap } from '../data/serverPlatforms';
import { getOemChassis } from '../data/oemConfigs';
import { RACK_HEIGHT_U } from '../data/containerSpecs';

/** Compute max nodes per rack accounting for OEM chassis U-height overrides */
function getMaxNodes(platformId: PlatformId, oemId: OemId): number {
  const platform = platformMap.get(platformId);
  if (!platform) return 0;
  if (platform.formFactor === 'full-rack') return 1;
  const oem = getOemChassis(platformId, oemId);
  const uPerNode = oem?.rackUnits ?? platform.rackUnits;
  return Math.floor(RACK_HEIGHT_U / uPerNode);
}

interface ConfigState {
  // Container settings
  ambientTemp_C: number;
  coolantId: CoolantId;
  inletTemp_C: number;
  cduRedundancy: CduRedundancy;

  // Tier 2 settings
  climateProfile: ClimateProfile | null;
  electricityRate: number;          // $/kWh

  // Rack configuration
  racks: RackConfig[];

  // Calculated results
  results: FullCalculationResult | null;

  // Actions
  setAmbientTemp: (temp: number) => void;
  setCoolant: (id: CoolantId) => void;
  setInletTemp: (temp: number) => void;
  setCduRedundancy: (r: CduRedundancy) => void;
  setClimateProfile: (profile: ClimateProfile | null) => void;
  setElectricityRate: (rate: number) => void;
  setRackSlot: (rackId: string, platformId: PlatformId, oemId: OemId) => void;
  clearRackSlot: (rackId: string) => void;
  setNodeCount: (rackId: string, count: number) => void;
  quickFill: (platformId: PlatformId, oemId: OemId) => void;
  clearAll: () => void;
  recalculate: () => void;
}

function createEmptyRacks(count: number): RackConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `rack-${i}`,
    position: i,
    slot: null,
  }));
}

/** Pre-fill 12 racks: 6× HGX B300 + 6× HGX B200, all Supermicro, full capacity */
function createDefaultRacks(): RackConfig[] {
  const b300Nodes = getMaxNodes('hgx-b300', 'supermicro'); // 10 nodes (4U × 10 = 40U)
  const b200Nodes = getMaxNodes('hgx-b200', 'supermicro'); // 10 nodes (4U × 10 = 40U)

  return Array.from({ length: INITIAL_RACK_COUNT }, (_, i) => ({
    id: `rack-${i}`,
    position: i,
    slot: i < 6
      ? { platformId: 'hgx-b300' as PlatformId, oemId: 'supermicro' as OemId, nodeCount: b300Nodes }
      : { platformId: 'hgx-b200' as PlatformId, oemId: 'supermicro' as OemId, nodeCount: b200Nodes },
  }));
}

const INITIAL_RACK_COUNT = 12;

const initialRacks = createDefaultRacks();
const initialResults = runCalculations(initialRacks, 'pg30', 20, 35, 'n+1', null, 0.10);

export const useConfigStore = create<ConfigState>((set, get) => ({
  ambientTemp_C: 35,
  coolantId: 'pg30',
  inletTemp_C: 20,
  cduRedundancy: 'n+1',
  climateProfile: null,
  electricityRate: 0.10,
  racks: initialRacks,
  results: initialResults,

  setAmbientTemp: (temp) => {
    set({ ambientTemp_C: temp });
    get().recalculate();
  },

  setCoolant: (id) => {
    set({ coolantId: id });
    get().recalculate();
  },

  setInletTemp: (temp) => {
    set({ inletTemp_C: temp });
    get().recalculate();
  },

  setCduRedundancy: (r) => {
    set({ cduRedundancy: r });
    get().recalculate();
  },

  setClimateProfile: (profile) => {
    set({ climateProfile: profile });
    get().recalculate();
  },

  setElectricityRate: (rate) => {
    set({ electricityRate: rate });
    get().recalculate();
  },

  setRackSlot: (rackId, platformId, oemId) => {
    const platform = platformMap.get(platformId);
    if (!platform) return;

    set(state => ({
      racks: state.racks.map(rack =>
        rack.id === rackId
          ? {
              ...rack,
              slot: {
                platformId,
                oemId,
                nodeCount: getMaxNodes(platformId, oemId),
              },
            }
          : rack
      ),
    }));
    get().recalculate();
  },

  clearRackSlot: (rackId) => {
    set(state => ({
      racks: state.racks.map(rack =>
        rack.id === rackId ? { ...rack, slot: null } : rack
      ),
    }));
    get().recalculate();
  },

  setNodeCount: (rackId, count) => {
    set(state => ({
      racks: state.racks.map(rack =>
        rack.id === rackId && rack.slot
          ? { ...rack, slot: { ...rack.slot, nodeCount: count } }
          : rack
      ),
    }));
    get().recalculate();
  },

  quickFill: (platformId, oemId) => {
    const platform = platformMap.get(platformId);
    if (!platform) return;

    const maxNodes = getMaxNodes(platformId, oemId);
    set(state => ({
      racks: state.racks.map(rack => ({
        ...rack,
        slot: {
          platformId,
          oemId,
          nodeCount: maxNodes,
        },
      })),
    }));
    get().recalculate();
  },

  clearAll: () => {
    set({ racks: createEmptyRacks(INITIAL_RACK_COUNT), results: null });
  },

  recalculate: () => {
    const { racks, coolantId, inletTemp_C, ambientTemp_C, cduRedundancy, climateProfile, electricityRate } = get();
    const results = runCalculations(racks, coolantId, inletTemp_C, ambientTemp_C, cduRedundancy, climateProfile, electricityRate);
    set({ results });
  },
}));
