import { useState, useCallback, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PodScene } from './PodScene';
import type { PodSceneData, ViewOptions, CameraPreset } from './PodScene';
import { useConfigStore } from '../../store/configStore';
import { platformMap } from '../../data/serverPlatforms';
import {
  Moon, Sun, Scissors, Ruler, Download, AlertTriangle,
  Droplets, RotateCcw, Clapperboard,
} from 'lucide-react';

// ── Camera presets ──
const PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
  default:     { pos: [18, 14, 16],   target: [0, 1.5, 0],  label: 'Perspective' },
  front:       { pos: [0, 3, 14],     target: [0, 1.5, 0],  label: 'Front' },
  side:        { pos: [20, 3, 0],     target: [0, 1.5, 0],  label: 'Side' },
  top:         { pos: [0, 28, 0.1],   target: [0, 0, 0],    label: 'Top-Down' },
  walkthrough: { pos: [0, 1.7, 1.8],  target: [5, 1.7, -1], label: 'Aisle Walk' },
};

function usePodData(): PodSceneData | null {
  const racks = useConfigStore(s => s.racks);
  const results = useConfigStore(s => s.results);
  const inletTemp_C = useConfigStore(s => s.inletTemp_C);
  if (!results) return null;

  const rackData = racks.filter(r => r.slot).map((r, i) => {
    const platform = platformMap.get(r.slot!.platformId);
    const thermalRack = results.thermal.perRack[i];
    const powerRack = results.power.perRack[i];
    return {
      id: r.id,
      platformName: platform?.name ?? r.slot!.platformId,
      power_kW: powerRack?.it_kW ?? 0,
      inletTemp_C: thermalRack?.inletTemp_C ?? inletTemp_C,
      outletTemp_C: thermalRack?.outletTemp_C ?? inletTemp_C,
      flow_Lpm: thermalRack?.flow_Lpm ?? 0,
      coolingType: platform?.coolingType ?? 'air' as const,
    };
  });

  return {
    rackCount: rackData.length,
    racks: rackData,
    totalPower_kW: results.power.totalIT_kW,
    totalFlow_Lpm: results.thermal.totalFlow_Lpm,
    supplyTemp_C: results.clusterThermal.supplyTemp_C,
    returnTemp_C: results.clusterThermal.weightedReturnTemp_C,
    cduCount: results.cdu.totalCount,
    cduCapacity_kW: results.cdu.selectedSize_kW,
    heatRejection_kW: results.heatRejection.capacity_kW,
  };
}

