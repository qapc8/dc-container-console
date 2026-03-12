import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';

// ── Layout Constants (meters) ──
const CONT_40_L = 12.192;
const CONT_40_W = 2.438;
const CONT_40_H = 2.896;
const CONT_20_L = 6.058;
const CONT_20_W = 2.438;
const CONT_20_H = 2.896;

// Compute container = 2× 40ft side-by-side
const COMPUTE_W = CONT_40_W * 2;          // ~4.876m wide
const COMPUTE_L = CONT_40_L;              // ~12.192m long
const COMPUTE_H = CONT_40_H;

// Positions (center Y at half-height above ground)
const Y_BASE = COMPUTE_H / 2;
const COMPUTE_POS: [number, number, number] = [0, Y_BASE, 0];
const CDU_POS: [number, number, number] = [0, Y_BASE, -(COMPUTE_W / 2 + 1.5 + CONT_20_W / 2)];
const UPS_POS: [number, number, number] = [0, Y_BASE, (COMPUTE_W / 2 + 1.5 + CONT_20_W / 2)];
const CHILLER_SIZE: [number, number, number] = [3.5, 2.2, 2.0];
const CHILLER_Y = CHILLER_SIZE[1] / 2;
const CHILLER1_POS: [number, number, number] = [-3, CHILLER_Y, CDU_POS[2] - CONT_20_W / 2 - 2.5];
const CHILLER2_POS: [number, number, number] = [3, CHILLER_Y, CDU_POS[2] - CONT_20_W / 2 - 2.5];

// Rack geometry
const RACK_W = 0.6;
const RACK_D = 1.07;
const RACK_H = 2.0;
const RACK_GAP = 0.025;
const AISLE_W = COMPUTE_W - 2 * RACK_D;  // ~2.7m aisle

// Colors
const COLD_BLUE = '#2196f3';
const HOT_RED = '#f44336';
const POWER_AMBER = '#ffb300';
const CONTAINER_TEAL = '#00796b';
const CDU_STEEL = '#546e7a';
const UPS_GOLD = '#f9a825';
const CHILLER_GRAY = '#78909c';

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

// ── Helper: temperature → color ──
function tempToColor(temp_C: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (temp_C - 15) / 35));
  return new THREE.Color().setHSL(0.6 - t * 0.6, 0.85, 0.45);
}

// ── Container Shell ──
function ContainerShell({
  position,
  size,
  color,
  opacity = 0.12,
  label,
  labelColor = '#ffffff',
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  opacity?: number;
  label: string;
  labelColor?: string;
}) {
  const edgesGeom = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);

  return (
    <group position={position}>
      {/* Transparent volume */}
      <mesh>
        <boxGeometry args={size} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.3}
          metalness={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Frame edges */}
      <lineSegments geometry={edgesGeom}>
        <lineBasicMaterial color={color} transparent opacity={0.6} />
      </lineSegments>
      {/* Corrugation lines (sides) */}
      <ContainerRibs size={size} color={color} />
      {/* Label */}
      <Text
        position={[0, size[1] / 2 + 0.5, 0]}
        fontSize={0.45}
        color={labelColor}
        anchorX="center"
        anchorY="bottom"
        font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
      >
        {label}
      </Text>
    </group>
  );
}

function ContainerRibs({ size, color }: { size: [number, number, number]; color: string }) {
  const ribs = useMemo(() => {
    const pts: [number, number, number][][] = [];
    const step = 0.25;
    const count = Math.floor(size[0] / step);
    for (let i = 1; i < count; i++) {
      const x = -size[0] / 2 + i * step;
      // Front face ribs
      pts.push([
        [x, -size[1] / 2, size[2] / 2],
        [x, size[1] / 2, size[2] / 2],
      ]);
      // Back face ribs
      pts.push([
        [x, -size[1] / 2, -size[2] / 2],
        [x, size[1] / 2, -size[2] / 2],
      ]);
    }
    return pts;
  }, [size]);

  return (
    <>
      {ribs.map((pair, i) => (
        <Line key={i} points={pair} color={color} lineWidth={0.5} transparent opacity={0.2} />
      ))}
    </>
  );
}

