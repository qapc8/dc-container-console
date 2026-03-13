import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';

// ── Layout Constants (meters) ──
const CONT_40_L = 12.192;
const CONT_40_W = 2.438;
const CONT_40_H = 2.896;
const CONT_20_L = 6.058;
const CONT_20_W = 2.438;

// Compute container = 2× 40ft side-by-side
const COMPUTE_W = CONT_40_W * 2;       // ~4.876m
const COMPUTE_L = CONT_40_L;           // ~12.192m
const COMPUTE_H = CONT_40_H;           // ~2.896m

// Y base for all containers
const Y_BASE = COMPUTE_H / 2;

// Pod layout — CDU north, compute center, UPS south
const COMPUTE_POS: [number, number, number] = [0, Y_BASE, 0];
const CDU_POS: [number, number, number] = [0, Y_BASE, -(COMPUTE_W / 2 + 1.8 + CONT_20_W / 2)];
const UPS_POS: [number, number, number] = [0, Y_BASE, (COMPUTE_W / 2 + 1.8 + CONT_20_W / 2)];
const CHILLER_SIZE: [number, number, number] = [4.0, 2.4, 2.2];
const CHILLER_Y = CHILLER_SIZE[1] / 2;
const CHILLER1_POS: [number, number, number] = [-3.5, CHILLER_Y, CDU_POS[2] - CONT_20_W / 2 - 3.0];
const CHILLER2_POS: [number, number, number] = [3.5, CHILLER_Y, CDU_POS[2] - CONT_20_W / 2 - 3.0];

// Rack geometry — single row of 12
const RACK_W = 0.6;
const RACK_D = 1.07;
const RACK_H = 2.0;
const RACK_GAP = 0.025;
const RACK_PITCH = RACK_W + RACK_GAP;  // 0.625m
const MAX_RACKS = 12;

// Rack row positioned against back wall, centered along container length
const RACK_Z_OFFSET = -(COMPUTE_W / 2 - RACK_D / 2 - 0.15); // 0.15m wall clearance

// Pipe radii
const HEADER_RADIUS = 0.06;
const BRANCH_RADIUS = 0.035;
const POWER_RADIUS = 0.045;

// Colors
const COLD_BLUE = '#1e88e5';
const HOT_RED = '#e53935';
const POWER_AMBER = '#ff8f00';
const CONTAINER_TEAL = '#00695c';
const CDU_STEEL = '#455a64';
const UPS_OLIVE = '#827717';
const CHILLER_GRAY = '#607d8b';
const FLOOR_DARK = '#1a237e';

// ── Types ──
export interface PodSceneData {
  rackCount: number;
  racks: {
    id: string;
    platformName: string;
    power_kW: number;
    inletTemp_C: number;
    outletTemp_C: number;
    flow_Lpm: number;
    coolingType: 'liquid' | 'air';
  }[];
  totalPower_kW: number;
  totalFlow_Lpm: number;
  supplyTemp_C: number;
  returnTemp_C: number;
  cduCount: number;
  cduCapacity_kW: number;
  heatRejection_kW: number;
}

export interface ViewOptions {
  nightMode: boolean;
  cutaway: boolean;
  showDimensions: boolean;
  failureMode: 'none' | 'cdu' | 'chiller';
  showParticles: boolean;
}

export type CameraPreset = 'default' | 'front' | 'side' | 'top' | 'walkthrough';

// ── Helpers ──
function tempToColor(temp_C: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (temp_C - 15) / 35));
  return new THREE.Color().setHSL(0.6 - t * 0.6, 0.85, 0.5);
}

function makeTubeGeom(pts: [number, number, number][], radius: number, segments = 32): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(p => new THREE.Vector3(...p)),
    false, 'catmullrom', 0.01
  );
  return new THREE.TubeGeometry(curve, segments, radius, 12, false);
}

// ── 3D Label ──
function Label3D({
  position, children, color = '#e0e0e0', size = '0.7rem', bg = false,
}: {
  position: [number, number, number]; children: React.ReactNode;
  color?: string; size?: string; bg?: boolean;
}) {
  return (
    <Html position={position} center transform={false} style={{ pointerEvents: 'none' }}>
      <div style={{
        color, fontSize: size, fontFamily: "'Inter', system-ui, sans-serif",
        fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.02em',
        textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.6)',
        background: bg ? 'rgba(15,23,42,0.85)' : 'transparent',
        padding: bg ? '3px 8px' : 0, borderRadius: bg ? '4px' : 0,
        border: bg ? '1px solid rgba(100,116,139,0.3)' : 'none',
        userSelect: 'none',
      }}>
        {children}
      </div>
    </Html>
  );
}

// ── Container Shell with structural frame ──
function ContainerShell({
  position, size, color, opacity = 0.1, label,
}: {
  position: [number, number, number]; size: [number, number, number];
  color: string; opacity?: number; label: string;
}) {
  const [w, h, d] = size;
  const edgesGeom = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d]);

  // Corner post positions
  const corners: [number, number][] = [
    [-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2],
  ];

  return (
    <group position={position}>
      {/* Transparent panels */}
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial
          color={color} transparent opacity={opacity}
          roughness={0.15} metalness={0.5}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      {/* Frame edges */}
      <lineSegments geometry={edgesGeom}>
        <lineBasicMaterial color={color} transparent opacity={0.5} />
      </lineSegments>
      {/* Corner posts */}
      {corners.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0, cz]}>
          <boxGeometry args={[0.08, h, 0.08]} />
          <meshStandardMaterial color="#37474f" metalness={0.9} roughness={0.15} />
        </mesh>
      ))}
      {/* Bottom frame rails */}
      <mesh position={[0, -h / 2, -d / 2]}>
        <boxGeometry args={[w, 0.06, 0.06]} />
        <meshStandardMaterial color="#37474f" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0, -h / 2, d / 2]}>
        <boxGeometry args={[w, 0.06, 0.06]} />
        <meshStandardMaterial color="#37474f" metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Corrugation ribs */}
      <ContainerRibs size={size} color={color} />
      {/* Label */}
      <Label3D position={[0, h / 2 + 0.6, 0]} size="0.9rem">
        {label}
      </Label3D>
    </group>
  );
}

