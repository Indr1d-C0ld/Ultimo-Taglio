import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import type { Tool } from "../types";

/** Where the pointer touches the set, shared between the tracker and the tool that follows it. */
const hand = { point: new THREE.Vector3(), over: false, actAt: -10, touchedAt: 0, movedAt: 0 };

/** Reports a point the pointer is touching. Parts that stop pointer events from bubbling call this themselves. */
export function touch(point: THREE.Vector3) {
  hand.point.copy(point);
  hand.over = true;
  hand.touchedAt = performance.now();
}

/** Wraps the set: every pointer move over it tells the hand where the tool tip should be. */
export function HandSurface({ children }: { children: ReactNode }) {
  return (
    <group
      onPointerMove={(e) => touch(e.point)}
    >
      {children}
    </group>
  );
}

/** Seconds since the last click, for the tools' working motion. */
const sinceAct = () => performance.now() / 1000 - hand.actAt;
/** 0 → 1 → 0 over `span` seconds after a click. */
const squeeze = (span: number) => {
  const t = sinceAct() / span;
  return t >= 0 && t <= 1 ? Math.sin(t * Math.PI) : 0;
};

const STEEL = { color: "#c9c6bf", metalness: 0.92, roughness: 0.24 } as const;
const DARK = { color: "#1d1b19", metalness: 0.4, roughness: 0.55 } as const;

/** Tools are modelled tip-down: the tip sits at the origin and the grip rises along +Y. */
function Cutters() {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame(() => {
    const open = 0.2 * (1 - squeeze(0.22));
    if (left.current) left.current.rotation.z = open;
    if (right.current) right.current.rotation.z = -open;
  });
  const half = (side: 1 | -1) => (
    <>
      <mesh position={[side * 0.006, -0.035, 0]} castShadow>
        <boxGeometry args={[0.012, 0.07, 0.014]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[side * 0.004, -0.064, 0]} rotation={[0, 0, side * 0.25]} castShadow>
        <boxGeometry args={[0.006, 0.02, 0.016]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[side * -0.03, 0.13, 0]} rotation={[0, 0, side * -0.2]} castShadow>
        <capsuleGeometry args={[0.012, 0.2, 6, 12]} />
        <meshStandardMaterial color="#b3261c" roughness={0.6} />
      </mesh>
    </>
  );
  return (
    <group position={[0, 0.075, 0]}>
      <group ref={left}>{half(1)}</group>
      <group ref={right}>{half(-1)}</group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.022, 14]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  );
}

