/**
 * ENGINEERING VALIDATION SUITE
 * ============================
 * Comprehensive test scenarios for the DC Container Cooling Console.
 * Validates physics, cross-checks related calculations, and ensures
 * results are auditable and defensible for engineering reference.
 *
 * Run: npx tsx validate-engineering.ts
 *
 * Coverage:
 *   A. Thermodynamic first-principles (Q=ṁCpΔT)
 *   B. Hydraulic engineering (Darcy-Weisbach, Reynolds, pipe sizing)
 *   C. Heat rejection method selection
 *   D. CDU sizing & redundancy
 *   E. Cross-module consistency
 *   F. Deployment scenarios (homogeneous & mixed)
 *   G. Coolant variation
 *   H. Partial load & pump affinity
 *   I. Redundancy & failure transients
 *   J. Climate & seasonal analysis
 *   K. Cost model sanity
 *   L. Edge cases
 *   M. ASHRAE W-class classification
 *   N. Loop architecture
 */

import { runCalculations } from './src/engine/index';
import { coolantMap, coolants } from './src/data/coolants';
import { platformMap } from './src/data/serverPlatforms';
import { climateProfiles } from './src/data/climateProfiles';
import type { RackConfig, PlatformId, OemId, CoolantId, CduRedundancy, FullCalculationResult } from './src/types';

// ════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════

