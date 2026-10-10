"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { ProductRow } from "./store3d/products";
import { makeSignTexture } from "./store3d/textures";

/** Cutaway shelf (milk, bread, produce) reusing the store product builders. */
function Shelf() {
  const ref = useRef<THREE.Group>(null);
  const sign = useMemo(() => makeSignTexture("fresh"), []);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.16;
  });
  return (
    <group ref={ref}>
      {/* gondola */}
      <mesh position={[0, 0.08, -0.35]}>
        <boxGeometry args={[7.4, 0.16, 1.4]} />
        <meshStandardMaterial color="#3a3f45" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.5, -0.72]}>
        <boxGeometry args={[7.4, 2.7, 0.08]} />
        <meshStandardMaterial color="#4a4640" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[7.2, 0.07, 1.15]} />
        <meshStandardMaterial color="#8a8f96" roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.35, -0.25]}>
        <boxGeometry args={[7.2, 0.06, 0.9]} />
        <meshStandardMaterial color="#8a8f96" roughness={0.35} metalness={0.8} />
      </mesh>
      {/* milk cartons */}
      <group position={[-2.3, 0.54, 0.05]}>
        <ProductRow kind="carton" color="#f2f6fa" count={8} capacity={8} width={1.9} />
      </group>
      {/* bread bags */}
      <group position={[0, 0.54, 0.05]}>
        <ProductRow kind="bag" color="#c98f4e" count={7} capacity={8} width={1.9} />
      </group>
      {/* tomatoes */}
      <group position={[2.3, 0.54, 0.05]}>
        <ProductRow kind="heap" color="#c0392b" count={10} capacity={12} width={1.9} />
      </group>
      {/* upper row: tubs + trays */}
      <group position={[-1.2, 1.39, -0.2]}>
        <ProductRow kind="tub" color="#ffffff" count={5} capacity={6} width={1.9} />
      </group>
      <group position={[1.2, 1.39, -0.2]}>
        <ProductRow kind="tray" color="#e07856" count={5} capacity={6} width={1.9} />
      </group>
      <mesh position={[0, 2.9, -0.4]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={sign} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Dust({ count = 120 }: { count?: number }) {
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

function Rig() {
  useFrame((state) => {
    const x = state.pointer.x * 0.7;
    const y = 2.1 + state.pointer.y * 0.5;
    state.camera.position.x += (x - state.camera.position.x) * 0.04;
    state.camera.position.y += (y - state.camera.position.y) * 0.04;
    state.camera.lookAt(0, 1.2, 0);
  });
  return null;
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ position: [0, 2.1, 7.2], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} color="#d1fae5" />
      <pointLight position={[-4, 2, 3]} intensity={12} color="#10B981" />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2.0} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} color="#e8fff2" />
      </Environment>
      <Shelf />
      <Dust />
      <ContactShadows position={[0, 0.01, 0]} scale={10} far={4} blur={2.4} opacity={0.5} frames={1} />
      <Rig />
    </Canvas>
  );
}
