import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Archetype } from "../types";

const url = (file: string) => `${import.meta.env.BASE_URL}models/${file}.glb`;

/** Height of the module floor in bench space: every shell is fitted so its deck lands here. */
const FLOOR_Y = 0.03;
/** Half extents the deck is stretched to, so the module slots fit inside any shell. */
const DECK = { halfX: 0.98, halfZ: 0.8, centerZ: -0.02 };

/** A generated shell as measured in its own file: the numbers the fit is worked out from. */
interface ShellSpec {
  file: string;
  /** Node that swings open; everything under it turns about the hinge line. */
  lid: string;
  /** Nodes that came with the model but are not part of the prop (a table, a ground slab). */
  drop?: RegExp;
  /** Panes: the texture pass bakes them opaque, so they get real glass here. */
  glass: RegExp;
  /** Meshes x-ray leaves solid. */
  keep: RegExp;
  deck: { y: number; halfX: number; halfZ: number; centerZ: number };
  /** Hinge line: height and depth, model space. It runs along X. */
  hinge: { y: number; z: number };
  /** Outer faces of the shell and the vertical band on its front where posts and plate can sit. */
  front: number;
  back: number;
  side: number;
  band: { low: number; high: number };
  bottom: number;
  latchX: number;
  /** Where the engraved plate goes: riveted upright to the front band, or lying on the table before it. */
  plate: "front" | "table";
  /** How far below the band the plate hangs, bench units, when the band is too thin to carry it. */
  plateDrop?: number;
  /** Half the gap between the two microswitch posts, bench units. */
  postX?: number;
  /** UV digit places for shells whose walls are not flat boxes, bench space. Deck spot is added by the scene. */
  uv?: { position: [number, number, number]; rotation: [number, number, number] }[];
}

const SPECS: Partial<Record<Archetype, ShellSpec>> = {
  valigetta: {
    file: "valigetta",
    lid: "Windowed_Lid_Group",
    drop: /Table_Surface/,
    glass: /glass/i,
    keep: /floor/i,
    deck: { y: 0.1, halfX: 0.595, halfZ: 0.507, centerZ: 0 },
    hinge: { y: 0.24, z: -0.542 },
    front: 0.534,
    back: -0.534,
    side: 0.622,
    band: { low: 0.073, high: 0.24 },
    bottom: 0.073,
    latchX: 0.41,
    plate: "front",
  },
  // A capsule in a cradle: the deck sits flush with a thin flange, the trough hangs below it,
  // and the canopy is half a tube. Fitted, it stands 0.85 above whatever it rests on.
  cilindro: {
    file: "cilindro",
    lid: "Hinged_Canopy_Group",
    glass: /Canopy_Glass/,
    keep: /^Deck/,
    deck: { y: 0.684, halfX: 0.823, halfZ: 0.624, centerZ: 0 },
    hinge: { y: 0.7, z: -0.755 },
    front: 0.748,
    back: -0.748,
    side: 0.922,
    band: { low: 0.626, high: 0.677 },
    bottom: 0,
    latchX: 0.53,
    plate: "front",
    plateDrop: 0.19,
    postX: 0.34,
    uv: [
      { position: [1.11, -0.334, -0.1], rotation: [0, Math.PI / 2, 0] },
      { position: [-1.11, -0.334, 0.1], rotation: [0, -Math.PI / 2, 0] },
      { position: [0.3, -0.334, -0.83], rotation: [0, Math.PI, 0] },
    ],
  },
};

/** A shell fitted to the bench: scale, offset and the landmarks the rest of the scene hangs things on. */
export interface ShellFit {
  spec: ShellSpec;
  scale: [number, number, number];
  offset: [number, number, number];
  hinge: THREE.Vector3;
  frontZ: number;
  backZ: number;
  sideX: number;
  wallMidY: number;
  wallHeight: number;
  latchX: number;
  /** Underside of the shell, bench space: what rests on the table. */
  bottomY: number;
  plate: "front" | "table";
  plateDrop: number;
  postX: number;
  uv?: ShellSpec["uv"];
}

function fit(spec: ShellSpec): ShellFit {
  // The deck is stretched to host the module slots. Y and Z share one factor so the lid,
  // which swings about X, keeps its shape while it opens.
  const sx = DECK.halfX / spec.deck.halfX;
  const syz = DECK.halfZ / spec.deck.halfZ;
  const oy = FLOOR_Y - spec.deck.y * syz;
  const oz = DECK.centerZ - spec.deck.centerZ * syz;
  return {
    spec,
    scale: [sx, syz, syz],
    offset: [0, oy, oz],
    hinge: new THREE.Vector3(0, spec.hinge.y, spec.hinge.z),
    frontZ: spec.front * syz + oz,
    backZ: spec.back * syz + oz,
    sideX: spec.side * sx,
    wallMidY: ((spec.band.low + spec.band.high) / 2) * syz + oy,
    wallHeight: (spec.band.high - spec.band.low) * syz,
    latchX: spec.latchX * sx,
    bottomY: spec.bottom * syz + oy,
    plate: spec.plate,
    plateDrop: spec.plateDrop ?? 0,
    postX: spec.postX ?? 0.545,
    uv: spec.uv,
  };
}

export const SHELLS: Partial<Record<Archetype, ShellFit>> = Object.fromEntries(
  Object.entries(SPECS).map(([id, spec]) => [id, fit(spec)]),
);

export function ShellModel({ fit: shell, open, xray }: { fit: ShellFit; open: boolean; xray: boolean }) {
  const { spec } = shell;
  const { scene } = useGLTF(url(spec.file));
  const { root, pivot, shellMats } = useMemo(() => {
    const root = scene.clone(true);
    const doomed: THREE.Object3D[] = [];
    const shellMats: THREE.Material[] = [];
    root.traverse((node) => {
      if (spec.drop?.test(node.name)) doomed.push(node);
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (spec.glass.test(mesh.name)) {
        mesh.castShadow = false;
        mesh.material = new THREE.MeshPhysicalMaterial({
          color: "#9fc4d6",
          transparent: true,
          opacity: 0.12,
          roughness: 0.04,
          metalness: 0,
          envMapIntensity: 1.6,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        shellMats.push(mesh.material);
        return;
      }
      // Own copies: x-ray fades them, and the cache hands the same material to every clone.
      const fade = !spec.keep.test(mesh.name);
      const copy = (m: THREE.Material) => {
        const c = m.clone();
        if (fade) shellMats.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
    });
    for (const node of doomed) node.removeFromParent();
    root.updateMatrixWorld(true);
    const pivot = new THREE.Group();
    pivot.position.copy(shell.hinge);
    root.add(pivot);
    pivot.updateMatrixWorld(true);
    const lid = root.getObjectByName(spec.lid);
    if (lid) pivot.attach(lid);
    return { root, pivot, shellMats };
  }, [scene, spec, shell.hinge]);

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

  return <primitive object={root} scale={shell.scale} position={shell.offset} />;
}

for (const spec of Object.values(SPECS)) useGLTF.preload(url(spec.file));