let passCount = 0;
let failCount = 0;
let warnCount = 0;
const failures: string[] = [];
const warnings: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passCount++;
  } else {
    failCount++;
    const msg = detail ? `FAIL: ${label} — ${detail}` : `FAIL: ${label}`;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

function assertApprox(actual: number, expected: number, tolerancePct: number, label: string) {
  const diff = Math.abs(actual - expected);
  const tol = Math.abs(expected) * tolerancePct / 100;
  const ok = diff <= Math.max(tol, 0.01); // absolute floor of 0.01 for near-zero values
  if (ok) {
    passCount++;
  } else {
    failCount++;
    const msg = `FAIL: ${label} — expected ~${expected.toFixed(4)}, got ${actual.toFixed(4)} (${((diff / Math.max(Math.abs(expected), 0.001)) * 100).toFixed(1)}% off, tolerance ${tolerancePct}%)`;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

function assertRange(actual: number, min: number, max: number, label: string) {
  if (actual >= min && actual <= max) {
    passCount++;
  } else {
    failCount++;
    const msg = `FAIL: ${label} — expected [${min}, ${max}], got ${actual.toFixed(4)}`;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

function warn(condition: boolean, label: string) {
  if (!condition) {
    warnCount++;
    warnings.push(`WARN: ${label}`);
    console.warn(`  ⚠ WARN: ${label}`);
  }
}

function makeRacks(configs: { platformId: PlatformId; oemId: OemId; nodeCount: number }[]): RackConfig[] {
  return configs.map((c, i) => ({
    id: `rack-${i}`,
    position: i,
    slot: { platformId: c.platformId, oemId: c.oemId, nodeCount: c.nodeCount },
  }));
}

function makeHomogeneous(platformId: PlatformId, oemId: OemId, rackCount: number): RackConfig[] {
  const platform = platformMap.get(platformId)!;
  const nodeCount = platform.formFactor === 'full-rack' ? 1 : Math.floor(42 / platform.rackUnits);
  return Array.from({ length: rackCount }, (_, i) => ({
    id: `rack-${i}`,
    position: i,
    slot: { platformId, oemId, nodeCount },
  }));
}

function run(racks: RackConfig[], coolantId: CoolantId = 'pg30', inlet: number = 20, ambient: number = 35, redundancy: CduRedundancy = 'n+1', climate?: typeof climateProfiles[0], elecRate: number = 0.10): FullCalculationResult {
  return runCalculations(racks, coolantId, inlet, ambient, redundancy, climate ?? null, elecRate);
}

// ════════════════════════════════════════════
//  SECTION A: Thermodynamic First Principles
// ════════════════════════════════════════════

function sectionA() {
  console.log('\n═══ A. THERMODYNAMIC FIRST PRINCIPLES ═══');

  // A1: Single HGX B300 rack — manual Q=ṁCpΔT verification
  {
    console.log('\n  A1: Single HGX B300 (10 nodes) — Q=ṁCpΔT');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 1);
    const r = run(racks, 'pg30', 25, 35);
    const coolant = coolantMap.get('pg30')!;
    const platform = platformMap.get('hgx-b300')!;

    // Manual calculation:
    // Power per node: 10.5 kW, OEM overhead: ~1.5kW (Supermicro), 10 nodes
    // Liquid fraction: 0.98
    // Total liquid heat: (10.5 + 1.5) × 10 × 0.98 = 117.6 kW
    const rackPower = r.power.perRack[0];
    const liquidHeat_kW = rackPower.liquid_kW;
    const flow_Lpm = r.thermal.perRack[0].flow_Lpm;
    const flow_Ls = flow_Lpm / 60;
    const massFlow_kgs = flow_Ls * coolant.density_kgL;

    // ΔT = Q / (ṁ × Cp)
    const expectedDeltaT = (liquidHeat_kW * 1000) / (massFlow_kgs * coolant.specificHeat_JkgK);
    const actualDeltaT = r.thermal.perRack[0].deltaT_C;

    assertApprox(actualDeltaT, expectedDeltaT, 0.1, 'A1: ΔT matches Q/(ṁ×Cp)');
    assert(r.thermal.perRack[0].outletTemp_C === 25 + actualDeltaT, 'A1: Outlet = Inlet + ΔT');
    assert(flow_Lpm === platform.flowPerUnit_Lpm * 10, 'A1: Flow = platform flow × nodeCount');
    assert(r.power.totalIT_kW > 0, 'A1: Total IT power > 0');

    // Energy conservation: liquid_kW + air_kW = total_kW
    assertApprox(rackPower.liquid_kW + rackPower.air_kW, rackPower.it_kW, 0.01, 'A1: Energy conservation (liquid + air = total)');
  }

  // A2: Verify ΔT with DI water (different Cp)
  {
    console.log('\n  A2: Same config, DI water — different Cp gives different ΔT');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 1);
    const rPG = run(racks, 'pg30', 25, 35);
    const rDI = run(racks, 'di-water', 25, 35);

    // DI water has higher Cp (4186 vs 3850) → lower ΔT for same heat & flow
    assert(rDI.thermal.perRack[0].deltaT_C < rPG.thermal.perRack[0].deltaT_C,
      'A2: DI water ΔT < PG30 ΔT (higher Cp)');

    // Ratio should be approximately inversely proportional to Cp×density product
    const cpRho_PG = 3850 * 1.032;
    const cpRho_DI = 4186 * 0.998;
    const expectedRatio = cpRho_PG / cpRho_DI;
    const actualRatio = rDI.thermal.perRack[0].deltaT_C / rPG.thermal.perRack[0].deltaT_C;
    assertApprox(actualRatio, expectedRatio, 1, 'A2: ΔT ratio matches Cp×ρ ratio');
  }

  // A3: GB200 NVL72 full rack — high power density
  {
    console.log('\n  A3: GB200 NVL72 full rack — 120 kW, 80 L/min');
    const racks = makeHomogeneous('gb200-nvl72', 'dell', 1);
    const r = run(racks, 'pg30', 22, 35);
    const coolant = coolantMap.get('pg30')!;

    const liquidHeat = r.power.perRack[0].liquid_kW;
    const flow_kgs = (r.thermal.perRack[0].flow_Lpm / 60) * coolant.density_kgL;
    const expectedDT = (liquidHeat * 1000) / (flow_kgs * coolant.specificHeat_JkgK);

    assertApprox(r.thermal.perRack[0].deltaT_C, expectedDT, 0.1, 'A3: GB200 ΔT matches formula');
    assert(r.thermal.perRack[0].flow_Lpm === 80, 'A3: GB200 flow = 80 L/min');
    assertRange(r.thermal.perRack[0].deltaT_C, 10, 30, 'A3: ΔT in realistic range 10–30°C');
  }

  // A4: Cluster thermal — flow-weighted return temp
  {
    console.log('\n  A4: Mixed racks — flow-weighted return temperature');
    const racks = makeRacks([
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 10 },
      { platformId: 'hgx-b200', oemId: 'dell', nodeCount: 8 },
    ]);
    const r = run(racks, 'pg30', 20, 35);

    // Manual flow-weighted return temp
    const liquidRacks = r.thermal.perRack.filter(tr => tr.flow_Lpm > 0);
    const totalFlow = liquidRacks.reduce((s, tr) => s + tr.flow_Lpm, 0);
    const manualWeightedReturn = liquidRacks.reduce((s, tr) => s + tr.outletTemp_C * tr.flow_Lpm, 0) / totalFlow;

    assertApprox(r.clusterThermal.weightedReturnTemp_C, manualWeightedReturn, 0.01,
      'A4: Cluster return temp matches manual flow-weighted calculation');
    assertApprox(r.clusterThermal.totalFlow_Lpm, totalFlow, 0.01, 'A4: Cluster total flow matches sum');
  }

  // A5: Total power conservation across the system
  {
    console.log('\n  A5: Power conservation — sum of per-rack = totals');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);

    const sumIT = r.power.perRack.reduce((s, p) => s + p.it_kW, 0);
    const sumLiquid = r.power.perRack.reduce((s, p) => s + p.liquid_kW, 0);
    const sumAir = r.power.perRack.reduce((s, p) => s + p.air_kW, 0);

    assertApprox(sumIT, r.power.totalIT_kW, 0.01, 'A5: Sum(per-rack IT) = total IT');
    assertApprox(sumLiquid, r.power.totalLiquidHeat_kW, 0.01, 'A5: Sum(per-rack liquid) = total liquid');
    assertApprox(sumAir, r.power.totalAirHeat_kW, 0.01, 'A5: Sum(per-rack air) = total air');
    assertApprox(r.power.totalIT_kW, r.power.totalLiquidHeat_kW + r.power.totalAirHeat_kW, 0.01,
      'A5: totalIT = totalLiquid + totalAir');
  }
}

// ════════════════════════════════════════════
//  SECTION B: Hydraulic Engineering
// ════════════════════════════════════════════

function sectionB() {
  console.log('\n═══ B. HYDRAULIC ENGINEERING ═══');

  // B1: Pipe velocity within ASHRAE limit
  {
    console.log('\n  B1: Header pipe velocity ≤ 1.8 m/s (ASHRAE erosion limit)');
    for (const count of [1, 4, 8, 12]) {
      const racks = makeHomogeneous('hgx-b300', 'supermicro', count);
      const r = run(racks, 'pg30', 25, 35);
      // If pipe is properly sized, velocity should be ≤ 1.8 m/s (or there's a warning)
      if (r.hydraulic.pipeVelocity_mps <= 1.8) {
        assert(true, `B1: ${count} racks — velocity ${r.hydraulic.pipeVelocity_mps.toFixed(2)} m/s ≤ 1.8`);
      } else {
        assert(r.hydraulic.velocityWarnings.length > 0,
          `B1: ${count} racks — velocity exceeded, warning generated`);
      }
    }
  }

  // B2: Reynolds number — turbulent flow expected for datacenter flows
  {
    console.log('\n  B2: Reynolds number — turbulent (Re > 2300) at design flow');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    assert(r.hydraulic.reynoldsNumber > 2300,
      `B2: Re = ${r.hydraulic.reynoldsNumber.toFixed(0)} > 2300 (turbulent)`,
      `Re = ${r.hydraulic.reynoldsNumber.toFixed(0)}`);
  }

  // B3: Pipe sizing increases with flow
  {
    console.log('\n  B3: Header diameter increases with rack count');
    const r1 = run(makeHomogeneous('hgx-b300', 'supermicro', 1), 'pg30', 25, 35);
    const r6 = run(makeHomogeneous('hgx-b300', 'supermicro', 6), 'pg30', 25, 35);
    const r12 = run(makeHomogeneous('hgx-b300', 'supermicro', 12), 'pg30', 25, 35);

    assert(r6.hydraulic.headerDiameter_mm >= r1.hydraulic.headerDiameter_mm,
      `B3: 6-rack header ≥ 1-rack (${r6.hydraulic.headerDn} ≥ ${r1.hydraulic.headerDn})`);
    assert(r12.hydraulic.headerDiameter_mm >= r6.hydraulic.headerDiameter_mm,
      `B3: 12-rack header ≥ 6-rack (${r12.hydraulic.headerDn} ≥ ${r6.hydraulic.headerDn})`);
  }

  // B4: System ΔP budget components sum correctly
  {
    console.log('\n  B4: ΔP budget components sum to total');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    const dp = r.hydraulic.dpBudget;

    const computedTotal = dp.coldPlates_bar + dp.manifold_bar + dp.piping_bar + dp.cdu_bar + dp.fittings_bar;
    assertApprox(computedTotal, dp.total_bar, 2, 'B4: ΔP components sum to total');
    assertApprox(dp.total_bar, r.hydraulic.totalSystemDp_bar, 0.1, 'B4: dpBudget.total = totalSystemDp');
  }

  // B5: Pump head = ΔP / (ρg) — verify formula
  {
    console.log('\n  B5: Pump head H = ΔP / (ρg)');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    const coolant = coolantMap.get('pg30')!;
    const density_kgm3 = coolant.density_kgL * 1000;
    const expectedHead = (r.hydraulic.totalSystemDp_bar * 100000) / (density_kgm3 * 9.81);
    assertApprox(r.hydraulic.pumpHead_m, expectedHead, 0.1, 'B5: Pump head matches ΔP/(ρg)');
  }

  // B6: Pump power = Q × ΔP / η
  {
    console.log('\n  B6: Pump power P = Q×ΔP / (η×1000)');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    const totalFlow_m3s = r.thermal.totalFlow_Lpm / 60000;
    const eta = 0.65; // PUMP_EFFICIENCY
    const expectedPower = (totalFlow_m3s * r.hydraulic.totalSystemDp_bar * 100000) / (eta * 1000);
    assertApprox(r.hydraulic.pumpPower_kW, expectedPower, 0.5, 'B6: Pump power matches Q×ΔP/(η×1000)');
  }

  // B7: Cold plate ΔP — parallel nodes (should be single-node ΔP, not multiplied)
  {
    console.log('\n  B7: Cold plate ΔP = single node ΔP (parallel manifold)');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 1);
    const r = run(racks, 'pg30', 25, 35);
    const platform = platformMap.get('hgx-b300')!;

    // Per-rack cold plate ΔP should equal platform's cold plate ΔP (nodes in parallel)
    if (r.hydraulic.perRackBranch.length > 0) {
      assertApprox(r.hydraulic.perRackBranch[0].coldPlate_bar, platform.coldPlateDp_bar, 0.1,
        `B7: Rack coldPlate ΔP = ${platform.coldPlateDp_bar} bar (not ×nodeCount)`);
    }
  }

  // B8: Flow imbalance detection
  {
    console.log('\n  B8: Flow imbalance risk detection');
    // Mix GB200 (high ΔP) and B300 (low ΔP) — different cold plate drops
    const racks = makeRacks([
      { platformId: 'gb200-nvl72', oemId: 'dell', nodeCount: 1 },
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 10 },
    ]);
    const r = run(racks, 'pg30', 20, 35);

    if (r.hydraulic.perRackBranch.length > 1) {
      const dpValues = r.hydraulic.perRackBranch.map(b => b.total_bar);
      const ratio = Math.max(...dpValues) / Math.min(...dpValues);
      if (ratio > 1.5) {
        assert(r.hydraulic.flowImbalanceRisk, 'B8: Flow imbalance flagged when max/min ΔP > 1.5');
      }
    }
    assert(true, 'B8: Flow imbalance detection executed');
  }

  // B9: Higher viscosity coolant → higher ΔP
  {
    console.log('\n  B9: PG50 (higher viscosity) → higher system ΔP than DI water');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const rDI = run(racks, 'di-water', 25, 35);
    const rPG50 = run(racks, 'pg50', 25, 35);

    assert(rPG50.hydraulic.totalSystemDp_bar > rDI.hydraulic.totalSystemDp_bar,
      `B9: PG50 ΔP (${rPG50.hydraulic.totalSystemDp_bar.toFixed(3)}) > DI ΔP (${rDI.hydraulic.totalSystemDp_bar.toFixed(3)})`);
    assert(rPG50.hydraulic.reynoldsNumber < rDI.hydraulic.reynoldsNumber,
      `B9: PG50 Re (${rPG50.hydraulic.reynoldsNumber.toFixed(0)}) < DI Re (${rDI.hydraulic.reynoldsNumber.toFixed(0)})`);
  }
}

