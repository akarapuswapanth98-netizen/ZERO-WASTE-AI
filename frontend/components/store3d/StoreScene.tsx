"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { KIND_FOR_SKU, ProductRow, type ProductKind } from "./products";
import { CAT_COLORS, makeShelfTagTexture, makeSignTexture } from "./textures";

export interface ShelfGroup {
  key: string; store_id: string; sku: string; name: string; category: string;
  qty: number; firstExp: string; rem: number; status: "red" | "amber" | "green";
}

const COLD = new Set(["dairy", "meat", "seafood", "ready-to-eat"]);
const SECTION_W = 2.3;
const AISLE_GAP = 3.6;

const statusColor = (s: string) => (s === "red" ? "#FF7D78" : s === "amber" ? "#F4B860" : "#66E3A1");

interface Placed extends ShelfGroup {
  x: number; z: number; cold: boolean;
}

function useLayout(items: ShelfGroup[]): { placed: Placed[]; cats: string[]; width: number; depth: number } {
  return useMemo(() => {
    const cats = [...new Set(items.map((i) => i.category))].sort();
    const placed: Placed[] = [];
    let maxW = 8;
    cats.forEach((cat, ci) => {
      const inCat = items.filter((i) => i.category === cat);
      const rowW = Math.max(8, inCat.length * SECTION_W + 1);
      maxW = Math.max(maxW, rowW);
      inCat.forEach((g, i) => {
        placed.push({ ...g, x: -rowW / 2 + 0.5 + SECTION_W / 2 + i * SECTION_W, z: ci * AISLE_GAP, cold: COLD.has(cat) });
      });
    });
    return { placed, cats, width: maxW, depth: cats.length * AISLE_GAP };
  }, [items]);
}

function Pump({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => {
    if (active) invalidate();
  });
  return null;
}

function StatsSampler({ onStats }: { onStats: (s: { calls: number; tris: number }) => void }) {
  const gl = useThree((s) => s.gl);
  const last = useRef({ calls: 0, tris: 0 });
  const n = useRef(0);
  useFrame(() => {
    n.current += 1;
    if (n.current % 30 === 0) {
      const calls = gl.info.render.calls;
      const tris = gl.info.render.triangles;
      if (calls !== last.current.calls || tris !== last.current.tris) {
        last.current = { calls, tris };
        onStats({ calls, tris });
        (window as unknown as { __r3f?: { calls: number; tris: number } }).__r3f = { calls, tris };
      }
    }
  });
  return null;
}

function Led({ color, pulse }: { color: string; pulse: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    tmp.copy(m.color).lerp(target, 0.12);
    m.color.copy(tmp);
    m.emissive.copy(tmp);
    const t = state.clock.elapsedTime;
    m.emissiveIntensity = pulse > 0 ? 1.6 + Math.sin(t * pulse) * 1.1 : 1.4;
  });
  return (
    <mesh position={[-0.85, 0.78, 0.72]}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial ref={ref} color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
    </mesh>
  );
}

function EdgeGlow({ color, pulse, width }: { color: string; pulse: number; width: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    tmp.copy(m.color).lerp(target, 0.12);
    m.color.copy(tmp);
    m.emissive.copy(tmp);
    m.emissiveIntensity = pulse > 0 ? 0.9 + Math.sin(state.clock.elapsedTime * pulse) * 0.5 : 0.8;
  });
  return (
    <mesh position={[0, 0.42, 0.66]}>
      <boxGeometry args={[width, 0.035, 0.03]} />
      <meshStandardMaterial ref={ref} color={color} emissive={color} emissiveIntensity={0.8} toneMapped={false} />
    </mesh>
  );
}

function StaticLed({ color }: { color: string }) {
  return (
    <mesh position={[-0.85, 0.78, 0.72]}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
    </mesh>
  );
}

