import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { formatClock } from "../logic";
import { colorHex } from "../palette";
import { useGame } from "../store";
import type { Bomb, Module, Vec3, Wire } from "../types";
import {
  BatteryModule,
  CapModule,
  DetonatorModule,
  DialModule,
  HarnessModule,
  KeypadModule,
  LedsModule,
  ReceiverModule,
  TiltModule,
  TimerModule,
} from "./Modules";
import { paint } from "./paint";
import { CASE, ValigettaModel } from "./Valigetta";

function pointOf(bomb: Bomb, id: string, exploded: boolean): THREE.Vector3 | null {
  for (const mod of bomb.modules) {
    const terminal = mod.terminals.find((t) => t.id === id);
    if (!terminal) continue;
    const extra = exploded ? mod.explode : ([0, 0, 0] as Vec3);
    return new THREE.Vector3(
      mod.position[0] + extra[0] + terminal.local[0],
      mod.position[1] + extra[1] + terminal.local[1],
      mod.position[2] + extra[2] + terminal.local[2],
    );
  }
  const chassis = bomb.chassisTerminals.find((t) => t.id === id);
  if (!chassis) return null;
  if (bomb.archetype === "valigetta") {
    const post = id === "sw-a" ? SW_POST.a : SW_POST.b;
    return new THREE.Vector3(post[0], post[1], post[2] + 0.04);
  }
  return new THREE.Vector3(chassis.local[0], chassis.local[1], chassis.local[2]);
}

export function Device() {
  const bomb = useGame((s) => s.bomb);
  if (!bomb) return <Hero />;
  return (
    <Attitude>
      <Chassis />
      {bomb.modules.map((mod) => (
        <ModuleMesh key={mod.id} mod={mod} />
      ))}
      <HarnessWires />
      <UvMark />
    </Attitude>
  );
}

/** Height of the bench group over the room origin. The table top sits at −0.255. */
const TABLE_Y = -0.255;
const BENCH_Y = { valigetta: TABLE_Y - CASE.bottomY, cilindro: -0.08, console: -0.08 } as const;

function Attitude({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const archetype = useGame((s) => s.bomb?.archetype ?? "valigetta");
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const a = useGame.getState().attitude;
    if (!ref.current) return;
    ref.current.rotation.x += (a.x - ref.current.rotation.x) * Math.min(1, d * 8);
    ref.current.rotation.z += (a.z - ref.current.rotation.z) * Math.min(1, d * 8);
  });
  return (
    <group ref={ref} position={[0, BENCH_Y[archetype], 0]}>
      {children}
    </group>
  );
}