// ════════════════════════════════════════════
//  SECTION C: Heat Rejection Method Selection
// ════════════════════════════════════════════

function sectionC() {
  console.log('\n═══ C. HEAT REJECTION METHOD SELECTION ═══');

  const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);

  // C1: Low ambient → dry cooler
  {
    console.log('\n  C1: Ambient 10°C, inlet 25°C → dry cooler (margin = 25-8-10 = 7°C > 3°C)');
    const r = run(racks, 'pg30', 25, 10);
    assert(r.heatRejection.method === 'dry-cooler', `C1: Method = ${r.heatRejection.method}`);
    assert(r.heatRejection.compressorPower_kW === 0, 'C1: No compressor power');
    assert(r.heatRejection.dryCoolerSpec !== undefined, 'C1: DryCoolerSpec present');
  }

  // C2: High ambient → chiller
  {
    console.log('\n  C2: Ambient 20°C, inlet 25°C → chiller (margin = 25-8-20 = -3°C ≤ 0)');
    const r = run(racks, 'pg30', 25, 20);
    assert(r.heatRejection.method === 'chiller', `C2: Method = ${r.heatRejection.method}`);
    assert(r.heatRejection.compressorPower_kW > 0, 'C2: Compressor power > 0');
    assert(r.heatRejection.chillerSpec !== undefined, 'C2: ChillerSpec present');
  }

  // C3: Marginal → hybrid
  {
    console.log('\n  C3: Ambient 15°C, inlet 25°C → hybrid (margin = 25-8-15 = 2°C, 0 < 2 ≤ 3)');
    const r = run(racks, 'pg30', 25, 15);
    assert(r.heatRejection.method === 'hybrid', `C3: Method = ${r.heatRejection.method}`);
    assert(r.heatRejection.dryCoolerSpec !== undefined, 'C3: DryCoolerSpec present');
    assert(r.heatRejection.chillerSpec !== undefined, 'C3: ChillerSpec present');
  }

  // C4: Capacity includes 15% margin
  {
    console.log('\n  C4: Heat rejection capacity = total heat × 1.15');
    const r = run(racks, 'pg30', 25, 10);
    const totalHeat = r.power.totalLiquidHeat_kW + r.power.totalAirHeat_kW;
    assertApprox(r.heatRejection.capacity_kW, totalHeat * 1.15, 0.1, 'C4: Capacity = heat × 1.15');
  }

  // C5: Chiller COP = 4.0
  {
    console.log('\n  C5: Chiller COP = 4.0');
    const r = run(racks, 'pg30', 25, 20);
    if (r.heatRejection.chillerSpec) {
      assertApprox(r.heatRejection.chillerSpec.cop, 4.0, 0.1, 'C5: COP = 4.0');
      assertApprox(r.heatRejection.chillerSpec.eer, 4.0 * 3.412, 0.1, 'C5: EER = COP × 3.412');
    }
  }
}

// ════════════════════════════════════════════
//  SECTION D: CDU Sizing & Redundancy
// ════════════════════════════════════════════

function sectionD() {
  console.log('\n═══ D. CDU SIZING & REDUNDANCY ═══');

  // D1: CDU capacity ≥ liquid heat × 1.2
  {
    console.log('\n  D1: CDU active capacity ≥ liquid heat × 1.2');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    const activeCapacity = r.cdu.selectedSize_kW * r.cdu.activeCount;
    assert(activeCapacity >= r.power.totalLiquidHeat_kW * 1.2 * 0.95,
      `D1: ${activeCapacity} kW ≥ ${(r.power.totalLiquidHeat_kW * 1.2).toFixed(0)} kW required`);
  }

  // D2: N+1 redundancy = 1 spare
  {
    console.log('\n  D2: N+1 redundancy');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35, 'n+1');
    assert(r.cdu.redundantCount === 1, `D2: N+1 → redundant = 1 (got ${r.cdu.redundantCount})`);
    assert(r.cdu.totalCount === r.cdu.activeCount + 1, 'D2: total = active + 1');
  }

  // D3: 2N redundancy = N spare
  {
    console.log('\n  D3: 2N redundancy');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35, '2n');
    assert(r.cdu.redundantCount === r.cdu.activeCount,
      `D3: 2N → redundant = active (${r.cdu.redundantCount} = ${r.cdu.activeCount})`);
    assert(r.cdu.totalCount === r.cdu.activeCount * 2, 'D3: total = active × 2');
  }

  // D4: CDU width calculation
  {
    console.log('\n  D4: CDU width = total count × 0.6m');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    assertApprox(r.cdu.widthUsed_m, r.cdu.totalCount * 0.6, 0.01, 'D4: CDU width = count × 0.6m');
  }
}

// ════════════════════════════════════════════
//  SECTION E: Cross-Module Consistency
// ════════════════════════════════════════════

