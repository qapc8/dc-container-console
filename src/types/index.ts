// ── Server Platforms ──
export type PlatformId = 'gb300-nvl72' | 'gb300-nvl36x2' | 'dgx-b300' | 'gb200-nvl72' | 'hgx-b300' | 'hgx-b200' | 'xeon-6' | 'epyc-9005';

export type CoolingType = 'liquid' | 'air';
export type FormFactor = 'full-rack' | '10u-node' | '4u-node' | '5u-node' | '2u-server';

export interface ServerPlatform {
  id: PlatformId;
  name: string;
  formFactor: FormFactor;
  rackUnits: number;             // U height per unit
  coolingType: CoolingType;
  powerPerUnit_kW: number;       // kW per unit (node or full-rack)
  liquidFraction: number;        // 0-1, fraction of heat removed by liquid
  flowPerUnit_Lpm: number;       // L/min per unit (0 for air-cooled)
  inletTemp_C: number;           // recommended inlet temperature
  inletTempRange_C: [number, number]; // [min, max] acceptable inlet temp
  maxDeltaT_C: number;           // max allowable ΔT across cold plates
  weightPerUnit_kg: number;
  maxPerRack: number;            // how many fit in a 42U rack
  tdpGpu_W?: number;
  gpuCount?: number;
  cpuCount?: number;
  sourceIds: string[];           // references into dataSources

  // Hydraulic properties (Tier 1)
  coldPlateDp_bar: number;       // cold plate pressure drop at design flow (bar)
  minFlowPerUnit_Lpm: number;    // minimum safe flow rate per unit (L/min)

  // Redundancy properties (Tier 2)
  coolantVolumePerUnit_L: number; // coolant volume per unit (liters)
}

// ── OEM Configurations ──
export type OemId = 'dell' | 'hpe' | 'lenovo' | 'supermicro';

export interface OemChassis {
  oemId: OemId;
  oemName: string;
  platformId: PlatformId;
  chassisModel: string;
  rackUnits: number;
  additionalPower_kW: number;    // networking, fans, BMC overhead
  weightOverhead_kg: number;
  liquidFractionOverride?: number; // OEM-specific liquid fraction if different
  inletTempRangeOverride_C?: [number, number]; // OEM-specific range
  sourceIds: string[];
}

// ── Coolants ──
export type CoolantId = 'pg30' | 'di-water' | 'pg50';

export interface Coolant {
  id: CoolantId;
  name: string;
  specificHeat_JkgK: number;     // Cp in J/(kg·K)
  density_kgL: number;           // kg/L
  viscosity_cP: number;          // centipoise at ~25°C
  freezePoint_C: number;
}

// ── Container ──
export interface ContainerSpec {
  name: string;
  externalLength_m: number;
  externalWidth_m: number;
  externalHeight_m: number;
  internalLength_m: number;
  internalWidth_m: number;
  internalHeight_m: number;
  maxPayload_kg: number;
  tareWeight_kg: number;
  maxGrossWeight_kg: number;
}

// ── Rack Configuration ──
export interface RackSlot {
  platformId: PlatformId;
  oemId: OemId;
  nodeCount: number;             // how many nodes in this rack
}

export interface RackConfig {
  id: string;
  position: number;              // 0-indexed position in container
  slot: RackSlot | null;         // null = empty rack
}

// ── CDU ──
export type CduRedundancy = 'n+1' | '2n';

export interface CduUnit {
  capacity_kW: number;
  count: number;
  totalCapacity_kW: number;
  pumpPower_kW: number;
}

// ── Cluster Thermal Summary ──
export interface ClusterThermalSummary {
  supplyTemp_C: number;
  weightedReturnTemp_C: number;
  totalDeltaT_C: number;
  totalFlow_Lpm: number;
  estimatedCoolantVolume_L: number;
  perRackContribution: {
    rackId: string;
    platformName: string;
    heatLoad_kW: number;
    fractionOfTotal: number;
  }[];
}

// ── Detailed Equipment Specs ──
export interface ChillerSpec {
  capacity_kW: number;
  cop: number;
  eer: number;
  compressorPower_kW: number;
  evapTemp_C: number;
  evapApproach_C: number;
  condenserTemp_C: number;
  condenserApproach_C: number;
  refrigerant: string;
}

export interface HeatExchangerSpec {
  type: 'plate' | 'shell-tube';
  capacity_kW: number;
  primaryInTemp_C: number;
  primaryOutTemp_C: number;
  secondaryInTemp_C: number;
  secondaryOutTemp_C: number;
  approach_C: number;
  estimatedArea_m2: number;
  estimatedFootprint_m2: number;
}