// ── Join seam for dual container ──
function ContainerJoinSeam({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  const points: [number, number, number][] = [
    [-size[0] / 2, -size[1] / 2, 0],
    [size[0] / 2, -size[1] / 2, 0],
    [size[0] / 2, size[1] / 2, 0],
    [-size[0] / 2, size[1] / 2, 0],
    [-size[0] / 2, -size[1] / 2, 0],
  ];
  return (
    <group position={position}>
      <Line points={points} color="#ffab00" lineWidth={2} dashed dashSize={0.3} gapSize={0.15} />
      <Text
        position={[0, size[1] / 2 + 0.15, 0]}
        fontSize={0.2}
        color="#ffab00"
        anchorX="center"
        anchorY="bottom"
        font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
      >
        Container Join
      </Text>
    </group>
  );
}

// ── Server Rack ──
function Rack({
  position,
  outletTemp_C,
  coolingType,
  power_kW,
}: {
  position: [number, number, number];
  outletTemp_C: number;
  coolingType: 'liquid' | 'air';
  power_kW: number;
}) {
  const color = useMemo(() => tempToColor(outletTemp_C), [outletTemp_C]);
  const emissive = useMemo(() => {
    const c = tempToColor(outletTemp_C);
    return c.clone().multiplyScalar(0.3);
  }, [outletTemp_C]);

  return (
    <group position={position}>
      {/* Rack body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[RACK_W, RACK_H, RACK_D]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} emissive={emissive} />
      </mesh>
      {/* Front panel */}
      <mesh position={[0, 0, RACK_D / 2 + 0.002]}>
        <planeGeometry args={[RACK_W * 0.92, RACK_H * 0.96]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.15} />
      </mesh>
      {/* LED strip */}
      {power_kW > 0 && (
        <mesh position={[RACK_W / 2 - 0.015, 0, RACK_D / 2 + 0.005]}>
          <boxGeometry args={[0.008, RACK_H * 0.85, 0.005]} />
          <meshStandardMaterial
            color={coolingType === 'liquid' ? '#00e676' : '#29b6f6'}
            emissive={coolingType === 'liquid' ? '#00e676' : '#29b6f6'}
            emissiveIntensity={3}
          />
        </mesh>
      )}
    </group>
  );
}

// ── CDU Unit (inside CDU container) ──
function CduCabinet({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 1.8, 0.6]} />
        <meshStandardMaterial color="#37474f" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Display panel */}
      <mesh position={[0, 0.4, 0.305]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshStandardMaterial color="#0d47a1" emissive="#1565c0" emissiveIntensity={2} />
      </mesh>
      {/* Pipe connectors */}
      <mesh position={[0.25, -0.5, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.12, 8]} />
        <meshStandardMaterial color={COLD_BLUE} metalness={0.9} />
      </mesh>
      <mesh position={[-0.25, -0.5, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.12, 8]} />
        <meshStandardMaterial color={HOT_RED} metalness={0.9} />
      </mesh>
    </group>
  );
}

// ── UPS Module ──
function UpsModule({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.8, 1.6, 0.6]} />
        <meshStandardMaterial color="#4e342e" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Status display */}
      <mesh position={[0, 0.5, 0.305]}>
        <planeGeometry args={[0.35, 0.15]} />
        <meshStandardMaterial color="#1b5e20" emissive="#2e7d32" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