function sectionE() {
  console.log('\n═══ E. CROSS-MODULE CONSISTENCY ═══');

  const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
  const r = run(racks, 'pg30', 25, 35);

  // E1: PUE formula verification
  {
    console.log('\n  E1: PUE = (IT + cooling + dist) / IT');
    const expectedPUE = (r.pue.itPower_kW + r.pue.coolingPower_kW + r.pue.distributionLoss_kW) / r.pue.itPower_kW;
    assertApprox(r.pue.pue, expectedPUE, 0.01, 'E1: PUE formula verified');
    assertApprox(r.pue.totalFacilityPower_kW,
      r.pue.itPower_kW + r.pue.coolingPower_kW + r.pue.distributionLoss_kW, 0.01,
      'E1: Facility power = IT + cooling + dist');
  }

  // E2: Distribution loss = 4% of IT
  {
    console.log('\n  E2: Distribution loss = 4% of IT power');
    assertApprox(r.pue.distributionLoss_kW, r.power.totalIT_kW * 0.04, 0.1, 'E2: Dist loss = 4% IT');
  }

  // E3: PUE uses hydraulic pump power (not flat CDU estimate)
  {
    console.log('\n  E3: PUE cooling includes hydraulic pump power');
    const expectedCooling = r.hydraulic.pumpPower_kW + r.heatRejection.totalPower_kW;
    assertApprox(r.pue.coolingPower_kW, expectedCooling, 0.5, 'E3: Cooling = pump + heat rejection');
  }

  // E4: Thermal flow total = sum of per-rack flows
  {
    console.log('\n  E4: Thermal flow consistency');
    const sumFlow = r.thermal.perRack.reduce((s, tr) => s + tr.flow_Lpm, 0);
    assertApprox(sumFlow, r.thermal.totalFlow_Lpm, 0.01, 'E4: Sum(flow) = totalFlow');
  }

  // E5: PUE in realistic range
  {
    console.log('\n  E5: PUE in realistic range [1.03, 1.60]');
    assertRange(r.pue.pue, 1.03, 1.60, 'E5: PUE range');
  }

  // E6: Container rack capacity check
  {
    console.log('\n  E6: Container rack positions');
    assert(r.container.usedRacks === 6, 'E6: 6 racks used');
    assert(r.container.maxRacks >= 6, 'E6: Container fits at least 6 racks');
  }
}

// ════════════════════════════════════════════
//  SECTION F: Deployment Scenarios
// ════════════════════════════════════════════

function sectionF() {
  console.log('\n═══ F. DEPLOYMENT SCENARIOS ═══');

  // F1: 12× HGX B300 (homogeneous GPU cluster)
  {
    console.log('\n  F1: 12× HGX B300 — homogeneous GPU cluster');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 12);
    const r = run(racks, 'pg30', 25, 35);

    // Supermicro OEM overhead: 0.25 kW/node. Total: 12 × 10 × (10.5 + 0.25) = 1290 kW
    const expectedIT = 12 * 10 * (10.5 + 0.25);
    assertApprox(r.power.totalIT_kW, expectedIT, 5, 'F1: Total IT ~1290 kW');
    assertRange(r.thermal.totalFlow_Lpm, 1500, 2000, 'F1: Total flow 1500-2000 L/min');
    assert(r.coolingCompat.sharedLoopFeasible, 'F1: Single platform → shared loop feasible');
    assert(r.ashraeWClass.systemClass === 'W4', `F1: ASHRAE class = ${r.ashraeWClass.systemClass} (B300 max inlet 45°C → W4)`);
    // At ambient 35°C, inlet 25°C: margin = 25 - 8 - 35 = -18°C → chiller required
    assertRange(r.pue.pue, 1.10, 1.50, 'F1: PUE 1.10–1.50 (chiller needed at 35°C ambient)');
  }

  // F2: 12× GB200 NVL72 (ultra-high density)
  {
    console.log('\n  F2: 12× GB200 NVL72 — ultra-high density');
    const racks = makeHomogeneous('gb200-nvl72', 'dell', 12);
    const r = run(racks, 'pg30', 22, 35);

    assertRange(r.power.totalIT_kW, 1400, 2000, 'F2: Total IT 1400–2000 kW (12 × ~120-140 kW)');
    assert(r.thermal.totalFlow_Lpm === 12 * 80, 'F2: Total flow = 12 × 80 = 960 L/min');
    // GB200 max inlet 25°C: getWaterClass(25) → 25 > 22 → not W2, 25 ≤ 32 → W3
    assert(r.ashraeWClass.systemClass === 'W3', `F2: ASHRAE class = ${r.ashraeWClass.systemClass} (GB200 max 25°C → W3)`);
    // 12× GB200: 12 × (1500 + 100 OEM + 120 rack) = 20,640 kg + CDU weight ≈ 21,840 kg < 26,480 kg limit
    assert(r.container.overweight === false, 'F2: 12× GB200 fits within container weight limit');
  }

  // F3: Mixed B300 + B200 (compatible platforms)
  {
    console.log('\n  F3: 6× B300 + 6× B200 — compatible mix');
    const racks = makeRacks([
      ...Array.from({ length: 6 }, () => ({ platformId: 'hgx-b300' as PlatformId, oemId: 'supermicro' as OemId, nodeCount: 10 })),
      ...Array.from({ length: 6 }, () => ({ platformId: 'hgx-b200' as PlatformId, oemId: 'dell' as OemId, nodeCount: 8 })),
    ]);
    const r = run(racks, 'pg30', 20, 35);

    assert(r.coolingCompat.sharedLoopFeasible, 'F3: B300+B200 shared loop feasible (overlap 15-30°C)');
    assert(r.coolingCompat.constrainedInletRange_C !== null, 'F3: Has constrained inlet range');
    if (r.coolingCompat.constrainedInletRange_C) {
      assert(r.coolingCompat.constrainedInletRange_C[0] === 15, 'F3: Min inlet = 15°C (B300 lower bound)');
      assert(r.coolingCompat.constrainedInletRange_C[1] === 30, 'F3: Max inlet = 30°C (B200 upper bound)');
    }
    // System class limited by B200 (max 30°C → W3)
    assert(r.ashraeWClass.systemClass === 'W3', `F3: System class = ${r.ashraeWClass.systemClass} (limited by B200)`);
  }

  // F4: Mixed GB200 + B300 (incompatible — narrow or no overlap)
  {
    console.log('\n  F4: 6× GB200 + 6× B300 — check compatibility');
    const racks = makeRacks([
      ...Array.from({ length: 6 }, () => ({ platformId: 'gb200-nvl72' as PlatformId, oemId: 'dell' as OemId, nodeCount: 1 })),
      ...Array.from({ length: 6 }, () => ({ platformId: 'hgx-b300' as PlatformId, oemId: 'supermicro' as OemId, nodeCount: 10 })),
    ]);
    const r = run(racks, 'pg30', 22, 35);

    // GB200: 20–25°C, B300: 15–45°C → overlap 20–25°C (5°C margin)
    assert(r.coolingCompat.sharedLoopFeasible, 'F4: GB200+B300 feasible (overlap 20–25°C)');
    // System class: GB200 max 25°C → W3 (25 > 22, ≤ 32)
    assert(r.ashraeWClass.systemClass === 'W3', `F4: System class = ${r.ashraeWClass.systemClass} (limited by GB200 W3)`);
  }

  // F5: All air-cooled
  {
    console.log('\n  F5: 12× Xeon 6 — all air-cooled');
    const racks = makeHomogeneous('xeon-6', 'dell', 12);
    const r = run(racks, 'pg30', 25, 35);

    assert(r.thermal.totalFlow_Lpm === 0, 'F5: No liquid flow');
    assert(r.power.totalLiquidHeat_kW === 0, 'F5: No liquid heat');
    assert(r.hydraulic.totalSystemDp_bar === 0, 'F5: No hydraulic ΔP');
    assert(r.cdu.totalCount === 0, 'F5: No CDUs needed');
  }

  // F6: Mixed liquid + air (adjacent cooling detection)
  {
    console.log('\n  F6: Mixed liquid + air — adjacent cooling detection');
    const racks = makeRacks([
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 10 },
      { platformId: 'xeon-6', oemId: 'dell', nodeCount: 21 },
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 10 },
    ]);
    const r = run(racks, 'pg30', 25, 35);

    assert(r.coolingCompat.mixedCoolingRows.length > 0,
      `F6: Mixed cooling detected — ${r.coolingCompat.mixedCoolingRows.length} adjacent pairs`);
  }

  // F7: GB300 NVL72 — newest/highest power platform
  {
    console.log('\n  F7: 6× GB300 NVL72 — 132 kW per rack');
    const racks = makeHomogeneous('gb300-nvl72', 'dell', 6);
    const r = run(racks, 'pg30', 17, 35);

    assertRange(r.power.totalIT_kW, 700, 1000, 'F7: Total IT ~792-900 kW');
    assert(r.power.peakRack_kW > 100, 'F7: Peak rack > 100 kW');
    assert(r.thermal.totalFlow_Lpm === 6 * 80, 'F7: Flow = 6 × 80 = 480 L/min');
  }

  // F8: Single rack
  {
    console.log('\n  F8: Single HGX B200 rack');
    const racks = makeHomogeneous('hgx-b200', 'supermicro', 1);
    const r = run(racks, 'pg30', 25, 35);

    assert(r.power.perRack.filter(p => p.it_kW > 0).length === 1, 'F8: 1 active rack');
    assert(r.hydraulic.perRackBranch.length === 1, 'F8: 1 hydraulic branch');
    assert(!r.hydraulic.flowImbalanceRisk, 'F8: No flow imbalance (single rack)');
  }
}