function ContainerRibs({ size, color }: { size: [number, number, number]; color: string }) {
  const ribs = useMemo(() => {
    const pts: [number, number, number][][] = [];
    const step = 0.3;
    const count = Math.floor(size[0] / step);
    for (let i = 1; i < count; i++) {
      const x = -size[0] / 2 + i * step;
      pts.push([[x, -size[1] / 2 + 0.06, size[2] / 2], [x, size[1] / 2, size[2] / 2]]);
      pts.push([[x, -size[1] / 2 + 0.06, -size[2] / 2], [x, size[1] / 2, -size[2] / 2]]);
    }
    return pts;
  }, [size]);
  return (
    <>
      {ribs.map((pair, i) => (
        <Line key={i} points={pair} color={color} lineWidth={0.4} transparent opacity={0.15} />
      ))}
    </>
  );
}

// ── Container join seam ──
function ContainerJoinSeam({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  const [w, h] = size;
  return (
    <group position={position}>
      {/* Structural beam at join */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w, 0.05, 0.04]} />
        <meshStandardMaterial color="#ff8f00" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, 0.05, 0.04]} />
        <meshStandardMaterial color="#ff8f00" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -h / 2, 0]}>
        <boxGeometry args={[w, 0.05, 0.04]} />
        <meshStandardMaterial color="#ff8f00" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ── Server Rack (detailed) ──
