# 3D asset credits — ZeroWaste AI

No external 3D models, HDRIs, textures, fonts or images are used anywhere in the
app. Every visual is procedural at runtime:

- three.js geometries (Box, Sphere, Cylinder, Cone, Torus, Lathe, Capsule,
  Icosahedron, Plane) with `meshStandardMaterial` PBR lighting.
- `@react-three/drei` helpers (OrbitControls, Environment with declarative
  Lightformer children, ContactShadows, PerformanceMonitor) — code only, no
  downloaded HDRIs or models.
- Canvas-generated label/signage textures (`components/store3d/textures.ts`):
  generic "ZERO" branding, SKU names, category colours. No real brands or logos.
- The hero cutaway shelf reuses the same builders as the store explorer.

Deliberate deviations from photorealism (perf + licence safety): glow is
emissive material intensity, not a postprocessing bloom pass; the floor is a
polished PBR standard material, not a real-time mirror; selection uses a
wireframe marker, not a stencil outline pass.