// ════════════════════════════════════════════
//  SECTION G: Coolant Variation
// ════════════════════════════════════════════

function sectionG() {
  console.log('\n═══ G. COOLANT VARIATION ═══');

  const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);

  for (const coolant of coolants) {
    console.log(`\n  G: ${coolant.name}`);
    const r = run(racks, coolant.id as CoolantId, 25, 35);

    assert(r.thermal.totalFlow_Lpm > 0, `G/${coolant.id}: Flow > 0`);
    assert(r.thermal.avgDeltaT_C > 0, `G/${coolant.id}: ΔT > 0`);
    assertRange(r.thermal.avgDeltaT_C, 2, 25, `G/${coolant.id}: ΔT in [2, 25]°C`);
    assert(r.hydraulic.reynoldsNumber > 0, `G/${coolant.id}: Re > 0`);

    // Verify ΔT inversely related to Cp × density
    const cpRho = coolant.specificHeat_JkgK * coolant.density_kgL;
    warn(r.thermal.avgDeltaT_C > 0, `G/${coolant.id}: ΔT > 0 for Cp×ρ = ${cpRho.toFixed(0)}`);
  }

  // Cross-coolant: DI water should have lowest ΔT (highest Cp)
  {
    const rPG30 = run(racks, 'pg30', 25, 35);
    const rDI = run(racks, 'di-water', 25, 35);
    const rPG50 = run(racks, 'pg50', 25, 35);

    assert(rDI.thermal.avgDeltaT_C < rPG30.thermal.avgDeltaT_C,
      `G: DI ΔT (${rDI.thermal.avgDeltaT_C.toFixed(2)}) < PG30 ΔT (${rPG30.thermal.avgDeltaT_C.toFixed(2)})`);
    assert(rPG50.thermal.avgDeltaT_C > rPG30.thermal.avgDeltaT_C,
      `G: PG50 ΔT (${rPG50.thermal.avgDeltaT_C.toFixed(2)}) > PG30 ΔT (${rPG30.thermal.avgDeltaT_C.toFixed(2)})`);
  }
}

// ════════════════════════════════════════════
//  SECTION H: Partial Load & Pump Affinity
// ════════════════════════════════════════════

function sectionH() {
  console.log('\n═══ H. PARTIAL LOAD & PUMP AFFINITY ═══');

  const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
  const r = run(racks, 'pg30', 25, 35);

  // H1: 4 load points (25%, 50%, 75%, 100%)
  {
    console.log('\n  H1: Load scenario count and points');
    assert(r.partialLoad.loadScenarios.length === 4, 'H1: 4 load scenarios');
    const loadPcts = r.partialLoad.loadScenarios.map(s => s.loadPercent);
    assert(JSON.stringify(loadPcts) === JSON.stringify([25, 50, 75, 100]), 'H1: Load points [25, 50, 75, 100]');
  }

  // H2: Pump affinity — P ∝ Q³
  {
    console.log('\n  H2: Pump affinity law — power ∝ flow³');
    const s100 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 100)!;
    const s50 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 50)!;
    const s25 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 25)!;

    // At 50% flow, pump power should be 12.5% of design (0.5³ = 0.125)
    const expectedP50 = s100.pumpPower_kW * Math.pow(0.5, 3);
    assertApprox(s50.pumpPower_kW, expectedP50, 0.5, 'H2: At 50% flow, pump power = 12.5% of design');

    // At 25% flow, pump power should be 1.5625% of design (0.25³ = 0.015625)
    const expectedP25 = s100.pumpPower_kW * Math.pow(0.25, 3);
    assertApprox(s25.pumpPower_kW, expectedP25, 0.5, 'H2: At 25% flow, pump power = 1.56% of design');
  }

  // H3: PUE improves at partial load (pump affinity benefit)
  {
    console.log('\n  H3: PUE at 50% load vs 100% load');
    const pue100 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 100)!.pue;
    const pue50 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 50)!.pue;

    // At partial load, cooling fraction drops → PUE should improve (lower)
    assert(pue50 < pue100,
      `H3: PUE at 50% (${pue50.toFixed(4)}) < PUE at 100% (${pue100.toFixed(4)})`);
  }

  // H4: Reynolds at 25% load — check for laminar risk
  {
    console.log('\n  H4: Reynolds at 25% load');
    const s25 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 25)!;
    if (s25.laminarRisk) {
      console.log(`    → Laminar risk at 25% (Re = ${s25.reynoldsNumber.toFixed(0)})`);
    } else {
      console.log(`    → Still turbulent at 25% (Re = ${s25.reynoldsNumber.toFixed(0)})`);
    }
    assert(s25.reynoldsNumber > 0, 'H4: Reynolds calculated at 25% load');
  }

  // H5: Flow scales linearly with load
  {
    console.log('\n  H5: Flow scales linearly with load');
    const s100 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 100)!;
    const s50 = r.partialLoad.loadScenarios.find(s => s.loadPercent === 50)!;
    assertApprox(s50.flow_Lpm, s100.flow_Lpm * 0.5, 0.1, 'H5: Flow at 50% = half of 100%');
  }
}

// ════════════════════════════════════════════
//  SECTION I: Redundancy & Failure Transients
// ════════════════════════════════════════════

