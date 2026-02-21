import { Zap, Thermometer, Droplets, Gauge, Weight, AlertTriangle, Wind, Server } from 'lucide-react';
import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { MetricCard } from '../common/MetricCard';
import { StatusBadge } from '../common/StatusBadge';
import { PowerDistributionChart } from '../charts/PowerDistributionChart';
import { ThermalProfileChart } from '../charts/ThermalProfileChart';
import { PueBreakdownChart } from '../charts/PueBreakdownChart';
import { FlowRateChart } from '../charts/FlowRateChart';
import { ClusterThermalWaterfallChart } from '../charts/ClusterThermalWaterfallChart';
import { CapacityVsDemandChart } from '../charts/CapacityVsDemandChart';
import { CoolingCompatPanel } from './CoolingCompatPanel';
import { ClusterThermalPanel } from './ClusterThermalPanel';
import { CoolingInfraPanel } from './CoolingInfraPanel';
import { RackVsCoolingPanel } from './RackVsCoolingPanel';
import { HydraulicPanel } from './HydraulicPanel';
import { PartialLoadPanel } from './PartialLoadPanel';
import { LoopArchitecturePanel } from './LoopArchitecturePanel';
import { RedundancyPanel } from './RedundancyPanel';
import { ClimateAnalysisPanel } from './ClimateAnalysisPanel';
import { CostPanel } from './CostPanel';
import { formatPower, formatFlow, formatTemp, formatWeight, formatPue } from '../../utils/format';

