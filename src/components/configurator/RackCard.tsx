import { useState } from 'react';
import { Plus, X, Minus, ChevronUp, Thermometer } from 'lucide-react';
import type { RackConfig } from '../../types';
import { platformMap } from '../../data/serverPlatforms';
import { getOemChassis, oemList } from '../../data/oemConfigs';
import { RACK_HEIGHT_U } from '../../data/containerSpecs';
import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { formatPower, formatFlow, formatTemp, formatPressure } from '../../utils/format';
import { coolantMap } from '../../data/coolants';
import { ServerSelector } from './ServerSelector';

interface RackCardProps {
  rack: RackConfig;
}

export function RackCard({ rack }: RackCardProps) {
  const [showSelector, setShowSelector] = useState(false);
  const { setRackSlot, clearRackSlot, setNodeCount, results, coolantId } = useConfigStore();
  const { selectedRackId, setSelectedRack, unitSystem } = useUiStore();
  const isSelected = selectedRackId === rack.id;

  const platform = rack.slot ? platformMap.get(rack.slot.platformId) : null;
  const oem = rack.slot ? getOemChassis(rack.slot.platformId, rack.slot.oemId) : null;
  const oemInfo = rack.slot ? oemList.find(o => o.id === rack.slot!.oemId) : null;

  const totalPower = platform && rack.slot
    ? (platform.powerPerUnit_kW + (oem?.additionalPower_kW ?? 0)) * rack.slot.nodeCount
    : 0;
  const totalFlow = platform && rack.slot
    ? platform.flowPerUnit_Lpm * rack.slot.nodeCount
    : 0;
  const effectiveLiquidFraction = oem?.liquidFractionOverride ?? platform?.liquidFraction ?? 0;
  const uPerNode = oem?.rackUnits ?? platform?.rackUnits ?? 4;
  const maxNodesForOem = platform?.formFactor === 'full-rack' ? 1 : Math.floor(RACK_HEIGHT_U / uPerNode);

  const powerColor = totalPower > 100 ? 'text-red-400' : totalPower > 50 ? 'text-yellow-400' : 'text-green-400';

  if (showSelector) {
    return (
      <ServerSelector
        onSelect={(platformId, oemId) => {
          setRackSlot(rack.id, platformId, oemId);
          setShowSelector(false);
        }}
        onCancel={() => setShowSelector(false)}
      />
    );
  }

  if (!rack.slot || !platform) {
    return (
      <button
        onClick={() => setShowSelector(true)}
        className="bg-slate-800/50 border border-dashed border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:border-cyan-500/50 hover:bg-slate-800 transition-colors min-h-[120px] w-full"
      >
        <Plus className="w-5 h-5 text-slate-500" />
        <span className="text-xs text-slate-500">Rack {rack.position + 1}</span>
      </button>
    );
  }

  return (
    <div
      className={`bg-slate-800 border rounded-lg p-3 transition-colors cursor-pointer ${
        isSelected ? 'border-cyan-500 ring-1 ring-cyan-500/30' : 'border-slate-700 hover:border-slate-600'
      }`}
      onClick={() => setSelectedRack(isSelected ? null : rack.id)}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs text-slate-500">Rack {rack.position + 1}</div>
          <div className="text-sm font-medium text-slate-200 leading-tight">{platform.name}</div>
          <div className="text-xs text-slate-400">{oemInfo?.name} — {oem?.chassisModel}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            clearRackSlot(rack.id);
          }}
          className="text-slate-600 hover:text-red-400 transition-colors p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {platform.formFactor !== 'full-rack' && rack.slot && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-slate-400">Nodes:</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNodeCount(rack.id, Math.max(1, rack.slot!.nodeCount - 1));
            }}
            className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center hover:bg-slate-600"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-mono text-cyan-400 w-6 text-center">{rack.slot.nodeCount}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNodeCount(rack.id, Math.min(maxNodesForOem, rack.slot!.nodeCount + 1));
            }}
            className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center hover:bg-slate-600"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <span className="text-xs text-slate-500">/ {maxNodesForOem}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div className="text-slate-400">Power</div>
        <div className={`font-mono text-right ${powerColor}`}>{formatPower(totalPower, unitSystem)}</div>
        {totalFlow > 0 && (
          <>
            <div className="text-slate-400">Flow</div>
            <div className="font-mono text-right text-blue-400">{formatFlow(totalFlow, unitSystem)}</div>
          </>
        )}
        {totalFlow > 0 && platform.coolingType === 'liquid' && (() => {
          const coolant = coolantMap.get(coolantId);
          if (!coolant || platform.maxDeltaT_C <= 0) return null;
          const liquidHeat_W = totalPower * effectiveLiquidFraction * 1000;
          const massFlow_kgs = liquidHeat_W / (coolant.specificHeat_JkgK * platform.maxDeltaT_C);
          const recFlow_Lpm = (massFlow_kgs / coolant.density_kgL) * 60;
          return (
            <>
              <div className="text-slate-400">Rec. Flow</div>
              <div className="font-mono text-right text-cyan-400">{formatFlow(recFlow_Lpm, unitSystem)}</div>
            </>
          );
        })()}
        <div className="text-slate-400">Cooling</div>
        <div className="font-mono text-right text-slate-300">
          {platform.coolingType === 'liquid' ? `${(effectiveLiquidFraction * 100).toFixed(0)}% liquid` : 'Air'}
        </div>
      </div>

      {results && platform.coolingType === 'liquid' && (() => {
        const thermalRack = results.thermal.perRack.find(r => r.rackId === rack.id);
        const hydraulicRack = results.hydraulic.perRackBranch.find(r => r.rackId === rack.id);
        if (!thermalRack) return null;

        const deltaTRatio = thermalRack.deltaT_C / platform.maxDeltaT_C;
        const outletColor = deltaTRatio > 1 ? 'text-red-400'
          : deltaTRatio >= 0.8 ? 'text-yellow-400'
          : 'text-green-400';

        return (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-1 mb-1">
              <Thermometer className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Thermal / Hydraulic</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="text-slate-400">Outlet</div>
              <div className={`font-mono text-right ${outletColor}`}>
                {formatTemp(thermalRack.outletTemp_C, unitSystem)}
              </div>
              <div className="text-slate-400">ΔT</div>
              <div className={`font-mono text-right ${deltaTRatio > 1 ? 'text-red-400' : 'text-slate-300'}`}>
                {formatTemp(thermalRack.deltaT_C, unitSystem)} / {formatTemp(platform.maxDeltaT_C, unitSystem)}
              </div>
              {hydraulicRack && (
                <>
                  <div className="text-slate-400">Branch ΔP</div>
                  <div className="font-mono text-right text-slate-300">
                    {formatPressure(hydraulicRack.total_bar, unitSystem)}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