function Section({ g, selected, animated, onSelect }: {
  g: Placed; selected: boolean; animated: boolean;
  onSelect: (k: string, e: ThreeEvent<MouseEvent>) => void;
}) {
  const color = statusColor(g.status);
  const pulse = g.status === "red" ? 6 : g.status === "amber" ? 2.4 : 0;
  const kind: ProductKind = KIND_FOR_SKU[g.sku] ?? "tray";
  const tint: Record<string, string> = {
    "TOM-500G": "#c0392b", "SPIN-200G": "#2e7d32", "BAN-1KG": "#e6c33a", "AVOC-2PK": "#3d5a2e",
    "BREAD-WH": "#c98f4e", "CROIS-4PK": "#d9a45b", "BUN-6PK": "#d9a45b",
    "MILK-1L": "#f2f6fa", "YOG-500G": "#ffffff", "CHED-200G": "#e8b93a", "EGGS-12": "#e5d9c3",
    "PANEER-200G": "#f4f1e8", "CHKN-500G": "#e8a0a0", "SALM-300G": "#e07856", "FISH-400G": "#9fc4d4",
    "VEG-BIRY": "#d9a13b", "CHKN-WRAP": "#e0c184", "FRUIT-CUP": "#e86a7a",
  };
  const tag = useMemo(() => makeShelfTagTexture(`${g.sku} · ${g.name}`, g.qty, g.rem), [g.sku, g.name, g.qty, g.rem]);
  useEffect(() => () => {
    tag.dispose();
  }, [tag]);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(g.key, e);
  };
  return (
    <group position={[g.x, 0, g.z]}>
      {/* shelf board segment */}
      <mesh position={[0, 0.4, 0]} onClick={click}>
        <boxGeometry args={[SECTION_W - 0.12, 0.07, 1.15]} />
        <meshStandardMaterial color="#8a8f96" roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.28, -0.35]}>
        <boxGeometry args={[SECTION_W - 0.12, 0.06, 0.9]} />
        <meshStandardMaterial color="#8a8f96" roughness={0.35} metalness={0.8} />
      </mesh>
      {/* products on two levels */}
      <group position={[0, 0.44, 0]}>
        <ProductRow kind={kind} color={tint[g.sku] ?? CAT_COLORS[g.category] ?? "#e8e4da"} count={g.qty} capacity={16} width={2.0} />
      </group>
      {/* crate for produce */}
      {g.category === "produce" && (
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[2.0, 0.22, 1.0]} />
          <meshStandardMaterial color="#7a5a36" roughness={0.9} metalness={0} />
        </mesh>
      )}
      {/* electronic shelf tag */}
      <mesh position={[0.1, 0.78, 0.72]} onClick={click}>
        <planeGeometry args={[1.5, 0.42]} />
        <meshBasicMaterial map={tag} toneMapped={false} />
      </mesh>
      {animated ? <Led color={color} pulse={pulse} /> : <StaticLed color={color} />}
      {animated
        ? <EdgeGlow color={color} pulse={pulse} width={SECTION_W - 0.12} />
        : (
          <mesh position={[0, 0.42, 0.66]}>
            <boxGeometry args={[SECTION_W - 0.12, 0.035, 0.03]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} toneMapped={false} />
          </mesh>
        )}
      {/* selection frame */}
      {selected && (
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[SECTION_W, 1.15, 1.3]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function Aisle({ cat, x0, width, z, cold }: { cat: string; x0: number; width: number; z: number; cold: boolean }) {
  const sign = useMemo(() => makeSignTexture(cat), [cat]);
  return (
    <group>
      {/* plinth + back panel */}
      <mesh position={[x0 + width / 2, 0.08, z - 0.62]}>
        <boxGeometry args={[width, 0.16, 1.3]} />
        <meshStandardMaterial color="#3a3f45" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[x0 + width / 2, 1.35, z - 0.66]}>
        <boxGeometry args={[width, 2.4, 0.08]} />
        <meshStandardMaterial color={cold ? "#dfe9ee" : "#4a4640"} roughness={cold ? 0.25 : 0.8} metalness={cold ? 0.55 : 0.1} />
      </mesh>
      {cold ? (
        <>
          <mesh position={[x0 + width / 2, 2.62, z - 0.3]}>
            <boxGeometry args={[width, 0.28, 1.5]} />
            <meshStandardMaterial color="#2b3138" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[x0 + width / 2, 2.46, z - 0.3]}>
            <boxGeometry args={[width - 0.2, 0.05, 1.3]} />
            <meshStandardMaterial color="#bfe3f2" emissive="#9fd4e8" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
          <mesh position={[x0 + width / 2, 1.35, z + 0.06]}>
            <planeGeometry args={[width, 2.2]} />
            <meshStandardMaterial color="#cfe6ef" transparent opacity={0.16} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </>
      ) : (
        <mesh position={[x0 + width / 2, 2.5, z - 0.5]}>
          <boxGeometry args={[width, 0.14, 0.9]} />
          <meshStandardMaterial color="#6b5a44" roughness={0.85} metalness={0.05} />
        </mesh>
      )}
      {/* hanging category sign */}
      <mesh position={[x0 + width / 2, 3.35, z]}>
        <planeGeometry args={[3.4, 0.85]} />
        <meshBasicMaterial map={sign} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[x0 + width / 2, 3.9, z]}>
        <boxGeometry args={[0.06, 0.7, 0.06]} />
        <meshStandardMaterial color="#22262b" roughness={0.6} metalness={0.5} />
      </mesh>
    </group>
  );
}