// ── Chiller Unit ──
function ChillerUnit({ position, label }: { position: [number, number, number]; label: string }) {
  return (
    <group position={position}>
      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={CHILLER_SIZE} />
        <meshStandardMaterial color={CHILLER_GRAY} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Fan grills on top */}
      {[-0.8, 0.8].map((x, i) => (
        <group key={i} position={[x, CHILLER_SIZE[1] / 2 + 0.02, 0]}>
          <mesh>
            <cylinderGeometry args={[0.6, 0.6, 0.05, 24]} />
            <meshStandardMaterial color="#263238" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Fan blades */}
          <FanBlade offset={i * Math.PI / 3} />
        </group>
      ))}
      {/* Label */}
      <Text
        position={[0, CHILLER_SIZE[1] / 2 + 0.8, 0]}
        fontSize={0.35}
        color="#b0bec5"
        anchorX="center"
        font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
      >
        {label}
      </Text>
    </group>
  );
}

function FanBlade({ offset }: { offset: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 3;
  });
  return (
    <group ref={ref} position={[0, 0.06, 0]}>
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} rotation={[0, (Math.PI / 2) * i + offset, 0]} position={[0.2, 0, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.08]} />
          <meshStandardMaterial color="#455a64" metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ── Animated Flow Pipe ──
function FlowPipe({
  points,
  color,
  speed = 2,
  lineWidth = 3,
  label,
  labelPosition,
}: {
  points: [number, number, number][];
  color: string;
  speed?: number;
  lineWidth?: number;
  label?: string;
  labelPosition?: [number, number, number];
}) {
  const lineRef = useRef<any>(null);
  useFrame((_, delta) => {
    if (lineRef.current?.material) {
      lineRef.current.material.dashOffset -= speed * delta;
    }
  });

  return (
    <>
      {/* Glow backing */}
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth + 4}
        transparent
        opacity={0.15}
      />
      {/* Animated dashed line */}
      <Line
        ref={lineRef}
        points={points}
        color={color}
        lineWidth={lineWidth}
        dashed
        dashSize={0.5}
        gapSize={0.25}
      />
      {label && labelPosition && (
        <Text
          position={labelPosition}
          fontSize={0.25}
          color={color}
          anchorX="center"
          font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
        >
          {label}
        </Text>
      )}
    </>
  );
}

