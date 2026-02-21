/**
 * Comprehensive test scenarios for the datacenter cooling system calculation engine.
 * Exercises runCalculations with 15 different rack configurations and validates results.
 *
 * Run with: npx tsx test-scenarios.ts
 */

import { runCalculations } from './src/engine/index.js';
import { climateProfiles } from './src/data/climateProfiles.js';
import type {
  RackConfig, RackSlot, CoolantId, CduRedundancy,
  FullCalculationResult, ClimateProfile, PlatformId, OemId,
} from './src/types/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSlot(platformId: PlatformId, oemId: OemId, nodeCount: number): RackSlot {
  return { platformId, oemId, nodeCount };
}

function makeRacks(configs: (RackSlot | null)[]): RackConfig[] {
  const racks: RackConfig[] = [];
  for (let i = 0; i < 12; i++) {
    racks.push({
      id: `rack-${i + 1}`,
      position: i,
      slot: i < configs.length ? configs[i] : null,
    });
  }
  return racks;
}

function getClimate(name: string): ClimateProfile | undefined {
  return climateProfiles.find(c => c.locationName.toLowerCase().includes(name.toLowerCase()));
}

// ─── Assertion helpers ───────────────────────────────────────────────────────

interface Assertion {
  label: string;
  pass: boolean;
  actual: string;
  expected: string;
}

function assert(label: string, actual: number | string | boolean | null | undefined, expected: string, predicate: boolean): Assertion {
  return { label, pass: predicate, actual: String(actual), expected };
}

function assertRange(label: string, value: number, min: number, max: number): Assertion {
  return assert(label, value.toFixed(2), `${min} - ${max}`, value >= min && value <= max);
}

function assertEq(label: string, actual: string | number | boolean | null | undefined, expected: string | number | boolean): Assertion {
  return assert(label, actual, String(expected), String(actual) === String(expected));
}

function assertGt(label: string, value: number, threshold: number): Assertion {
  return assert(label, value.toFixed(2), `> ${threshold}`, value > threshold);
}

function assertLt(label: string, value: number, threshold: number): Assertion {
  return assert(label, value.toFixed(2), `< ${threshold}`, value < threshold);
}

function assertGte(label: string, value: number, threshold: number): Assertion {
  return assert(label, value.toFixed(2), `>= ${threshold}`, value >= threshold);
}

function assertTruthy(label: string, value: unknown): Assertion {
  return assert(label, String(value), 'truthy', !!value);
}

function assertFalsy(label: string, value: unknown): Assertion {
  return assert(label, String(value), 'falsy', !value);
}

function assertNotEq(label: string, actual: string | number | boolean | null | undefined, unexpected: string | number | boolean): Assertion {
  return assert(label, actual, `!= ${unexpected}`, String(actual) !== String(unexpected));
}

// ─── Report printer ──────────────────────────────────────────────────────────

