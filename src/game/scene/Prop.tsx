import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

export const modelUrl = (name: string) => `${import.meta.env.BASE_URL}models/${name}.glb`;

export interface Prop {
  /** Scaled and seated: footprint centred on the origin, underside on y = 0. */
  object: THREE.Group;
  size: THREE.Vector3;
  /** Bounds of a part, in the prop's seated space. */
  boxOf: (part: THREE.Object3D) => THREE.Box3;
  /** Bench units per model unit: divide by it to move a part in its own space. */
  unit: number;
  /** Parts whose (sanitised) name matches, in scene-graph order. */
  parts: (pattern: RegExp) => THREE.Object3D[];
}

/**
 * Loads a generated module and fits it to the slot the bench gives it.
 * `width` is the size along X after fitting; the other axes follow uniformly.
 * Generated props sometimes arrive with a table or ground slab: `drop` removes those nodes.
 */
export function useProp(name: string, width: number, opts: { drop?: RegExp; turn?: number } = {}): Prop {
  const { scene } = useGLTF(modelUrl(name));
  const drop = opts.drop?.source;
  const turn = opts.turn ?? 0;
  return useMemo(() => {
    const model = scene.clone(true);
    const doomed: THREE.Object3D[] = [];
    model.traverse((node) => {
      if (/table|ground|floor_slab|plinth/i.test(node.name) || (drop && new RegExp(drop, "i").test(node.name))) {
        doomed.push(node);
      }
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Own copy: selection glow and lamps tint materials per instance.
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    });
    for (const node of doomed) node.removeFromParent();
    model.rotation.y = turn;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const raw = box.getSize(new THREE.Vector3());
    const k = width / (raw.x || 1);
    const mid = box.getCenter(new THREE.Vector3());
    const object = new THREE.Group();
    model.scale.setScalar(k);
    model.position.set(-mid.x * k, -box.min.y * k, -mid.z * k);
    object.add(model);
    object.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4();
    const boxOf = (part: THREE.Object3D) => {
      object.updateMatrixWorld(true);
      inverse.copy(object.matrixWorld).invert();
      return new THREE.Box3().setFromObject(part).applyMatrix4(inverse);
    };
    const parts = (pattern: RegExp) => {
      const hits: THREE.Object3D[] = [];
      object.traverse((node) => {
        if (node !== object && pattern.test(node.name)) hits.push(node);
      });
      // A named group and its own meshes both match; keep the outermost.
      return hits.filter((h) => !hits.some((o) => o !== h && isAncestor(o, h)));
    };
    return { object, size: raw.multiplyScalar(k), boxOf, parts, unit: k };
  }, [scene, width, drop, turn]);
}

function isAncestor(a: THREE.Object3D, b: THREE.Object3D): boolean {
  for (let p = b.parent; p; p = p.parent) if (p === a) return true;
  return false;
}

export function materialsOf(node: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  node.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      out.push(m as THREE.MeshStandardMaterial);
    }
  });
  return out;
}

/** Amber rim glow on the whole prop while it is the selected module. */
export function useSelectionGlow(prop: Prop, selected: boolean, skip?: RegExp) {
  useEffect(() => {
    prop.object.traverse((node) => {
      if (skip?.test(node.name)) return;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std.emissive || std.userData.lamp) continue;
        std.emissive.set(selected ? "#ffb020" : "#000000");
        std.emissiveIntensity = selected ? 0.22 : 0;
      }
    });
  }, [prop, selected, skip]);
}

/** Swaps a baked-opaque pane for real glass. */
export function glaze(node: THREE.Object3D, opacity = 0.22) {
  node.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.material = new THREE.MeshPhysicalMaterial({
      color: "#cfe3ea",
      transparent: true,
      opacity,
      roughness: 0.05,
      metalness: 0,
      envMapIntensity: 1.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  });
}
