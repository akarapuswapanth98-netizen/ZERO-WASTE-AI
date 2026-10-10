"use client";
import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { ProductRow } from "@/components/store3d/products";

import { useMotionValueEvent } from "framer-motion";
import type { MotionValue } from "framer-motion";

export type ProgressRef = { current: number };

const STOPS = ["#66E3A1", "#F4B860", "#FF7D78"];

function MomentScene({ progress, animated }: { progress: MotionValue<number>; animated: boolean }) {
  const leds = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const cam = useRef<{ x: number }>({ x: -4.5 });
  const holderRef = useRef<ProgressRef>({ current: 0.35 });
  useMotionValueEvent(progress, "change", (v) => {
    holderRef.current.current = v;
  });
  const invalidate = useThree((s) => s.invalidate);
  const cA = [new THREE.Color(STOPS[0]), new THREE.Color(STOPS[1]), new THREE.Color(STOPS[2])];
  const tmp = new THREE.Color();
  useFrame((state) => {
    const p = Math.min(1, Math.max(0, holderRef.current.current));
    const cx = -4.5 + p * 9;
    if (animated) {
      cam.current.x += (cx - cam.current.x) * 0.08;
      state.camera.position.x = cam.current.x;
      state.camera.lookAt(cam.current.x * 0.7, 1.0, 0);
    } else {
      state.camera.position.x = cx;
      state.camera.lookAt(cx * 0.7, 1.0, 0);
    }
    leds.current.forEach((m, i) => {
      if (!m) return;
      const local = Math.min(1, Math.max(0, p * 1.6 - i * 0.3));
      const seg = local * (STOPS.length - 1);
      const a = Math.min(STOPS.length - 2, Math.floor(seg));
      tmp.copy(cA[a]).lerp(cA[a + 1], seg - a);
      m.color.copy(tmp);
      m.emissive.copy(tmp);
      m.emissiveIntensity = animated ? 1.6 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.7 : 1.6;
    });
    invalidate();
  });
  const rowX = [-3.4, 0, 3.4];
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} color="#d1fae5" />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2.0} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} color="#e8fff2" />
      </Environment>
      <mesh position={[0, 0.08, -0.4]}>
        <boxGeometry args={[12, 0.16, 1.4]} />
        <meshStandardMaterial color="#3a3f45" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.5, -0.75]}>
        <boxGeometry args={[12, 2.7, 0.08]} />
        <meshStandardMaterial color="#dfe9ee" roughness={0.25} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[11.6, 0.07, 1.15]} />
        <meshStandardMaterial color="#8a8f96" roughness={0.35} metalness={0.8} />
      </mesh>
      {rowX.map((x, i) => (
        <group key={x} position={[x, 0.54, 0.05]}>
          {i === 0 && <ProductRow kind="carton" color="#f2f6fa" count={8} capacity={8} width={2.6} />}
          {i === 1 && <ProductRow kind="bag" color="#c98f4e" count={7} capacity={8} width={2.6} />}
          {i === 2 && <ProductRow kind="heap" color="#c0392b" count={10} capacity={12} width={2.6} />}
        </group>
      ))}
      {rowX.map((x, i) => (
        <mesh key={`led${x}`} position={[x, 0.9, 0.62]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial
            ref={(m) => {
              leds.current[i] = m;
            }}
            color={STOPS[0]}
            emissive={STOPS[0]}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.44, 0.6]}>
        <boxGeometry args={[11.4, 0.035, 0.03]} />
        <meshStandardMaterial color="#66E3A1" emissive="#66E3A1" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} scale={13} far={4} blur={2.4} opacity={0.5} frames={1} />
    </>
  );
}

export default function ScrollCanvas({ progress, animated }: { progress: MotionValue<number>; animated: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{ position: [-4.5, 2.4, 6.4], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <MomentScene progress={progress} animated={animated} />
    </Canvas>
  );
}
