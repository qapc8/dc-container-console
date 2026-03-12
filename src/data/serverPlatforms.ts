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
    liquidFraction: 0.90,         // ~90% liquid at rack level (HPE, Introl; Vertiv cites 80%)
    flowPerUnit_Lpm: 130,          // QCT/CoolIT CHx2000: ~150 L/min per rack; Introl: 12-15°C ΔT target
    inletTemp_C: 20,
    inletTempRange_C: [15, 25],   // Introl GB300: 15°C min DTC supply; 25°C upper per GB200 spec
    maxDeltaT_C: 15,              // At 130 L/min PG25: Q/(ṁCp) = 118.8kW/(2.225×3.940) = 13.5°C
    weightPerUnit_kg: 1360,
    maxPerRack: 1,
    tdpGpu_W: 1400,
    gpuCount: 72,
    cpuCount: 36,
    coldPlateDp_bar: 1.0,
    minFlowPerUnit_Lpm: 95,        // 73% of design flow (130 L/min)
    coolantVolumePerUnit_L: 200,  // Aligned with GB200 NVL72 (Introl: 200L)
    sourceIds: ['nvidia-gb300-product', 'supermicro-gb300-nvl72', 'hpe-gb300-quickspecs', 'introl-gb300-deploy', 'sunbird-gb300-power', 'glennklockwood-b300'],
  },
  {
    id: 'gb300-nvl36x2',
    name: 'NVIDIA GB300 NVL36×2 (per rack)',
    formFactor: 'full-rack',
    rackUnits: 48,               // Each rack is 48U; system spans 2 racks
    coolingType: 'liquid',
    // 36 B300 GPUs + 18 Grace CPUs per rack (half of NVL72)
    // 2 racks connected via 162× 1.6T active copper NVLink cables
    // NVL36x2 uses 36 NVSwitch ASICs (vs 18 for NVL72) — adds ~5kW overhead per rack
    // Scaled from NVL72 132kW: (132/2) + 5kW NVSwitch overhead ≈ 71kW per rack
    powerPerUnit_kW: 71,
    liquidFraction: 0.90,
    flowPerUnit_Lpm: 70,           // Scaled from NVL72's 130 L/min (half GPUs + NVSwitch overhead)
    inletTemp_C: 20,
    inletTempRange_C: [15, 25],
    maxDeltaT_C: 15,              // At 70 L/min PG25: 63.9kW/(1.198×3.940) = 13.5°C
    weightPerUnit_kg: 750,        // Heavier than NVL72/2 due to 18 NVSwitch ASICs per rack (vs 9)
    maxPerRack: 1,
    tdpGpu_W: 1400,
    gpuCount: 36,
    cpuCount: 18,
    coldPlateDp_bar: 0.8,
    minFlowPerUnit_Lpm: 52,        // 75% of design flow (70 L/min)
    coolantVolumePerUnit_L: 110,   // Slightly more than NVL72/2 due to additional NVSwitch cold plates
    sourceIds: ['nvidia-gb300-product', 'semianalysis-gb200-arch', 'nvidia-multinode-nvlink', 'glennklockwood-b300'],
  },
  {
    id: 'dgx-b300',
    name: 'NVIDIA DGX B300 (10U Air)',
    formFactor: '10u-node',
    rackUnits: 10,
    coolingType: 'air',
    // 8× B300 GPUs, air-cooled, PSU variant
    // NVIDIA DGX B300 User Guide: 15.1kW (PSU) / 14.5kW (busbar), 168kg (PSU)
    // 12× 3.2kW PSUs (N+N redundancy), 1,500 CFM airflow at 70% PWM
    powerPerUnit_kW: 15.1,
    liquidFraction: 0,
    flowPerUnit_Lpm: 0,
    inletTemp_C: 25,
    inletTempRange_C: [10, 30],   // NVIDIA DGX B300 User Guide: 10–30°C (50–86°F)
    maxDeltaT_C: 0,
    weightPerUnit_kg: 168,        // PSU variant per NVIDIA guide
    maxPerRack: 4,                // 42U / 10U = 4
    tdpGpu_W: 1400,
    gpuCount: 8,
    cpuCount: 2,
    coldPlateDp_bar: 0,
    minFlowPerUnit_Lpm: 0,
    coolantVolumePerUnit_L: 0,
    sourceIds: ['nvidia-dgx-b300-guide', 'nvidia-dgx-b300-datasheet', 'glennklockwood-b300'],
  },
  {
    id: 'dgx-b200',
    name: 'NVIDIA DGX B200 (10U Air)',
    formFactor: '10u-node',
    rackUnits: 10,
    coolingType: 'air',
    // 8× B200 GPUs, air-cooled
    // NVIDIA DGX B200 User Guide: ~14.3kW, 142.4kg
    // 6× 3.3kW PSUs (5+1 redundancy), 10-35°C ambient
    powerPerUnit_kW: 14.3,
    liquidFraction: 0,
    flowPerUnit_Lpm: 0,
    inletTemp_C: 25,
    inletTempRange_C: [10, 35],   // NVIDIA DGX B200 User Guide: 10–35°C
    maxDeltaT_C: 0,
    weightPerUnit_kg: 142,        // NVIDIA DGX B200 User Guide: 142.4kg
    maxPerRack: 4,                // 42U / 10U = 4
    tdpGpu_W: 1000,              // Air-cooled TDP (vs 1,200W liquid)
    gpuCount: 8,
    cpuCount: 2,
    coldPlateDp_bar: 0,
    minFlowPerUnit_Lpm: 0,
    coolantVolumePerUnit_L: 0,
    sourceIds: ['nvidia-dgx-b200-guide'],
  },
  {
    id: 'gb200-nvl72',
    name: 'NVIDIA GB200 NVL72',
    formFactor: 'full-rack',
    rackUnits: 48,               // Dell XE9712 / Supermicro confirm 48U rack
    coolingType: 'liquid',
    // 72 Blackwell GPUs + 36 Grace CPUs
    // NVIDIA reference: 120kW (104kW liquid + ~16kW air), 200L coolant volume
    powerPerUnit_kW: 120,
    liquidFraction: 0.87,
    flowPerUnit_Lpm: 110,          // Introl GB200 deployment: 12-15°C ΔT target at design flow
    inletTemp_C: 22,
    inletTempRange_C: [20, 25],
    maxDeltaT_C: 15,              // At 110 L/min PG30: 104.4kW/(1.892×3.915) = 14.1°C
    // Compute tray ~1,500kg; full system with NVLink switch tray ~3,000kg
    weightPerUnit_kg: 1500,
    maxPerRack: 1,
    tdpGpu_W: 1200,
    gpuCount: 72,
    cpuCount: 36,
    coldPlateDp_bar: 0.8,
    minFlowPerUnit_Lpm: 80,        // 73% of design flow (110 L/min)
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
    // Total node: 8×1,200W GPU + 2 CPUs (~350W each) ≈ 10.2kW
    // NVIDIA reference: 20 L/min per node, <1.5 bar pressure drop
    // Supermicro DLC-2: up to 92% liquid cooling
    powerPerUnit_kW: 10.2,
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