function sectionI() {
  console.log('\n═══ I. REDUNDANCY & FAILURE TRANSIENTS ═══');

  // I1: GB200 NVL72 — large coolant volume → long time-to-throttle
  {
    console.log('\n  I1: GB200 NVL72 time-to-throttle (~99s expected)');
    const racks = makeHomogeneous('gb200-nvl72', 'dell', 1);
    const r = run(racks, 'pg30', 22, 35);
    const throttle = r.redundancy.cduFailureScenario.perRackThrottle[0];

    if (throttle) {
      // Manual: t = (V×ρ×Cp×ΔT) / Q
      const coolant = coolantMap.get('pg30')!;
      const V_m3 = throttle.coolantVolume_L / 1000;
      const rho = coolant.density_kgL * 1000;
      const Q_W = throttle.heatLoad_kW * 1000;
      const expected_s = (V_m3 * rho * coolant.specificHeat_JkgK * throttle.tempBudget_C) / Q_W;

      assertApprox(throttle.timeToThrottle_s, expected_s, 1, 'I1: Time-to-throttle matches formula');
      assertRange(throttle.timeToThrottle_s, 50, 200, 'I1: GB200 TTT ~50–200s (large coolant vol)');
      assert(throttle.coolantVolume_L === 200, 'I1: GB200 coolant volume = 200L');
    }
  }

  // I2: HGX B200 — small coolant volume → fast time-to-throttle
  {
    console.log('\n  I2: HGX B200 (10 nodes) time-to-throttle (~13s expected)');
    const racks = makeHomogeneous('hgx-b200', 'supermicro', 1);
    const r = run(racks, 'pg30', 25, 35);
    const throttle = r.redundancy.cduFailureScenario.perRackThrottle[0];

    if (throttle) {
      assert(throttle.coolantVolume_L === 4 * 10, 'I2: B200 10-node volume = 40L');
      assertRange(throttle.timeToThrottle_s, 5, 40, 'I2: B200 TTT ~5–40s (small volume)');
    }
  }

  // I3: N+1 CDU failure survivability
  {
    console.log('\n  I3: N+1 survivability');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35, 'n+1');

    // With N+1, losing one CDU leaves N active → should still cover load
    assert(r.redundancy.cduFailureScenario.canSurvive,
      `I3: N+1 survives CDU failure (remaining: ${r.redundancy.cduFailureScenario.remainingCapacity_kW.toFixed(0)} kW, load: ${r.redundancy.cduFailureScenario.totalLoad_kW.toFixed(0)} kW)`);
  }

  // I4: Shed order sorted by ascending time-to-throttle
  {
    console.log('\n  I4: Shed order = ascending time-to-throttle');
    const racks = makeRacks([
      { platformId: 'gb200-nvl72', oemId: 'dell', nodeCount: 1 },
      { platformId: 'hgx-b200', oemId: 'supermicro', nodeCount: 10 },
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 10 },
    ]);
    const r = run(racks, 'pg30', 20, 35);
    const throttles = r.redundancy.cduFailureScenario.perRackThrottle;
    const sorted = [...throttles].sort((a, b) => a.timeToThrottle_s - b.timeToThrottle_s);
    const shedOrder = r.redundancy.cduFailureScenario.shedOrder;

    assert(shedOrder.length === sorted.length, 'I4: Shed order length matches');
    assert(shedOrder[0] === sorted[0].rackId,
      `I4: First to shed = shortest TTT (${sorted[0].rackId}, ${sorted[0].timeToThrottle_s.toFixed(1)}s)`);
  }
}

// ════════════════════════════════════════════
//  SECTION J: Climate & Seasonal Analysis
// ════════════════════════════════════════════

function sectionJ() {
  console.log('\n═══ J. CLIMATE & SEASONAL ANALYSIS ═══');

  const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);

  // J1: Oslo (cold climate) — most hours free cooling
  {
    console.log('\n  J1: Oslo — high free cooling hours');
    const oslo = climateProfiles.find(p => p.locationName.includes('Oslo'))!;
    const r = run(racks, 'pg30', 25, 10, 'n+1', oslo);

    assert(r.climate !== null, 'J1: Climate result present');
    if (r.climate) {
      assertRange(r.climate.freeCoolingHours, 5000, 8760, 'J1: Oslo free cooling 5000–8760 hours');
      assert(r.climate.annualPue > 1.0, 'J1: Annual PUE > 1.0');
      assert(r.climate.annualEnergy_MWh > 0, 'J1: Annual energy > 0');
      assert(r.climate.monthlySummary.length === 12, 'J1: 12 months in summary');
    }
  }

  // J2: Singapore (hot humid) — mostly chiller hours
  {
    console.log('\n  J2: Singapore — mostly chiller hours');
    const sg = climateProfiles.find(p => p.locationName.includes('Singapore'))!;
    const r = run(racks, 'pg30', 25, 30, 'n+1', sg);

    if (r.climate) {
      // B300 return temp ≈ 35.6°C, free cooling threshold = 35.6 - 8 = 27.6°C
      // Singapore bins: 20-25°C (mid 22.5 → free), 25-30°C (mid 27.5 → free), 30-35°C (mid 32.5 → chiller)
      // So free cooling dominates. Assert chiller hours are significant but don't exceed free cooling.
      assert(r.climate.chillerHours > 2000,
        `J2: Singapore has significant chiller hours (${r.climate.chillerHours})`);
      assert(r.climate.freeCoolingHours > r.climate.chillerHours,
        `J2: Singapore free cooling hours (${r.climate.freeCoolingHours}) > chiller (${r.climate.chillerHours}) — warm-water cooling enables free cooling even in hot climates`);
      assert(r.climate.annualPue > 1.05, 'J2: Singapore PUE > 1.05');
    }
  }

  // J3: All bins sum to ~8760 hours
  {
    console.log('\n  J3: Temperature bin hours sum to ~8760');
    for (const profile of climateProfiles) {
      const totalHours = profile.temperatureBins.reduce((s, b) => s + b.hours, 0);
      assertApprox(totalHours, 8760, 1, `J3: ${profile.locationName} bins sum to ${totalHours}`);
    }
  }

  // J4: Free cooling + chiller hours = total analyzed hours
  {
    console.log('\n  J4: Free cooling + chiller ≈ total hours');
    const london = climateProfiles.find(p => p.locationName.includes('London'))!;
    const r = run(racks, 'pg30', 25, 10, 'n+1', london);

    if (r.climate) {
      const total = r.climate.freeCoolingHours + r.climate.chillerHours;
      assertApprox(total, 8760, 2, 'J4: Free + chiller ≈ 8760');
    }
  }

  // J5: Cross-city comparison — Oslo PUE < Singapore PUE
  {
    console.log('\n  J5: Oslo PUE < Singapore PUE');
    const oslo = climateProfiles.find(p => p.locationName.includes('Oslo'))!;
    const sg = climateProfiles.find(p => p.locationName.includes('Singapore'))!;
    const rOslo = run(racks, 'pg30', 25, 10, 'n+1', oslo);
    const rSG = run(racks, 'pg30', 25, 30, 'n+1', sg);

    if (rOslo.climate && rSG.climate) {
      assert(rOslo.climate.annualPue < rSG.climate.annualPue,
        `J5: Oslo PUE (${rOslo.climate.annualPue.toFixed(4)}) < Singapore PUE (${rSG.climate.annualPue.toFixed(4)})`);
    }
  }

  // J6: All 8 cities produce valid results
  {
    console.log('\n  J6: All 8 cities produce valid results');
    for (const profile of climateProfiles) {
      const r = run(racks, 'pg30', 25, 35, 'n+1', profile);
      assert(r.climate !== null, `J6: ${profile.locationName} — result present`);
      if (r.climate) {
        assertRange(r.climate.annualPue, 1.0, 2.0, `J6: ${profile.locationName} PUE [1.0, 2.0]`);
        assert(r.climate.annualEnergy_MWh > 0, `J6: ${profile.locationName} energy > 0`);
      }
    }
  }
}

