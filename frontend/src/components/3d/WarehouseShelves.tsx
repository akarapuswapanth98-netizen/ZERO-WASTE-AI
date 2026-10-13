"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ShelfBoxProps {
  position: [number, number, number];
  name: string;
  daysRemaining: number;
  dayOffset: number;
  initialUnits: number;
  onSelect?: (info: { name: string; units: number; daysLeft: number }) => void;
}

const ShelfBatchBox: React.FC<ShelfBoxProps> = ({
  position,
  name,
  daysRemaining,
  dayOffset,
  initialUnits,
  onSelect,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const effectiveDays = Math.max(0, daysRemaining - dayOffset);
  const effectiveUnits = effectiveDays === 0 ? 0 : Math.max(5, initialUnits - dayOffset * 6);

  // Vibrant Cyber-Neon color-coding
  let boxColor = "#00FF9D"; // Neon Emerald
  let emissiveColor = "#0A291A";
  let isCritical = false;

  if (effectiveDays <= 1) {
    boxColor = "#FF2E63"; // Neon Rose
    emissiveColor = "#4A081A";
    isCritical = true;
  } else if (effectiveDays <= 3) {
    boxColor = "#FFB800"; // Neon Amber
    emissiveColor = "#3D2A00";
  }

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.scale.y = hovered ? 1.2 : 1.0;
      meshRef.current.position.y = position[1] + (hovered ? 0.08 : 0);
    }
    if (beaconRef.current && isCritical) {
      const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 8) * 0.4;
      beaconRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={() => onSelect?.({ name, units: effectiveUnits, daysLeft: effectiveDays })}
      >
        <boxGeometry args={[0.56, 0.48, 0.56]} />
        <meshStandardMaterial
          color={boxColor}
          emissive={emissiveColor}
          emissiveIntensity={hovered ? 1.4 : 0.6}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>

      {/* Critical Floating Pulsing Warning Beacon */}
      {isCritical && (
        <mesh ref={beaconRef} position={[0, 0.42, 0]}>
          <octahedronGeometry args={[0.1, 0]} />
          <meshBasicMaterial color="#FF2E63" wireframe />
        </mesh>
      )}
    </group>
  );
};

const LaserScannerPlane: React.FC = () => {
  const laserRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (laserRef.current) {
      // Sweeps vertically across shelves between -1.2 and +1.2
      laserRef.current.position.y = Math.sin(clock.getElapsedTime() * 1.4) * 1.25;
    }
  });

  return (
    <mesh ref={laserRef} position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <planeGeometry args={[3.4, 1.6]} />
      <meshBasicMaterial
        color="#00F0FF"
        transparent
        opacity={0.12}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const IsometricShelfUnit: React.FC<{ dayOffset: number }> = ({ dayOffset }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock, pointer }) => {
    if (groupRef.current) {
      // Smooth interactive mouse parallax
      const targetY = -Math.PI / 4 + pointer.x * 0.15;
      const targetX = pointer.y * 0.1;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.05);
    }
  });

  const tiers = [-1.0, 0.0, 1.0];

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Sweeping Laser Scanner Beam */}
      <LaserScannerPlane />

      {/* 3 Physical Shelf Levels */}
      {tiers.map((y, idx) => (
        <group key={idx} position={[0, y, 0]}>
          {/* Metal Shelf Plate */}
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[3.3, 0.08, 1.4]} />
            <meshStandardMaterial color="#13231B" roughness={0.5} metalness={0.9} />
          </mesh>

          {/* Glowing Front Edge Rail */}
          <mesh position={[0, 0.02, 0.7]}>
            <boxGeometry args={[3.3, 0.04, 0.04]} />
            <meshStandardMaterial color="#00FF9D" emissive="#00FF9D" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}

      {/* Vertical Metal Supports */}
      <mesh position={[-1.55, 0, -0.6]}>
        <boxGeometry args={[0.08, 2.6, 0.08]} />
        <meshStandardMaterial color="#243E30" metalness={0.9} />
      </mesh>
      <mesh position={[1.55, 0, -0.6]}>
        <boxGeometry args={[0.08, 2.6, 0.08]} />
        <meshStandardMaterial color="#243E30" metalness={0.9} />
      </mesh>
      <mesh position={[-1.55, 0, 0.6]}>
        <boxGeometry args={[0.08, 2.6, 0.08]} />
        <meshStandardMaterial color="#243E30" metalness={0.9} />
      </mesh>
      <mesh position={[1.55, 0, 0.6]}>
        <boxGeometry args={[0.08, 2.6, 0.08]} />
        <meshStandardMaterial color="#243E30" metalness={0.9} />
      </mesh>

      {/* Tier 1 (Bottom): Dairy & Meat */}
      <ShelfBatchBox position={[-1.0, -0.75, 0]} name="Whole Milk 1L" daysRemaining={3} dayOffset={dayOffset} initialUnits={45} />
      <ShelfBatchBox position={[-0.3, -0.75, 0]} name="Greek Yogurt 500g" daysRemaining={2} dayOffset={dayOffset} initialUnits={38} />
      <ShelfBatchBox position={[0.4, -0.75, 0]} name="Chicken Breast 500g" daysRemaining={2} dayOffset={dayOffset} initialUnits={38} />
      <ShelfBatchBox position={[1.1, -0.75, 0]} name="Minced Beef 500g" daysRemaining={4} dayOffset={dayOffset} initialUnits={30} />

      {/* Tier 2 (Middle): Produce & Bakery */}
      <ShelfBatchBox position={[-1.0, 0.25, 0]} name="Organic Bananas 1kg" daysRemaining={2} dayOffset={dayOffset} initialUnits={55} />
      <ShelfBatchBox position={[-0.3, 0.25, 0]} name="Strawberries 400g" daysRemaining={1} dayOffset={dayOffset} initialUnits={40} />
      <ShelfBatchBox position={[0.4, 0.25, 0]} name="Sourdough Loaf 600g" daysRemaining={2} dayOffset={dayOffset} initialUnits={25} />
      <ShelfBatchBox position={[1.1, 0.25, 0]} name="Butter Croissants 4pk" daysRemaining={3} dayOffset={dayOffset} initialUnits={30} />

      {/* Tier 3 (Top): Seafood & Deli */}
      <ShelfBatchBox position={[-1.0, 1.25, 0]} name="Salmon Fillet 400g" daysRemaining={1} dayOffset={dayOffset} initialUnits={40} />
      <ShelfBatchBox position={[-0.3, 1.25, 0]} name="Tiger Prawns 300g" daysRemaining={2} dayOffset={dayOffset} initialUnits={35} />
      <ShelfBatchBox position={[0.4, 1.25, 0]} name="Sea Bass Portions" daysRemaining={2} dayOffset={dayOffset} initialUnits={39} />
      <ShelfBatchBox position={[1.1, 1.25, 0]} name="Prosciutto Di Parma" daysRemaining={6} dayOffset={dayOffset} initialUnits={20} />
    </group>
  );
};

