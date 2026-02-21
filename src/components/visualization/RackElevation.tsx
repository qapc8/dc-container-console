import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { platformMap } from '../../data/serverPlatforms';
import { getOemChassis } from '../../data/oemConfigs';
import { formatPower, formatFlow, formatWeight } from '../../utils/format';

const TOTAL_U = 42;
const U_HEIGHT = 10; // px per U
const RACK_W = 200;
const PADDING = 30;

export function RackElevation() {
  const racks = useConfigStore(s => s.racks);
  const { selectedRackId, unitSystem } = useUiStore();

  const rack = racks.find(r => r.id === selectedRackId);
  if (!rack?.slot) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center text-slate-500 text-sm">
        Select a rack to view elevation
      </div>
    );
  }

  const platform = platformMap.get(rack.slot.platformId)!;
  const oem = getOemChassis(rack.slot.platformId, rack.slot.oemId);
  const nodeCount = rack.slot.nodeCount;
  const usedU = platform.rackUnits * nodeCount;
  const freeU = TOTAL_U - usedU;

  const svgH = TOTAL_U * U_HEIGHT + PADDING * 2;
  const svgW = RACK_W + PADDING * 2 + 80;

  const nodePower = platform.powerPerUnit_kW + (oem?.additionalPower_kW ?? 0);
  const totalPower = nodePower * nodeCount;
  const totalFlow = platform.flowPerUnit_Lpm * nodeCount;
  const totalWeight = (platform.weightPerUnit_kg + (oem?.weightOverhead_kg ?? 0)) * nodeCount;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Rack {rack.position + 1} Elevation</h3>
      <div className="flex gap-6 items-start">
        <svg width={svgW} height={svgH}>
          {/* Rack frame */}
          <rect x={PADDING} y={PADDING} width={RACK_W} height={TOTAL_U * U_HEIGHT} fill="#0f172a" stroke="#475569" strokeWidth={1} />

          {/* Nodes */}
          {Array.from({ length: nodeCount }).map((_, i) => {
            const y = PADDING + i * platform.rackUnits * U_HEIGHT;
            const h = platform.rackUnits * U_HEIGHT;
            return (
              <g key={i}>
                <rect
                  x={PADDING + 2}
                  y={y + 1}
                  width={RACK_W - 4}
                  height={h - 2}
                  fill={platform.coolingType === 'liquid' ? '#0e4d6e' : '#3d3d00'}
                  stroke={platform.coolingType === 'liquid' ? '#06b6d4' : '#eab308'}
                  strokeWidth={0.5}
                  rx={2}
                />
                <text x={PADDING + RACK_W / 2} y={y + h / 2 + 3} fill="#e2e8f0" fontSize={8} textAnchor="middle">
                  {platform.name.split('(')[0].trim()} #{i + 1}
                </text>
              </g>
            );
          })}

          {/* Free space */}
          {freeU > 0 && (
            <rect
              x={PADDING + 2}
              y={PADDING + usedU * U_HEIGHT + 1}
              width={RACK_W - 4}
              height={freeU * U_HEIGHT - 2}
              fill="none"
              stroke="#334155"
              strokeWidth={0.5}
              strokeDasharray="4 2"
              rx={2}
            />
          )}

          {/* U markers */}
          {[0, 10, 20, 30, 42].map(u => (
            <text key={u} x={PADDING - 4} y={PADDING + u * U_HEIGHT + 4} fill="#64748b" fontSize={8} textAnchor="end">
              {u}U
            </text>
          ))}
        </svg>

        {/* Rack summary */}
        <div className="text-xs space-y-2 min-w-[140px]">
          <div>
            <span className="text-slate-400">Platform:</span>
            <div className="text-slate-200 font-medium">{platform.name}</div>
          </div>
          <div>
            <span className="text-slate-400">OEM:</span>
            <div className="text-slate-200">{oem?.oemName} {oem?.chassisModel}</div>
          </div>
          <div>
            <span className="text-slate-400">Nodes:</span>
            <span className="text-cyan-400 ml-1">{nodeCount}</span>
          </div>
          <div>
            <span className="text-slate-400">Used:</span>
            <span className="text-slate-200 ml-1">{usedU}U / {TOTAL_U}U</span>
          </div>
          <div>
            <span className="text-slate-400">Total Power:</span>
            <div className="text-green-400 font-mono">{formatPower(totalPower, unitSystem)}</div>
          </div>
          {totalFlow > 0 && (
            <div>
              <span className="text-slate-400">Flow Rate:</span>
              <div className="text-blue-400 font-mono">{formatFlow(totalFlow, unitSystem)}</div>
            </div>
          )}
          <div>
            <span className="text-slate-400">Weight:</span>
            <div className="text-slate-200 font-mono">{formatWeight(totalWeight, unitSystem)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
