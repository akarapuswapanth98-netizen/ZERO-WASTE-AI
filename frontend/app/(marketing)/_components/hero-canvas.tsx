"use client";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { ProductRow } from "@/components/store3d/products";
import { makeSignTexture } from "@/components/store3d/textures";

const LEDS = ["#66E3A1", "#F4B860", "#FF7D78"];

function Pump({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => {
    if (active) invalidate();
  });
  return null;
}

function LedDot({ color, x, pulse }: { color: string; x: number; pulse: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    m.emissiveIntensity = 1.6 + Math.sin(state.clock.elapsedTime * pulse) * 1.1;
  });
  return (
    <mesh position={[x, 0.82, 0.62]}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial ref={ref} color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
    </mesh>
  );
}

function Shelf() {
  const ref = useRef<THREE.Group>(null);
  const sign = useMemo(() => makeSignTexture("fresh"), []);
  useEffect(() => () => {
    sign.dispose();
  }, [sign]);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.16;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.08, -0.35]}>
        <boxGeometry args={[7.4, 0.16, 1.4]} />
        <meshStandardMaterial color="#3a3f45" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.5, -0.72]}>
        <boxGeometry args={[7.4, 2.7, 0.08]} />
        <meshStandardMaterial color="#dfe9ee" roughness={0.25} metalness={0.55} />
      </mesh>
      <mesh position={[0, 2.72, -0.3]}>
        <boxGeometry args={[7.4, 0.28, 1.5]} />
        <meshStandardMaterial color="#2b3138" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0, 2.56, -0.3]}>
        <boxGeometry args={[7.2, 0.05, 1.3]} />
        <meshStandardMaterial color="#bfe3f2" emissive="#9fd4e8" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.35, 0.02]}>
        <planeGeometry args={[7.2, 2.2]} />
        <meshStandardMaterial color="#cfe6ef" transparent opacity={0.14} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[7.2, 0.07, 1.15]} />
        <meshStandardMaterial color="#8a8f96" roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.35, -0.25]}>
        <boxGeometry args={[7.2, 0.06, 0.9]} />
        <meshStandardMaterial color="#8a8f96" roughness={0.35} metalness={0.8} />
      </mesh>
      <group position={[-2.3, 0.54, 0.05]}>
        <ProductRow kind="carton" color="#f2f6fa" count={8} capacity={8} width={1.9} />
      </group>
      <group position={[0, 0.54, 0.05]}>
        <ProductRow kind="bag" color="#c98f4e" count={7} capacity={8} width={1.9} />
      </group>
      <group position={[2.3, 0.54, 0.05]}>
        <ProductRow kind="heap" color="#c0392b" count={10} capacity={12} width={1.9} />
      </group>
      <group position={[-1.2, 1.39, -0.2]}>
        <ProductRow kind="tub" color="#ffffff" count={5} capacity={6} width={1.9} />
      </group>
      <group position={[1.2, 1.39, -0.2]}>
        <ProductRow kind="tray" color="#e07856" count={5} capacity={6} width={1.9} />
      </group>
      {LEDS.map((c, i) => (
        <LedDot key={c} color={c} x={-0.5 + i * 0.5} pulse={i === 2 ? 6 : i === 1 ? 2.4 : 0} />
      ))}
      <mesh position={[0, 0.44, 0.58]}>
        <boxGeometry args={[6.9, 0.035, 0.03]} />
        <meshStandardMaterial color="#66E3A1" emissive="#66E3A1" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.15, -0.4]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={sign} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Dust({ count = 110 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const hash = (n: number) => (Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (hash(i * 3 + 1) - 0.5) * 10;
      arr[i * 3 + 1] = (hash(i * 3 + 2) - 0.5) * 6;
      arr[i * 3 + 2] = (hash(i * 3 + 3) - 0.5) * 10;
    }
    return arr;
  }, [count]);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#66E3A1" transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

function Rig({ enabled }: { enabled: boolean }) {
  useFrame((state) => {
    if (!enabled) return;
    const x = state.pointer.x * 0.7;
    const y = 2.1 + state.pointer.y * 0.5;
    state.camera.position.x += (x - state.camera.position.x) * 0.04;
    state.camera.position.y += (y - state.camera.position.y) * 0.04;
    state.camera.lookAt(0, 1.2, 0);
  });
  return null;
}

export default function HeroCanvas({ animated, paused }: { animated: boolean; paused: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{ position: [0, 2.1, 7.4], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} color="#d1fae5" />
      <pointLight position={[-4, 2, 3]} intensity={12} color="#66E3A1" />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2.0} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} color="#e8fff2" />
      </Environment>
      <Shelf />
      <Dust />
      <ContactShadows position={[0, 0.01, 0]} scale={10} far={4} blur={2.4} opacity={0.5} frames={1} />
      <Rig enabled={animated && !paused} />
      <Pump active={animated && !paused} />
      <StatsProbe active={animated && !paused} />
    </Canvas>
  );
}

function StatsProbe({ active }: { active: boolean }) {
  const gl = useThree((s) => s.gl);
  const n = useRef(0);
  useFrame(() => {
    if (!active) return;
    n.current += 1;
    if (n.current % 60 === 0) {
      (window as unknown as { __r3f_landing?: { calls: number; tris: number } }).__r3f_landing = {
        calls: gl.info.render.calls,
        tris: gl.info.render.triangles,
      };
    }
  });
  return null;
}