// ── Flow Arrow (cone marker) ──
function FlowArrow({
  position,
  direction,
  color,
}: {
  position: [number, number, number];
  direction: [number, number, number];
  color: string;
}) {
  const rotation = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return new THREE.Euler().setFromQuaternion(quat);
  }, [direction]);

  return (
    <mesh position={position} rotation={rotation}>
      <coneGeometry args={[0.12, 0.35, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

// ── Ground Plane ──
function Ground() {
  return (
    <group>
      {/* Concrete pad */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#37474f" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Grid lines */}
      <gridHelper args={[40, 40, '#455a64', '#37474f']} position={[0, 0.005, 0]} />
    </group>
  );
}

// ── Temperature Legend Bar ──
function TempLegend3D() {
  return (
    <group position={[-8, 0.1, 8]}>
      {Array.from({ length: 20 }).map((_, i) => {
        const t = i / 19;
        const col = new THREE.Color().setHSL(0.6 - t * 0.6, 0.85, 0.45);
        return (
          <mesh key={i} position={[i * 0.25, 0, 0]}>
            <boxGeometry args={[0.24, 0.1, 0.3]} />
            <meshStandardMaterial color={col} />
          </mesh>
        );
      })}
      <Text position={[0, 0.25, 0]} fontSize={0.2} color="#90a4ae" anchorX="center"
        font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2">
        15°C
      </Text>
      <Text position={[4.75, 0.25, 0]} fontSize={0.2} color="#90a4ae" anchorX="center"
        font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2">
        50°C
      </Text>
    </group>
  );
}

// ── Main Scene ──
export function PodScene({ data }: { data: PodSceneData }) {
  const rackCount = data.rackCount;
  const maxRacksPerRow = Math.ceil(rackCount / 2);

  // Rack positions inside compute container: two rows facing the aisle
  const rackPositions = useMemo(() => {
    const positions: { pos: [number, number, number]; rackIdx: number; row: 'north' | 'south' }[] = [];
    const startX = -(maxRacksPerRow - 1) * (RACK_W + RACK_GAP) / 2;

    for (let i = 0; i < rackCount; i++) {
      const row = i < maxRacksPerRow ? 'north' : 'south';
      const rowIdx = row === 'north' ? i : i - maxRacksPerRow;
      const x = startX + rowIdx * (RACK_W + RACK_GAP);
      const z = row === 'north' ? -(AISLE_W / 2 + RACK_D / 2) : (AISLE_W / 2 + RACK_D / 2);
      positions.push({ pos: [x, RACK_H / 2, z], rackIdx: i, row });
    }
    return positions;
  }, [rackCount, maxRacksPerRow]);

  // CDU positions inside CDU container
  const cduPositions = useMemo(() => {
    const count = data.cduCount || 2;
    const spacing = Math.min(1.5, (CONT_20_L - 1) / count);
    const startX = -(count - 1) * spacing / 2;
    return Array.from({ length: count }, (_, i) => [startX + i * spacing, 0.9, 0] as [number, number, number]);
  }, [data.cduCount]);

  // UPS modules
  const upsCount = Math.max(2, Math.ceil(data.totalPower_kW / 250));
  const upsPositions = useMemo(() => {
    const spacing = Math.min(1.5, (CONT_20_L - 1) / upsCount);
    const startX = -(upsCount - 1) * spacing / 2;
    return Array.from({ length: upsCount }, (_, i) => [startX + i * spacing, 0.8, 0] as [number, number, number]);
  }, [upsCount]);

  // ── Pipe routes ──
  const computeNorthWall = COMPUTE_POS[2] - COMPUTE_W / 2;
  const computeSouthWall = COMPUTE_POS[2] + COMPUTE_W / 2;
  const cduSouthWall = CDU_POS[2] + CONT_20_W / 2;
  const upsNorthWall = UPS_POS[2] - CONT_20_W / 2;

  // Coolant supply: CDU → Compute (blue)
  const supplyPipe: [number, number, number][] = [
    [-1.0, COMPUTE_H - 0.3, cduSouthWall],
    [-1.0, COMPUTE_H + 0.5, (cduSouthWall + computeNorthWall) / 2],
    [-1.0, COMPUTE_H - 0.3, computeNorthWall],
  ];
  // Coolant return: Compute → CDU (red)
  const returnPipe: [number, number, number][] = [
    [1.0, COMPUTE_H - 0.3, computeNorthWall],
    [1.0, COMPUTE_H + 0.5, (cduSouthWall + computeNorthWall) / 2],
    [1.0, COMPUTE_H - 0.3, cduSouthWall],
  ];

  // Secondary: Chiller → CDU (blue)
  const chiller1Supply: [number, number, number][] = [
    [CHILLER1_POS[0], CHILLER_SIZE[1] - 0.3, CHILLER1_POS[2] + CHILLER_SIZE[2] / 2],
    [CHILLER1_POS[0], CHILLER_SIZE[1] + 0.3, (CHILLER1_POS[2] + CDU_POS[2]) / 2],
    [-1.5, COMPUTE_H - 0.3, CDU_POS[2] - CONT_20_W / 2],
  ];
  const chiller2Supply: [number, number, number][] = [
    [CHILLER2_POS[0], CHILLER_SIZE[1] - 0.3, CHILLER2_POS[2] + CHILLER_SIZE[2] / 2],
    [CHILLER2_POS[0], CHILLER_SIZE[1] + 0.3, (CHILLER2_POS[2] + CDU_POS[2]) / 2],
    [1.5, COMPUTE_H - 0.3, CDU_POS[2] - CONT_20_W / 2],
  ];
  // Secondary return: CDU → Chiller (red)
  const chiller1Return: [number, number, number][] = [
    [-0.5, COMPUTE_H - 0.3, CDU_POS[2] - CONT_20_W / 2],
    [CHILLER1_POS[0] + 0.8, CHILLER_SIZE[1] + 0.3, (CHILLER1_POS[2] + CDU_POS[2]) / 2],
    [CHILLER1_POS[0] + 0.8, CHILLER_SIZE[1] - 0.3, CHILLER1_POS[2] + CHILLER_SIZE[2] / 2],
  ];
  const chiller2Return: [number, number, number][] = [
    [0.5, COMPUTE_H - 0.3, CDU_POS[2] - CONT_20_W / 2],
    [CHILLER2_POS[0] - 0.8, CHILLER_SIZE[1] + 0.3, (CHILLER2_POS[2] + CDU_POS[2]) / 2],
    [CHILLER2_POS[0] - 0.8, CHILLER_SIZE[1] - 0.3, CHILLER2_POS[2] + CHILLER_SIZE[2] / 2],
  ];

  // Power: UPS → Compute (amber)
  const powerPipe: [number, number, number][] = [
    [0, 0.3, upsNorthWall],
    [0, 0.3, (upsNorthWall + computeSouthWall) / 2],
    [0, 0.3, computeSouthWall],
  ];

  // Internal manifold pipes inside compute container (overhead)
  const manifoldY = COMPUTE_H - 0.4;
  const manifoldXStart = -(maxRacksPerRow - 1) * (RACK_W + RACK_GAP) / 2 - 0.5;
  const manifoldXEnd = (maxRacksPerRow - 1) * (RACK_W + RACK_GAP) / 2 + 0.5;

  const supplyManifold: [number, number, number][] = [
    [-1.0, manifoldY, computeNorthWall],
    [-1.0, manifoldY, -(AISLE_W / 2 + RACK_D + 0.2)],
    [manifoldXStart, manifoldY, -(AISLE_W / 2 + RACK_D + 0.2)],
    [manifoldXEnd, manifoldY, -(AISLE_W / 2 + RACK_D + 0.2)],
  ];
  const returnManifold: [number, number, number][] = [
    [manifoldXEnd, manifoldY, (AISLE_W / 2 + RACK_D + 0.2)],
    [manifoldXStart, manifoldY, (AISLE_W / 2 + RACK_D + 0.2)],
    [1.0, manifoldY, (AISLE_W / 2 + RACK_D + 0.2)],
    [1.0, manifoldY, computeNorthWall],
  ];

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#b3e5fc', '#37474f', 0.5]} />
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Ground */}
      <Ground />

      {/* ── Compute Container (2×40ft) ── */}
      <ContainerShell
        position={COMPUTE_POS}
        size={[COMPUTE_L, COMPUTE_H, COMPUTE_W]}
        color={CONTAINER_TEAL}
        opacity={0.08}
        label="Compute Container (2 x 40ft)"
      />
      <ContainerJoinSeam
        position={COMPUTE_POS}
        size={[COMPUTE_L, COMPUTE_H, COMPUTE_W]}
      />

      {/* Racks inside compute */}
      <group position={COMPUTE_POS}>
        {rackPositions.map(({ pos, rackIdx }) => {
          const rackData = data.racks[rackIdx];
          return rackData ? (
            <Rack
              key={rackIdx}
              position={pos}
              outletTemp_C={rackData.outletTemp_C}
              coolingType={rackData.coolingType}
              power_kW={rackData.power_kW}
            />
          ) : null;
        })}
        {/* Aisle label */}
        <Text
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color="#ffffff"
          anchorX="center"
          font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
        >
          {'< HOT AISLE >'}
        </Text>
        {/* Internal manifold supply */}
        <FlowPipe points={supplyManifold} color={COLD_BLUE} lineWidth={2.5} speed={1.5} />
        <FlowPipe points={returnManifold} color={HOT_RED} lineWidth={2.5} speed={1.5} />
      </group>

      {/* ── CDU Container ── */}
      <ContainerShell
        position={CDU_POS}
        size={[CONT_20_L, CONT_20_H, CONT_20_W]}
        color={CDU_STEEL}
        opacity={0.1}
        label={`CDU Container (${data.cduCount} units)`}
      />
      <group position={CDU_POS}>
        {cduPositions.map((pos, i) => (
          <CduCabinet key={i} position={pos} />
        ))}
      </group>

      {/* ── UPS Container ── */}
      <ContainerShell
        position={UPS_POS}
        size={[CONT_20_L, CONT_20_H, CONT_20_W]}
        color={UPS_GOLD}
        opacity={0.08}
        label={`UPS Container (${Math.round(data.totalPower_kW)} kW)`}
      />
      <group position={UPS_POS}>
        {upsPositions.map((pos, i) => (
          <UpsModule key={i} position={pos} />
        ))}
      </group>

      {/* ── Chillers ── */}
      <ChillerUnit position={CHILLER1_POS} label={`Chiller A (${Math.round(data.heatRejection_kW / 2)} kW)`} />
      <ChillerUnit position={CHILLER2_POS} label={`Chiller B (${Math.round(data.heatRejection_kW / 2)} kW)`} />

      {/* ── Primary Coolant Pipes: CDU ↔ Compute ── */}
      <FlowPipe
        points={supplyPipe}
        color={COLD_BLUE}
        speed={2.5}
        lineWidth={4}
        label={`Supply ${data.supplyTemp_C.toFixed(0)}°C  ${data.totalFlow_Lpm.toFixed(0)} L/min`}
        labelPosition={[-1.0, COMPUTE_H + 0.9, (cduSouthWall + computeNorthWall) / 2]}
      />
      <FlowArrow
        position={[-1.0, COMPUTE_H + 0.5, (cduSouthWall + computeNorthWall) / 2 + 0.3]}
        direction={[0, 0, 1]}
        color={COLD_BLUE}
      />
      <FlowPipe
        points={returnPipe}
        color={HOT_RED}
        speed={2.5}
        lineWidth={4}
        label={`Return ${data.returnTemp_C.toFixed(0)}°C`}
        labelPosition={[1.0, COMPUTE_H + 0.9, (cduSouthWall + computeNorthWall) / 2]}
      />
      <FlowArrow
        position={[1.0, COMPUTE_H + 0.5, (cduSouthWall + computeNorthWall) / 2 - 0.3]}
        direction={[0, 0, -1]}
        color={HOT_RED}
      />

      {/* ── Secondary Coolant: Chiller ↔ CDU ── */}
      <FlowPipe points={chiller1Supply} color={COLD_BLUE} speed={1.8} lineWidth={3} />
      <FlowPipe points={chiller2Supply} color={COLD_BLUE} speed={1.8} lineWidth={3} />
      <FlowPipe points={chiller1Return} color={HOT_RED} speed={1.8} lineWidth={3} />
      <FlowPipe points={chiller2Return} color={HOT_RED} speed={1.8} lineWidth={3} />

      {/* Secondary loop label */}
      <Text
        position={[0, CHILLER_SIZE[1] + 1.5, (CHILLER1_POS[2] + CDU_POS[2]) / 2]}
        fontSize={0.3}
        color="#90a4ae"
        anchorX="center"
        font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2"
      >
        Secondary Coolant Loop
      </Text>

      {/* ── Power Cables: UPS → Compute ── */}
      <FlowPipe
        points={powerPipe}
        color={POWER_AMBER}
        speed={3}
        lineWidth={3.5}
        label={`${Math.round(data.totalPower_kW)} kW AC Power`}
        labelPosition={[0, 0.7, (upsNorthWall + computeSouthWall) / 2]}
      />
      <FlowArrow
        position={[0, 0.3, (upsNorthWall + computeSouthWall) / 2]}
        direction={[0, 0, -1]}
        color={POWER_AMBER}
      />

      {/* ── 3D Temperature Legend ── */}
      <TempLegend3D />
    </>
  );
}