function ServerRack({
  position, outletTemp_C, coolingType, power_kW, index, rackData, failureMode,
}: {
  position: [number, number, number]; outletTemp_C: number;
  coolingType: 'liquid' | 'air'; power_kW: number; index: number;
  rackData?: PodSceneData['racks'][0]; failureMode?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const effectiveTemp = failureMode === 'cdu' ? outletTemp_C + 15 : outletTemp_C;
  const bodyColor = useMemo(() => tempToColor(effectiveTemp), [effectiveTemp]);
  const emissiveColor = useMemo(() => tempToColor(effectiveTemp).clone().multiplyScalar(0.25), [effectiveTemp]);
  const ledColor = coolingType === 'liquid' ? '#00e676' : '#29b6f6';

  return (
    <group position={position}
      onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Main chassis */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[RACK_W, RACK_H, RACK_D]} />
        <meshStandardMaterial color={bodyColor} metalness={0.75} roughness={0.2} emissive={emissiveColor} />
      </mesh>
      {/* Front bezel (dark panel) */}
      <mesh position={[0, 0, RACK_D / 2 + 0.003]}>
        <planeGeometry args={[RACK_W * 0.94, RACK_H * 0.97]} />
        <meshStandardMaterial color="#0d1117" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* U-height slots (horizontal lines on front) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`slot-${i}`} position={[0, -RACK_H * 0.4 + i * (RACK_H * 0.8 / 7), RACK_D / 2 + 0.005]}>
          <boxGeometry args={[RACK_W * 0.88, 0.004, 0.002]} />
          <meshStandardMaterial color="#1a2332" metalness={0.8} />
        </mesh>
      ))}
      {/* LED strip */}
      {power_kW > 0 && (
        <mesh position={[RACK_W / 2 - 0.012, 0, RACK_D / 2 + 0.006]}>
          <boxGeometry args={[0.006, RACK_H * 0.88, 0.004]} />
          <meshStandardMaterial color={ledColor} emissive={ledColor} emissiveIntensity={4} />
        </mesh>
      )}
      {/* Status LEDs */}
      {power_kW > 0 && [0.7, 0.5, 0.3].map((y, i) => (
        <mesh key={`led-${i}`} position={[-RACK_W / 2 + 0.02, RACK_H * y - RACK_H / 2, RACK_D / 2 + 0.006]}>
          <sphereGeometry args={[0.008, 6, 6]} />
          <meshStandardMaterial color="#4caf50" emissive="#4caf50" emissiveIntensity={5} />
        </mesh>
      ))}
      {/* Rack number */}
      <Label3D position={[0, RACK_H / 2 + 0.15, 0]} color="#90a4ae" size="0.55rem">
        R{index + 1}
      </Label3D>
      {/* Hover tooltip */}
      {rackData && (
        <group position={[0, RACK_H / 2 + 0.6, RACK_D / 2 + 0.3]}>
          <RackTooltip rack={rackData} visible={hovered} />
        </group>
      )}
      {/* Hover highlight ring */}
      {hovered && (
        <mesh position={[0, -RACK_H / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.45, 32]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ── CoolIT CHx2000 CDU (2MW capacity) ──
// Dimensions: ~2.0m H × 1.8m W × 1.0m D (large floor-standing unit)
function CoolITCHx2000({ position }: { position: [number, number, number] }) {
  const CHX_W = 1.8;
  const CHX_H = 2.1;
  const CHX_D = 1.0;

  return (
    <group position={position}>
      {/* Main cabinet */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CHX_W, CHX_H, CHX_D]} />
        <meshStandardMaterial color="#263238" metalness={0.85} roughness={0.12} />
      </mesh>
      {/* CoolIT blue accent stripe */}
      <mesh position={[0, CHX_H * 0.3, CHX_D / 2 + 0.005]}>
        <boxGeometry args={[CHX_W * 0.95, 0.08, 0.005]} />
        <meshStandardMaterial color="#0277bd" emissive="#0288d1" emissiveIntensity={2} />
      </mesh>
      {/* Front panel */}
      <mesh position={[0, 0, CHX_D / 2 + 0.003]}>
        <planeGeometry args={[CHX_W * 0.92, CHX_H * 0.9]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.08} />
      </mesh>
      {/* Digital display */}
      <mesh position={[0, CHX_H * 0.25, CHX_D / 2 + 0.008]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial color="#001529" emissive="#0d47a1" emissiveIntensity={1.5} />
      </mesh>
      {/* Display text overlay */}
      <Label3D position={[0, CHX_H * 0.25, CHX_D / 2 + 0.04]} color="#4fc3f7" size="0.5rem">
        CHx2000 | 2000 kW
      </Label3D>
      {/* Dual pump assemblies */}
      {[-0.45, 0.45].map((x, i) => (
        <group key={i} position={[x, -CHX_H * 0.15, CHX_D / 2 + 0.008]}>
          {/* Pump housing */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.06, 16]} />
            <meshStandardMaterial color="#37474f" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Pump indicator */}
          <mesh position={[0, 0, 0.035]}>
            <circleGeometry args={[0.06, 16]} />
            <meshStandardMaterial
              color={i === 0 ? '#00c853' : '#2196f3'}
              emissive={i === 0 ? '#00c853' : '#2196f3'}
              emissiveIntensity={3}
            />
          </mesh>
        </group>
      ))}
      {/* Top pipe manifold connections */}
      {[-0.5, -0.2, 0.2, 0.5].map((x, i) => (
        <mesh key={`pipe-${i}`} position={[x, CHX_H / 2 + 0.08, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.16, 12]} />
          <meshStandardMaterial color={i < 2 ? COLD_BLUE : HOT_RED} metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {/* Ventilation grills (sides) */}
      {[-1, 1].map(side => (
        <group key={side} position={[0, -CHX_H * 0.2, side * (CHX_D / 2 + 0.003)]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={i} position={[0, i * 0.08 - 0.2, 0]}>
              <boxGeometry args={[CHX_W * 0.7, 0.01, 0.003]} />
              <meshStandardMaterial color="#455a64" metalness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Label */}
      <Label3D position={[0, CHX_H / 2 + 0.4, 0]} color="#4fc3f7" size="0.75rem">
        CoolIT CHx2000
      </Label3D>
    </group>
  );
}

// ── UPS Module (detailed) ──
function UpsModule({ position, index }: { position: [number, number, number]; index: number }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 1.8, 0.65]} />
        <meshStandardMaterial color="#33291a" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Front panel */}
      <mesh position={[0, 0.1, 0.33]}>
        <planeGeometry args={[0.7, 1.5]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.1} />
      </mesh>
      {/* Status display */}
      <mesh position={[0, 0.55, 0.335]}>
        <planeGeometry args={[0.35, 0.18]} />
        <meshStandardMaterial color="#001a00" emissive="#1b5e20" emissiveIntensity={1.5} />
      </mesh>
      {/* Battery indicator bars */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-0.1 + i * 0.05, 0.35, 0.336]}>
          <boxGeometry args={[0.035, 0.06, 0.002]} />
          <meshStandardMaterial color="#4caf50" emissive="#4caf50" emissiveIntensity={2} />
        </mesh>
      ))}
      <Label3D position={[0, 1.1, 0.34]} color="#a5d6a7" size="0.45rem">
        UPS {index + 1}
      </Label3D>
    </group>
  );
}

