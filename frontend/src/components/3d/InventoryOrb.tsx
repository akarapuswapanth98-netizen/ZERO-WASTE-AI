"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CategoryOrbProps {
  name: string;
  color: string;
  radius: number;
  speed: number;
  phase: number;
}

const CategoryNode: React.FC<CategoryOrbProps> = ({ name, color, radius, speed, phase }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() * speed + phase;
    meshRef.current.position.x = Math.cos(t) * radius;
    meshRef.current.position.z = Math.sin(t) * radius;
    meshRef.current.position.y = Math.sin(t * 1.8) * 0.55;

    if (glowRef.current) {
      glowRef.current.position.copy(meshRef.current.position);
      const s = 1.0 + Math.sin(t * 4) * 0.15;
      glowRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          roughness={0.1}
        />
      </mesh>
      {/* Outer Glow Halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} wireframe />
      </mesh>
    </group>
  );
};

const QuantumParticles: React.FC<{ count?: number }> = ({ count = 300 }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c1 = new THREE.Color("#00FF9D");
    const c2 = new THREE.Color("#00F0FF");
    const c3 = new THREE.Color("#B026FF");

    for (let i = 0; i < count; i++) {
      const radius = 2.0 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      const chosen = Math.random() > 0.6 ? c2 : Math.random() > 0.3 ? c1 : c3;
      col[i * 3] = chosen.r;
      col[i * 3 + 1] = chosen.g;
      col[i * 3 + 2] = chosen.b;
    }
    return [pos, col];
  }, [count]);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.05;
      pointsRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.03) * 0.08;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
      />
    </points>
  );
};

const AdvancedQuantumGlobe: React.FC = () => {
  const mainGroup = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.Mesh>(null);
  const ringCyanRef = useRef<THREE.Mesh>(null);
  const ringVioletRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();

    if (mainGroup.current) {
      // Smooth interactive mouse parallax tilt
      mainGroup.current.rotation.x = THREE.MathUtils.lerp(
        mainGroup.current.rotation.x,
        -pointer.y * 0.45,
        0.05
      );
      mainGroup.current.rotation.y = THREE.MathUtils.lerp(
        mainGroup.current.rotation.y,
        pointer.x * 0.45 + t * 0.12,
        0.05
      );
    }

    if (coreRef.current) {
      const pulse = 1.0 + Math.sin(t * 2) * 0.04;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    if (wireframeRef.current) {
      wireframeRef.current.rotation.y = -t * 0.2;
      wireframeRef.current.rotation.z = t * 0.08;
    }

    if (ringCyanRef.current) {
      ringCyanRef.current.rotation.z = t * 0.25;
      ringCyanRef.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.3) * 0.1;
    }

    if (ringVioletRef.current) {
      ringVioletRef.current.rotation.z = -t * 0.18;
      ringVioletRef.current.rotation.y = Math.PI / 4 + Math.cos(t * 0.2) * 0.1;
    }
  });

  return (
    <group ref={mainGroup}>
      {/* 300+ Particle Quantum Constellation */}
      <QuantumParticles count={320} />

      {/* Central Solid Biophilic Core with Dark Glass Lustre */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.3, 1]} />
        <meshStandardMaterial
          color="#0F1F17"
          emissive="#13231B"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Outer Holographic Emerald Wireframe Sphere */}
      <mesh ref={wireframeRef}>
        <icosahedronGeometry args={[1.68, 2]} />
        <meshStandardMaterial
          color="#00FF9D"
          wireframe
          transparent
          opacity={0.45}
          emissive="#00FF9D"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Outer Holographic Neon Cyan Ring */}
      <mesh ref={ringCyanRef}>
        <torusGeometry args={[2.55, 0.025, 16, 100]} />
        <meshStandardMaterial
          color="#00F0FF"
          transparent
          opacity={0.65}
          emissive="#00F0FF"
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Counter-Rotating Neon Violet Ring */}
      <mesh ref={ringVioletRef}>
        <torusGeometry args={[2.75, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#B026FF"
          transparent
          opacity={0.55}
          emissive="#B026FF"
          emissiveIntensity={1.0}
        />
      </mesh>

      {/* Orbiting Perishable Category Nodes with Neon Colors */}
      <CategoryNode name="Dairy" color="#00FF9D" radius={2.55} speed={0.45} phase={0} />
      <CategoryNode name="Produce" color="#00F0FF" radius={2.55} speed={0.45} phase={Math.PI / 2} />
      <CategoryNode name="Seafood" color="#38BDF8" radius={2.55} speed={0.45} phase={Math.PI} />
      <CategoryNode name="Bakery" color="#FFB800" radius={2.55} speed={0.45} phase={(3 * Math.PI) / 2} />
    </group>
  );
};