function Chassis() {
  const archetype = useGame((s) => s.bomb?.archetype ?? "valigetta");
  const open = useGame((s) => s.lidOpen);
  const xray = useGame((s) => s.xray);
  const dispatch = useGame((s) => s.dispatch);
  if (archetype === "valigetta") {
    const latch = (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      dispatch({ type: "pointer-latch" });
    };
    return (
      <group>
        <ValigettaModel open={open} xray={xray} />
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * CASE.latchX, CASE.wallMidY + 0.06, CASE.frontZ + 0.03]} onClick={latch}>
            <boxGeometry args={[0.22, 0.3, 0.12]} />
            <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
          </mesh>
        ))}
        <Post id="sw-a" position={SW_POST.a} rotation={[Math.PI / 2, 0, 0]} />
        <Post id="sw-b" position={SW_POST.b} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    );
  }
  const shell = archetype === "cilindro" ? "#3c4248" : "#3d4634";
  const opacity = xray ? 0.16 : 1;
  return (
    <group>
      <mesh position={[0, -0.1, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[2.12, 0.26, 1.78]} />
        <meshStandardMaterial
          color={shell}
          roughness={0.62}
          metalness={0.55}
          transparent={xray}
          opacity={opacity}
          depthWrite={!xray}
        />
      </mesh>
      <mesh position={[0, 0.02, -0.02]}>
        <boxGeometry args={[1.92, 0.03, 1.52]} />
        <meshStandardMaterial color="#8a8680" metalness={0.82} roughness={0.32} />
      </mesh>
      {archetype === "cilindro" && (
        <mesh position={[0, -0.28, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 2.2, 24]} />
          <meshStandardMaterial color="#2c3238" metalness={0.7} roughness={0.38} />
        </mesh>
      )}
      {archetype === "console" && (
        <mesh position={[0, -0.02, 0.72]} rotation={[-0.55, 0, 0]} castShadow>
          <boxGeometry args={[2.05, 0.08, 0.42]} />
          <meshStandardMaterial color="#2a3124" metalness={0.4} roughness={0.5} />
        </mesh>
      )}
      <Cover open={open}>
        <mesh position={[-0.9, 0.16, -0.05]} castShadow>
          <boxGeometry args={[0.2, 0.07, 1.48]} />
          <meshStandardMaterial color={xray ? "#d9d3c8" : "#141210"} metalness={0.45} roughness={0.4} transparent={xray} opacity={xray ? 0.12 : 1} depthWrite={!xray} />
        </mesh>
        <mesh position={[0.9, 0.16, -0.05]} castShadow>
          <boxGeometry args={[0.2, 0.07, 1.48]} />
          <meshStandardMaterial color={xray ? "#d9d3c8" : "#141210"} metalness={0.45} roughness={0.4} transparent={xray} opacity={xray ? 0.12 : 1} depthWrite={!xray} />
        </mesh>
        <mesh position={[0, 0.16, -0.7]} castShadow>
          <boxGeometry args={[1.62, 0.07, 0.18]} />
          <meshStandardMaterial color={xray ? "#d9d3c8" : "#141210"} metalness={0.45} roughness={0.4} transparent={xray} opacity={xray ? 0.12 : 1} depthWrite={!xray} />
        </mesh>
        <mesh position={[0, 0.16, 0.58]} castShadow>
          <boxGeometry args={[1.62, 0.07, 0.22]} />
          <meshStandardMaterial color={xray ? "#d9d3c8" : "#141210"} metalness={0.45} roughness={0.4} transparent={xray} opacity={xray ? 0.12 : 1} depthWrite={!xray} />
        </mesh>
        <mesh position={[0, 0.2, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.55, 1.1]} />
          <meshStandardMaterial
            color="#7ec8ea"
            transparent
            opacity={xray ? 0.02 : 0.08}
            roughness={0.05}
            metalness={0.05}
            depthWrite={false}
          />
        </mesh>
        <mesh
          position={[-0.34, 0.22, 0.62]}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "pointer-latch" });
          }}
        >
          <boxGeometry args={[0.22, 0.08, 0.1]} />
          <meshStandardMaterial color="#d5d0c6" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh
          position={[0.34, 0.22, 0.62]}
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "pointer-latch" });
          }}
        >
          <boxGeometry args={[0.22, 0.08, 0.1]} />
          <meshStandardMaterial color="#d5d0c6" metalness={0.85} roughness={0.25} />
        </mesh>
      </Cover>
      <Post id="sw-a" position={[-0.34, 0.1, 0.78]} />
      <Post id="sw-b" position={[0.34, 0.1, 0.78]} />
      <mesh position={[0, 0.08, 0.9]}>
        <boxGeometry args={[0.7, 0.02, 0.18]} />
        <meshStandardMaterial color="#1a1816" />
      </mesh>
    </group>
  );
}

/** Microswitch posts on the case: outside, on the front wall, between plate and catches. */
const SW_POST = {
  a: [-0.545, CASE.wallMidY, CASE.frontZ + 0.04] as Vec3,
  b: [0.545, CASE.wallMidY, CASE.frontZ + 0.04] as Vec3,
};

function Cover({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const anim = useRef(0);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    anim.current += ((open ? 1 : 0) - anim.current) * Math.min(1, d * 4.5);
    if (ref.current) ref.current.rotation.x = -anim.current * 1.95;
  });
  return (
    <group ref={ref} position={[0, 0.04, -0.8]}>
      <group position={[0, 0, 0.8]}>{children}</group>
    </group>
  );
}