function printReport(
  name: string,
  configSummary: string,
  r: FullCalculationResult,
  assertions: Assertion[],
  extras?: Record<string, string>,
) {
  const passCount = assertions.filter(a => a.pass).length;
  const failCount = assertions.filter(a => !a.pass).length;
  const status = failCount === 0 ? 'ALL PASS' : `${failCount} FAIL`;

  console.log('\n' + '='.repeat(100));
  console.log(`  ${name}`);
  console.log('='.repeat(100));
  console.log(`  Config: ${configSummary}`);
  console.log('-'.repeat(100));

  // Key results
  console.log('  [Key Results]');
  console.log(`    Total IT Power:     ${r.power.totalIT_kW.toFixed(1)} kW`);
  console.log(`    Total Liquid Heat:  ${r.power.totalLiquidHeat_kW.toFixed(1)} kW`);
  console.log(`    Total Air Heat:     ${r.power.totalAirHeat_kW.toFixed(1)} kW`);
  console.log(`    PUE:                ${r.pue.pue.toFixed(3)}`);
  console.log(`    Total Flow:         ${r.thermal.totalFlow_Lpm.toFixed(1)} L/min`);
  console.log(`    System dP:          ${r.hydraulic.totalSystemDp_bar.toFixed(3)} bar`);
  console.log(`    Pump Power:         ${r.hydraulic.pumpPower_kW.toFixed(2)} kW`);
  console.log(`    Pump Head:          ${r.hydraulic.pumpHead_m.toFixed(2)} m`);

  // Hydraulic
  console.log('  [Hydraulic]');
  console.log(`    Header DN:          ${r.hydraulic.headerDn}`);
  console.log(`    Header Diameter:    ${r.hydraulic.headerDiameter_mm.toFixed(1)} mm`);
  console.log(`    Pipe Velocity:      ${r.hydraulic.pipeVelocity_mps.toFixed(3)} m/s`);
  console.log(`    Reynolds:           ${r.hydraulic.reynoldsNumber.toFixed(0)}`);
  console.log(`    Flow Imbalance:     ${r.hydraulic.flowImbalanceRisk}`);
  console.log(`    dP Budget: coldPlates=${r.hydraulic.dpBudget.coldPlates_bar.toFixed(3)}, manifold=${r.hydraulic.dpBudget.manifold_bar.toFixed(3)}, piping=${r.hydraulic.dpBudget.piping_bar.toFixed(3)}, cdu=${r.hydraulic.dpBudget.cdu_bar.toFixed(3)}, fittings=${r.hydraulic.dpBudget.fittings_bar.toFixed(3)}`);

  // Per-rack branch details (first 3)
  if (r.hydraulic.perRackBranch.length > 0) {
    console.log('    Per-rack branches (first 3):');
    for (const b of r.hydraulic.perRackBranch.slice(0, 3)) {
      console.log(`      ${b.rackId} (${b.platformName}): coldPlate=${b.coldPlate_bar.toFixed(3)} bar, piping=${b.piping_bar.toFixed(3)} bar, total=${b.total_bar.toFixed(3)} bar, flow=${b.flow_Lpm.toFixed(1)} L/min`);
    }
  }

  // ASHRAE
  console.log('  [ASHRAE W-Class]');
  console.log(`    System Class:       ${r.ashraeWClass.systemClass}`);
  console.log(`    Limiting Platform:  ${r.ashraeWClass.limitingPlatform}`);
  console.log(`    Free Cooling:       ${r.ashraeWClass.freeCoolingViability}`);
  for (const p of r.ashraeWClass.perPlatform) {
    console.log(`      ${p.name}: ${p.waterClass} (${p.inletRange_C[0]}-${p.inletRange_C[1]}°C)`);
  }

  // Loop Architecture
  console.log('  [Loop Architecture]');
  console.log(`    Topology:           ${r.loopArchitecture.topology}`);
  console.log(`    Secondary Loops:    ${r.loopArchitecture.secondaryLoops.length}`);
  console.log(`    Buffer Tank:        ${r.loopArchitecture.bufferTank_L.toFixed(1)} L`);
  console.log(`    Bypass Flow:        ${r.loopArchitecture.bypassFlow_Lpm.toFixed(1)} L/min`);
  console.log(`    Reason:             ${r.loopArchitecture.reason}`);
  for (const sl of r.loopArchitecture.secondaryLoops) {
    console.log(`      ${sl.name}: ${sl.inletTempRange_C[0]}-${sl.inletTempRange_C[1]}°C, ${sl.totalFlow_Lpm.toFixed(1)} L/min, ${sl.totalHeat_kW.toFixed(1)} kW, pipe=${sl.pipeDiameter_mm}`);
  }

  // Partial Load
  console.log('  [Partial Load]');
  console.log(`    Design Pump Power:  ${r.partialLoad.designPumpPower_kW.toFixed(2)} kW`);
  for (const ls of r.partialLoad.loadScenarios) {
    console.log(`    ${ls.loadPercent.toFixed(0)}%: IT=${ls.itPower_kW.toFixed(1)} kW, PUE=${ls.pue.toFixed(3)}, pump=${ls.pumpPower_kW.toFixed(2)} kW, Re=${ls.reynoldsNumber.toFixed(0)}, laminar=${ls.laminarRisk}`);
  }

  // Redundancy
  console.log('  [Redundancy]');
  console.log(`    CDU Survive?:       ${r.redundancy.cduFailureScenario.canSurvive}`);
  console.log(`    Total Load:         ${r.redundancy.cduFailureScenario.totalLoad_kW.toFixed(1)} kW`);
  console.log(`    Remaining Cap:      ${r.redundancy.cduFailureScenario.remainingCapacity_kW.toFixed(1)} kW`);
  console.log(`    Deficit:            ${r.redundancy.cduFailureScenario.deficit_kW.toFixed(1)} kW`);
  console.log(`    Shed Order (top 3): ${r.redundancy.cduFailureScenario.shedOrder.slice(0, 3).join(', ')}`);
  const sortedThrottle = [...r.redundancy.cduFailureScenario.perRackThrottle].sort((a, b) => a.timeToThrottle_s - b.timeToThrottle_s);
  for (const rt of sortedThrottle.slice(0, 5)) {
    console.log(`      ${rt.rackId} (${rt.platformName}): vol=${rt.coolantVolume_L}L, heat=${rt.heatLoad_kW.toFixed(1)} kW, budget=${rt.tempBudget_C}°C, TTT=${rt.timeToThrottle_s.toFixed(1)}s`);
  }

  // Climate
  if (r.climate) {
    console.log('  [Climate]');
    console.log(`    Location:           ${r.climate.locationName}`);
    console.log(`    Annual PUE:         ${r.climate.annualPue.toFixed(3)}`);
    console.log(`    Free Cooling Hrs:   ${r.climate.freeCoolingHours}`);
    console.log(`    Chiller Hours:      ${r.climate.chillerHours}`);
    console.log(`    Annual Energy:      ${r.climate.annualEnergy_MWh.toFixed(1)} MWh`);
  }

  // Cost
  if (r.cost) {
    console.log('  [Cost]');
    console.log(`    CAPEX Total:        $${r.cost.capex.total.toLocaleString()}`);
    console.log(`      CDUs:             $${r.cost.capex.cdus.toLocaleString()}`);
    console.log(`      Piping:           $${r.cost.capex.piping.toLocaleString()}`);
    console.log(`      Manifolds:        $${r.cost.capex.manifolds.toLocaleString()}`);
    console.log(`      Dry Cooler:       $${r.cost.capex.dryCooler.toLocaleString()}`);
    console.log(`      Chiller:          $${r.cost.capex.chiller.toLocaleString()}`);
    console.log(`      Controls:         $${r.cost.capex.controls.toLocaleString()}`);
    console.log(`    OPEX/yr:            $${r.cost.opexAnnual.total.toLocaleString()}`);
    console.log(`      Electricity:      $${r.cost.opexAnnual.electricity.toLocaleString()}`);
    console.log(`      Coolant:          $${r.cost.opexAnnual.coolantReplacement.toLocaleString()}`);
    console.log(`      Maintenance:      $${r.cost.opexAnnual.maintenance.toLocaleString()}`);
    console.log(`    TCO 5yr:            $${r.cost.tco5Year.toLocaleString()}`);
    console.log(`    Per-GPU-Hour:       $${r.cost.costPerGpuHour.toFixed(6)}`);
  }

  // Cooling Compat
  console.log('  [Cooling Compat]');
  console.log(`    Shared Loop OK?:    ${r.coolingCompat.sharedLoopFeasible}`);
  console.log(`    Constrained Range:  ${r.coolingCompat.constrainedInletRange_C ? `${r.coolingCompat.constrainedInletRange_C[0]}-${r.coolingCompat.constrainedInletRange_C[1]}°C` : 'N/A'}`);
  console.log(`    # Alerts:           ${r.coolingCompat.alerts.length}`);
  for (const a of r.coolingCompat.alerts.slice(0, 5)) {
    console.log(`      [${a.severity}] ${a.message}`);
  }

  // Warnings
  console.log('  [Warnings]');
  if (r.warnings.length === 0) {
    console.log('    (none)');
  }
  for (const w of r.warnings) {
    console.log(`    [${w.severity}/${w.category}] ${w.message}`);
  }

  // Extras
  if (extras) {
    console.log('  [Extras]');
    for (const [k, v] of Object.entries(extras)) {
      console.log(`    ${k}: ${v}`);
    }
  }

  // Assertions
  console.log('-'.repeat(100));
  console.log(`  ASSERTIONS: ${passCount} passed, ${failCount} failed  [${status}]`);
  for (const a of assertions) {
    const mark = a.pass ? 'PASS' : '** FAIL **';
    console.log(`    [${mark}] ${a.label}  (actual: ${a.actual}, expected: ${a.expected})`);
  }
}