export const InventoryOrb: React.FC = () => {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducedMotion(true);
    }
  }, []);

  if (!hasWebGL || reducedMotion) {
    return (
      <div className="relative w-full h-[340px] flex items-center justify-center bg-gradient-to-br from-[#0C1712] to-[#080F0C] rounded-2xl border border-[#243E30] overflow-hidden">
        <div className="absolute inset-0 vibe-grid opacity-30" />
        <div className="relative w-52 h-52 rounded-full border-2 border-dashed border-[#00FF9D]/50 flex items-center justify-center animate-pulseSlow">
          <div className="w-40 h-40 rounded-full bg-[#13231B]/90 border border-[#00FF9D] flex flex-col items-center justify-center text-center p-3 shadow-glow">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00FF9D]">Quantum Mesh</span>
            <span className="text-2xl font-bold text-[#F0FAF4] mt-1">18 SKUs</span>
            <span className="text-[10px] text-[#A3C5B3]">5 Stores Real-Time</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[360px] rounded-2xl border border-[#243E30] bg-gradient-to-b from-[#0C1712]/95 via-[#0A1410]/95 to-[#080F0C]/95 backdrop-blur-xl overflow-hidden shadow-glass group">
      {/* Background Cyber Mesh */}
      <div className="absolute inset-0 vibe-grid opacity-25 pointer-events-none" />
      <div className="laser-scanner-line pointer-events-none" />

      {/* Top Telemetry HUD Overlay */}
      <div className="absolute top-3.5 left-4 right-4 z-10 flex items-center justify-between text-[11px] pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF9D] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00FF9D]"></span>
          </span>
          <span className="font-mono text-[#00FF9D] font-bold tracking-wider">
            QUANTUM NEURAL CORE // 3D PARALLAX
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-0.5 rounded border border-[#00F0FF]/30">
            PARTICLES: 320
          </span>
          <span className="text-[#B026FF] bg-[#B026FF]/10 px-2 py-0.5 rounded border border-[#B026FF]/30 hidden sm:inline">
            TILT: ACTIVE
          </span>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.9} />
        <pointLight position={[10, 10, 10]} intensity={1.8} color="#00FF9D" />
        <pointLight position={[-10, 8, -5]} intensity={1.5} color="#00F0FF" />
        <pointLight position={[0, -10, 5]} intensity={1.0} color="#B026FF" />
        <AdvancedQuantumGlobe />
      </Canvas>

      {/* Bottom Category Interactive Legend */}
      <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-[10px] bg-[#13231B]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#243E30] font-mono shadow-lg">
        <div className="flex items-center gap-4 text-[#F0FAF4]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FF9D] shadow-[0_0_8px_#00FF9D]" /> Dairy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" /> Produce
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]" /> Seafood
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFB800] shadow-[0_0_8px_#FFB800]" /> Bakery
          </span>
        </div>
        <span className="text-[#00FF9D] font-bold hidden sm:inline flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9D] animate-ping" /> Interactive Parallax
        </span>
      </div>
    </div>
  );
};