export function Dashboard() {
  const results = useConfigStore(s => s.results);
  const racks = useConfigStore(s => s.racks);
  const climateProfile = useConfigStore(s => s.climateProfile);
  const electricityRate = useConfigStore(s => s.electricityRate);
  const setClimateProfile = useConfigStore(s => s.setClimateProfile);
  const setElectricityRate = useConfigStore(s => s.setElectricityRate);
  const unitSystem = useUiStore(s => s.unitSystem);

  if (!results) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="text-center">
          <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Configure racks to see calculations</p>
          <p className="text-xs mt-1">Go to the Configure tab and add server platforms</p>
        </div>
      </div>
    );
  }

  const { power, thermal, clusterThermal, cdu, pue, container, heatRejection, coolingCompat, warnings, hydraulic, partialLoad, loopArchitecture, ashraeWClass, redundancy, climate, cost } = results;

  const pueSeverity = pue.pue < 1.15 ? 'normal' : pue.pue < 1.3 ? 'warning' : 'critical';
  const weightSeverity = container.overweight ? 'critical' : container.totalWeight_kg > container.weightLimit_kg * 0.9 ? 'warning' : 'normal';

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            Validation Warnings
          </div>
          <div className="flex flex-wrap gap-2">
            {warnings.map((w, i) => (
              <StatusBadge key={i} severity={w.severity} label={w.message} />
            ))}
          </div>
        </div>
      )}

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <MetricCard
          label="Total IT Power"
          value={formatPower(power.totalIT_kW, unitSystem)}
          icon={<Zap className="w-4 h-4" />}
          tooltip="Sum of all rack IT power including OEM overhead"
        />
        <MetricCard
          label="Wall Power"
          value={formatPower(pue.totalFacilityPower_kW, unitSystem)}
          subValue={`PUE × IT Power`}
          icon={<Zap className="w-4 h-4" />}
        />
        <MetricCard
          label="Peak Rack"
          value={formatPower(power.peakRack_kW, unitSystem)}
          subValue={`Avg: ${formatPower(power.avgRack_kW, unitSystem)}`}
          severity={power.peakRack_kW > 150 ? 'critical' : 'normal'}
        />
        <MetricCard
          label="Inlet / Outlet"
          value={`${formatTemp(thermal.perRack[0]?.inletTemp_C ?? 0, unitSystem)}`}
          subValue={`Out: ${formatTemp(thermal.maxOutletTemp_C, unitSystem)} (max)`}
          icon={<Thermometer className="w-4 h-4" />}
          severity={thermal.maxOutletTemp_C > 45 ? 'critical' : thermal.maxOutletTemp_C > 40 ? 'warning' : 'normal'}
          tooltip={`ΔT avg: ${thermal.avgDeltaT_C.toFixed(1)}°C`}
        />
        <MetricCard
          label="Total Flow Rate"
          value={formatFlow(thermal.totalFlow_Lpm, unitSystem)}
          icon={<Droplets className="w-4 h-4" />}
          tooltip="Sum of all liquid-cooled rack flow rates"
        />
        <MetricCard
          label="CDU Sizing"
          value={`${cdu.totalCount}× ${cdu.selectedSize_kW} kW`}
          subValue={`${cdu.activeCount} active + ${cdu.redundantCount} redundant`}
          icon={<Wind className="w-4 h-4" />}
        />
        <MetricCard
          label="PUE"
          value={formatPue(pue.pue)}
          subValue={`Cooling: ${formatPower(pue.coolingPower_kW, unitSystem)}`}
          icon={<Gauge className="w-4 h-4" />}
          severity={pueSeverity}
          tooltip={`IT: ${power.totalIT_kW.toFixed(0)} kW + Cooling: ${pue.coolingPower_kW.toFixed(1)} kW + Dist: ${pue.distributionLoss_kW.toFixed(1)} kW`}
        />
        <MetricCard
          label="Heat Rejection"
          value={heatRejection.method.replace('-', ' ')}
          subValue={formatPower(heatRejection.capacity_kW, unitSystem)}
          tooltip={`Fan: ${heatRejection.fanPower_kW.toFixed(1)} kW, Compressor: ${heatRejection.compressorPower_kW.toFixed(1)} kW`}
        />
        <MetricCard
          label="Total Weight"
          value={formatWeight(container.totalWeight_kg, unitSystem)}
          subValue={`Limit: ${formatWeight(container.weightLimit_kg, unitSystem)}`}
          icon={<Weight className="w-4 h-4" />}
          severity={weightSeverity}
        />
        <MetricCard
          label="Rack Capacity"
          value={`${container.usedRacks} / ${container.maxRacks}`}
          subValue={`${container.maxRacks - container.usedRacks} slots available`}
          severity={container.usedRacks > container.maxRacks ? 'critical' : 'normal'}
        />
      </div>

      {/* Cluster Thermal Panel */}
      <ClusterThermalPanel clusterThermal={clusterThermal} unitSystem={unitSystem} />

      {/* Cooling Loop Compatibility (enhanced with ASHRAE W-class) */}
      <CoolingCompatPanel compat={coolingCompat} thermal={thermal} unitSystem={unitSystem} ashraeWClass={ashraeWClass} racks={racks} />

      {/* Hydraulic Design */}
      <HydraulicPanel hydraulic={hydraulic} unitSystem={unitSystem} />

      {/* Loop Architecture */}
      <LoopArchitecturePanel loopArch={loopArchitecture} unitSystem={unitSystem} />

      {/* Partial Load */}
      <PartialLoadPanel partialLoad={partialLoad} unitSystem={unitSystem} />

      {/* Cooling Infrastructure */}
      <CoolingInfraPanel heatRejection={heatRejection} unitSystem={unitSystem} />

      {/* Rack vs Cooling Capacity */}
      <RackVsCoolingPanel power={power} thermal={thermal} cdu={cdu} racks={racks} unitSystem={unitSystem} />

      {/* Redundancy & Failure Analysis (Tier 2) */}
      <RedundancyPanel redundancy={redundancy} unitSystem={unitSystem} />

      {/* Climate & Seasonal Analysis (Tier 2) */}
      <ClimateAnalysisPanel
        climate={climate}
        unitSystem={unitSystem}
        selectedProfile={climateProfile}
        onSelectProfile={setClimateProfile}
      />

      {/* Cost Estimation (Tier 2) */}
      <CostPanel
        cost={cost}
        unitSystem={unitSystem}
        electricityRate={electricityRate}
        onElectricityRateChange={setElectricityRate}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Power Distribution per Rack</h3>
          <PowerDistributionChart data={power.perRack} unitSystem={unitSystem} />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Coolant Temperature Profile</h3>
          <ThermalProfileChart data={thermal.perRack} unitSystem={unitSystem} />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">PUE Breakdown</h3>
          <PueBreakdownChart pue={pue} />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Flow Rate per Rack</h3>
          <FlowRateChart data={thermal.perRack} unitSystem={unitSystem} />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Cluster Thermal Waterfall</h3>
          <ClusterThermalWaterfallChart clusterThermal={clusterThermal} unitSystem={unitSystem} />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Capacity vs Demand</h3>
          <CapacityVsDemandChart power={power} cdu={cdu} racks={racks} unitSystem={unitSystem} />
        </div>
      </div>
    </div>
  );
}
