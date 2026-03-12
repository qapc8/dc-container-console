import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PodScene } from './PodScene';
import type { PodSceneData } from './PodScene';
import { useConfigStore } from '../../store/configStore';
import { platformMap } from '../../data/serverPlatforms';

function usePodData(): PodSceneData | null {
  const racks = useConfigStore(s => s.racks);
  const results = useConfigStore(s => s.results);
  const inletTemp_C = useConfigStore(s => s.inletTemp_C);

  if (!results) return null;

  const rackData = racks
    .filter(r => r.slot)
    .map((r, i) => {
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

export default function PodViewer() {
  const data = usePodData();

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p>Configure racks first to generate the 3D pod view.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[600px] bg-slate-950">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [18, 14, 16], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: 3 /* ACESFilmic */ }}
      >
        <fog attach="fog" args={['#0a1929', 30, 70]} />
        <PodScene data={data} />
        <OrbitControls
          makeDefault
          maxPolarAngle={Math.PI / 2.05}
          minDistance={8}
          maxDistance={50}
          target={[0, 1.5, 0]}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      {/* ── HUD Overlay ── */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg px-4 py-3 pointer-events-auto max-w-xs">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">Compute Pod Overview</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300">
            <span className="text-slate-500">IT Power</span>
            <span className="font-mono">{data.totalPower_kW.toFixed(0)} kW</span>
            <span className="text-slate-500">Coolant Flow</span>
            <span className="font-mono">{data.totalFlow_Lpm.toFixed(0)} L/min</span>
            <span className="text-slate-500">Supply Temp</span>
            <span className="font-mono text-blue-400">{data.supplyTemp_C.toFixed(1)}°C</span>
            <span className="text-slate-500">Return Temp</span>
            <span className="font-mono text-red-400">{data.returnTemp_C.toFixed(1)}°C</span>
            <span className="text-slate-500">CDUs</span>
            <span className="font-mono">{data.cduCount} × {data.cduCapacity_kW} kW</span>
            <span className="text-slate-500">Racks</span>
            <span className="font-mono">{data.rackCount}</span>
            <span className="text-slate-500">Heat Rejection</span>
            <span className="font-mono">{data.heatRejection_kW.toFixed(0)} kW</span>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <div className="bg-slate-900/85 backdrop-blur border border-slate-700 rounded-lg px-4 py-3 pointer-events-auto">
          <h4 className="text-xs font-semibold text-slate-400 mb-2">Flow Legend</h4>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-blue-500 rounded inline-block" style={{ boxShadow: '0 0 6px #2196f3' }} />
              <span className="text-blue-400">Cold Supply (Coolant)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-red-500 rounded inline-block" style={{ boxShadow: '0 0 6px #f44336' }} />
              <span className="text-red-400">Hot Return (Coolant)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-amber-500 rounded inline-block" style={{ boxShadow: '0 0 6px #ffb300' }} />
              <span className="text-amber-400">AC Power</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-4 h-3 rounded-sm inline-block" style={{ background: 'linear-gradient(90deg, #1565c0, #e53935)' }} />
              <span className="text-slate-400">Rack Temp (blue=cool, red=hot)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls hint ── */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-500">
          Orbit: drag &middot; Zoom: scroll &middot; Pan: right-drag
        </div>
      </div>
    </div>
  );
}