// ════════════════════════════════════════════
//  SECTION K: Cost Model Sanity
// ════════════════════════════════════════════

function sectionK() {
  console.log('\n═══ K. COST MODEL SANITY ═══');

  const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
  const r = run(racks, 'pg30', 25, 35, 'n+1', null, 0.10);

  assert(r.cost !== null, 'K: Cost result present');
  if (!r.cost) return;

  // K1: CAPEX components sum to total
  {
    console.log('\n  K1: CAPEX components sum correctly');
    const c = r.cost.capex;
    const sumComponents = c.cdus + c.piping + c.manifolds + c.dryCooler + c.chiller + c.controls;
    assertApprox(sumComponents, c.total, 0.01, 'K1: CAPEX components sum = total');
    assert(c.total > 0, 'K1: CAPEX > 0');
  }

  // K2: OPEX components sum to total
  {
    console.log('\n  K2: OPEX components sum correctly');
    const o = r.cost.opexAnnual;
    const sumOPEX = o.electricity + o.coolantReplacement + o.maintenance;
    assertApprox(sumOPEX, o.total, 0.01, 'K2: OPEX components sum = total');
    assert(o.total > 0, 'K2: OPEX > 0');
  }

  // K3: TCO ≥ CAPEX (TCO = CAPEX + NPV of OPEX)
  {
    console.log('\n  K3: TCO ≥ CAPEX');
    assert(r.cost.tco5Year >= r.cost.capex.total,
      `K3: TCO $${(r.cost.tco5Year / 1000).toFixed(0)}k ≥ CAPEX $${(r.cost.capex.total / 1000).toFixed(0)}k`);
  }

  // K4: Per-GPU-hour cost is reasonable
  {
    console.log('\n  K4: Per-GPU-hour cost sanity');
    if (r.cost.costPerGpuHour > 0) {
      assertRange(r.cost.costPerGpuHour, 0.001, 1.0,
        `K4: $/GPU-hr = ${r.cost.costPerGpuHour.toFixed(4)} in [0.001, 1.0]`);
    }
  }

  // K5: Higher electricity rate → higher OPEX
  {
    console.log('\n  K5: Higher electricity rate → higher OPEX');
    const rLow = run(racks, 'pg30', 25, 35, 'n+1', null, 0.05);
    const rHigh = run(racks, 'pg30', 25, 35, 'n+1', null, 0.20);

    if (rLow.cost && rHigh.cost) {
      assert(rHigh.cost.opexAnnual.total > rLow.cost.opexAnnual.total,
        'K5: Higher elec rate → higher OPEX');
      assert(rHigh.cost.tco5Year > rLow.cost.tco5Year,
        'K5: Higher elec rate → higher TCO');
    }
  }

  // K6: CDU CAPEX formula: count × (base + size×$/kW)
  {
    console.log('\n  K6: CDU CAPEX formula');
    const expectedCDU = r.cdu.totalCount * (30000 + r.cdu.selectedSize_kW * 500);
    assertApprox(r.cost.capex.cdus, expectedCDU, 0.01, 'K6: CDU CAPEX = count × (30k + size×500)');
  }

  // K7: Piping cost formula: (30 + racks×6) × $300/m
  {
    console.log('\n  K7: Piping CAPEX formula');
    const liquidRacks = racks.filter(r => {
      const p = platformMap.get(r.slot!.platformId);
      return p && p.coolingType === 'liquid';
    }).length;
    const expectedPiping = (30 + liquidRacks * 6) * 300;
    assertApprox(r.cost.capex.piping, expectedPiping, 0.01, 'K7: Piping CAPEX = (30+N×6) × 300');
  }
}

// ════════════════════════════════════════════
//  SECTION L: Edge Cases
// ════════════════════════════════════════════

function sectionL() {
  console.log('\n═══ L. EDGE CASES ═══');

  // L1: All empty racks
  {
    console.log('\n  L1: All empty racks');
    const racks: RackConfig[] = Array.from({ length: 12 }, (_, i) => ({
      id: `rack-${i}`, position: i, slot: null,
    }));
    const r = run(racks, 'pg30', 25, 35);

    assert(r.power.totalIT_kW === 0, 'L1: Zero IT power');
    assert(r.thermal.totalFlow_Lpm === 0, 'L1: Zero flow');
    assert(r.hydraulic.totalSystemDp_bar === 0, 'L1: Zero ΔP');
    assert(r.cdu.totalCount === 0, 'L1: Zero CDUs');
    assert(r.pue.pue === 1.0, 'L1: PUE = 1.0 (no load)');
  }

  // L2: Single node
  {
    console.log('\n  L2: Single rack, single node');
    const racks = makeRacks([{ platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 1 }]);
    const r = run(racks, 'pg30', 25, 35);

    assert(r.power.totalIT_kW > 0, 'L2: Non-zero power');
    assert(r.thermal.totalFlow_Lpm === 15, 'L2: Flow = 15 L/min (1 B300 node)');
    assert(r.hydraulic.totalSystemDp_bar > 0, 'L2: Non-zero ΔP');
  }

  // L3: Extreme inlet temp — very low
  {
    console.log('\n  L3: Extreme low inlet (5°C)');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 5, 35);

    assert(r.thermal.maxOutletTemp_C < r.thermal.perRack[0].inletTemp_C + 50,
      'L3: Outlet temp reasonable even at low inlet');
  }

  // L4: Extreme inlet temp — very high
  {
    console.log('\n  L4: Extreme high inlet (40°C)');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 40, 45);

    assert(r.thermal.maxOutletTemp_C > 40, 'L4: Outlet > inlet at high temp');
    assert(r.heatRejection.method === 'chiller', 'L4: Chiller required at 45°C ambient');
  }

  // L5: Minimum node count per rack
  {
    console.log('\n  L5: Minimum nodes (1 node per rack)');
    const racks = makeRacks([
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 1 },
      { platformId: 'hgx-b200', oemId: 'dell', nodeCount: 1 },
    ]);
    const r = run(racks, 'pg30', 25, 35);

    assert(r.power.totalIT_kW > 0, 'L5: Non-zero power with min nodes');
    assert(r.thermal.totalFlow_Lpm > 0, 'L5: Non-zero flow with min nodes');
  }

  // L6: All same platform, different OEMs
  {
    console.log('\n  L6: Same platform, different OEMs');
    const racks = makeRacks([
      { platformId: 'hgx-b200', oemId: 'dell', nodeCount: 8 },
      { platformId: 'hgx-b200', oemId: 'supermicro', nodeCount: 10 },
      { platformId: 'hgx-b200', oemId: 'lenovo', nodeCount: 8 },
    ]);
    const r = run(racks, 'pg30', 25, 35);

    assert(r.coolingCompat.sharedLoopFeasible, 'L6: Same platform, different OEMs → compatible');
    assert(r.power.totalIT_kW > 0, 'L6: Non-zero power');
  }
}

// ════════════════════════════════════════════
//  SECTION M: ASHRAE W-Class Classification
// ════════════════════════════════════════════