export interface DryCoolerSpec {
  capacity_kW: number;
  fanCount: number;
  fanPower_kW: number;
  approachTemp_C: number;
  designAmbient_C: number;
  deratingFactor: number;
  fluidInTemp_C: number;
  fluidOutTemp_C: number;
}

// ── Compatibility Alerts ──
export type CompatibilityAlertType =
  | 'outlet-temp-exceeded'
  | 'delta-t-exceeded'
  | 'flow-imbalance'
  | 'mixed-cooling-row';

export interface CompatibilityAlert {
  rackId: string;
  alertType: CompatibilityAlertType;
  severity: 'warning' | 'critical';
  message: string;
  actualValue: number;
  limitValue: number;
}

// ── Cooling Loop Compatibility ──
export interface CoolingLoopCompatibility {
  sharedLoopFeasible: boolean;
  constrainedInletRange_C: [number, number] | null; // overlapping range
  platformsInLoop: {
    platformId: PlatformId;
    name: string;
    requiredRange_C: [number, number];
    maxDeltaT_C: number;
  }[];
  warnings: ValidationWarning[];
  alerts: CompatibilityAlert[];
  flowBalanceSummary: {
    totalSupply_Lpm: number;
    totalDemand_Lpm: number;
  } | null;
  mixedCoolingRows: {
    position: number;
    rackId: string;
    coolingType: CoolingType;
    adjacentRackId: string;
    adjacentCoolingType: CoolingType;
  }[];
}

