import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { formatFlow, formatTemp, formatPower } from '../../utils/format';

export function CoolingSchematic() {
  const results = useConfigStore(s => s.results);
  const unitSystem = useUiStore(s => s.unitSystem);

  if (!results || results.power.totalIT_kW <= 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center text-slate-500 text-sm">
        Configure racks to view cooling schematic
      </div>
    );
  }

  const { thermal, cdu, heatRejection } = results;
  const inletTemp = thermal.perRack.find(r => r.flow_Lpm > 0)?.inletTemp_C ?? 0;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Cooling Loop Schematic</h3>
      <svg width={600} height={280} viewBox="0 0 600 280">
        {/* Server Racks box */}
        <rect x={30} y={60} width={140} height={120} rx={8} fill="#0e4d6e" fillOpacity={0.3} stroke="#06b6d4" />
        <text x={100} y={90} fill="#06b6d4" fontSize={11} textAnchor="middle" fontWeight="bold">Server Racks</text>
        <text x={100} y={110} fill="#94a3b8" fontSize={9} textAnchor="middle">
          {formatPower(results.power.totalLiquidHeat_kW, unitSystem)}
        </text>
        <text x={100} y={125} fill="#94a3b8" fontSize={9} textAnchor="middle">
          {formatFlow(thermal.totalFlow_Lpm, unitSystem)}
        </text>

        {/* CDU box */}
        <rect x={240} y={60} width={120} height={120} rx={8} fill="#1e3a5f" fillOpacity={0.3} stroke="#3b82f6" />
        <text x={300} y={90} fill="#3b82f6" fontSize={11} textAnchor="middle" fontWeight="bold">CDU</text>
        <text x={300} y={110} fill="#94a3b8" fontSize={9} textAnchor="middle">
          {cdu.totalCount}× {cdu.selectedSize_kW}kW
        </text>
        <text x={300} y={125} fill="#94a3b8" fontSize={9} textAnchor="middle">
          Pump: {formatPower(cdu.totalPumpPower_kW, unitSystem)}
        </text>

        {/* Heat Rejection box */}
        <rect x={430} y={60} width={140} height={120} rx={8} fill="#3d1f00" fillOpacity={0.3} stroke="#f59e0b" />
        <text x={500} y={90} fill="#f59e0b" fontSize={11} textAnchor="middle" fontWeight="bold">
          {heatRejection.method === 'dry-cooler' ? 'Dry Cooler' : heatRejection.method === 'chiller' ? 'Chiller' : 'Hybrid'}
        </text>
        <text x={500} y={110} fill="#94a3b8" fontSize={9} textAnchor="middle">
          {formatPower(heatRejection.capacity_kW, unitSystem)}
        </text>
        <text x={500} y={125} fill="#94a3b8" fontSize={9} textAnchor="middle">
          Fan: {formatPower(heatRejection.fanPower_kW, unitSystem)}
        </text>

        {/* Arrows: Racks → CDU (hot supply) */}
        <line x1={170} y1={100} x2={240} y2={100} stroke="#ef4444" strokeWidth={2} markerEnd="url(#arrowRed)" />
        <text x={205} y={95} fill="#ef4444" fontSize={8} textAnchor="middle">HOT</text>
        <text x={205} y={115} fill="#94a3b8" fontSize={8} textAnchor="middle">
          {formatTemp(thermal.maxOutletTemp_C, unitSystem)}
        </text>

        {/* CDU → Racks (cold return) */}
        <line x1={240} y1={150} x2={170} y2={150} stroke="#06b6d4" strokeWidth={2} markerEnd="url(#arrowBlue)" />
        <text x={205} y={145} fill="#06b6d4" fontSize={8} textAnchor="middle">COLD</text>
        <text x={205} y={165} fill="#94a3b8" fontSize={8} textAnchor="middle">
          {formatTemp(inletTemp, unitSystem)}
        </text>

        {/* CDU → Heat Rejection */}
        <line x1={360} y1={100} x2={430} y2={100} stroke="#f59e0b" strokeWidth={2} markerEnd="url(#arrowOrange)" />
        <text x={395} y={95} fill="#f59e0b" fontSize={8} textAnchor="middle">REJECT</text>

        {/* Heat Rejection → CDU (return) */}
        <line x1={430} y1={150} x2={360} y2={150} stroke="#10b981" strokeWidth={2} markerEnd="url(#arrowGreen)" />
        <text x={395} y={145} fill="#10b981" fontSize={8} textAnchor="middle">COOLED</text>

        {/* Ambient label */}
        <text x={500} y={200} fill="#64748b" fontSize={9} textAnchor="middle">→ Ambient</text>

        {/* Arrow markers */}
        <defs>
          {[
            { id: 'arrowRed', color: '#ef4444' },
            { id: 'arrowBlue', color: '#06b6d4' },
            { id: 'arrowOrange', color: '#f59e0b' },
            { id: 'arrowGreen', color: '#10b981' },
          ].map(({ id, color }) => (
            <marker key={id} id={id} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={color} />
            </marker>
          ))}
        </defs>
      </svg>
    </div>
  );
}
