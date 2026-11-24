import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const URL = `${import.meta.env.BASE_URL}models/valigetta.glb`;

/**
 * Fit of the generated case to the bench. The model's steel floor (y = 0.1, 1.19 × 1.014)
 * is stretched to host the module slots. Y and Z share one factor so the lid, which
 * swings about X, keeps its shape while it opens.
 */
const SX = 1.647;
const SYZ = 1.58;
const FLOOR_Y = 0.03;
export const CASE = {
  scale: [SX, SYZ, SYZ] as [number, number, number],
  offset: [0, FLOOR_Y - 0.1 * SYZ, -0.02] as [number, number, number],
  /** Outer face of the front wall, bench space. */
  frontZ: 0.534 * SYZ - 0.02,
  backZ: -0.534 * SYZ - 0.02,
  wallMidY: FLOOR_Y + (0.1565 - 0.1) * SYZ,
  sideX: 0.622 * SX,
  latchX: 0.41 * SX,
  /** Underside of the shell, bench space: what rests on the table. */
  bottomY: FLOOR_Y + (0.073 - 0.1) * SYZ,
};

/** Hinge line in model space, read off the two hinge pins. */
const HINGE = new THREE.Vector3(0, 0.24, -0.542);

export function ValigettaModel({ open, xray }: { open: boolean; xray: boolean }) {
  const { scene } = useGLTF(URL);
  const { root, pivot, shellMats } = useMemo(() => {
    const root = scene.clone(true);
    root.getObjectByName("Table_Surface_Group")?.removeFromParent();
    const shellMats: THREE.Material[] = [];
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (/glass/i.test(mesh.name)) {
        // The texture pass bakes the pane opaque; a window has to be seen through.
        mesh.castShadow = false;
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: "#9fc4d6",
          transparent: true,
          opacity: 0.12,
          roughness: 0.04,
          metalness: 0,
          envMapIntensity: 1.6,
          depthWrite: false,
        });
        shellMats.push(mesh.material);
        return;
      }
      // Own copies: x-ray fades them, and the cache hands the same material to every clone.
      const fade = !/floor/i.test(mesh.name);
      const copy = (m: THREE.Material) => {
        const c = m.clone();
        if (fade) shellMats.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
    });
    root.updateMatrixWorld(true);
    const pivot = new THREE.Group();
    pivot.position.copy(HINGE);
    root.add(pivot);
    pivot.updateMatrixWorld(true);
    const lid = root.getObjectByName("Windowed_Lid_Group");
    if (lid) pivot.attach(lid);
    return { root, pivot, shellMats };
  }, [scene]);

  const base = useRef(new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>());
  useEffect(() => {
    for (const m of shellMats) {
      if (!base.current.has(m)) {
        base.current.set(m, { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite });
      }
      const was = base.current.get(m)!;
      m.transparent = xray || was.transparent;
      m.opacity = xray ? Math.min(was.opacity, 0.14) : was.opacity;
      m.depthWrite = xray ? false : was.depthWrite;
      m.needsUpdate = true;
    }
  }, [shellMats, xray]);

  const anim = useRef(0);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    anim.current += ((open ? 1 : 0) - anim.current) * Math.min(1, d * 4.5);
    pivot.rotation.x = -anim.current * 1.95;
  });

  return <primitive object={root} scale={CASE.scale} position={CASE.offset} />;
}

useGLTF.preload(URL);
