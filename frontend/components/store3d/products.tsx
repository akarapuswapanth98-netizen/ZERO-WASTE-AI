import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type ProductKind = "carton" | "tub" | "bag" | "tray" | "cup" | "heap" | "arc" | "wrap";

export const KIND_FOR_SKU: Record<string, ProductKind> = {
  "MILK-1L": "carton", "YOG-500G": "tub", "CHED-200G": "tray", "EGGS-12": "tray",
  "PANEER-200G": "tray", "BREAD-WH": "bag", "CROIS-4PK": "heap", "BUN-6PK": "heap",
  "TOM-500G": "heap", "SPIN-200G": "tray", "BAN-1KG": "arc", "AVOC-2PK": "heap",
  "CHKN-500G": "tray", "SALM-300G": "tray", "FISH-400G": "tray", "VEG-BIRY": "tub",
  "CHKN-WRAP": "wrap", "FRUIT-CUP": "cup",
};

function hash(n: number): number {
  const x = Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
  return x;
}

function buildGeometry(kind: ProductKind): THREE.BufferGeometry {
  switch (kind) {
    case "carton": {
      const box = new THREE.BoxGeometry(0.24, 0.3, 0.17);
      box.translate(0, 0.15, 0);
      const roof = new THREE.ConeGeometry(0.155, 0.11, 4);
      roof.rotateY(Math.PI / 4);
      roof.scale(1, 1, 0.72);
      roof.translate(0, 0.355, 0);
      return mergeGeometries([box, roof]) as THREE.BufferGeometry;
    }
    case "tub": {
      const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.13, 0), new THREE.Vector2(0.155, 0.2), new THREE.Vector2(0.165, 0.23)];
      return new THREE.LatheGeometry(pts, 14);
    }
    case "bag": {
      const g = new THREE.CapsuleGeometry(0.11, 0.2, 6, 10);
      g.scale(1, 1, 0.55);
      g.translate(0, 0.2, 0);
      return g;
    }
    case "tray": {
      const g = new THREE.BoxGeometry(0.34, 0.1, 0.24);
      g.translate(0, 0.05, 0);
      return g;
    }
    case "cup": {
      const g = new THREE.CylinderGeometry(0.11, 0.085, 0.22, 12);
      g.translate(0, 0.11, 0);
      return g;
    }
    case "heap": {
      const g = new THREE.IcosahedronGeometry(0.105, 1);
      g.scale(1, 0.82, 1);
      g.translate(0, 0.09, 0);
      return g;
    }
    case "arc": {
      const g = new THREE.TorusGeometry(0.15, 0.045, 8, 12, Math.PI * 0.85);
      g.rotateZ(Math.PI * 0.1);
      g.translate(0, 0.1, 0);
      return g;
    }
    case "wrap": {
      const g = new THREE.CylinderGeometry(0.085, 0.085, 0.32, 12);
      g.rotateZ(Math.PI / 2);
      g.translate(0, 0.1, 0);
      return g;
    }
  }
}

/** Instanced product row: `filled` of `capacity` slots, deterministic gaps. */
export function ProductRow({ kind, color, count, capacity = 16, width = 2.0, transparent = false, opacity = 1 }: {
  kind: ProductKind; color: string; count: number; capacity?: number; width?: number; transparent?: boolean; opacity?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => buildGeometry(kind), [kind]);
  const filled = Math.max(0, Math.min(count, capacity));
  const order = useMemo(() => {
    const idx = Array.from({ length: capacity }, (_, i) => i);
    idx.sort((a, b) => hash(a * 3 + capacity) - hash(b * 3 + capacity));
    return idx.slice(0, filled);
  }, [capacity, filled]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const perRow = Math.max(1, Math.round(width / 0.28));
    const dummy = new THREE.Object3D();
    order.forEach((slot, k) => {
      const col = slot % perRow;
      const lvl = Math.floor(slot / perRow);
      dummy.position.set(-width / 2 + 0.16 + col * ((width - 0.3) / Math.max(1, perRow - 1)), lvl * 0.42, (hash(slot * 7 + filled) - 0.5) * 0.1);
      dummy.rotation.set(0, (hash(slot * 13 + 1) - 0.5) * 0.5, 0);
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
    });
    m.count = order.length;
    m.instanceMatrix.needsUpdate = true;
  }, [order, width, filled]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, capacity]} frustumCulled={false}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} transparent={transparent} opacity={opacity} />
    </instancedMesh>
  );
}

export function disposeGeometry(geo: THREE.BufferGeometry) {
  geo.dispose();
}
