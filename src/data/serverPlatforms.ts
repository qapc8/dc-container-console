import type { ServerPlatform } from '../types';

/**
 * Server platform specifications.
 * Each entry includes sourceIds referencing dataSources.ts for traceability.
 * Inlet temperature ranges are critical for cooling loop compatibility —
 * platforms sharing a loop must have overlapping inlet temp ranges.
 */
export const serverPlatforms: ServerPlatform[] = [
  {
    id: 'gb300-nvl72',
    name: 'NVIDIA GB300 NVL72',
    formFactor: 'full-rack',
    rackUnits: 48,               // Supermicro SRS-GB300-NVL72 is 48U rack
    coolingType: 'liquid',
    // 72 B300 GPUs + 36 Grace CPUs in a single rack
    // Supermicro SRS-GB300-NVL72: 8× 33kW power shelves ≈ 132kW capacity
    // NVIDIA reference: ~120–140kW range depending on workload
    powerPerUnit_kW: 132,
    liquidFraction: 0.90,         // ~90% liquid at rack level (Sunbird, Introl)
    flowPerUnit_Lpm: 80,
    inletTemp_C: 20,              // Aligned with GB200 NVL72 range
    inletTempRange_C: [20, 25],   // Consistent with GB200 NVL72 (no GB300-specific range published)
    maxDeltaT_C: 15,
    weightPerUnit_kg: 1360,
    maxPerRack: 1,
    tdpGpu_W: 1400,
    gpuCount: 72,
    cpuCount: 36,
    coldPlateDp_bar: 1.0,
    minFlowPerUnit_Lpm: 60,
    coolantVolumePerUnit_L: 200,  // Aligned with GB200 NVL72 (Introl: 200L)
    sourceIds: ['nvidia-gb300-product', 'supermicro-gb300-nvl72', 'sunbird-gb300-power', 'glennklockwood-b300'],
  },
  {
    id: 'gb200-nvl72',
    name: 'NVIDIA GB200 NVL72',
    formFactor: 'full-rack',
    rackUnits: 48,               // Dell XE9712 / Supermicro confirm 48U rack
    coolingType: 'liquid',
    // 72 Blackwell GPUs + 36 Grace CPUs
    // NVIDIA reference: 120kW (115kW liquid + ~5kW air), 200L coolant volume
    powerPerUnit_kW: 120,
    liquidFraction: 0.87,
    flowPerUnit_Lpm: 80,
    inletTemp_C: 22,
    inletTempRange_C: [20, 25],
    maxDeltaT_C: 15,
    // Compute tray ~1,500kg; full system with NVLink switch tray ~3,000kg
    weightPerUnit_kg: 1500,
    maxPerRack: 1,
    tdpGpu_W: 1200,
    gpuCount: 72,
    cpuCount: 36,
    coldPlateDp_bar: 0.8,
    minFlowPerUnit_Lpm: 60,
    coolantVolumePerUnit_L: 200,
    sourceIds: ['nvidia-gb200-product', 'introl-gb200-deploy', 'theregister-gb200'],
  },
  {
    id: 'hgx-b300',
    name: 'NVIDIA HGX B300 (4U LC node)',
    formFactor: '4u-node',
    rackUnits: 4,
    coolingType: 'liquid',
    // 8× B300 SXM GPUs per node
    // GPU TDP: 1,400W max / 1,100W OEM sustained (Supermicro DLC-2)
    // Total node: 8×1,100W GPU + 2 CPUs + overhead ≈ 10.5kW
    // Supermicro DLC-2: up to 98% liquid cooling, supports 45°C warm water
    powerPerUnit_kW: 10.5,
    liquidFraction: 0.98,
    flowPerUnit_Lpm: 15,
    inletTemp_C: 25,
    inletTempRange_C: [15, 45],
    maxDeltaT_C: 10,
    weightPerUnit_kg: 90,
    maxPerRack: 10,
    tdpGpu_W: 1100,
    gpuCount: 8,
    cpuCount: 2,
    coldPlateDp_bar: 0.7,
    minFlowPerUnit_Lpm: 10,
    coolantVolumePerUnit_L: 4,
    sourceIds: [
      'supermicro-hgx-b300', 'supermicro-dlc2', 'nvidia-dgx-b300-guide',
      'tomshw-b300-tdp', 'techpowerup-b300', 'verda-b300-b200',
    ],
  },
  {
    id: 'hgx-b200',
    name: 'NVIDIA HGX B200 (4U LC node)',
    formFactor: '4u-node',
    rackUnits: 4,
    coolingType: 'liquid',
    // 8× B200 SXM6 GPUs per node, 180GB HBM3e each
    // GPU TDP: 1,200W liquid / 1,000W air
    // Total node: 8×1,200W GPU + 2 CPUs (~350W each) + overhead ≈ 12kW
    // NVIDIA reference: 20 L/min per node, <1.5 bar pressure drop
    // Supermicro DLC-2: up to 92% liquid cooling
    powerPerUnit_kW: 12.0,
    liquidFraction: 0.92,
    flowPerUnit_Lpm: 20,
    inletTemp_C: 25,
    inletTempRange_C: [15, 30],
    maxDeltaT_C: 10,
    // Supermicro SYS-421GE-NBRT-LCC: 87kg net / 103kg gross
    // Dell XE9680L: 95.6kg; Lenovo SR780a V3: 92kg
    weightPerUnit_kg: 95,
    maxPerRack: 10,
    tdpGpu_W: 1200,
    gpuCount: 8,
    cpuCount: 2,
    coldPlateDp_bar: 0.8,
    minFlowPerUnit_Lpm: 14,
    coolantVolumePerUnit_L: 4,
    sourceIds: [
      'nvidia-dgx-b200-guide', 'supermicro-b200-lcc', 'dell-xe9680l',
      'dell-xe9685l', 'lenovo-sr780a-v3', 'fibermall-b200-cooling',
      'introl-b200-deploy', 'lenovopress-b200-gpu',
    ],
  },
  {
    id: 'xeon-6',
    name: 'Intel Xeon 6 (2U Server)',
    formFactor: '2u-server',
    rackUnits: 2,
    coolingType: 'air',
    powerPerUnit_kW: 1.5,
    liquidFraction: 0,
    flowPerUnit_Lpm: 0,
    inletTemp_C: 25,
    // ASHRAE A1 class: 18–27°C recommended; A2: 10–35°C allowable
    inletTempRange_C: [18, 35],
    maxDeltaT_C: 0,
    weightPerUnit_kg: 35,
    maxPerRack: 21,
    cpuCount: 2,
    coldPlateDp_bar: 0,
    minFlowPerUnit_Lpm: 0,
    coolantVolumePerUnit_L: 0,
    sourceIds: ['intel-xeon6-datasheet', 'ashrae-tc-2021'],
  },
  {
    id: 'epyc-9005',
    name: 'AMD EPYC 9005 (2U Server)',
    formFactor: '2u-server',
    rackUnits: 2,
    coolingType: 'air',
    powerPerUnit_kW: 1.2,
    liquidFraction: 0,
    flowPerUnit_Lpm: 0,
    inletTemp_C: 25,
    inletTempRange_C: [18, 35],
    maxDeltaT_C: 0,
    weightPerUnit_kg: 32,
    maxPerRack: 21,
    cpuCount: 2,
    coldPlateDp_bar: 0,
    minFlowPerUnit_Lpm: 0,
    coolantVolumePerUnit_L: 0,
    sourceIds: ['amd-epyc9005-datasheet', 'ashrae-tc-2021'],
  },
];

export const platformMap = new Map(serverPlatforms.map(p => [p.id, p]));
