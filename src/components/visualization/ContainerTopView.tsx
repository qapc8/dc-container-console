import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { container40ft, RACK_WIDTH_M, RACK_DEPTH_M, RACK_GAP_M, CLEARANCE_M } from '../../data/containerSpecs';
import { platformMap } from '../../data/serverPlatforms';

// Scale: 1m = 80px
const SCALE = 80;
const PADDING = 20;

function powerToColor(kW: number): string {
  if (kW <= 0) return '#334155';
  if (kW < 20) return '#22d3ee';
  if (kW < 50) return '#10b981';
  if (kW < 100) return '#f59e0b';
  if (kW < 130) return '#f97316';
  return '#ef4444';
}

export function ContainerTopView() {
  const racks = useConfigStore(s => s.racks);
  const results = useConfigStore(s => s.results);
  const { selectedRackId, setSelectedRack } = useUiStore();

  const L = container40ft.internalLength_m;
  const W = container40ft.internalWidth_m;
  const svgW = L * SCALE + PADDING * 2;
  const svgH = W * SCALE + PADDING * 2;

  const cduWidth = results?.cdu.widthUsed_m ?? 0;
  const powerPerRack = results?.power.perRack ?? [];

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="bg-slate-900 rounded-lg border border-slate-700"
      >
        {/* Container outline */}
        <rect
          x={PADDING}
          y={PADDING}
          width={L * SCALE}
          height={W * SCALE}
          fill="none"
          stroke="#475569"
          strokeWidth={2}
          strokeDasharray="8 4"
        />

        {/* Container label */}
        <text x={PADDING + 4} y={PADDING - 5} fill="#64748b" fontSize={10}>
          40ft ISO Container — {L.toFixed(2)}m × {W.toFixed(2)}m (internal)
        </text>

        {/* CDU zone (at far end) */}
        {cduWidth > 0 && (
          <>
            <rect
              x={PADDING + (L - cduWidth) * SCALE}
              y={PADDING}
              width={cduWidth * SCALE}
              height={W * SCALE}
              fill="#1e3a5f"
              fillOpacity={0.5}
              stroke="#3b82f6"
              strokeWidth={1}
            />
            <text
              x={PADDING + (L - cduWidth / 2) * SCALE}
              y={PADDING + W * SCALE / 2}
              fill="#60a5fa"
              fontSize={10}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              CDU Zone
            </text>
          </>
        )}

        {/* Racks */}
        {racks.map((rack, i) => {
          const x = PADDING + (CLEARANCE_M + i * (RACK_WIDTH_M + RACK_GAP_M)) * SCALE;
          const y = PADDING + (W - RACK_DEPTH_M) / 2 * SCALE;
          const w = RACK_WIDTH_M * SCALE;
          const h = RACK_DEPTH_M * SCALE;
          const rackPower = powerPerRack.find(p => p.rackId === rack.id);
          const kW = rackPower?.it_kW ?? 0;
          const isSelected = selectedRackId === rack.id;
          const isEmpty = !rack.slot;
          const platform = rack.slot ? platformMap.get(rack.slot.platformId) : null;

          return (
            <g key={rack.id} onClick={() => setSelectedRack(isSelected ? null : rack.id)} className="cursor-pointer">
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={isEmpty ? '#1e293b' : powerToColor(kW)}
                fillOpacity={isEmpty ? 0.3 : 0.6}
                stroke={isSelected ? '#06b6d4' : isEmpty ? '#334155' : '#475569'}
                strokeWidth={isSelected ? 2 : 1}
                rx={3}
              />
              <text x={x + w / 2} y={y + h / 2 - 6} fill="#e2e8f0" fontSize={9} textAnchor="middle">
                R{i + 1}
              </text>
              {!isEmpty && (
                <>
                  <text x={x + w / 2} y={y + h / 2 + 6} fill="#94a3b8" fontSize={8} textAnchor="middle">
                    {kW.toFixed(0)} kW
                  </text>
                  <text x={x + w / 2} y={y + h / 2 + 16} fill="#64748b" fontSize={7} textAnchor="middle">
                    {platform?.id.split('-')[0].toUpperCase()}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Aisle indicators */}
        <line
          x1={PADDING}
          y1={PADDING + ((W - RACK_DEPTH_M) / 2) * SCALE - 2}
          x2={PADDING + L * SCALE}
          y2={PADDING + ((W - RACK_DEPTH_M) / 2) * SCALE - 2}
          stroke="#475569"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        <line
          x1={PADDING}
          y1={PADDING + ((W - RACK_DEPTH_M) / 2 + RACK_DEPTH_M) * SCALE + 2}
          x2={PADDING + L * SCALE}
          y2={PADDING + ((W - RACK_DEPTH_M) / 2 + RACK_DEPTH_M) * SCALE + 2}
          stroke="#475569"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />

        {/* Scale bar */}
        <line x1={PADDING} y1={svgH - 8} x2={PADDING + 1 * SCALE} y2={svgH - 8} stroke="#64748b" strokeWidth={1} />
        <text x={PADDING + SCALE / 2} y={svgH - 2} fill="#64748b" fontSize={9} textAnchor="middle">1m</text>

        {/* Heat map legend */}
        <g transform={`translate(${svgW - 180}, ${svgH - 18})`}>
          {[
            { color: '#22d3ee', label: '<20kW' },
            { color: '#10b981', label: '<50kW' },
            { color: '#f59e0b', label: '<100kW' },
            { color: '#ef4444', label: '>130kW' },
          ].map((item, i) => (
            <g key={i} transform={`translate(${i * 42}, 0)`}>
              <rect width={10} height={10} fill={item.color} fillOpacity={0.6} rx={2} />
              <text x={13} y={9} fill="#94a3b8" fontSize={7}>{item.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
