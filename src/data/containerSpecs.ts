import type { ContainerSpec } from '../types';

export const container40ft: ContainerSpec = {
  name: '40ft High-Cube ISO Container',
  externalLength_m: 12.192,
  externalWidth_m: 2.438,
  externalHeight_m: 2.896,
  internalLength_m: 12.032,
  internalWidth_m: 2.352,
  internalHeight_m: 2.698,
  maxPayload_kg: 26480,
  tareWeight_kg: 3800,
  maxGrossWeight_kg: 30480,
};

// Standard rack dimensions
export const RACK_WIDTH_M = 0.600;       // 600mm standard rack
export const RACK_DEPTH_M = 1.200;       // 1200mm server rack depth
export const RACK_HEIGHT_U = 42;
export const RACK_GAP_M = 0.025;         // 25mm gap between racks
export const CLEARANCE_M = 0.150;        // 150mm wall clearance each end
export const CDU_WIDTH_M = 0.600;        // CDU footprint width
export const CDU_DEPTH_M = 0.800;
export const AISLE_MIN_M = 0.600;        // minimum aisle width
export const RACK_WEIGHT_EMPTY_KG = 120; // empty rack frame weight