function CameraRig({ width, depth, target, resetSignal }: {
  width: number; depth: number; target: [number, number, number] | null; resetSignal: number;
}) {
  const { camera, invalidate } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const cam = camera as THREE.PerspectiveCamera;
  const home = useMemo(() => ({
    pos: new THREE.Vector3(width * 0.52, 9.2, depth + width * 0.58),
    tgt: new THREE.Vector3(0, 0.8, depth / 2 - AISLE_GAP / 2),
  }), [width, depth]);
  const goal = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null);
  const lastReset = useRef(0);
  const lastTarget = useRef<string | null>(null);
  useFrame(() => {
    if (resetSignal !== lastReset.current) {
      lastReset.current = resetSignal;
      lastTarget.current = null;
      goal.current = { pos: home.pos.clone(), tgt: home.tgt.clone() };
    } else if (target) {
      const key = target.join(",");
      if (key !== lastTarget.current) {
        lastTarget.current = key;
        const t = new THREE.Vector3(...target);
        goal.current = {
          tgt: t.clone(),
          pos: t.clone().add(new THREE.Vector3(3.4, 3.0, 5.2)),
        };
      }
    }
    if (goal.current && controls) {
      cam.position.lerp(goal.current.pos, 0.08);
      controls.target.lerp(goal.current.tgt, 0.1);
      controls.update();
      if (cam.position.distanceTo(goal.current.pos) < 0.05) goal.current = null;
      invalidate();
    }
  });
  return null;
}

export interface StoreStats { calls: number; tris: number; }

