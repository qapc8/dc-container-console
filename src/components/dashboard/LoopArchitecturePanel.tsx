import { GitBranch, Droplets, ArrowRight } from 'lucide-react';
import type { LoopArchitecture, UnitSystem } from '../../types';
import { formatFlow, formatPower, formatTemp, formatVolume } from '../../utils/format';

interface Props {
  loopArch: LoopArchitecture;
  unitSystem: UnitSystem;
}

export function LoopArchitecturePanel({ loopArch, unitSystem }: Props) {
  if (loopArch.primaryLoop.totalFlow_Lpm <= 0) return null;

  const isPrimSec = loopArch.topology === 'primary-secondary';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">Loop Architecture</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${
          isPrimSec ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
        }`}>
          {isPrimSec ? 'Primary/Secondary' : 'Single Loop'}
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4">{loopArch.reason}</p>

      {/* Primary Loop Schematic */}
      <div className="bg-slate-700/30 rounded-lg p-3 mb-4">
        <h4 className="text-xs font-semibold text-slate-300 mb-2">Primary Loop</h4>
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-blue-500/20 text-blue-400 rounded px-2 py-1 text-center">
            <div className="font-mono font-medium">{formatTemp(loopArch.primaryLoop.supplyTemp_C, unitSystem)}</div>
            <div className="text-[10px] text-blue-400/70">Supply</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500" />
          <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-blue-500 to-red-500 opacity-50" />
          <ArrowRight className="w-4 h-4 text-slate-500" />
          <div className="bg-red-500/20 text-red-400 rounded px-2 py-1 text-center">
            <div className="font-mono font-medium">{formatTemp(loopArch.primaryLoop.returnTemp_C, unitSystem)}</div>
            <div className="text-[10px] text-red-400/70">Return</div>
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
          <span>Flow: <span className="font-mono text-slate-300">{formatFlow(loopArch.primaryLoop.totalFlow_Lpm, unitSystem)}</span></span>
          <span>Pipe: <span className="font-mono text-slate-300">{loopArch.primaryLoop.pipeDiameter_mm}</span></span>
        </div>
      </div>

      {/* Secondary Loops */}
      {isPrimSec && loopArch.secondaryLoops.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Secondary Loops</h4>
          {loopArch.secondaryLoops.map(loop => (
            <div key={loop.id} className="bg-slate-700/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-200">{loop.name}</span>
                {loop.mixingValveRequired && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                    Mixing valve required
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-400">
                <div>
                  Inlet range: <span className="font-mono text-slate-300">{loop.inletTempRange_C[0]}–{loop.inletTempRange_C[1]}°C</span>
                </div>
                <div>
                  Flow: <span className="font-mono text-slate-300">{formatFlow(loop.totalFlow_Lpm, unitSystem)}</span>
                </div>
                <div>
                  Heat: <span className="font-mono text-slate-300">{formatPower(loop.totalHeat_kW, unitSystem)}</span>
                </div>
                <div>
                  Pipe: <span className="font-mono text-slate-300">{loop.pipeDiameter_mm}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Racks: {loop.rackIds.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buffer Tank & Bypass */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Buffer tank:</span>
          <span className="font-mono text-slate-200">{formatVolume(loopArch.bufferTank_L, unitSystem)}</span>
          <span className="text-[10px] text-slate-500">(30s failover)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Bypass flow:</span>
          <span className="font-mono text-slate-200">{formatFlow(loopArch.bypassFlow_Lpm, unitSystem)}</span>
          <span className="text-[10px] text-slate-500">(25% min flow protection)</span>
        </div>
      </div>
    </div>
  );
}