// ── Data Sources ──
export interface DataSource {
  id: string;
  label: string;
  url: string;
  publisher: string;
  accessDate: string;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

// ── ASHRAE Water Class ──
export type AshraeWaterClass = 'W1' | 'W2' | 'W3' | 'W4' | 'W5';

// ── Hydraulic Analysis ──
export interface VelocityWarning {
  location: string;
  velocity_mps: number;
  limit_mps: number;
}

export interface RackBranchDp {
  rackId: string;
  platformName: string;
  coldPlate_bar: number;
  piping_bar: number;
  total_bar: number;
  flow_Lpm: number;
}

export interface HydraulicResult {
  totalSystemDp_bar: number;
  pumpHead_m: number;
  pumpPower_kW: number;
  headerDiameter_mm: number;
  headerDn: string;              // nearest standard DN size label
  pipeVelocity_mps: number;
  reynoldsNumber: number;
  perRackBranch: RackBranchDp[];
  velocityWarnings: VelocityWarning[];
  flowImbalanceRisk: boolean;
  dpBudget: {
    coldPlates_bar: number;
    manifold_bar: number;
    piping_bar: number;
    cdu_bar: number;
    fittings_bar: number;
    total_bar: number;
  };
}

// ── Partial Load ──
export interface LoadScenario {
  loadPercent: number;
  itPower_kW: number;
  flow_Lpm: number;
  pumpSpeedPercent: number;
  pumpPower_kW: number;
  pue: number;
  reynoldsNumber: number;
  laminarRisk: boolean;
}

export interface PartialLoadResult {
  designPumpPower_kW: number;
  loadScenarios: LoadScenario[];
}

// ── Loop Architecture ──
export interface SecondaryLoop {
  id: string;
  name: string;
  platformIds: PlatformId[];
  rackIds: string[];
  inletTempRange_C: [number, number];
  requiredInletTemp_C: number;
  totalFlow_Lpm: number;
  totalHeat_kW: number;
  pipeDiameter_mm: string;
  mixingValveRequired: boolean;
}

export interface LoopArchitecture {
  topology: 'single-loop' | 'primary-secondary';
  primaryLoop: {
    supplyTemp_C: number;
    returnTemp_C: number;
    totalFlow_Lpm: number;
    pipeDiameter_mm: string;
  };
  secondaryLoops: SecondaryLoop[];
  bufferTank_L: number;
  bypassFlow_Lpm: number;
  reason: string;
}

// ── ASHRAE W-Class Result ──
export interface AshraeWClassResult {
  systemClass: AshraeWaterClass;
  perPlatform: {
    platformId: PlatformId;
    name: string;
    waterClass: AshraeWaterClass;
    inletRange_C: [number, number];
  }[];
  limitingPlatform: string;
  freeCoolingViability: 'excellent' | 'good' | 'limited' | 'poor';
}

// ── Redundancy Analysis (Tier 2) ──
export interface RackThrottleInfo {
  rackId: string;
  platformName: string;
  coolantVolume_L: number;
  heatLoad_kW: number;
  tempBudget_C: number;
  timeToThrottle_s: number;
}

export interface RedundancyAnalysis {
  cduFailureScenario: {
    totalLoad_kW: number;
    remainingCapacity_kW: number;
    deficit_kW: number;
    canSurvive: boolean;
    perRackThrottle: RackThrottleInfo[];
    shedOrder: string[];
  };
  maintenanceWindow: {
    maxAmbient_C: number;
    feasible: boolean;
  };
}

// ── Climate Analysis (Tier 2) ──
export interface TemperatureBin {
  tempMin_C: number;
  tempMax_C: number;
  hours: number;
}

export interface ClimateProfile {
  locationName: string;
  temperatureBins: TemperatureBin[];
  designDryBulb_C: number;
}

export interface MonthlySummary {
  month: string;
  avgAmbient_C: number;
  avgPue: number;
  freeCoolingHours: number;
  chillerHours: number;
}

export interface AnnualPueResult {
  locationName: string;
  annualPue: number;
  freeCoolingHours: number;
  chillerHours: number;
  annualEnergy_MWh: number;
  monthlySummary: MonthlySummary[];
}

// ── Cost Estimation (Tier 2) ──
export interface CapexBreakdown {
  cdus: number;
  piping: number;
  manifolds: number;
  dryCooler: number;
  chiller: number;
  controls: number;
  total: number;
}

export interface CostResult {
  capex: CapexBreakdown;
  opexAnnual: {
    electricity: number;
    coolantReplacement: number;
    maintenance: number;
    total: number;
  };
  tco5Year: number;
  costPerGpuHour: number;
  discountRate: number;
  electricityRate: number;
}

// ── Calculated Results ──
export interface PowerResult {
  totalIT_kW: number;
  totalLiquidHeat_kW: number;
  totalAirHeat_kW: number;
  perRack: {
    rackId: string;
    it_kW: number;
    liquid_kW: number;
    air_kW: number;
  }[];
  peakRack_kW: number;
  avgRack_kW: number;
}

export interface ThermalResult {
  totalFlow_Lpm: number;
  perRack: {
    rackId: string;
    flow_Lpm: number;
    inletTemp_C: number;
    outletTemp_C: number;
    deltaT_C: number;
  }[];
  avgDeltaT_C: number;
  maxOutletTemp_C: number;
}

export interface CduResult {
  requiredCapacity_kW: number;
  selectedSize_kW: number;
  activeCount: number;
  redundantCount: number;
  totalCount: number;
  totalPumpPower_kW: number;
  widthUsed_m: number;
}

export interface PueResult {
  pue: number;
  itPower_kW: number;
  coolingPower_kW: number;
  distributionLoss_kW: number;
  totalFacilityPower_kW: number;
}

export interface ContainerFitResult {
  maxRacks: number;
  usedRacks: number;
  cduPositions: number;
  aisleWidth_m: number;
  totalWeight_kg: number;
  weightLimit_kg: number;
  overweight: boolean;
  rackPositions_m: number[];     // x-position of each rack
}

export interface HeatRejectionResult {
  method: 'dry-cooler' | 'chiller' | 'hybrid';
  capacity_kW: number;
  fanPower_kW: number;
  compressorPower_kW: number;
  totalPower_kW: number;
  approachTemp_C: number;
  chillerSpec?: ChillerSpec;
  heatExchangerSpec?: HeatExchangerSpec;
  dryCoolerSpec?: DryCoolerSpec;
}

export interface FullCalculationResult {
  power: PowerResult;
  thermal: ThermalResult;
  clusterThermal: ClusterThermalSummary;
  cdu: CduResult;
  pue: PueResult;
  container: ContainerFitResult;
  heatRejection: HeatRejectionResult;
  coolingCompat: CoolingLoopCompatibility;
  warnings: ValidationWarning[];

  // Tier 1 additions
  hydraulic: HydraulicResult;
  partialLoad: PartialLoadResult;
  loopArchitecture: LoopArchitecture;
  ashraeWClass: AshraeWClassResult;

  // Tier 2 additions
  redundancy: RedundancyAnalysis;
  climate: AnnualPueResult | null;
  cost: CostResult | null;
}

export interface ValidationWarning {
  severity: 'info' | 'warning' | 'critical';
  category: 'weight' | 'power' | 'thermal' | 'flow' | 'space' | 'cooling-compat' | 'outlet-temp' | 'delta-t' | 'mixed-cooling' | 'hydraulic' | 'redundancy';
  message: string;
}

// ── UI State ──
export type TabId = 'configure' | 'dashboard' | 'container' | 'compare' | 'sources';
export type UnitSystem = 'metric' | 'imperial';

export interface SavedConfig {
  id: string;
  name: string;
  timestamp: number;
  racks: RackConfig[];
  ambientTemp_C: number;
  coolantId: CoolantId;
  inletTemp_C: number;
  cduRedundancy: CduRedundancy;
  results: FullCalculationResult;
}