export default function StoreScene({ items, selectedKey, quality, onQuality, onSelect }: {
  items: ShelfGroup[]; selectedKey: string | null; quality: "high" | "low";
  onQuality: (q: "high" | "low") => void; onSelect: (k: string) => void;
}) {
  const { placed, cats, width, depth } = useLayout(items);
  const [resetSignal, setResetSignal] = useState(0);
  const [stats, setStats] = useState<StoreStats>({ calls: 0, tris: 0 });
  const animated = quality === "high";
  const target = useMemo(() => {
    const g = placed.find((p) => p.key === selectedKey);
    return g ? ([g.x, 0.9, g.z] as [number, number, number]) : null;
  }, [placed, selectedKey]);

  const handleSelect = (k: string) => onSelect(k);

  return (
    <div className="relative h-[480px] w-full">
      <Canvas
        key={`${width.toFixed(1)}x${cats.length}`}
        dpr={quality === "high" ? [1, 1.5] : [1, 1]}
        frameloop="demand"
        camera={{ position: [width * 0.52, 9.2, depth + width * 0.58], fov: 32, near: 0.1, far: 140 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <color attach="background" args={["#0B1511"]} />
        <fog attach="fog" args={["#0B1511", 30, 70]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 12, 6]} intensity={1.0} color="#fff4e0" />
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={2.2} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 12, 1]} color="#e8fff2" />
          <Lightformer intensity={0.7} position={[-6, 2, -4]} scale={[8, 2, 1]} color="#9fd4e8" />
          <Lightformer intensity={0.5} position={[6, 3, 5]} scale={[8, 2, 1]} color="#ffe9c4" />
        </Environment>
        {/* polished floor */}
        <mesh position={[0, 0, depth / 2 - AISLE_GAP / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 10, depth + 12]} />
          <meshStandardMaterial color="#232a28" roughness={0.22} metalness={0.85} />
        </mesh>
        {/* back wall */}
        <mesh position={[0, 4, -4.4]}>
          <planeGeometry args={[width + 12, 9]} />
          <meshStandardMaterial color="#141b19" roughness={0.9} metalness={0.05} />
        </mesh>
        {/* ceiling light panels */}
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[(i * width) / 3.4, 7.6, depth / 2 - AISLE_GAP / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[5, 1.6]} />
            <meshBasicMaterial color="#f2fff7" toneMapped={false} />
          </mesh>
        ))}
        {cats.map((cat, ci) => {
          const inCat = placed.filter((p) => p.category === cat);
          if (inCat.length === 0) return null;
          const xs = inCat.map((p) => p.x);
          const x0 = Math.min(...xs) - SECTION_W / 2 - 0.3;
          const w = Math.max(...xs) - Math.min(...xs) + SECTION_W + 0.6;
          return <Aisle key={cat} cat={cat} x0={x0} width={w} z={ci * AISLE_GAP} cold={COLD.has(cat)} />;
        })}
        {placed.map((g) => (
          <Section key={g.key} g={g} selected={g.key === selectedKey} animated={animated} onSelect={handleSelect} />
        ))}
        <ContactShadows position={[0, 0.02, depth / 2 - AISLE_GAP / 2]} scale={width + 8} far={6} blur={2.4} opacity={0.55} frames={1} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          enablePan
          minDistance={3}
          maxDistance={42}
          maxPolarAngle={Math.PI / 2.15}
          target={[0, 0.8, depth / 2 - AISLE_GAP / 2]}
        />
        <CameraRig width={width} depth={depth} target={target} resetSignal={resetSignal} />
        <Pump active={animated} />
        <StatsSampler onStats={setStats} />
        <PerformanceMonitor
          onDecline={() => onQuality("low")}
          flipflops={2}
          onFallback={() => onQuality("low")}
        />
      </Canvas>
      {/* overlay controls */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <button onClick={() => setResetSignal((s) => s + 1)} className="glass-input pointer-events-auto text-xs" aria-label="Reset view">
          Reset view
        </button>
        <div className="glass-input pointer-events-auto flex items-center gap-1 text-xs" role="group" aria-label="Render quality">
          {(["high", "low"] as const).map((q) => (
            <button key={q} onClick={() => onQuality(q)} aria-pressed={quality === q} className={`rounded-full px-2 py-0.5 ${quality === q ? "bg-emerald-500/40 font-bold" : "opacity-70"}`}>
              {q === "high" ? "High" : "Low"}
            </button>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 rounded bg-black/55 px-2 py-0.5 font-mono text-[10px] text-emerald-100" aria-label="Render statistics">
        {stats.calls} draws · {(stats.tris / 1000).toFixed(0)}k tris · {quality}{animated ? "" : " (static LEDs)"}
      </div>
    </div>
  );
}
