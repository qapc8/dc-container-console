import { ContainerTopView } from './ContainerTopView';
import { RackElevation } from './RackElevation';
import { CoolingSchematic } from './CoolingSchematic';
import { InfrastructureDiagram } from './InfrastructureDiagram';
import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { formatLength, formatWeight } from '../../utils/format';
import { container40ft } from '../../data/containerSpecs';

export function ContainerLayout() {
  const results = useConfigStore(s => s.results);
  const unitSystem = useUiStore(s => s.unitSystem);

  return (
    <div className="space-y-6">
      {/* Container specs bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-wrap gap-4 text-xs">
        <div>
          <span className="text-slate-400">Container:</span>
          <span className="text-slate-200 ml-1">{container40ft.name}</span>
        </div>
        <div>
          <span className="text-slate-400">Internal:</span>
          <span className="text-slate-200 ml-1">
            {formatLength(container40ft.internalLength_m, unitSystem)} × {formatLength(container40ft.internalWidth_m, unitSystem)} × {formatLength(container40ft.internalHeight_m, unitSystem)}
          </span>
        </div>
        <div>
          <span className="text-slate-400">Max Payload:</span>
          <span className="text-slate-200 ml-1">{formatWeight(container40ft.maxPayload_kg, unitSystem)}</span>
        </div>
        {results && (
          <>
            <div>
              <span className="text-slate-400">Current Weight:</span>
              <span className={`ml-1 ${results.container.overweight ? 'text-red-400' : 'text-green-400'}`}>
                {formatWeight(results.container.totalWeight_kg, unitSystem)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Racks:</span>
              <span className="text-slate-200 ml-1">{results.container.usedRacks} / {results.container.maxRacks}</span>
            </div>
            <div>
              <span className="text-slate-400">Aisle:</span>
              <span className="text-slate-200 ml-1">{formatLength(results.container.aisleWidth_m, unitSystem)}</span>
            </div>
          </>
        )}
      </div>

      {/* Top-down view */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Top-Down Container View (to scale)</h3>
        <ContainerTopView />
      </div>

      {/* Infrastructure Diagram — full power & cooling flow */}
      <InfrastructureDiagram />

      {/* Side-by-side: elevation + schematic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RackElevation />
        <CoolingSchematic />
      </div>
    </div>
  );
}
