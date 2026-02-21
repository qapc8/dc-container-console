import type { OemChassis, OemId, PlatformId } from '../types';

export const oemList: { id: OemId; name: string }[] = [
  { id: 'dell', name: 'Dell Technologies' },
  { id: 'hpe', name: 'Hewlett Packard Enterprise' },
  { id: 'lenovo', name: 'Lenovo' },
  { id: 'supermicro', name: 'Supermicro' },
];

export const oemConfigs: OemChassis[] = [
  // ── Dell ──
  { oemId: 'dell', oemName: 'Dell', platformId: 'gb300-nvl72', chassisModel: 'PowerEdge XE9712', rackUnits: 48, additionalPower_kW: 2.5, weightOverhead_kg: 80, sourceIds: ['nvidia-gb300-product'] },
  { oemId: 'dell', oemName: 'Dell', platformId: 'gb200-nvl72', chassisModel: 'PowerEdge XE9712', rackUnits: 48, additionalPower_kW: 2.0, weightOverhead_kg: 100, sourceIds: ['dell-xe9680l'] },
  { oemId: 'dell', oemName: 'Dell', platformId: 'hgx-b300', chassisModel: 'PowerEdge XE9685L', rackUnits: 4, additionalPower_kW: 0.3, weightOverhead_kg: 15, sourceIds: ['dell-xe9685l'] },
  { oemId: 'dell', oemName: 'Dell', platformId: 'hgx-b200', chassisModel: 'PowerEdge XE9680L', rackUnits: 4, additionalPower_kW: 0.3, weightOverhead_kg: 15, liquidFractionOverride: 0.70, sourceIds: ['dell-xe9680l', 'dell-xe9685l'] },
  { oemId: 'dell', oemName: 'Dell', platformId: 'xeon-6', chassisModel: 'PowerEdge R770', rackUnits: 2, additionalPower_kW: 0.05, weightOverhead_kg: 3, sourceIds: ['intel-xeon6-datasheet'] },
  { oemId: 'dell', oemName: 'Dell', platformId: 'epyc-9005', chassisModel: 'PowerEdge R7725', rackUnits: 2, additionalPower_kW: 0.05, weightOverhead_kg: 3, sourceIds: ['amd-epyc9005-datasheet'] },

  // ── HPE ──
  { oemId: 'hpe', oemName: 'HPE', platformId: 'gb300-nvl72', chassisModel: 'NVIDIA GB300 NVL72 by HPE', rackUnits: 48, additionalPower_kW: 2.8, weightOverhead_kg: 85, sourceIds: ['nvidia-gb300-product'] },
  { oemId: 'hpe', oemName: 'HPE', platformId: 'gb200-nvl72', chassisModel: 'NVIDIA GB200 NVL72 by HPE', rackUnits: 48, additionalPower_kW: 2.2, weightOverhead_kg: 110, sourceIds: ['nvidia-gb200-product'] },
  { oemId: 'hpe', oemName: 'HPE', platformId: 'hgx-b300', chassisModel: 'ProLiant DL380a Gen12', rackUnits: 4, additionalPower_kW: 0.35, weightOverhead_kg: 18, sourceIds: ['supermicro-hgx-b300'] },
  { oemId: 'hpe', oemName: 'HPE', platformId: 'hgx-b200', chassisModel: 'ProLiant DL380a Gen12', rackUnits: 4, additionalPower_kW: 0.35, weightOverhead_kg: 18, sourceIds: ['nvidia-dgx-b200-guide'] },
  { oemId: 'hpe', oemName: 'HPE', platformId: 'xeon-6', chassisModel: 'ProLiant DL380 Gen12', rackUnits: 2, additionalPower_kW: 0.05, weightOverhead_kg: 4, sourceIds: ['intel-xeon6-datasheet'] },
  { oemId: 'hpe', oemName: 'HPE', platformId: 'epyc-9005', chassisModel: 'ProLiant DL385 Gen11', rackUnits: 2, additionalPower_kW: 0.05, weightOverhead_kg: 4, sourceIds: ['amd-epyc9005-datasheet'] },

  // ── Lenovo ──
  { oemId: 'lenovo', oemName: 'Lenovo', platformId: 'gb300-nvl72', chassisModel: 'NVIDIA GB300 NVL72 by Lenovo', rackUnits: 48, additionalPower_kW: 2.6, weightOverhead_kg: 75, sourceIds: ['nvidia-gb300-product'] },
  { oemId: 'lenovo', oemName: 'Lenovo', platformId: 'gb200-nvl72', chassisModel: 'NVIDIA GB200 NVL72 by Lenovo', rackUnits: 48, additionalPower_kW: 2.1, weightOverhead_kg: 95, sourceIds: ['nvidia-gb200-product'] },
  { oemId: 'lenovo', oemName: 'Lenovo', platformId: 'hgx-b300', chassisModel: 'ThinkSystem SR685a V3', rackUnits: 4, additionalPower_kW: 0.28, weightOverhead_kg: 14, sourceIds: ['supermicro-hgx-b300'] },
  { oemId: 'lenovo', oemName: 'Lenovo', platformId: 'hgx-b200', chassisModel: 'ThinkSystem SR780a V3', rackUnits: 5, additionalPower_kW: 0.28, weightOverhead_kg: 14, liquidFractionOverride: 0.75, sourceIds: ['lenovo-sr780a-v3', 'lenovopress-b200-gpu'] },
  { oemId: 'lenovo', oemName: 'Lenovo', platformId: 'xeon-6', chassisModel: 'ThinkSystem SR650 V4', rackUnits: 2, additionalPower_kW: 0.04, weightOverhead_kg: 3, sourceIds: ['intel-xeon6-datasheet'] },
  { oemId: 'lenovo', oemName: 'Lenovo', platformId: 'epyc-9005', chassisModel: 'ThinkSystem SR665 V3', rackUnits: 2, additionalPower_kW: 0.04, weightOverhead_kg: 3, sourceIds: ['amd-epyc9005-datasheet'] },

  // ── Supermicro ──
  { oemId: 'supermicro', oemName: 'Supermicro', platformId: 'gb300-nvl72', chassisModel: 'SRS-GB300-NVL72', rackUnits: 48, additionalPower_kW: 2.3, weightOverhead_kg: 70, sourceIds: ['supermicro-gb300-nvl72'] },
  { oemId: 'supermicro', oemName: 'Supermicro', platformId: 'gb200-nvl72', chassisModel: 'SRS-GB200-NVL72', rackUnits: 48, additionalPower_kW: 1.9, weightOverhead_kg: 90, sourceIds: ['nvidia-gb200-product'] },
  { oemId: 'supermicro', oemName: 'Supermicro', platformId: 'hgx-b300', chassisModel: 'SYS-421GE-TNHR2-LCC', rackUnits: 4, additionalPower_kW: 0.25, weightOverhead_kg: 12, liquidFractionOverride: 0.98, inletTempRangeOverride_C: [15, 45], sourceIds: ['supermicro-hgx-b300', 'supermicro-dlc2'] },
  { oemId: 'supermicro', oemName: 'Supermicro', platformId: 'hgx-b200', chassisModel: 'SYS-421GE-NBRT-LCC', rackUnits: 4, additionalPower_kW: 0.25, weightOverhead_kg: 12, liquidFractionOverride: 0.92, sourceIds: ['supermicro-b200-lcc', 'supermicro-b200-press'] },
  { oemId: 'supermicro', oemName: 'Supermicro', platformId: 'xeon-6', chassisModel: 'SYS-622B-TRT', rackUnits: 2, additionalPower_kW: 0.04, weightOverhead_kg: 2, sourceIds: ['intel-xeon6-datasheet'] },
  { oemId: 'supermicro', oemName: 'Supermicro', platformId: 'epyc-9005', chassisModel: 'AS-2126HS-TN', rackUnits: 2, additionalPower_kW: 0.04, weightOverhead_kg: 2, sourceIds: ['amd-epyc9005-datasheet'] },
];

export function getOemForPlatform(platformId: PlatformId): OemChassis[] {
  return oemConfigs.filter(c => c.platformId === platformId);
}

export function getOemChassis(platformId: PlatformId, oemId: OemId): OemChassis | undefined {
  return oemConfigs.find(c => c.platformId === platformId && c.oemId === oemId);
}