function ModuleMesh({ mod }: { mod: Module }) {
  const exploded = useGame((s) => s.exploded);
  const selected = useGame((s) => s.selectedId === mod.id);
  const dispatch = useGame((s) => s.dispatch);
  const pos = mod.position;
  const extra = exploded ? mod.explode : [0, 0, 0];
  const onCase = useGame((s) => s.bomb?.archetype === "valigetta") && mod.kind === "plate";
  // On the case the plate is riveted upright to the front wall instead of lying on the bench.
  const home: Vec3 = onCase ? [0, CASE.wallMidY, CASE.frontZ - 0.018] : pos;
  const at: [number, number, number] = [home[0] + extra[0], home[1] + extra[1], home[2] + extra[2]];
  return (
    <group
      position={at}
      rotation={onCase ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
      scale={onCase ? 0.92 : 1}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "pointer-part", id: mod.id });
      }}
    >
      {mod.kind === "timer" && <TimerModule selected={selected} />}
      {mod.kind === "battery" && <BatteryModule selected={selected} />}
      {mod.kind === "detonator" && <DetonatorModule selected={selected} />}
      {mod.kind === "cap" && <CapModule selected={selected} />}
      {mod.kind === "keypad" && <KeypadModule selected={selected} />}
      {mod.kind === "tilt" && <TiltModule selected={selected} />}
      {mod.kind === "receiver" && <ReceiverModule selected={selected} />}
      {mod.kind === "leds" && <LedsModule selected={selected} />}
      {mod.kind === "dial" && <DialModule selected={selected} />}
      {mod.kind === "plate" && <PlateMesh selected={selected} />}
      {mod.kind === "harness" && <HarnessModule selected={selected} />}
      {mod.terminals.map((t) => (
        <Post key={t.id} id={t.id} position={t.local} />
      ))}
    </group>
  );
}

function Mat({
  color,
  selected,
  rough = 0.42,
  metal = 0.62,
}: {
  color: string;
  selected: boolean;
  rough?: number;
  metal?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={metal}
      emissive={selected ? "#ffb020" : "#000000"}
      emissiveIntensity={selected ? 0.28 : 0}
    />
  );
}

function Post({ id, position, rotation }: { id: string; position: Vec3; rotation?: Vec3 }) {
  const dispatch = useGame((s) => s.dispatch);
  const pending = useGame((s) => s.probeA === id || s.pendingJumper === id);
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "pointer-terminal", id });
      }}
    >
      <cylinderGeometry args={[0.03, 0.034, 0.075, 14]} />
      <meshStandardMaterial
        color={pending ? "#ffb020" : "#e6e0d4"}
        emissive={pending ? "#ffb020" : "#000000"}
        emissiveIntensity={pending ? 0.7 : 0}
        metalness={0.9}
        roughness={0.22}
      />
    </mesh>
  );
}

