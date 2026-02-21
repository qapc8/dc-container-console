import { useConfigStore } from '../../store/configStore';
import { useUiStore } from '../../store/uiStore';
import { formatPower, formatFlow, formatTemp } from '../../utils/format';

export function InfrastructureDiagram() {
  const results = useConfigStore(s => s.results);
  const racks = useConfigStore(s => s.racks);
  const unitSystem = useUiStore(s => s.unitSystem);

  if (!results || results.power.totalIT_kW <= 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center text-slate-500 text-sm">
        Configure racks to view infrastructure diagram
      </div>
    );
  }

  const { power, thermal, cdu, heatRejection, hydraulic, pue } = results;
  const inletTemp = thermal.perRack.find(r => r.flow_Lpm > 0)?.inletTemp_C ?? 0;
  const liquidRackCount = racks.filter(r => r.slot).length;
  const methodLabel = heatRejection.method === 'dry-cooler' ? 'Dry Cooler'
    : heatRejection.method === 'chiller' ? 'Chiller' : 'Hybrid';

  const W = 900;
  const H = 520;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Datacenter Infrastructure Diagram</h3>
      <div className="overflow-x-auto">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mx-auto">
          <defs>
            {/* Arrow markers */}
            {[
              { id: 'arr-red', color: '#ef4444' },
              { id: 'arr-blue', color: '#3b82f6' },
              { id: 'arr-cyan', color: '#06b6d4' },
              { id: 'arr-orange', color: '#f59e0b' },
              { id: 'arr-green', color: '#22c55e' },
              { id: 'arr-yellow', color: '#eab308' },
              { id: 'arr-purple', color: '#a855f7' },
            ].map(({ id, color }) => (
              <marker key={id} id={id} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={color} />
              </marker>
            ))}

            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ===== TITLE SECTION ===== */}
          <text x={W / 2} y={20} fill="#94a3b8" fontSize={10} textAnchor="middle" fontStyle="italic">
            Power Flow (yellow) &amp; Cooling Flow (blue/red)
          </text>

          {/* ===== POWER SECTION (Top) ===== */}

          {/* Utility / Grid */}
          <rect x={20} y={40} width={100} height={60} rx={6} fill="#1c1917" fillOpacity={0.5} stroke="#eab308" strokeWidth={1.5} />
          <text x={70} y={60} fill="#eab308" fontSize={10} textAnchor="middle" fontWeight="bold">Utility Grid</text>
          <text x={70} y={78} fill="#94a3b8" fontSize={8} textAnchor="middle">
            {formatPower(pue.totalFacilityPower_kW, unitSystem)}
          </text>

          {/* UPS */}
          <rect x={180} y={40} width={120} height={60} rx={6} fill="#1e1b4b" fillOpacity={0.4} stroke="#a855f7" strokeWidth={1.5} />
          <text x={240} y={58} fill="#a855f7" fontSize={10} textAnchor="middle" fontWeight="bold">UPS System</text>
          <text x={240} y={72} fill="#94a3b8" fontSize={8} textAnchor="middle">
            {formatPower(pue.totalFacilityPower_kW, unitSystem)}
          </text>
          <text x={240} y={84} fill="#64748b" fontSize={7} textAnchor="middle">Battery Backup</text>

          {/* PDU */}
          <rect x={360} y={40} width={100} height={60} rx={6} fill="#1e1b4b" fillOpacity={0.3} stroke="#8b5cf6" strokeWidth={1.5} />
          <text x={410} y={58} fill="#8b5cf6" fontSize={10} textAnchor="middle" fontWeight="bold">PDU</text>
          <text x={410} y={72} fill="#94a3b8" fontSize={8} textAnchor="middle">Power Distribution</text>
          <text x={410} y={84} fill="#64748b" fontSize={7} textAnchor="middle">
            Loss: {formatPower(pue.distributionLoss_kW, unitSystem)}
          </text>

          {/* Power flow arrows: Grid → UPS → PDU */}
          <line x1={120} y1={70} x2={180} y2={70} stroke="#eab308" strokeWidth={2} strokeDasharray="6,3" markerEnd="url(#arr-yellow)" />
          <line x1={300} y1={70} x2={360} y2={70} stroke="#eab308" strokeWidth={2} strokeDasharray="6,3" markerEnd="url(#arr-yellow)" />

          {/* ===== POWER DISTRIBUTION SPLIT ===== */}
          {/* PDU → IT Equipment */}
          <line x1={410} y1={100} x2={410} y2={130} stroke="#eab308" strokeWidth={1.5} strokeDasharray="6,3" />
          <line x1={410} y1={130} x2={170} y2={130} stroke="#eab308" strokeWidth={1.5} strokeDasharray="6,3" />
          <line x1={170} y1={130} x2={170} y2={160} stroke="#eab308" strokeWidth={1.5} strokeDasharray="6,3" markerEnd="url(#arr-yellow)" />

          {/* PDU → Cooling Equipment */}
          <line x1={410} y1={130} x2={620} y2={130} stroke="#eab308" strokeWidth={1} strokeDasharray="4,4" />
          <line x1={620} y1={130} x2={620} y2={160} stroke="#eab308" strokeWidth={1} strokeDasharray="4,4" markerEnd="url(#arr-yellow)" />

          {/* Power split labels */}
          <text x={280} y={126} fill="#eab308" fontSize={7} textAnchor="middle">
            IT: {formatPower(power.totalIT_kW, unitSystem)}
          </text>
          <text x={530} y={126} fill="#eab308" fontSize={7} textAnchor="middle">
            Cooling: {formatPower(pue.coolingPower_kW, unitSystem)}
          </text>

          {/* ===== IT EQUIPMENT ROW ===== */}

          {/* Server Racks */}
          <rect x={60} y={160} width={220} height={110} rx={8} fill="#0e4d6e" fillOpacity={0.2} stroke="#06b6d4" strokeWidth={1.5} />
          <text x={170} y={182} fill="#06b6d4" fontSize={11} textAnchor="middle" fontWeight="bold">Server Racks</text>

          {/* Mini rack icons */}
          {Array.from({ length: Math.min(liquidRackCount, 12) }, (_, i) => {
            const col = i % 6;
            const row = Math.floor(i / 6);
            const rx = 80 + col * 32;
            const ry = 194 + row * 30;
            return (
              <g key={i}>
                <rect x={rx} y={ry} width={22} height={22} rx={2} fill="#164e63" stroke="#06b6d4" strokeWidth={0.5} />
                <text x={rx + 11} y={ry + 14} fill="#67e8f9" fontSize={6} textAnchor="middle">R{i + 1}</text>
              </g>
            );
          })}

          <text x={170} y={256} fill="#94a3b8" fontSize={8} textAnchor="middle">
            {liquidRackCount} racks | {formatPower(power.totalIT_kW, unitSystem)} IT
          </text>

          {/* ===== CDU SECTION ===== */}
          <rect x={350} y={160} width={160} height={110} rx={8} fill="#1e3a5f" fillOpacity={0.3} stroke="#3b82f6" strokeWidth={1.5} />
          <text x={430} y={182} fill="#3b82f6" fontSize={11} textAnchor="middle" fontWeight="bold">CDU Array</text>

          {/* CDU unit icons */}
          {Array.from({ length: Math.min(cdu.totalCount, 6) }, (_, i) => {
            const cx = 370 + i * 24;
            const isRedundant = i >= cdu.activeCount;
            return (
              <g key={i}>
                <rect x={cx} y={196} width={18} height={30} rx={3}
                  fill={isRedundant ? '#1e293b' : '#1e3a5f'}
                  stroke={isRedundant ? '#475569' : '#3b82f6'}
                  strokeWidth={0.8}
                  strokeDasharray={isRedundant ? '2,2' : 'none'} />
                <text x={cx + 9} y={215} fill={isRedundant ? '#64748b' : '#60a5fa'} fontSize={6} textAnchor="middle">
                  {isRedundant ? 'R' : 'A'}
                </text>
              </g>
            );
          })}

          <text x={430} y={244} fill="#94a3b8" fontSize={8} textAnchor="middle">
            {cdu.activeCount}+{cdu.redundantCount} x {cdu.selectedSize_kW}kW
          </text>
          <text x={430} y={256} fill="#64748b" fontSize={7} textAnchor="middle">
            Pump: {formatPower(hydraulic.pumpPower_kW, unitSystem)} | {hydraulic.headerDn}
          </text>

          {/* ===== HEAT REJECTION ===== */}
          <rect x={580} y={160} width={160} height={110} rx={8}
            fill={heatRejection.method === 'chiller' ? '#3d1f00' : '#1a2e1a'} fillOpacity={0.3}
            stroke={heatRejection.method === 'chiller' ? '#f59e0b' : '#22c55e'} strokeWidth={1.5} />
          <text x={660} y={182}
            fill={heatRejection.method === 'chiller' ? '#f59e0b' : '#22c55e'}
            fontSize={11} textAnchor="middle" fontWeight="bold">
            {methodLabel}
          </text>

          {/* Equipment details */}
          <text x={660} y={200} fill="#94a3b8" fontSize={8} textAnchor="middle">
            {formatPower(heatRejection.capacity_kW, unitSystem)} capacity
          </text>
          {heatRejection.dryCoolerSpec && (
            <text x={660} y={214} fill="#94a3b8" fontSize={8} textAnchor="middle">
              {heatRejection.dryCoolerSpec.fanCount} fans | Approach: {heatRejection.dryCoolerSpec.approachTemp_C}°C
            </text>
          )}
          {heatRejection.chillerSpec && (
            <>
              <text x={660} y={214} fill="#94a3b8" fontSize={8} textAnchor="middle">
                COP: {heatRejection.chillerSpec.cop.toFixed(1)} | {heatRejection.chillerSpec.refrigerant}
              </text>
              <text x={660} y={228} fill="#94a3b8" fontSize={8} textAnchor="middle">
                Compressor: {formatPower(heatRejection.chillerSpec.compressorPower_kW, unitSystem)}
              </text>
            </>
          )}
          <text x={660} y={256} fill="#64748b" fontSize={7} textAnchor="middle">
            Fan: {formatPower(heatRejection.fanPower_kW, unitSystem)}
          </text>

          {/* ===== COOLING FLOW ARROWS ===== */}

          {/* Racks → CDU (hot coolant) */}
          <path d="M 280 195 L 350 195" stroke="#ef4444" strokeWidth={2.5} fill="none" markerEnd="url(#arr-red)" />
          <text x={315} y={190} fill="#ef4444" fontSize={8} textAnchor="middle" fontWeight="bold">HOT</text>
          <text x={315} y={210} fill="#94a3b8" fontSize={7} textAnchor="middle">
            {formatTemp(thermal.maxOutletTemp_C, unitSystem)}
          </text>

          {/* CDU → Racks (cold coolant) */}
          <path d="M 350 230 L 280 230" stroke="#06b6d4" strokeWidth={2.5} fill="none" markerEnd="url(#arr-cyan)" />
          <text x={315} y={226} fill="#06b6d4" fontSize={8} textAnchor="middle" fontWeight="bold">COLD</text>
          <text x={315} y={244} fill="#94a3b8" fontSize={7} textAnchor="middle">
            {formatTemp(inletTemp, unitSystem)} | {formatFlow(thermal.totalFlow_Lpm, unitSystem)}
          </text>

          {/* CDU → Heat Rejection (secondary hot) */}
          <path d="M 510 195 L 580 195" stroke="#f59e0b" strokeWidth={2} fill="none" markerEnd="url(#arr-orange)" />
          <text x={545} y={190} fill="#f59e0b" fontSize={7} textAnchor="middle">REJECT</text>
          <text x={545} y={206} fill="#94a3b8" fontSize={7} textAnchor="middle">
            {formatPower(power.totalLiquidHeat_kW, unitSystem)}
          </text>

          {/* Heat Rejection → CDU (secondary cold) */}
          <path d="M 580 230 L 510 230" stroke="#22c55e" strokeWidth={2} fill="none" markerEnd="url(#arr-green)" />
          <text x={545} y={226} fill="#22c55e" fontSize={7} textAnchor="middle">COOLED</text>

          {/* Heat rejection to ambient */}
          <path d="M 740 210 L 770 210" stroke="#64748b" strokeWidth={1.5} fill="none" markerEnd="url(#arr-green)" />
          <text x={790} y={214} fill="#64748b" fontSize={8} textAnchor="start">Ambient</text>

          {/* ===== SUMMARY BAR ===== */}
          <rect x={20} y={300} width={W - 40} height={1} fill="#334155" />

          {/* PUE Section */}
          <rect x={20} y={320} width={W - 40} height={80} rx={8} fill="#0f172a" fillOpacity={0.5} stroke="#334155" />
          <text x={40} y={342} fill="#94a3b8" fontSize={10} fontWeight="bold">System Summary</text>

          {/* Summary metrics */}
          {[
            { label: 'PUE', value: pue.pue.toFixed(3), x: 50 },
            { label: 'IT Power', value: formatPower(power.totalIT_kW, unitSystem), x: 150 },
            { label: 'Wall Power', value: formatPower(pue.totalFacilityPower_kW, unitSystem), x: 290 },
            { label: 'Cooling Power', value: formatPower(pue.coolingPower_kW, unitSystem), x: 440 },
            { label: 'Total Flow', value: formatFlow(thermal.totalFlow_Lpm, unitSystem), x: 590 },
            { label: 'System ΔP', value: `${hydraulic.totalSystemDp_bar.toFixed(2)} bar`, x: 730 },
          ].map(({ label, value, x }) => (
            <g key={label}>
              <text x={x} y={365} fill="#64748b" fontSize={8}>{label}</text>
              <text x={x} y={382} fill="#e2e8f0" fontSize={11} fontWeight="bold">{value}</text>
            </g>
          ))}

          {/* ===== LEGEND ===== */}
          <rect x={20} y={420} width={W - 40} height={80} rx={8} fill="#0f172a" fillOpacity={0.3} stroke="#1e293b" />
          <text x={40} y={440} fill="#64748b" fontSize={9} fontWeight="bold">LEGEND</text>

          {/* Power flow legend */}
          <line x1={40} y1={458} x2={70} y2={458} stroke="#eab308" strokeWidth={2} strokeDasharray="6,3" />
          <text x={78} y={462} fill="#94a3b8" fontSize={8}>Electrical Power</text>

          {/* Hot coolant */}
          <line x1={200} y1={458} x2={230} y2={458} stroke="#ef4444" strokeWidth={2.5} />
          <text x={238} y={462} fill="#94a3b8" fontSize={8}>Hot Coolant (Primary)</text>

          {/* Cold coolant */}
          <line x1={400} y1={458} x2={430} y2={458} stroke="#06b6d4" strokeWidth={2.5} />
          <text x={438} y={462} fill="#94a3b8" fontSize={8}>Cold Coolant (Primary)</text>

          {/* Secondary */}
          <line x1={600} y1={458} x2={630} y2={458} stroke="#f59e0b" strokeWidth={2} />
          <text x={638} y={462} fill="#94a3b8" fontSize={8}>Secondary Loop</text>

          {/* Equipment key */}
          <rect x={40} y={472} width={12} height={12} rx={2} fill="#164e63" stroke="#06b6d4" strokeWidth={0.5} />
          <text x={58} y={482} fill="#94a3b8" fontSize={8}>Server Rack</text>

          <rect x={150} y={472} width={12} height={12} rx={2} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={0.5} />
          <text x={168} y={482} fill="#94a3b8" fontSize={8}>CDU (Active)</text>

          <rect x={270} y={472} width={12} height={12} rx={2} fill="#1e293b" stroke="#475569" strokeWidth={0.5} strokeDasharray="2,2" />
          <text x={288} y={482} fill="#94a3b8" fontSize={8}>CDU (Standby)</text>

          <rect x={410} y={472} width={12} height={12} rx={2}
            fill={heatRejection.method === 'chiller' ? '#3d1f00' : '#1a2e1a'}
            stroke={heatRejection.method === 'chiller' ? '#f59e0b' : '#22c55e'} strokeWidth={0.5} />
          <text x={428} y={482} fill="#94a3b8" fontSize={8}>{methodLabel}</text>

          <rect x={540} y={472} width={12} height={12} rx={2} fill="#1e1b4b" stroke="#a855f7" strokeWidth={0.5} />
          <text x={558} y={482} fill="#94a3b8" fontSize={8}>UPS / PDU</text>
        </svg>
      </div>
    </div>
  );
}