export const WarehouseShelves: React.FC = () => {
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }
  }, []);

  return (
    <div className="relative w-full rounded-2xl border border-[#243E30] bg-gradient-to-b from-[#0C1712] via-[#0A1410] to-[#080F0C] p-5 shadow-glass overflow-hidden mb-6">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 vibe-grid opacity-20 pointer-events-none" />
      <div className="laser-scanner-line pointer-events-none" />

      {/* Header and Time-Travel Controls */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-[#243E30]/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF9D] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00FF9D]"></span>
            </span>
            <h3 className="text-base font-bold text-[#F0FAF4]">3D Isometric Shelf Visualizer</h3>
            <span className="text-[10px] bg-[#00FF9D]/15 text-[#00FF9D] px-2 py-0.5 rounded-full border border-[#00FF9D]/30 font-mono font-bold">
              Three.js + Lidar Sweep
            </span>
          </div>
          <p className="text-xs text-[#A3C5B3] mt-0.5">
            Interactive FIFO batch aging across physical shelving tiers with active Lidar scan plane
          </p>
        </div>

        {/* Time-Travel Day Offset Slider with Neon Styling */}
        <div className="flex items-center gap-3 bg-[#13231B] px-4 py-2.5 rounded-xl border border-[#243E30] shadow-sm">
          <span className="text-xs text-[#A3C5B3] font-mono whitespace-nowrap">Time Horizon:</span>
          <input
            type="range"
            min="0"
            max="7"
            step="1"
            value={dayOffset}
            onChange={(e) => setDayOffset(parseInt(e.target.value, 10))}
            className="w-28 sm:w-36 accent-[#00FF9D] cursor-pointer"
          />
          <span className="text-xs font-bold text-[#00FF9D] font-mono min-w-14">
            +{dayOffset} {dayOffset === 1 ? "day" : "days"}
          </span>
        </div>
      </div>

      {/* 3D Viewport */}
      {hasWebGL ? (
        <div className="relative w-full h-[370px] rounded-xl overflow-hidden bg-[#070D0A]/90 border border-[#243E30]/60">
          <Canvas
            camera={{ position: [3.5, 2.5, 4.5], fov: 38 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[5, 8, 5]} intensity={1.8} color="#F0FAF4" />
            <pointLight position={[-5, 2, -2]} intensity={0.8} color="#00FF9D" />
            <pointLight position={[5, -2, 2]} intensity={0.6} color="#00F0FF" />
            <IsometricShelfUnit dayOffset={dayOffset} />
          </Canvas>

          {/* Floating Shelf Legends */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between text-[11px] font-mono bg-[#0C1712]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#243E30]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[#F0FAF4]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#00FF9D] shadow-[0_0_8px_#00FF9D]" /> Fresh (&gt;72h)
              </span>
              <span className="flex items-center gap-1.5 text-[#F0FAF4]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FFB800] shadow-[0_0_8px_#FFB800]" /> Moderate (48-72h)
              </span>
              <span className="flex items-center gap-1.5 text-[#F0FAF4]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FF2E63] shadow-[0_0_8px_#FF2E63]" /> Near-Expiry (&lt;48h)
              </span>
            </div>
            <span className="text-[#00F0FF] text-[10px] hidden sm:inline flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-ping" /> Laser Lidar Sweep Active
            </span>
          </div>
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center bg-[#13231B] rounded-xl text-xs text-[#A3C5B3]">
          3D Canvas Fallback (Isometric 2D Grid Active)
        </div>
      )}
    </div>
  );
};