function Probe({ color = "#b3261c" }: { color?: string }) {
  const body = useRef<THREE.Group>(null);
  useFrame(() => {
    if (body.current) body.current.position.y = -0.012 * squeeze(0.18);
  });
  return (
    <group ref={body}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <coneGeometry args={[0.004, 0.06, 10]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.062, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.005, 0.02, 12]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      <mesh position={[0, 0.15, 0]} castShadow>
        <capsuleGeometry args={[0.01, 0.14, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.004, 0.006, 0.05, 8]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
    </group>
  );
}

function Screwdriver() {
  const body = useRef<THREE.Group>(null);
  useFrame(() => {
    if (body.current) body.current.rotation.y = Math.min(1, Math.max(0, sinceAct() / 0.45)) * Math.PI * 2;
  });
  return (
    <group ref={body}>
      <mesh position={[0, 0.008, 0]} castShadow>
        <boxGeometry args={[0.014, 0.016, 0.003]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.16, 10]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.225, 0]} castShadow>
        <capsuleGeometry args={[0.019, 0.085, 8, 8]} />
        <meshStandardMaterial color="#d08a1e" roughness={0.35} transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

function HexKey() {
  const body = useRef<THREE.Group>(null);
  const hex = { color: "#2b2b2e", metalness: 0.85, roughness: 0.35 } as const;
  useFrame(() => {
    if (body.current) body.current.rotation.y = Math.min(1, Math.max(0, sinceAct() / 0.5)) * Math.PI;
  });
  return (
    <group ref={body}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.09, 6]} />
        <meshStandardMaterial {...hex} />
      </mesh>
      <mesh position={[0.075, 0.09, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
        <meshStandardMaterial {...hex} />
      </mesh>
    </group>
  );
}

function Clip() {
  const jaw = useRef<THREE.Group>(null);
  useFrame(() => {
    if (jaw.current) jaw.current.rotation.z = 0.32 * (1 - squeeze(0.25));
  });
  const blade = (
    <mesh position={[0, 0.045, 0]} castShadow>
      <boxGeometry args={[0.008, 0.09, 0.018]} />
      <meshStandardMaterial {...STEEL} />
    </mesh>
  );
  return (
    <group>
      {blade}
      <group ref={jaw} position={[0.006, 0.07, 0]}>
        <group position={[0, -0.07, 0]}>{blade}</group>
      </group>
      <mesh position={[0.004, 0.12, 0]} castShadow>
        <capsuleGeometry args={[0.014, 0.06, 6, 10]} />
        <meshStandardMaterial color="#c9d46a" roughness={0.6} />
      </mesh>
      <mesh position={[0.004, 0.2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.09, 8]} />
        <meshStandardMaterial color="#c9d46a" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Tweezers() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const open = 0.09 * (1 - squeeze(0.2));
    if (a.current) a.current.rotation.z = open;
    if (b.current) b.current.rotation.z = -open;
  });
  return (
    <group position={[0, 0.2, 0]}>
      <mesh ref={a} castShadow>
        <boxGeometry args={[0.004, 0.4, 0.012]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh ref={b} castShadow>
        <boxGeometry args={[0.004, 0.4, 0.012]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  );
}

function Stethoscope() {
  const head = useRef<THREE.Group>(null);
  useFrame(() => {
    if (head.current) head.current.position.y = -0.01 * squeeze(0.3);
  });
  return (
    <group ref={head}>
      <mesh position={[0, 0.008, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.045, 0.016, 28]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.03, 0.03, 20]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <capsuleGeometry args={[0.008, 0.2, 6, 10]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
    </group>
  );
}

function Tape() {
  return (
    <group position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.026, 28, 1, true]} />
        <meshStandardMaterial color="#e2b43a" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.034, 0.034, 0.027, 28, 1, true]} />
        <meshStandardMaterial color="#7a6a52" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Cell() {
  return (
    <group position={[0, 0.06, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.07, 0.12, 0.045]} />
        <meshStandardMaterial color="#20242a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[0.072, 0.05, 0.047]} />
        <meshStandardMaterial color="#d6a23a" metalness={0.6} roughness={0.35} />
      </mesh>
      {[-0.016, 0.016].map((x) => (
        <mesh key={x} position={[x, 0.066, 0]}>
          <cylinderGeometry args={[0.009, 0.009, 0.012, 12]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
    </group>
  );
}

const MODELS: Partial<Record<Tool, () => ReactNode>> = {
  tronchese: () => <Cutters />,
  multimetro: () => <Probe />,
  cacciavite: () => <Screwdriver />,
  brugola: () => <HexKey />,
  ponticello: () => <Clip />,
  pinzette: () => <Tweezers />,
  stetoscopio: () => <Stethoscope />,
  nastro: () => <Tape />,
  pila: () => <Cell />,
};

export const hasHandModel = (tool: Tool) => tool in MODELS;

/** The tool in hand: it follows the pointer over the set, leans toward the camera and works on a click. */
export function ToolInHand() {
  const tool = useGame((s) => s.tool);
  const playing = useGame((s) => s.phase === "play");
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  const model = MODELS[tool];
  const shown = playing && !!model;
  const scratch = useMemo(() => ({ lean: new THREE.Vector3(), flat: new THREE.Vector3(), side: new THREE.Vector3(), q: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0) }), []);

  useEffect(() => {
    const el = gl.domElement;
    const act = () => {
      hand.actAt = performance.now() / 1000;
    };
    const leave = () => {
      hand.over = false;
    };
    const moved = () => {
      hand.movedAt = performance.now();
      hand.over = true;
    };
    el.addEventListener("pointermove", moved);
    el.addEventListener("pointerdown", act);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", moved);
      el.removeEventListener("pointerdown", act);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  // The model is the cursor while a tool is out.
  useEffect(() => {
    gl.domElement.style.cursor = shown ? "none" : "";
    return () => {
      gl.domElement.style.cursor = "";
    };
  }, [gl, shown]);

  // A tool in hand must never be what the pointer hits.
  useEffect(() => {
    group.current?.traverse((node) => {
      node.raycast = () => {};
    });
  }, [tool, shown]);

  useFrame(({ camera, clock, pointer, raycaster }, delta) => {
    const g = group.current;
    if (!g) return;
    g.visible = shown && hand.over;
    if (!g.visible) return;
    const st = useGame.getState();
    // The pointer has moved but touched nothing (it is over empty backdrop): since the model is
    // the cursor, it must still follow. Carry it on a level plane at the height it last had.
    if (hand.movedAt - hand.touchedAt > 120) {
      raycaster.setFromCamera(pointer, camera);
      const ray = raycaster.ray;
      if (Math.abs(ray.direction.y) > 1e-4) {
        const t = (hand.point.y - ray.origin.y) / ray.direction.y;
        if (t > 0 && t < 30) hand.point.copy(ray.origin).addScaledVector(ray.direction, t);
      }
    }
    // Lean the grip toward the camera and a little to the right, as a right hand would hold it.
    scratch.flat.copy(camera.position).sub(hand.point).setY(0).normalize();
    scratch.side.crossVectors(scratch.up, scratch.flat);
    scratch.lean.copy(scratch.up).addScaledVector(scratch.flat, 0.55).addScaledVector(scratch.side, 0.35).normalize();
    scratch.q.setFromUnitVectors(scratch.up, scratch.lean);
    const k = 1 - Math.exp(-22 * Math.min(delta, 0.1));
    g.position.lerp(hand.point, k);
    g.quaternion.slerp(scratch.q, k);
    // The last seconds get to the hands.
    if (st.mode === "ripresa" && st.secondsLeft <= 20) {
      const shake = 0.0015 + (20 - st.secondsLeft) * 0.00022;
      const t = clock.elapsedTime * 31;
      g.position.x += Math.sin(t) * shake;
      g.position.z += Math.cos(t * 1.3) * shake;
    }
  });

  return (
    <group ref={group} visible={false}>
      {/* Hover a hair above the surface so the tip never sinks into it. */}
      {/* Larger than life, like a prop made to read on camera. */}
      <group position={[0, 0.006, 0]} scale={1.7}>
        {shown && model ? model() : null}
      </group>
    </group>
  );
}