function PlateMesh({ selected }: { selected: boolean }) {
  const lines = useGame((s) => s.bomb?.plateLines ?? []);
  const map = useMemo(
    () =>
      paint(`plate-${lines.join("|")}`, 512, 256, (ctx) => {
        ctx.fillStyle = "#8a7048";
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = "#1a140e";
        ctx.font = "600 36px sans-serif";
        lines.forEach((line, i) => ctx.fillText(line, 24, 56 + i * 48));
      }),
    [lines],
  );
  return (
    <group>
      <mesh
        castShadow
        position={[0, 0.04, 0]}
        onClick={(e) => {
          e.stopPropagation();
          useGame.getState().dispatch({ type: "pointer-part", id: "plate" });
        }}
      >
        <boxGeometry args={[0.9, 0.04, 0.28]} />
        <Mat color="#8a7048" selected={selected} metal={0.55} rough={0.4} />
      </mesh>
      <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.84, 0.24]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Silk({
  title,
  sub,
  y,
  z = 0,
  w = 0.32,
  h = 0.1,
}: {
  title: string;
  sub: string;
  y: number;
  z?: number;
  w?: number;
  h?: number;
}) {
  const map = useMemo(
    () =>
      paint(`silk-${title}-${sub}`, 256, 96, (ctx) => {
        ctx.clearRect(0, 0, 256, 96);
        ctx.fillStyle = "#141210";
        ctx.fillRect(0, 0, 256, 96);
        ctx.strokeStyle = "#e23b2b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, 250, 90);
        ctx.fillStyle = "#f4efe6";
        ctx.font = "600 32px sans-serif";
        ctx.fillText(title, 14, 42);
        ctx.fillStyle = "#a89884";
        ctx.font = "18px sans-serif";
        ctx.fillText(sub, 14, 72);
      }),
    [title, sub],
  );
  return (
    <mesh position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

function DigitReadout({ text, y, z }: { text: string; y: number; z: number }) {
  const map = useMemo(
    () =>
      paint(`dig-${text}`, 256, 80, (ctx) => {
        ctx.fillStyle = "#100c09";
        ctx.fillRect(0, 0, 256, 80);
        ctx.fillStyle = "#ffb020";
        ctx.font = "600 48px monospace";
        ctx.fillText(text, 16, 56);
      }),
    [text],
  );
  return (
    <mesh position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.16, 0.05]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

function UvMark() {
  const uv = useGame((s) => s.uv);
  const digit = useGame((s) => s.bomb?.uvDigit ?? "");
  const phase = useGame((s) => s.phase);
  const map = useMemo(
    () =>
      paint(`uv-${digit}`, 256, 128, (ctx) => {
        ctx.clearRect(0, 0, 256, 128);
        ctx.fillStyle = "#b388ff";
        ctx.font = "600 84px sans-serif";
        ctx.fillText(digit, 80, 96);
        ctx.font = "20px sans-serif";
        ctx.fillText("I", 24, 40);
      }),
    [digit],
  );
  const onCase = useGame((s) => s.bomb?.archetype === "valigetta");
  if (!uv || phase === "boot") return null;
  return (
    <mesh position={onCase ? [CASE.sideX + 0.012, CASE.wallMidY, -0.2] : [1.08, 0.05, -0.2]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.28, 0.16]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} />
    </mesh>
  );
}

function HarnessWires() {
  const bomb = useGame((s) => s.bomb);
  const cutIds = useGame((s) => s.cutIds);
  const exploded = useGame((s) => s.exploded);
  const unlocked = useGame((s) => s.codeUnlocked);
  const jumpers = useGame((s) => s.jumpers);
  const selected = useGame((s) => s.selectedId);
  const marked = useGame((s) => s.markedIds);
  const dispatch = useGame((s) => s.dispatch);
  const built = useMemo(() => {
    if (!bomb) return [];
    return bomb.wires.flatMap((wire) => {
      const a = pointOf(bomb, wire.a, exploded);
      const b = pointOf(bomb, wire.b, exploded);
      if (!a || !b) return [];
      const cut = cutIds.includes(wire.id);
      const spans = cut
        ? [
            [a, a.clone().lerp(b, 0.38)],
            [b.clone().lerp(a, 0.38), b],
          ]
        : [[a, b]];
      return spans.map((pair, index) => {
        const [p, q] = pair as [THREE.Vector3, THREE.Vector3];
        const mid = p.clone().lerp(q, 0.5);
        mid.y += cut ? 0.05 : 0.18;
        const curve = new THREE.QuadraticBezierCurve3(p, mid, q);
        const visible = new THREE.TubeGeometry(curve, 28, 0.015, 6, false);
        const hit = new THREE.TubeGeometry(curve, 10, 0.05, 5, false);
        return { wire, index, visible, hit, mid: a.clone().lerp(b, 0.5).setY(a.clone().lerp(b, 0.5).y + 0.18) };
      });
    });
  }, [bomb, cutIds, exploded]);

  useEffect(() => {
    return () => {
      for (const item of built) {
        item.visible.dispose();
        item.hit.dispose();
      }
    };
  }, [built]);

  const shield = useMemo(() => {
    if (!bomb || unlocked) return null;
    const wire = bomb.wires.find(
      (w) => w.role === "sicura" && !cutIds.includes(w.id) && (w.a === "det-inhibit" || w.b === "det-inhibit"),
    );
    if (!wire) return null;
    const a = pointOf(bomb, wire.a, exploded);
    const b = pointOf(bomb, wire.b, exploded);
    if (!a || !b) return null;
    const mid = a.clone().lerp(b, 0.55);
    mid.y += 0.12;
    return mid;
  }, [bomb, unlocked, cutIds, exploded]);

  if (!bomb) return null;
  return (
    <group>
      {built.map((item) => (
        <group key={`${item.wire.id}-${item.index}`}>
          <mesh geometry={item.visible} castShadow>
            <meshStandardMaterial
              color={colorHex(item.wire.color)}
              roughness={0.42}
              metalness={0.18}
              emissive={marked.includes(item.wire.id) ? "#e2b43a" : "#000000"}
              emissiveIntensity={marked.includes(item.wire.id) ? 0.55 : 0}
            />
          </mesh>
          <mesh
            geometry={item.hit}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "pointer-wire", id: item.wire.id });
            }}
          >
            <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
          </mesh>
          {selected === item.wire.id && item.index === 0 && (
            <mesh position={item.mid}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color="#ffb020" />
            </mesh>
          )}
          {item.index === 0 && item.wire.diode && !cutIds.includes(item.wire.id) && (
            <DiodeBead bomb={bomb} wire={item.wire} exploded={exploded} />
          )}
        </group>
      ))}
      {shield && (
        <mesh position={shield}>
          <boxGeometry args={[0.12, 0.05, 0.16]} />
          <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.25} />
        </mesh>
      )}
      {jumpers.map((j) => (
        <Jumper key={`${j.a}-${j.b}`} bomb={bomb} a={j.a} b={j.b} exploded={exploded} />
      ))}
    </group>
  );
}