// ── Toolbar button ──
function ToolBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick} title={title}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all
        ${active
          ? 'bg-cyan-600/80 text-white shadow-lg shadow-cyan-500/30'
          : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'
        } backdrop-blur border border-slate-600/50`}
    >
      {children}
    </button>
  );
}

export default function PodViewer() {
  const data = usePodData();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<any>(null);

  // View options
  const [nightMode, setNightMode] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [failureMode, setFailureMode] = useState<'none' | 'cdu' | 'chiller'>('none');
  const [showParticles, setShowParticles] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('default');
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  const viewOptions: ViewOptions = { nightMode, cutaway, showDimensions, failureMode, showParticles };

  // Camera preset handler
  const applyPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setShowCameraMenu(false);
    const p = PRESETS[preset];
    if (controlsRef.current) {
      const controls = controlsRef.current;
      controls.object.position.set(...p.pos);
      controls.target.set(...p.target);
      controls.update();
    }
  }, []);

  // Screenshot
  const takeScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `compute-pod-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  // Cycle failure mode
  const cycleFailure = useCallback(() => {
    setFailureMode(m => m === 'none' ? 'cdu' : m === 'cdu' ? 'chiller' : 'none');
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[600px] text-slate-400">
        <p>Configure racks first to generate the 3D pod view.</p>
      </div>
    );
  }

  const height = typeof window !== 'undefined' ? Math.max(500, window.innerHeight - 160) : 700;

  return (
    <div className="relative w-full bg-slate-950 rounded-lg overflow-hidden" style={{ height }}>
      <Canvas
        ref={canvasRef}
        shadows
        camera={{ position: [18, 14, 16], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: 3, preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          <fog attach="fog" args={[nightMode ? '#020617' : '#0a1929', 30, nightMode ? 50 : 70]} />
          <PodScene data={data} viewOptions={viewOptions} />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            maxPolarAngle={Math.PI / 2.05}
            minDistance={3}
            maxDistance={55}
            target={[0, 1.5, 0]}
            enableDamping
            dampingFactor={0.08}
          />
        </Suspense>
      </Canvas>

      {/* ── HUD ── */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-5 py-4 pointer-events-auto max-w-xs shadow-2xl">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2.5 tracking-wide">Compute Pod Overview</h3>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs text-slate-300">
            <span className="text-slate-500">IT Power</span>
            <span className="font-mono font-medium">{data.totalPower_kW.toFixed(0)} kW</span>
            <span className="text-slate-500">Coolant Flow</span>
            <span className="font-mono font-medium">{data.totalFlow_Lpm.toFixed(0)} L/min</span>
            <span className="text-slate-500">Supply</span>
            <span className="font-mono text-blue-400">{data.supplyTemp_C.toFixed(1)}°C</span>
            <span className="text-slate-500">Return</span>
            <span className="font-mono text-red-400">{data.returnTemp_C.toFixed(1)}°C</span>
            <span className="text-slate-500">CDU</span>
            <span className="font-mono">CoolIT CHx2000</span>
            <span className="text-slate-500">Racks</span>
            <span className="font-mono">{data.rackCount} × row</span>
            <span className="text-slate-500">Heat Reject</span>
            <span className="font-mono">{data.heatRejection_kW.toFixed(0)} kW</span>
          </div>
          {failureMode !== 'none' && (
            <div className="mt-2 px-2 py-1 bg-red-900/50 border border-red-700/50 rounded text-xs text-red-300 font-medium">
              SIMULATING: {failureMode === 'cdu' ? 'CDU Failure' : 'Chiller Failure'}
            </div>
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 pointer-events-auto">
        <ToolBtn active={nightMode} onClick={() => setNightMode(!nightMode)} title="Night Mode">
          {nightMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </ToolBtn>
        <ToolBtn active={cutaway} onClick={() => setCutaway(!cutaway)} title="Cutaway View">
          <Scissors className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={showDimensions} onClick={() => setShowDimensions(!showDimensions)} title="Dimensions">
          <Ruler className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={showParticles} onClick={() => setShowParticles(!showParticles)} title="Flow Particles">
          <Droplets className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn active={failureMode !== 'none'} onClick={cycleFailure}
          title={`Failure Sim: ${failureMode === 'none' ? 'Off' : failureMode === 'cdu' ? 'CDU (click→Chiller)' : 'Chiller (click→Off)'}`}>
          <AlertTriangle className="w-4 h-4" />
        </ToolBtn>

        <div className="h-px bg-slate-700/50 my-1" />

        {/* Camera presets */}
        <div className="relative">
          <ToolBtn active={showCameraMenu} onClick={() => setShowCameraMenu(!showCameraMenu)} title="Camera Views">
            <Clapperboard className="w-4 h-4" />
          </ToolBtn>
          {showCameraMenu && (
            <div className="absolute right-11 top-0 bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-lg py-1 shadow-xl min-w-[120px]">
              {(Object.entries(PRESETS) as [CameraPreset, typeof PRESETS.default][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                    cameraPreset === key ? 'text-cyan-400 bg-cyan-900/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {val.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolBtn onClick={() => applyPreset('default')} title="Reset Camera">
          <RotateCcw className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn onClick={takeScreenshot} title="Screenshot (PNG)">
          <Download className="w-4 h-4" />
        </ToolBtn>
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-3 pointer-events-auto shadow-2xl">
          <h4 className="text-[0.65rem] font-semibold text-slate-500 uppercase tracking-wider mb-2">Flow Legend</h4>
          <div className="flex flex-col gap-1.5 text-xs">
            <LegendItem color="#1e88e5" glow="#1e88e5" label="Cold Supply (Coolant)" />
            <LegendItem color="#e53935" glow="#e53935" label="Hot Return (Coolant)" />
            <LegendItem color="#ff8f00" glow="#ff8f00" label="AC Power" />
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-5 h-3 rounded-sm inline-block" style={{ background: 'linear-gradient(90deg, #1565c0, #e53935)' }} />
              <span className="text-slate-400">Rack Temp Gradient</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700/40 rounded-lg px-3 py-1.5 text-[0.65rem] text-slate-500">
          Orbit: drag &middot; Zoom: scroll &middot; Pan: right-drag
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, glow, label }: { color: string; glow: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-0.5 rounded inline-block" style={{ background: color, boxShadow: `0 0 6px ${glow}` }} />
      <span style={{ color }}>{label}</span>
    </div>
  );
}