// ── Chiller Unit (detailed) ──
function ChillerUnit({ position, label }: { position: [number, number, number]; label: string }) {
  return (
    <group position={position}>
      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={CHILLER_SIZE} />
        <meshStandardMaterial color={CHILLER_GRAY} metalness={0.65} roughness={0.25} />
      </mesh>
      {/* Side panels with louvers */}
      {[-1, 1].map(side => (
        <group key={side}>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh key={i} position={[0, -CHILLER_SIZE[1] / 2 + 0.3 + i * 0.15, side * (CHILLER_SIZE[2] / 2 + 0.003)]}>
              <boxGeometry args={[CHILLER_SIZE[0] * 0.85, 0.02, 0.005]} />
              <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.15} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Fan shrouds on top */}
      {[-1.0, 0, 1.0].map((x, i) => (
        <group key={i} position={[x, CHILLER_SIZE[1] / 2 + 0.03, 0]}>
          {/* Shroud ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.03, 8, 24]} />
            <meshStandardMaterial color="#37474f" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Guard grill */}
          <mesh>
            <cylinderGeometry args={[0.55, 0.55, 0.02, 24]} />
            <meshStandardMaterial color="#263238" metalness={0.9} roughness={0.1} transparent opacity={0.6} />
          </mesh>
          <FanBlade offset={i * Math.PI / 4} />
        </group>
      ))}
      {/* Pipe connections */}
      {[-1.2, 1.2].map((x, i) => (
        <mesh key={`conn-${i}`} position={[x, -CHILLER_SIZE[1] / 4, CHILLER_SIZE[2] / 2 + 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.2, 12]} />
          <meshStandardMaterial color={i === 0 ? HOT_RED : COLD_BLUE} metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      <Label3D position={[0, CHILLER_SIZE[1] / 2 + 0.9, 0]} color="#b0bec5" size="0.75rem">
        {label}
      </Label3D>
    </group>
  );
}

function FanBlade({ offset }: { offset: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 4;
  });
  return (
    <group ref={ref} position={[0, 0.04, 0]}>
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} rotation={[0, (Math.PI * 2 / 5) * i + offset, 0]} position={[0.22, 0, 0]}>
          <boxGeometry args={[0.35, 0.015, 0.06]} />
          <meshStandardMaterial color="#455a64" metalness={0.7} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// ── 3D Pipe (solid tube) ──
function Pipe3D({
  points, color, radius = HEADER_RADIUS,
}: {
  points: [number, number, number][]; color: string; radius?: number;
}) {
  const geom = useMemo(() => makeTubeGeom(points, radius), [points, radius]);
  return (
    <mesh geometry={geom} castShadow>
      <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
    </mesh>
  );
}

// ── Animated Flow overlay on pipe ──
function FlowOverlay({
  points, color, speed = 2, lineWidth = 3,
}: {
  points: [number, number, number][]; color: string; speed?: number; lineWidth?: number;
}) {
  const lineRef = useRef<any>(null);
  useFrame((_, delta) => {
    if (lineRef.current?.material) {
      lineRef.current.material.dashOffset -= speed * delta;
    }
  });
  return (
    <Line
      ref={lineRef} points={points} color={color}
      lineWidth={lineWidth} dashed dashSize={0.4} gapSize={0.2}
      transparent opacity={0.8}
    />
  );
}

// ── Labeled pipe with solid tube + animated flow ──
function FlowPipe({
  points, color, radius = HEADER_RADIUS, speed = 2,
  label, labelPosition,
}: {
  points: [number, number, number][]; color: string; radius?: number;
  speed?: number; label?: string; labelPosition?: [number, number, number];
}) {
  return (
    <>
      <Pipe3D points={points} color={color} radius={radius} />
      <FlowOverlay points={points} color="#ffffff" speed={speed} lineWidth={2} />
      {label && labelPosition && (
        <Label3D position={labelPosition} color={color} size="0.65rem" bg>
          {label}
        </Label3D>
      )}
    </>
  );
}

// ── Flow Arrow ──
function FlowArrow({ position, direction, color }: {
  position: [number, number, number]; direction: [number, number, number]; color: string;
}) {
  const rotation = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return new THREE.Euler().setFromQuaternion(quat);
  }, [direction]);
  return (
    <mesh position={position} rotation={rotation}>
      <coneGeometry args={[0.1, 0.3, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
    </mesh>
  );
}

// ── Raised floor inside compute container ──
function RaisedFloor({ length, width }: { length: number; width: number }) {
  const tiles = useMemo(() => {
    const pts: [number, number, number][] = [];
    const tileSize = 0.6;
    const nx = Math.floor(length / tileSize);
    const nz = Math.floor(width / tileSize);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        pts.push([
          -length / 2 + i * tileSize + tileSize / 2,
          -COMPUTE_H / 2 + 0.04,
          -width / 2 + j * tileSize + tileSize / 2,
        ]);
      }
    }
    return pts;
  }, [length, width]);

  return (
    <group>
      {/* Floor surface */}
      <mesh position={[0, -COMPUTE_H / 2 + 0.03, 0]}>
        <boxGeometry args={[length - 0.1, 0.06, width - 0.1]} />
        <meshStandardMaterial color={FLOOR_DARK} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Tile gaps */}
      {tiles.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.58, 0.005, 0.58]} />
          <meshStandardMaterial color="#1a237e" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ── Cable tray (overhead busway) ──
function CableTray({ startX, endX, y, z }: { startX: number; endX: number; y: number; z: number }) {
  const length = endX - startX;
  const cx = (startX + endX) / 2;
  return (
    <group position={[cx, y, z]}>
      {/* Tray body */}
      <mesh>
        <boxGeometry args={[length, 0.04, 0.2]} />
        <meshStandardMaterial color="#ff6f00" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Side rails */}
      {[-0.1, 0.1].map(dz => (
        <mesh key={dz} position={[0, 0.03, dz]}>
          <boxGeometry args={[length, 0.02, 0.01]} />
          <meshStandardMaterial color="#e65100" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// ── Safety floor marking ──
function FloorMarking({ x1, z1, x2, z2, color = '#ffd600' }: {
  x1: number; z1: number; x2: number; z2: number; color?: string;
}) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  return (
    <mesh position={[(x1 + x2) / 2, -COMPUTE_H / 2 + 0.065, (z1 + z2) / 2]}
      rotation={[-Math.PI / 2, 0, angle]}>
      <planeGeometry args={[0.06, length]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
    </mesh>
  );
}

// ── Ground ──
function Ground() {
  return (
    <group>
      {/* Concrete pad */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[50, 40]} />
        <meshStandardMaterial color="#455a64" roughness={0.85} metalness={0.05} />
      </mesh>
      <gridHelper args={[50, 50, '#546e7a', '#4a5568']} position={[0, -0.01, 0]} />
    </group>
  );
}

// ── Rack Hover Tooltip ──
function RackTooltip({ rack, visible }: {
  rack: PodSceneData['racks'][0]; visible: boolean;
}) {
  if (!visible) return null;
  return (
    <Html center style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(100,116,139,0.4)',
        borderRadius: 8, padding: '8px 12px', minWidth: 150,
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: '0.65rem',
        color: '#e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontWeight: 700, color: '#67e8f9', marginBottom: 4, fontSize: '0.7rem' }}>
          {rack.platformName}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
          <span style={{ color: '#94a3b8' }}>Power</span><span>{rack.power_kW.toFixed(1)} kW</span>
          <span style={{ color: '#94a3b8' }}>Inlet</span><span style={{ color: '#60a5fa' }}>{rack.inletTemp_C.toFixed(1)}°C</span>
          <span style={{ color: '#94a3b8' }}>Outlet</span><span style={{ color: '#ef4444' }}>{rack.outletTemp_C.toFixed(1)}°C</span>
          <span style={{ color: '#94a3b8' }}>Flow</span><span>{rack.flow_Lpm.toFixed(1)} L/min</span>
          <span style={{ color: '#94a3b8' }}>Cooling</span><span>{rack.coolingType}</span>
        </div>
      </div>
    </Html>
  );
}

// ── Coolant Particles (InstancedMesh) ──
function CoolantParticles({ paths, color, count = 40 }: {
  paths: [number, number, number][][]; color: string; count?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const state = useMemo(() => ({
    offsets: Array.from({ length: count }, () => Math.random()),
    pathAssign: Array.from({ length: count }, (_, i) => i % paths.length),
    speeds: Array.from({ length: count }, () => 0.15 + Math.random() * 0.25),
  }), [count, paths.length]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      state.offsets[i] = (state.offsets[i] + state.speeds[i] * delta) % 1;
      const path = paths[state.pathAssign[i]];
      if (!path || path.length < 2) continue;
      const t = state.offsets[i];
      const totalSegs = path.length - 1;
      const seg = Math.min(Math.floor(t * totalSegs), totalSegs - 1);
      const segT = t * totalSegs - seg;
      const p1 = path[seg], p2 = path[seg + 1];
      dummy.position.set(
        p1[0] + (p2[0] - p1[0]) * segT,
        p1[1] + (p2[1] - p1[1]) * segT,
        p1[2] + (p2[2] - p1[2]) * segT,
      );
      dummy.scale.setScalar(0.6 + Math.sin(t * Math.PI) * 0.4);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.045, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.9} />
    </instancedMesh>
  );
}

// ── Dimension Callout ──
function DimCallout({ from, to, label, offsetY = 0.3 }: {
  from: [number, number, number]; to: [number, number, number]; label: string; offsetY?: number;
}) {
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + offsetY, (from[2] + to[2]) / 2,
  ];
  return (
    <>
      <Line points={[from, to]} color="#ffd600" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} />
      {/* End markers */}
      <mesh position={from}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#ffd600" /></mesh>
      <mesh position={to}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#ffd600" /></mesh>
      <Label3D position={mid} color="#ffd600" size="0.6rem" bg>{label}</Label3D>
    </>
  );
}

// ── Cutaway clip plane manager ──
function CutawayManager({ enabled }: { enabled: boolean }) {
  const { gl } = useThree();
  useMemo(() => {
    gl.localClippingEnabled = enabled;
  }, [enabled, gl]);
  return null;
}

// ── Main Scene ──
export function PodScene({ data, viewOptions }: { data: PodSceneData; viewOptions: ViewOptions }) {
  const { nightMode, cutaway, showDimensions, failureMode, showParticles } = viewOptions;
  const rackCount = Math.min(data.rackCount, MAX_RACKS);

  // Single row of racks — centered in X, against back wall in Z
  const rackPositions = useMemo(() => {
    const startX = -(rackCount - 1) * RACK_PITCH / 2;
    return Array.from({ length: rackCount }, (_, i) => ({
      pos: [startX + i * RACK_PITCH, RACK_H / 2, RACK_Z_OFFSET] as [number, number, number],
      idx: i,
    }));
  }, [rackCount]);

  // UPS modules
  const upsCount = Math.max(2, Math.ceil(data.totalPower_kW / 500));
  const upsPositions = useMemo(() => {
    const spacing = Math.min(1.5, (CONT_20_L - 1) / upsCount);
    const startX = -(upsCount - 1) * spacing / 2;
    return Array.from({ length: upsCount }, (_, i) =>
      [startX + i * spacing, 0.9, 0] as [number, number, number]
    );
  }, [upsCount]);

  // ── Pipe routing ──
  const computeNorthWall = -COMPUTE_W / 2;
  const computeSouthWall = COMPUTE_W / 2;
  const cduSouthWall = CDU_POS[2] + CONT_20_W / 2;
  const upsNorthWall = UPS_POS[2] - CONT_20_W / 2;

  // Overhead manifold inside compute (runs along the rack row)
  const manifoldY = COMPUTE_H - 0.35;
  const manifoldZ_supply = RACK_Z_OFFSET - RACK_D / 2 - 0.15; // behind racks
  const manifoldZ_return = RACK_Z_OFFSET + RACK_D / 2 + 0.15; // in front of racks
  const manifoldXStart = -(rackCount - 1) * RACK_PITCH / 2 - 0.4;
  const manifoldXEnd = (rackCount - 1) * RACK_PITCH / 2 + 0.4;

  // Supply: CDU → Container north wall → manifold behind racks
  const supplyHeader: [number, number, number][] = [
    [-0.8, COMPUTE_H - 0.2 + Y_BASE, cduSouthWall],
    [-0.8, COMPUTE_H + 0.6 + Y_BASE, (cduSouthWall + computeNorthWall + Y_BASE) / 2 - 1],
    [-0.8, manifoldY + Y_BASE, computeNorthWall + Y_BASE - 0.5],
  ];
  // Return: Container → CDU
  const returnHeader: [number, number, number][] = [
    [0.8, manifoldY + Y_BASE, computeNorthWall + Y_BASE - 0.5],
    [0.8, COMPUTE_H + 0.6 + Y_BASE, (cduSouthWall + computeNorthWall + Y_BASE) / 2 - 1],
    [0.8, COMPUTE_H - 0.2 + Y_BASE, cduSouthWall],
  ];

  // Secondary loop: Chiller ↔ CDU
  const ch1supply: [number, number, number][] = [
    [CHILLER1_POS[0], CHILLER_SIZE[1] + 0.1, CHILLER1_POS[2] + CHILLER_SIZE[2] / 2],
    [CHILLER1_POS[0], CHILLER_SIZE[1] + 0.8, (CHILLER1_POS[2] + CDU_POS[2]) / 2],
    [-1.5, COMPUTE_H, CDU_POS[2] - CONT_20_W / 2],
  ];
  const ch2supply: [number, number, number][] = [
    [CHILLER2_POS[0], CHILLER_SIZE[1] + 0.1, CHILLER2_POS[2] + CHILLER_SIZE[2] / 2],
    [CHILLER2_POS[0], CHILLER_SIZE[1] + 0.8, (CHILLER2_POS[2] + CDU_POS[2]) / 2],
    [1.5, COMPUTE_H, CDU_POS[2] - CONT_20_W / 2],
  ];
  const ch1return: [number, number, number][] = [
    [-0.5, COMPUTE_H, CDU_POS[2] - CONT_20_W / 2],
    [CHILLER1_POS[0] + 1.0, CHILLER_SIZE[1] + 0.8, (CHILLER1_POS[2] + CDU_POS[2]) / 2],
    [CHILLER1_POS[0] + 1.0, CHILLER_SIZE[1] + 0.1, CHILLER1_POS[2] + CHILLER_SIZE[2] / 2],
  ];
  const ch2return: [number, number, number][] = [
    [0.5, COMPUTE_H, CDU_POS[2] - CONT_20_W / 2],
    [CHILLER2_POS[0] - 1.0, CHILLER_SIZE[1] + 0.8, (CHILLER2_POS[2] + CDU_POS[2]) / 2],
    [CHILLER2_POS[0] - 1.0, CHILLER_SIZE[1] + 0.1, CHILLER2_POS[2] + CHILLER_SIZE[2] / 2],
  ];

  // Power: UPS → Compute
  const powerRoute: [number, number, number][] = [
    [0, 0.3, upsNorthWall],
    [0, 0.3, (upsNorthWall + computeSouthWall + Y_BASE) / 2],
    [0, 0.3, computeSouthWall + Y_BASE - 1],
  ];

  // Manifold inside compute (local coordinates)
  const supplyManifold: [number, number, number][] = [
    [manifoldXStart, manifoldY, manifoldZ_supply],
    [manifoldXEnd, manifoldY, manifoldZ_supply],
  ];
  const returnManifold: [number, number, number][] = [
    [manifoldXStart, manifoldY, manifoldZ_return],
    [manifoldXEnd, manifoldY, manifoldZ_return],
  ];

  // Branch drops from manifold to each rack (local coordinates)
  const branchDrops = useMemo(() => {
    return rackPositions.map(({ pos }) => ({
      supply: [
        [pos[0], manifoldY, manifoldZ_supply],
        [pos[0], RACK_H + 0.05, RACK_Z_OFFSET - RACK_D / 2],
      ] as [number, number, number][],
      ret: [
        [pos[0], RACK_H + 0.05, RACK_Z_OFFSET + RACK_D / 2],
        [pos[0], manifoldY, manifoldZ_return],
      ] as [number, number, number][],
    }));
  }, [rackPositions, manifoldY, manifoldZ_supply, manifoldZ_return]);

  // Safety markings — walkway borders inside compute
  const rowStartX = manifoldXStart - 0.2;
  const rowEndX = manifoldXEnd + 0.2;

  return (
    <>
      {/* Cutaway clip plane */}
      <CutawayManager enabled={cutaway} />

      {/* Lighting — adjusts for night mode */}
      <ambientLight intensity={nightMode ? 0.08 : 0.3} />
      <hemisphereLight args={[nightMode ? '#0a1929' : '#e3f2fd', '#263238', nightMode ? 0.15 : 0.6]} />
      <directionalLight
        position={[20, 25, 15]}
        intensity={nightMode ? 0.4 : 1.5}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={80}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0001}
      />
      {/* Fill light from opposite side */}
      <directionalLight position={[-15, 10, -10]} intensity={nightMode ? 0.1 : 0.4} />

      <Ground />

      {/* ══════ COMPUTE CONTAINER (2×40ft) ══════ */}
      <ContainerShell
        position={COMPUTE_POS}
        size={[COMPUTE_L, COMPUTE_H, COMPUTE_W]}
        color={CONTAINER_TEAL}
        opacity={0.06}
        label="Compute Container (2 x 40ft ISO)"
      />
      <ContainerJoinSeam position={COMPUTE_POS} size={[COMPUTE_L, COMPUTE_H, COMPUTE_W]} />

      {/* Interior of compute container */}
      <group position={COMPUTE_POS}>
        {/* Raised floor */}
        <RaisedFloor length={COMPUTE_L - 0.2} width={COMPUTE_W - 0.2} />

        {/* Safety floor markings — aisle borders */}
        <FloorMarking x1={rowStartX} z1={RACK_Z_OFFSET + RACK_D / 2 + 0.3} x2={rowEndX} z2={RACK_Z_OFFSET + RACK_D / 2 + 0.3} />
        <FloorMarking x1={rowStartX} z1={RACK_Z_OFFSET + RACK_D / 2 + 0.3} x2={rowStartX} z2={COMPUTE_W / 2 - 0.1} />
        <FloorMarking x1={rowEndX} z1={RACK_Z_OFFSET + RACK_D / 2 + 0.3} x2={rowEndX} z2={COMPUTE_W / 2 - 0.1} />

        {/* Server racks — single row */}
        {rackPositions.map(({ pos, idx }) => {
          const rd = data.racks[idx];
          return rd ? (
            <ServerRack
              key={idx}
              position={pos}
              outletTemp_C={rd.outletTemp_C}
              coolingType={rd.coolingType}
              power_kW={rd.power_kW}
              index={idx}
              rackData={rd}
              failureMode={failureMode}
            />
          ) : null;
        })}

        {/* Overhead cable tray (power busway) */}
        <CableTray startX={manifoldXStart} endX={manifoldXEnd} y={manifoldY + 0.15} z={0} />

        {/* Coolant manifolds (inside container) */}
        <Pipe3D points={supplyManifold} color={COLD_BLUE} radius={HEADER_RADIUS} />
        <FlowOverlay points={supplyManifold} color="#bbdefb" speed={1.5} lineWidth={2} />
        <Pipe3D points={returnManifold} color={HOT_RED} radius={HEADER_RADIUS} />
        <FlowOverlay points={returnManifold} color="#ffcdd2" speed={1.5} lineWidth={2} />

        {/* Branch drops to each rack */}
        {branchDrops.map((drop, i) => (
          <group key={i}>
            <Pipe3D points={drop.supply} color={COLD_BLUE} radius={BRANCH_RADIUS} />
            <Pipe3D points={drop.ret} color={HOT_RED} radius={BRANCH_RADIUS} />
          </group>
        ))}

        {/* Aisle label */}
        <Label3D position={[0, 0.15, RACK_Z_OFFSET + RACK_D / 2 + 1.2]} color="#78909c" size="0.9rem">
          SERVICE AISLE
        </Label3D>
      </group>

      {/* ══════ CDU CONTAINER ══════ */}
      <ContainerShell
        position={CDU_POS}
        size={[CONT_20_L, CONT_40_H, CONT_20_W]}
        color={CDU_STEEL}
        opacity={0.08}
        label="CDU Container — CoolIT CHx2000"
      />
      <group position={CDU_POS}>
        <CoolITCHx2000 position={[0, 1.05, 0]} />
        {/* Internal lighting */}
        <pointLight position={[0, 1.2, 0]} intensity={0.5} distance={4} color="#4fc3f7" />
      </group>

      {/* ══════ UPS CONTAINER ══════ */}
      <ContainerShell
        position={UPS_POS}
        size={[CONT_20_L, CONT_40_H, CONT_20_W]}
        color={UPS_OLIVE}
        opacity={0.06}
        label={`UPS Container (${Math.round(data.totalPower_kW)} kW)`}
      />
      <group position={UPS_POS}>
        {upsPositions.map((pos, i) => <UpsModule key={i} position={pos} index={i} />)}
      </group>

      {/* ══════ CHILLERS ══════ */}
      <ChillerUnit position={CHILLER1_POS} label={`Chiller A — ${Math.round(data.heatRejection_kW / 2)} kW`} />
      <ChillerUnit position={CHILLER2_POS} label={`Chiller B — ${Math.round(data.heatRejection_kW / 2)} kW`} />

      {/* ══════ INTER-CONTAINER PIPING ══════ */}

      {/* Primary loop: CDU ↔ Compute */}
      <FlowPipe
        points={supplyHeader} color={COLD_BLUE} speed={2.5}
        label={`Supply ${data.supplyTemp_C.toFixed(0)}°C · ${data.totalFlow_Lpm.toFixed(0)} L/min`}
        labelPosition={[-0.8, COMPUTE_H + 1.2, (cduSouthWall + computeNorthWall + Y_BASE) / 2 - 1]}
      />
      <FlowArrow
        position={[-0.8, COMPUTE_H + 0.6 + Y_BASE, (cduSouthWall + computeNorthWall + Y_BASE) / 2 - 0.5]}
        direction={[0, -0.3, 1]} color={COLD_BLUE}
      />
      <FlowPipe
        points={returnHeader} color={HOT_RED} speed={2.5}
        label={`Return ${data.returnTemp_C.toFixed(0)}°C`}
        labelPosition={[0.8, COMPUTE_H + 1.2, (cduSouthWall + computeNorthWall + Y_BASE) / 2 - 1]}
      />
      <FlowArrow
        position={[0.8, COMPUTE_H + 0.6 + Y_BASE, (cduSouthWall + computeNorthWall + Y_BASE) / 2 - 0.5]}
        direction={[0, 0.3, -1]} color={HOT_RED}
      />

      {/* Secondary loop: Chiller ↔ CDU */}
      <FlowPipe points={ch1supply} color={COLD_BLUE} radius={HEADER_RADIUS * 0.8} speed={1.8} />
      <FlowPipe points={ch2supply} color={COLD_BLUE} radius={HEADER_RADIUS * 0.8} speed={1.8} />
      <FlowPipe points={ch1return} color={HOT_RED} radius={HEADER_RADIUS * 0.8} speed={1.8} />
      <FlowPipe points={ch2return} color={HOT_RED} radius={HEADER_RADIUS * 0.8} speed={1.8} />

      <Label3D position={[0, CHILLER_SIZE[1] + 1.8, (CHILLER1_POS[2] + CDU_POS[2]) / 2]} color="#78909c" size="0.7rem">
        Secondary Coolant Loop (Facility Water)
      </Label3D>

      {/* Power route: UPS → Compute */}
      <FlowPipe
        points={powerRoute} color={POWER_AMBER} radius={POWER_RADIUS} speed={3}
        label={`${Math.round(data.totalPower_kW)} kW AC Power`}
        labelPosition={[0, 0.8, (upsNorthWall + computeSouthWall + Y_BASE) / 2 - 0.5]}
      />
      <FlowArrow
        position={[0, 0.3, (upsNorthWall + computeSouthWall + Y_BASE) / 2 - 0.5]}
        direction={[0, 0, -1]} color={POWER_AMBER}
      />

      {/* ══════ COOLANT PARTICLES ══════ */}
      {showParticles && (
        <>
          <CoolantParticles
            paths={[
              supplyHeader,
              ...branchDrops.map(d => d.supply.map(p => [p[0] + COMPUTE_POS[0], p[1] + COMPUTE_POS[1], p[2] + COMPUTE_POS[2]] as [number, number, number])),
            ]}
            color={COLD_BLUE}
            count={50}
          />
          <CoolantParticles
            paths={[
              returnHeader,
              ...branchDrops.map(d => d.ret.map(p => [p[0] + COMPUTE_POS[0], p[1] + COMPUTE_POS[1], p[2] + COMPUTE_POS[2]] as [number, number, number])),
            ]}
            color={HOT_RED}
            count={50}
          />
        </>
      )}

      {/* ══════ DIMENSION CALLOUTS ══════ */}
      {showDimensions && (
        <>
          {/* Compute container length */}
          <DimCallout
            from={[-COMPUTE_L / 2, COMPUTE_H + 1.5, COMPUTE_W / 2 + 0.5]}
            to={[COMPUTE_L / 2, COMPUTE_H + 1.5, COMPUTE_W / 2 + 0.5]}
            label={`${COMPUTE_L.toFixed(1)}m (2×40ft)`}
          />
          {/* Compute container width */}
          <DimCallout
            from={[COMPUTE_L / 2 + 0.5, COMPUTE_H + 1.5, -COMPUTE_W / 2]}
            to={[COMPUTE_L / 2 + 0.5, COMPUTE_H + 1.5, COMPUTE_W / 2]}
            label={`${COMPUTE_W.toFixed(1)}m wide`}
          />
          {/* Aisle width */}
          <DimCallout
            from={[manifoldXEnd + 0.8, 0.3 + Y_BASE, RACK_Z_OFFSET + RACK_D / 2]}
            to={[manifoldXEnd + 0.8, 0.3 + Y_BASE, COMPUTE_W / 2 - 0.15]}
            label={`${(COMPUTE_W / 2 - 0.15 - (RACK_Z_OFFSET + RACK_D / 2)).toFixed(1)}m aisle`}
          />
          {/* Rack row length */}
          <DimCallout
            from={[manifoldXStart, -0.1 + Y_BASE, RACK_Z_OFFSET + RACK_D / 2 + 0.5]}
            to={[manifoldXEnd, -0.1 + Y_BASE, RACK_Z_OFFSET + RACK_D / 2 + 0.5]}
            label={`${((manifoldXEnd - manifoldXStart)).toFixed(1)}m rack row`}
          />
        </>
      )}

      {/* ══════ FAILURE MODE EFFECTS ══════ */}
      {failureMode === 'cdu' && (
        <group position={CDU_POS}>
          {/* Red warning glow on CDU */}
          <pointLight position={[0, 1.5, 0.8]} intensity={3} distance={5} color="#ef4444" />
          <Label3D position={[0, 2.8, 0]} color="#ef4444" size="1rem" bg>
            ⚠ CDU FAILURE
          </Label3D>
        </group>
      )}
      {failureMode === 'chiller' && (
        <>
          <group position={CHILLER1_POS}>
            <pointLight position={[0, 2, 0]} intensity={3} distance={5} color="#f59e0b" />
            <Label3D position={[0, CHILLER_SIZE[1] / 2 + 1.5, 0]} color="#f59e0b" size="1rem" bg>
              ⚠ CHILLER OFFLINE
            </Label3D>
          </group>
          <group position={CHILLER2_POS}>
            <pointLight position={[0, 2, 0]} intensity={3} distance={5} color="#f59e0b" />
            <Label3D position={[0, CHILLER_SIZE[1] / 2 + 1.5, 0]} color="#f59e0b" size="1rem" bg>
              ⚠ CHILLER OFFLINE
            </Label3D>
          </group>
        </>
      )}
    </>
  );
}