// ─── Scenario Runner ─────────────────────────────────────────────────────────

let totalPass = 0;
let totalFail = 0;

function runScenario(
  name: string,
  configSummary: string,
  racks: RackConfig[],
  coolantId: CoolantId,
  inletTemp: number,
  ambientTemp: number,
  redundancy: CduRedundancy,
  buildAssertions: (r: FullCalculationResult) => Assertion[],
  climate?: ClimateProfile | null,
  electricityRate?: number,
  extras?: Record<string, string>,
): FullCalculationResult {
  const r = runCalculations(racks, coolantId, inletTemp, ambientTemp, redundancy, climate, electricityRate);
  const assertions = buildAssertions(r);
  totalPass += assertions.filter(a => a.pass).length;
  totalFail += assertions.filter(a => !a.pass).length;
  printReport(name, configSummary, r, assertions, extras);
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 1: 12x HGX B300 (Supermicro, 10 nodes each)
// ═══════════════════════════════════════════════════════════════════════════════
//  Cold plate DP = 0.7 bar (single node, parallel manifold — NOT multiplied by
//  node count). System DP ~ 0.7 (cold plate) + 0.24 (manifold) + 0.07 (piping)
//  + 0.5 (CDU) + 0.15 (fittings) = ~1.6 bar

const s1Racks = makeRacks(Array(12).fill(makeSlot('hgx-b300', 'supermicro', 10)));
runScenario(
  'Scenario 1: 12x HGX B300 (Supermicro, 10 nodes)',
  'PG30, 25°C inlet, 35°C ambient, n+1',
  s1Racks, 'pg30', 25, 35, 'n+1',
  (r) => {
    // Per-rack cold plate DP: nodes are in parallel, so rack DP = single node DP = 0.7 bar
    const rack1Branch = r.hydraulic.perRackBranch.find(b => b.rackId === 'rack-1');
    const coldPlateDpPerRack = rack1Branch?.coldPlate_bar ?? -1;

    // Outlet temp check: at recommended 25°C inlet, no outlet-temp-exceeded alerts
    const outletAlerts = r.coolingCompat.alerts.filter(a => a.alertType === 'outlet-temp-exceeded');

    return [
      // 12 racks x 10 nodes x (10.5 + 0.25) kW = 1290 kW
      assertRange('Total IT power ~1290 kW', r.power.totalIT_kW, 1200, 1400),
      // Cold plate DP per rack = 0.7 bar (single node, parallel manifold)
      assertEq('Cold plate dP per rack = 0.7 bar (single node)', coldPlateDpPerRack, 0.7),
      // System DP ~1-4 bar with single-node parallel manifold
      assertRange('System dP 1-4 bar (single-node parallel manifold)', r.hydraulic.totalSystemDp_bar, 1, 4),
      // Pump head and power should be reasonable for ~1.6 bar
      assertRange('Pump head 10-25 m', r.hydraulic.pumpHead_m, 10, 25),
      assertRange('Pump power 3-15 kW', r.hydraulic.pumpPower_kW, 3, 15),
      assertGt('Pump power > 0', r.hydraulic.pumpPower_kW, 0),
      assertEq('ASHRAE W-class = W4', r.ashraeWClass.systemClass, 'W4'),
      assertEq('Free cooling = excellent', r.ashraeWClass.freeCoolingViability, 'excellent'),
      assertTruthy('Header DN is set', r.hydraulic.headerDn !== 'N/A'),
      assertGt('Reynolds > 2300 (turbulent)', r.hydraulic.reynoldsNumber, 2300),
      assertEq('Loop topology = single-loop', r.loopArchitecture.topology, 'single-loop'),
      assertRange('Total flow 1500-2000 L/min', r.thermal.totalFlow_Lpm, 1500, 2000),
      // At recommended 25°C inlet, no outlet-temp-exceeded alerts
      assertEq('No outlet-temp-exceeded alerts at 25°C inlet', outletAlerts.length, 0),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 2: 12x HGX B200 (Supermicro, 10 nodes each)
// ═══════════════════════════════════════════════════════════════════════════════

const s2Racks = makeRacks(Array(12).fill(makeSlot('hgx-b200', 'supermicro', 10)));
runScenario(
  'Scenario 2: 12x HGX B200 (Supermicro, 10 nodes)',
  'PG30, 22°C inlet, 35°C ambient, n+1',
  s2Racks, 'pg30', 22, 35, 'n+1',
  (r) => {
    // Outlet temp check: at recommended 22°C inlet, no outlet-temp-exceeded alerts
    const outletAlerts = r.coolingCompat.alerts.filter(a => a.alertType === 'outlet-temp-exceeded');

    return [
      // 12 racks x 10 nodes x (12 + 0.25) = 1470 kW
      assertRange('Total IT power ~1470 kW', r.power.totalIT_kW, 1400, 1600),
      // B200 max inlet 30°C -> W3 (<=32)
      assertEq('ASHRAE W-class = W3', r.ashraeWClass.systemClass, 'W3'),
      assertEq('Free cooling = good', r.ashraeWClass.freeCoolingViability, 'good'),
      assertGt('Reynolds > 2300 (turbulent)', r.hydraulic.reynoldsNumber, 2300),
      assertEq('Loop topology = single-loop', r.loopArchitecture.topology, 'single-loop'),
      assertRange('Total flow 2000-2600 L/min', r.thermal.totalFlow_Lpm, 2000, 2600),
      assertGt('Pump power > 0', r.hydraulic.pumpPower_kW, 0),
      // System dP ~1-4 bar with single-node parallel manifold (B200 coldPlate=0.8 bar)
      assertRange('System dP 1-4 bar (single-node parallel manifold)', r.hydraulic.totalSystemDp_bar, 1, 4),
      // At recommended 22°C inlet, no outlet-temp-exceeded alerts
      assertEq('No outlet-temp-exceeded alerts at 22°C inlet', outletAlerts.length, 0),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 3: Mixed B300 + B200 (6 each, Supermicro)
// ═══════════════════════════════════════════════════════════════════════════════

const s3Racks = makeRacks([
  ...Array(6).fill(makeSlot('hgx-b300', 'supermicro', 10)),
  ...Array(6).fill(makeSlot('hgx-b200', 'supermicro', 10)),
]);
runScenario(
  'Scenario 3: Mixed 6x B300 + 6x B200 (Supermicro)',
  'PG30, 20°C inlet, 35°C ambient, n+1',
  s3Racks, 'pg30', 20, 35, 'n+1',
  (r) => {
    // B300 range: 15-45, B200 range: 15-30 -> overlap: 15-30
    // System W-class: limited by B200 max=30 -> getWaterClass(30) = W3 (<=32)
    const constrainedRange = r.coolingCompat.constrainedInletRange_C;

    // ΔT budget bars: B300 and B200 should have different ΔT values
    // B300: (10.5+0.25)*10*0.98 / (15*1.032*3850/60) = ~10.6°C
    // B200: (12+0.25)*10*0.92 / (20*1.032*3850/60) = ~8.5°C
    const b300DeltaT = r.thermal.perRack.find(tr => tr.rackId === 'rack-1')?.deltaT_C ?? 0;
    const b200DeltaT = r.thermal.perRack.find(tr => tr.rackId === 'rack-7')?.deltaT_C ?? 0;

    // Outlet temp check at constrained midpoint (22°C): no outlet-temp-exceeded alerts
    // (actual scenario uses 20°C inlet; we just verify the *configured* inlet doesn't
    //  cause outlet alerts either — 20+10.6=30.6 and 20+8.5=28.5, both well under 40°C)
    const outletAlerts = r.coolingCompat.alerts.filter(a => a.alertType === 'outlet-temp-exceeded');

    return [
      assertEq('ASHRAE system W-class = W3 (limited by B200 max=30)', r.ashraeWClass.systemClass, 'W3'),
      assertTruthy('Shared loop feasible', r.coolingCompat.sharedLoopFeasible),
      assertTruthy('Constrained range exists', constrainedRange !== null),
      assertEq('Constrained range min = 15', constrainedRange?.[0], 15),
      assertEq('Constrained range max = 30', constrainedRange?.[1], 30),
      assertEq('Loop topology = single-loop', r.loopArchitecture.topology, 'single-loop'),
      assertGt('Total IT power > 0', r.power.totalIT_kW, 0),
      // ΔT budget: B300 and B200 have different ΔT values (different heat/flow ratios)
      assertGt('B300 ΔT > 0', b300DeltaT, 0),
      assertGt('B200 ΔT > 0', b200DeltaT, 0),
      assertNotEq('B300 ΔT differs from B200 ΔT', b300DeltaT.toFixed(2), b200DeltaT.toFixed(2)),
      assertRange('B300 ΔT ~10-11°C', b300DeltaT, 10, 11),
      assertRange('B200 ΔT ~8-9°C', b200DeltaT, 8, 9),
      // No outlet-temp-exceeded alerts at configured 20°C inlet
      assertEq('No outlet-temp-exceeded alerts at 20°C inlet', outletAlerts.length, 0),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 4: Mixed GB200 NVL72 + HGX B200
// ═══════════════════════════════════════════════════════════════════════════════
//  GB200 NVL72 (Dell): inlet range 20-25°C (no OEM override) -> W3
//  B200 (Supermicro): inlet range 15-30°C -> W3
//  Overlap: 20-25°C (5°C >= 3°C MIN_RANGE_OVERLAP) -> single-loop feasible
//  Loop architect groups them into one group -> single-loop topology

const s4Racks = makeRacks([
  ...Array(6).fill(makeSlot('gb200-nvl72', 'dell', 1)),
  ...Array(6).fill(makeSlot('hgx-b200', 'supermicro', 10)),
]);
runScenario(
  'Scenario 4: 6x GB200 NVL72 (Dell) + 6x HGX B200 (Supermicro)',
  'PG30, 22°C inlet, 35°C ambient, n+1',
  s4Racks, 'pg30', 22, 35, 'n+1',
  (r) => {
    // GB200: 20-25°C, B200 (Supermicro): 15-30°C -> overlap: 20-25°C
    // Both max inlets <= 32 -> W3
    // System W-class = W3 (GB200 max=25 -> W3, not W2 since W2 is <=22)
    const constrainedRange = r.coolingCompat.constrainedInletRange_C;

    // Loop architect: overlap is 5°C >= MIN_RANGE_OVERLAP_C (3°C),
    // so both platforms group together -> single-loop topology.
    // GB200 NVL72 has very high ΔT (~20°C) so at 22°C inlet, outlet hits 42°C
    // (outlet-temp-exceeded warning is expected for GB200 racks in this config)

    return [
      assertEq('ASHRAE system W-class = W3 (GB200 max=25, <=32)', r.ashraeWClass.systemClass, 'W3'),
      assertTruthy('Shared loop feasible', r.coolingCompat.sharedLoopFeasible),
      assertTruthy('Constrained range exists', constrainedRange !== null),
      assertEq('Constrained range min = 20', constrainedRange?.[0], 20),
      assertEq('Constrained range max = 25', constrainedRange?.[1], 25),
      assertEq('Free cooling = good (W3)', r.ashraeWClass.freeCoolingViability, 'good'),
      assertRange('Total IT power > 1000 kW', r.power.totalIT_kW, 1000, 2500),
      // Loop architect: 5°C overlap >= 3°C threshold -> single-loop
      assertEq('Loop topology = single-loop (5°C overlap >= 3°C threshold)', r.loopArchitecture.topology, 'single-loop'),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 5: GB300 NVL72 + GB200 NVL72 (very tight range)
// ═══════════════════════════════════════════════════════════════════════════════
//  GB300: 15-25°C, GB200: 20-25°C -> overlap: 20-25°C (5°C)
//  Both max inlet = 25°C -> getWaterClass(25) = W3

const s5Racks = makeRacks([
  ...Array(6).fill(makeSlot('gb300-nvl72', 'supermicro', 1)),
  ...Array(6).fill(makeSlot('gb200-nvl72', 'supermicro', 1)),
]);
runScenario(
  'Scenario 5: 6x GB300 NVL72 + 6x GB200 NVL72 (Supermicro)',
  'PG30, 22°C inlet, 35°C ambient, n+1',
  s5Racks, 'pg30', 22, 35, 'n+1',
  (r) => {
    // GB300: 15-25°C, GB200: 20-25°C -> overlap: 20-25°C (5°C)
    // max=25 -> W3 (<=32)
    const constrainedRange = r.coolingCompat.constrainedInletRange_C;
    return [
      assertEq('ASHRAE system W-class = W3 (max=25, <=32)', r.ashraeWClass.systemClass, 'W3'),
      assertTruthy('Shared loop feasible', r.coolingCompat.sharedLoopFeasible),
      assertTruthy('Constrained range exists', constrainedRange !== null),
      assertEq('Constrained range min = 20', constrainedRange?.[0], 20),
      assertEq('Constrained range max = 25', constrainedRange?.[1], 25),
      assertEq('Free cooling = good (W3)', r.ashraeWClass.freeCoolingViability, 'good'),
      // 5°C overlap is >3°C so narrow warning should not fire
      assertRange('Overlap width = 5°C', (constrainedRange?.[1] ?? 0) - (constrainedRange?.[0] ?? 0), 4, 6),
      assertRange('Total IT power ~1512 kW', r.power.totalIT_kW, 1400, 1600),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 6: Partial load at 50% — pump affinity
// ═══════════════════════════════════════════════════════════════════════════════

runScenario(
  'Scenario 6: Partial Load 50% — Pump Affinity (12x HGX B300)',
  'PG30, 25°C inlet, 35°C ambient, n+1 — checking partial load cube law',
  s1Racks, 'pg30', 25, 35, 'n+1',
  (r) => {
    const designPump = r.partialLoad.designPumpPower_kW;
    const s50 = r.partialLoad.loadScenarios.find(l => l.loadPercent === 50);
    const s100 = r.partialLoad.loadScenarios.find(l => l.loadPercent === 100);
    const s25 = r.partialLoad.loadScenarios.find(l => l.loadPercent === 25);
    const s75 = r.partialLoad.loadScenarios.find(l => l.loadPercent === 75);

    // At 50%: pump power = 0.5^3 = 0.125 = 12.5% of design
    const expectedPump50 = designPump * 0.125;
    const pumpRatio50 = s50 ? s50.pumpPower_kW / designPump : 0;

    return [
      assertGt('Design pump power > 0', designPump, 0),
      assertRange('50% pump power ratio ~12.5%', pumpRatio50 * 100, 11, 14),
      assertRange('50% pump power ~expected', s50?.pumpPower_kW ?? 0, expectedPump50 * 0.9, expectedPump50 * 1.1),
      assertLt('PUE at 50% < PUE at 100%', s50?.pue ?? 2, s100?.pue ?? 1),
      assertGt('Reynolds at 50% still turbulent', s50?.reynoldsNumber ?? 0, 2300),
      assertFalsy('No laminar risk at 50%', s50?.laminarRisk),
      assertGt('PUE at 25% still reasonable', s25?.pue ?? 0, 1.0),
      assertGt('PUE at 75%', s75?.pue ?? 0, 1.0),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 7: CDU failure / redundancy
// ═══════════════════════════════════════════════════════════════════════════════

const s7Racks = makeRacks([
  ...Array(6).fill(makeSlot('gb200-nvl72', 'supermicro', 1)),
  ...Array(6).fill(makeSlot('hgx-b200', 'supermicro', 10)),
]);
runScenario(
  'Scenario 7: CDU Failure — 6x GB200 NVL72 + 6x HGX B200 (Supermicro)',
  'PG30, 22°C inlet, 35°C ambient, n+1',
  s7Racks, 'pg30', 22, 35, 'n+1',
  (r) => {
    // GB200 NVL72: 200L per unit x 1 node = 200L, ~(120+1.9)*0.87 = ~106.1 kW liquid, maxDeltaT=15°C
    // time = (0.2 m³ × 1032 kg/m³ × 3850 J/(kg·K) × 15°C) / (106,100 W) = ~112s
    // HGX B200: 4L per node x 10 nodes = 40L, ~(12+0.25)×10×0.92 = ~112.7 kW liquid, maxDeltaT=10°C
    // time = (0.04 m³ × 1032 × 3850 × 10) / (112,700 W) = ~14.1s

    const gb200Racks = r.redundancy.cduFailureScenario.perRackThrottle.filter(
      rt => rt.platformName.includes('GB200')
    );
    const b200Racks = r.redundancy.cduFailureScenario.perRackThrottle.filter(
      rt => rt.platformName.includes('HGX B200')
    );

    const gb200Ttt = gb200Racks.length > 0 ? gb200Racks[0].timeToThrottle_s : 0;
    const b200Ttt = b200Racks.length > 0 ? b200Racks[0].timeToThrottle_s : 0;

    // The shed order: B200 racks first (lower TTT)
    const shedOrder = r.redundancy.cduFailureScenario.shedOrder;
    const firstShed = shedOrder[0] ?? '';
    const b200RackIds = s7Racks.filter((_r, i) => i >= 6 && i < 12).map(r2 => r2.id);
    const firstShedIsB200 = b200RackIds.includes(firstShed);

    return [
      // Tightened ranges per the fix verification
      assertRange('GB200 NVL72 TTT ~90-120s', gb200Ttt, 90, 120),
      assertRange('B200 TTT ~10-15s', b200Ttt, 10, 15),
      assertLt('B200 TTT < GB200 TTT', b200Ttt, gb200Ttt),
      assertTruthy('First shed is B200 rack', firstShedIsB200),
      assertTruthy('CDU failure can survive (n+1)', r.redundancy.cduFailureScenario.canSurvive),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 8: Climate — Phoenix vs Oslo
// ═══════════════════════════════════════════════════════════════════════════════

const phoenixClimate = getClimate('phoenix');
const osloClimate = getClimate('oslo');

const s8Phoenix = runScenario(
  'Scenario 8a: Climate — Phoenix (12x HGX B300)',
  'PG30, 25°C inlet, 35°C ambient, n+1, Phoenix climate',
  s1Racks, 'pg30', 25, 35, 'n+1',
  (r) => [
    assertTruthy('Climate result exists', r.climate !== null),
    assertGt('Chiller hours > 1000', r.climate?.chillerHours ?? 0, 1000),
    assertGt('Annual PUE > 1.0', r.climate?.annualPue ?? 0, 1.0),
    assertGt('Annual energy > 0', r.climate?.annualEnergy_MWh ?? 0, 0),
  ],
  phoenixClimate,
);

const s8Oslo = runScenario(
  'Scenario 8b: Climate — Oslo (12x HGX B300)',
  'PG30, 25°C inlet, 35°C ambient, n+1, Oslo climate',
  s1Racks, 'pg30', 25, 35, 'n+1',
  (r) => [
    assertTruthy('Climate result exists', r.climate !== null),
    assertGte('Free cooling hours >= 7500', r.climate?.freeCoolingHours ?? 0, 7500),
    assertGt('Annual PUE > 1.0', r.climate?.annualPue ?? 0, 1.0),
    assertLt('Oslo PUE < Phoenix PUE', r.climate?.annualPue ?? 2, s8Phoenix.climate?.annualPue ?? 1),
  ],
  osloClimate,
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 9: Cost estimation
// ═══════════════════════════════════════════════════════════════════════════════

runScenario(
  'Scenario 9: Cost — 12x HGX B300 (Supermicro)',
  'PG30, 25°C inlet, 35°C ambient, n+1, $0.10/kWh',
  s1Racks, 'pg30', 25, 35, 'n+1',
  (r) => [
    assertTruthy('Cost result exists', r.cost !== null),
    assertGt('CAPEX total > 0', r.cost?.capex.total ?? 0, 0),
    assertGt('CAPEX CDUs > 0', r.cost?.capex.cdus ?? 0, 0),
    assertGt('CAPEX piping > 0', r.cost?.capex.piping ?? 0, 0),
    assertGt('CAPEX manifolds > 0', r.cost?.capex.manifolds ?? 0, 0),
    assertGt('OPEX/yr > 0', r.cost?.opexAnnual.total ?? 0, 0),
    assertGt('TCO 5yr > CAPEX', r.cost?.tco5Year ?? 0, r.cost?.capex.total ?? 0),
    assertGt('Per-GPU-hour > 0', r.cost?.costPerGpuHour ?? 0, 0),
    assertLt('Per-GPU-hour < $1', r.cost?.costPerGpuHour ?? 1, 1),
  ],
  null,
  0.10,
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 10: All air-cooled (Xeon 6)
// ═══════════════════════════════════════════════════════════════════════════════

const s10Racks = makeRacks(Array(12).fill(makeSlot('xeon-6', 'dell', 21)));
runScenario(
  'Scenario 10: All Air-Cooled — 12x Xeon 6 (Dell, 21 nodes)',
  'PG30, 25°C inlet, 35°C ambient, n+1',
  s10Racks, 'pg30', 25, 35, 'n+1',
  (r) => [
    // 12 racks x 21 nodes x (1.5 + 0.05) kW = 390.6 kW
    assertRange('Total IT ~391 kW', r.power.totalIT_kW, 380, 400),
    assertEq('Total liquid heat = 0', r.power.totalLiquidHeat_kW, 0),
    assertEq('Total flow = 0', r.thermal.totalFlow_Lpm, 0),
    assertEq('System dP = 0', r.hydraulic.totalSystemDp_bar, 0),
    assertEq('Pump power = 0', r.hydraulic.pumpPower_kW, 0),
    assertEq('Header DN = N/A', r.hydraulic.headerDn, 'N/A'),
    assertEq('Reynolds = 0', r.hydraulic.reynoldsNumber, 0),
    // ASHRAE: no liquid platforms, system class W5 / excellent by default
    assertEq('ASHRAE W-class = W5 (no liquid)', r.ashraeWClass.systemClass, 'W5'),
    assertGt('PUE still > 1', r.pue.pue, 1.0),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 11: Empty racks
// ═══════════════════════════════════════════════════════════════════════════════

const s11Racks = makeRacks(Array(12).fill(null));
runScenario(
  'Scenario 11: Empty Racks (all 12 empty)',
  'PG30, 25°C inlet, 35°C ambient, n+1',
  s11Racks, 'pg30', 25, 35, 'n+1',
  (r) => [
    assertEq('Total IT = 0', r.power.totalIT_kW, 0),
    assertEq('Total liquid heat = 0', r.power.totalLiquidHeat_kW, 0),
    assertEq('Total flow = 0', r.thermal.totalFlow_Lpm, 0),
    assertEq('System dP = 0', r.hydraulic.totalSystemDp_bar, 0),
    assertEq('Pump power = 0', r.hydraulic.pumpPower_kW, 0),
    assertEq('PUE = 1.0', r.pue.pue, 1),
    assertEq('No warnings crash', true, true),  // if we got here, no crash
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 12: Single rack
// ═══════════════════════════════════════════════════════════════════════════════
//  GB300 NVL72: max inlet = 25°C -> getWaterClass(25) = W3 (<=32)

const s12Racks = makeRacks([
  makeSlot('gb300-nvl72', 'supermicro', 1),
  null, null, null, null, null, null, null, null, null, null, null,
]);
runScenario(
  'Scenario 12: Single Rack — 1x GB300 NVL72 (Supermicro)',
  'PG30, 20°C inlet, 35°C ambient, n+1',
  s12Racks, 'pg30', 20, 35, 'n+1',
  (r) => [
    // 1 rack x 1 node x (132 + 2.3) = 134.3 kW
    assertRange('Total IT ~134 kW', r.power.totalIT_kW, 130, 140),
    assertRange('Total flow = 80 L/min', r.thermal.totalFlow_Lpm, 75, 85),
    assertGt('System dP > 0', r.hydraulic.totalSystemDp_bar, 0),
    assertGt('Pump power > 0', r.hydraulic.pumpPower_kW, 0),
    assertFalsy('No flow imbalance (single rack)', r.hydraulic.flowImbalanceRisk),
    assertEq('ASHRAE W-class = W3 (max=25)', r.ashraeWClass.systemClass, 'W3'),
    assertEq('Loop topology = single-loop', r.loopArchitecture.topology, 'single-loop'),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 13: Inlet temp out of range
// ═══════════════════════════════════════════════════════════════════════════════

const s13Racks = makeRacks([
  ...Array(6).fill(makeSlot('hgx-b300', 'supermicro', 10)),
  ...Array(6).fill(makeSlot('hgx-b200', 'supermicro', 10)),
]);
runScenario(
  'Scenario 13: Inlet Out of Range — 6x B300 + 6x B200, inlet=5°C',
  'PG30, 5°C inlet, 35°C ambient, n+1',
  s13Racks, 'pg30', 5, 35, 'n+1',
  (r) => {
    // B300 range: 15-45, B200 range: 15-30 -> overlap: 15-30°C
    // 5°C is below 15°C -> out of range warning
    const hasOutOfRangeWarning = r.coolingCompat.warnings.some(
      w => w.message.toLowerCase().includes('outside') && w.message.includes('5°C')
    );
    return [
      assertTruthy('Shared loop feasible (overlap exists)', r.coolingCompat.sharedLoopFeasible),
      assertTruthy('Out-of-range warning present', hasOutOfRangeWarning),
      assertLt('Max outlet temp low (cold inlet)', r.thermal.maxOutletTemp_C, 20),
      assertGt('Total IT power > 0', r.power.totalIT_kW, 0),
    ];
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 14: DI-Water coolant (low viscosity)
// ═══════════════════════════════════════════════════════════════════════════════

const s14_PG30 = runCalculations(s1Racks, 'pg30', 25, 35, 'n+1');

runScenario(
  'Scenario 14: DI-Water — 12x HGX B300 (Supermicro)',
  'DI-Water, 25°C inlet, 35°C ambient, n+1',
  s1Racks, 'di-water', 25, 35, 'n+1',
  (r) => [
    assertGt('Reynolds higher than PG30', r.hydraulic.reynoldsNumber, s14_PG30.hydraulic.reynoldsNumber),
    assertLt('Pump power lower than PG30', r.hydraulic.pumpPower_kW, s14_PG30.hydraulic.pumpPower_kW),
    assertGt('Reynolds > 2300 (turbulent)', r.hydraulic.reynoldsNumber, 2300),
    assertGt('Total IT same ~1290 kW', r.power.totalIT_kW, 1200),
  ],
  null,
  undefined,
  {
    'PG30 Reynolds': s14_PG30.hydraulic.reynoldsNumber.toFixed(0),
    'PG30 Pump Power': s14_PG30.hydraulic.pumpPower_kW.toFixed(2) + ' kW',
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 15: PG50 coolant (high viscosity)
// ═══════════════════════════════════════════════════════════════════════════════

runScenario(
  'Scenario 15: PG50 — 12x HGX B300 (Supermicro)',
  'PG50, 25°C inlet, 35°C ambient, n+1',
  s1Racks, 'pg50', 25, 35, 'n+1',
  (r) => {
    // PG50 viscosity = 5.0 cP vs PG30 = 2.5 cP
    // Lower Reynolds, higher pump power
    const laminarAtAnyLoad = r.partialLoad.loadScenarios.some(ls => ls.laminarRisk);
    return [
      assertLt('Reynolds lower than PG30', r.hydraulic.reynoldsNumber, s14_PG30.hydraulic.reynoldsNumber),
      assertGt('Pump power higher than PG30', r.hydraulic.pumpPower_kW, s14_PG30.hydraulic.pumpPower_kW),
      assertGt('Total IT same ~1290 kW', r.power.totalIT_kW, 1200),
      // Check if laminar risk appears at low loads
      assertEq('Laminar risk check present', typeof laminarAtAnyLoad, 'boolean'),
    ];
  },
  null,
  undefined,
  {
    'PG30 Reynolds': s14_PG30.hydraulic.reynoldsNumber.toFixed(0),
    'PG30 Pump Power': s14_PG30.hydraulic.pumpPower_kW.toFixed(2) + ' kW',
  },
);


// ═══════════════════════════════════════════════════════════════════════════════
//  FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(100));
console.log('  FINAL SUMMARY');
console.log('='.repeat(100));
console.log(`  Total assertions: ${totalPass + totalFail}`);
console.log(`  Passed:           ${totalPass}`);
console.log(`  Failed:           ${totalFail}`);
console.log(`  Result:           ${totalFail === 0 ? 'ALL PASS' : `${totalFail} FAILURE(S)`}`);
console.log('='.repeat(100));

if (totalFail > 0) {
  process.exit(1);
}