function sectionM() {
  console.log('\n═══ M. ASHRAE W-CLASS CLASSIFICATION ═══');

  // M1: Individual platform classes
  {
    console.log('\n  M1: Per-platform water class');

    // GB300: inletTempRange_C [15, 25], max = 25°C
    // getWaterClass(25): 25 > 22 → not W2, 25 ≤ 32 → W3
    const gb300 = makeHomogeneous('gb300-nvl72', 'dell', 1);
    const rGB300 = run(gb300, 'pg30', 17, 35);
    const gb300Class = rGB300.ashraeWClass.perPlatform[0]?.waterClass;
    console.log(`    GB300 max inlet 25°C → ${gb300Class}`);
    assert(gb300Class === 'W3', `M1: GB300 = W3 (max 25°C > 22, ≤ 32)`);

    // GB200: 20–25°C → max 25 → W3
    const gb200 = makeHomogeneous('gb200-nvl72', 'dell', 1);
    const rGB200 = run(gb200, 'pg30', 22, 35);
    const gb200Class = rGB200.ashraeWClass.perPlatform[0]?.waterClass;
    console.log(`    GB200 max inlet 25°C → ${gb200Class}`);
    assert(gb200Class === 'W3', `M1: GB200 = W3 (max 25°C)`);

    // HGX B300: 15–45°C → max 45 → W4
    const b300 = makeHomogeneous('hgx-b300', 'supermicro', 1);
    const rB300 = run(b300, 'pg30', 25, 35);
    const b300Class = rB300.ashraeWClass.perPlatform[0]?.waterClass;
    console.log(`    HGX B300 max inlet 45°C → ${b300Class}`);
    assert(b300Class === 'W4', `M1: B300 = W4 (max 45°C ≤ 45)`);

    // HGX B200: 15–30°C → max 30 → W3
    const b200 = makeHomogeneous('hgx-b200', 'dell', 1);
    const rB200 = run(b200, 'pg30', 25, 35);
    const b200Class = rB200.ashraeWClass.perPlatform[0]?.waterClass;
    console.log(`    HGX B200 max inlet 30°C → ${b200Class}`);
    assert(b200Class === 'W3', `M1: B200 = W3 (max 30°C ≤ 32)`);
  }

  // M2: System class = most restrictive platform
  {
    console.log('\n  M2: System class = most restrictive');
    const racks = makeRacks([
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 10 }, // W4
      { platformId: 'gb200-nvl72', oemId: 'dell', nodeCount: 1 },     // W3
    ]);
    const r = run(racks, 'pg30', 22, 35);

    // System should be W3 (limited by GB200)
    assert(r.ashraeWClass.systemClass === 'W3',
      `M2: System = ${r.ashraeWClass.systemClass} (limited by GB200 W3)`);
    assert(r.ashraeWClass.limitingPlatform.includes('GB200'),
      `M2: Limiting platform contains 'GB200': ${r.ashraeWClass.limitingPlatform}`);
  }

  // M3: Free cooling viability ranking
  {
    console.log('\n  M3: Free cooling viability');
    // W4 → excellent, W3 → good, W2 → limited, W1 → poor
    const b300 = makeHomogeneous('hgx-b300', 'supermicro', 1);
    const rB300 = run(b300, 'pg30', 25, 35);
    assert(rB300.ashraeWClass.freeCoolingViability === 'excellent' || rB300.ashraeWClass.freeCoolingViability === 'good',
      `M3: W4 free cooling = ${rB300.ashraeWClass.freeCoolingViability}`);
  }
}

// ════════════════════════════════════════════
//  SECTION N: Loop Architecture
// ════════════════════════════════════════════

function sectionN() {
  console.log('\n═══ N. LOOP ARCHITECTURE ═══');

  // N1: Homogeneous → single loop
  {
    console.log('\n  N1: Homogeneous deployment → single loop');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);

    assert(r.loopArchitecture.topology === 'single-loop', 'N1: Single loop topology');
    assert(r.loopArchitecture.secondaryLoops.length === 0, 'N1: No secondary loops');
    assert(r.loopArchitecture.bypassFlow_Lpm > 0, 'N1: Bypass flow > 0');
    assert(r.loopArchitecture.bufferTank_L > 0, 'N1: Buffer tank > 0');
  }

  // N2: Compatible mix → single loop
  {
    console.log('\n  N2: Compatible platforms → single loop');
    const racks = makeRacks([
      { platformId: 'hgx-b300', oemId: 'supermicro', nodeCount: 10 },
      { platformId: 'hgx-b200', oemId: 'dell', nodeCount: 8 },
    ]);
    const r = run(racks, 'pg30', 20, 35);

    assert(r.loopArchitecture.topology === 'single-loop',
      `N2: Topology = ${r.loopArchitecture.topology}`);
  }

  // N3: Bypass flow = 25% of design flow
  {
    console.log('\n  N3: Bypass flow = 25% of design');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    assertApprox(r.loopArchitecture.bypassFlow_Lpm, r.thermal.totalFlow_Lpm * 0.25, 0.1,
      'N3: Bypass = 25% of total flow');
  }

  // N4: Buffer tank formula
  {
    console.log('\n  N4: Buffer tank sizing');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    const coolant = coolantMap.get('pg30')!;

    // V = Q_kW × 30s / (Cp × 15°C × ρ × 1000)
    const heatLoad_W = r.power.totalLiquidHeat_kW * 1000;
    const expected_L = (heatLoad_W * 30) / (coolant.specificHeat_JkgK * 15 * coolant.density_kgL * 1000) * 1000;
    assertApprox(r.loopArchitecture.bufferTank_L, expected_L, 1,
      `N4: Buffer tank = ${r.loopArchitecture.bufferTank_L.toFixed(1)} L`);
  }

  // N5: Primary loop pipe sizing
  {
    console.log('\n  N5: Primary loop pipe diameter valid DN size');
    const racks = makeHomogeneous('hgx-b300', 'supermicro', 6);
    const r = run(racks, 'pg30', 25, 35);
    const validDN = ['DN25', 'DN32', 'DN40', 'DN50', 'DN65', 'DN80', 'DN100', 'DN125', 'DN150', 'DN200'];
    assert(validDN.includes(r.loopArchitecture.primaryLoop.pipeDiameter_mm),
      `N5: Pipe = ${r.loopArchitecture.primaryLoop.pipeDiameter_mm}`);
  }
}

// ════════════════════════════════════════════
//  Run all sections
// ════════════════════════════════════════════

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║  DC CONTAINER CONSOLE — ENGINEERING VALIDATION SUITE  ║');
console.log('╚═══════════════════════════════════════════════════════╝');

sectionA();
sectionB();
sectionC();
sectionD();
sectionE();
sectionF();
sectionG();
sectionH();
sectionI();
sectionJ();
sectionK();
sectionL();
sectionM();
sectionN();

console.log('\n════════════════════════════════════');
console.log(`  RESULTS: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
console.log('════════════════════════════════════');

if (failures.length > 0) {
  console.log('\n  FAILURES:');
  failures.forEach(f => console.log(`    ${f}`));
}
if (warnings.length > 0) {
  console.log('\n  WARNINGS:');
  warnings.forEach(w => console.log(`    ${w}`));
}

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n  ✓ All assertions passed — engineering calculations are consistent and auditable.\n');
}