function DiodeBead({ bomb, wire, exploded }: { bomb: Bomb; wire: Wire; exploded: boolean }) {
  const geo = useMemo(() => {
    const pa = pointOf(bomb, wire.a, exploded);
    const pb = pointOf(bomb, wire.b, exploded);
    if (!pa || !pb || !wire.diode) return null;
    const from = wire.diode === "a-b" ? pa : pb;
    const to = wire.diode === "a-b" ? pb : pa;
    const pos = from.clone().lerp(to, 0.66);
    pos.y += 0.16;
    const dir = to.clone().sub(from);
    dir.y += 0.12;
    if (dir.lengthSq() < 1e-8) return null;
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return { pos, q };
  }, [bomb, wire, exploded]);
  if (!geo) return null;
  return (
    <mesh position={geo.pos} quaternion={geo.q}>
      <coneGeometry args={[0.028, 0.07, 7]} />
      <meshStandardMaterial color="#e7d27a" metalness={0.45} roughness={0.32} emissive="#6a5a20" emissiveIntensity={0.4} />
    </mesh>
  );
}

function Jumper({ bomb, a, b, exploded }: { bomb: Bomb; a: string; b: string; exploded: boolean }) {
  const geo = useMemo(() => {
    const pa = pointOf(bomb, a, exploded);
    const pb = pointOf(bomb, b, exploded);
    if (!pa || !pb) return null;
    const mid = pa.clone().lerp(pb, 0.5);
    mid.y += 0.1;
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(pa, mid, pb), 12, 0.01, 5, false);
  }, [bomb, a, b, exploded]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#d6e38a" />
    </mesh>
  );
}

function Hero() {
  return (
    <group position={[0, BENCH_Y.valigetta, 0]}>
      <ValigettaModel open={false} xray={false} />
    </group>
  );
}
