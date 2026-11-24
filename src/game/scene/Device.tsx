import { Billboard } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { colorHex, terminalLabel } from "../palette";
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
import { touch } from "./Hand";
import { paint } from "./paint";
import { SHELLS, ShellModel, type ShellFit } from "./Shell";

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
  const shell = SHELLS[bomb.archetype];
  if (shell) {
    // Where a clip or a probe meets the post: its free end, top or front.
    const post = swPost(shell, id === "sw-a" ? -1 : 1);
    return shell.posts.upright
      ? new THREE.Vector3(post[0], post[1] + 0.03, post[2])
      : new THREE.Vector3(post[0], post[1], post[2] + 0.04);
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
      <Planted />
      <UvMark />
    </Attitude>
  );
}

/** Height of the bench group over the room origin. The table top sits at −0.255. */
const TABLE_Y = -0.255;
/** A generated shell rests its underside on the table; the old boxes keep the height they were drawn for. */
export function benchY(archetype: Bomb["archetype"]): number {
  const shell = SHELLS[archetype];
  if (!shell) return -0.08;
  const resting = TABLE_Y - shell.bottomY;
  // A tall shell would lift the deck out of the camera's reach: keep the deck where it
  // always is and let the room come down to meet the shell instead (see roomDrop).
  return resting > 0.15 ? -0.08 : resting;
}

/** How far the room sits below its usual height so that the table still touches the shell. */
export function roomDrop(archetype: Bomb["archetype"]): number {
  const shell = SHELLS[archetype];
  return shell ? benchY(archetype) + shell.bottomY - TABLE_Y : 0;
}

/** Microswitch posts on a shell: outside, on the front band, between plate and catches. */
function swPost(shell: ShellFit, side: 1 | -1): Vec3 {
  return [side * shell.posts.x, shell.posts.y, shell.posts.z];
}

/** Where a module sits on the bench, in bench space. */
function moduleHome(bomb: Bomb, mod: Module, exploded: boolean): Vec3 {
  const shell = SHELLS[bomb.archetype];
  // Each shell says where its plate goes: riveted to a wall, hung from a flange, laid on a shelf.
  const home: Vec3 = mod.kind === "plate" && shell ? shell.plate.position : mod.position;
  const extra = exploded ? mod.explode : [0, 0, 0];
  return [home[0] + extra[0]!, home[1] + extra[1]!, home[2] + extra[2]!];
}

/** The point the camera should look at to inspect a module, in room space. */
export function inspectPoint(bomb: Bomb, id: string, exploded: boolean): THREE.Vector3 | null {
  const mod = bomb.modules.find((m) => m.id === id);
  if (!mod) return null;
  const at = moduleHome(bomb, mod, exploded);
  return new THREE.Vector3(at[0], at[1] + benchY(bomb.archetype) + 0.08, at[2]);
}

/** Pointer handlers that report what is under the cursor and show a hand over it. */
function hoverHandlers(id: string) {
  return {
    // Entering stops the event so only the nearest part reads as hovered; that also keeps it from
    // the set's own tracker, so the hand is told here where the tool tip is.
    onPointerMove: (e: ThreeEvent<PointerEvent>) => touch(e.point),
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      touch(e.point);
      e.stopPropagation();
      useGame.getState().setHover(id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      if (useGame.getState().hoverId === id) useGame.getState().setHover(null);
      document.body.style.cursor = "";
    },
  };
}

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
    <group ref={ref} position={[0, benchY(archetype), 0]}>
      {children}
    </group>
  );
}

function Chassis() {
  const archetype = useGame((s) => s.bomb?.archetype ?? "valigetta");
  const open = useGame((s) => s.lidOpen);
  const xray = useGame((s) => s.xray);
  const dispatch = useGame((s) => s.dispatch);
  const fitted = SHELLS[archetype];
  if (fitted) {
    const latch = (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      dispatch({ type: "pointer-latch" });
    };
    return (
      <group>
        <ShellModel fit={fitted} open={open} xray={xray} />
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * fitted.latch.x, fitted.latch.y, fitted.latch.z]} onClick={latch}>
            <boxGeometry args={[0.22, 0.3, 0.12]} />
            <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
          </mesh>
        ))}
        <Post id="sw-a" position={swPost(fitted, -1)} rotation={fitted.posts.upright ? undefined : [Math.PI / 2, 0, 0]} owner="chassis" />
        <Post id="sw-b" position={swPost(fitted, 1)} rotation={fitted.posts.upright ? undefined : [Math.PI / 2, 0, 0]} owner="chassis" />
      </group>
    );
  }
  // Every carriage has a generated shell now; this is only reached if a file is missing from the specs.
  return null;
}

function ModuleMesh({ mod }: { mod: Module }) {
  const bomb = useGame((s) => s.bomb);
  const exploded = useGame((s) => s.exploded);
  const selected = useGame((s) => s.selectedId === mod.id);
  const dispatch = useGame((s) => s.dispatch);
  if (!bomb) return null;
  const upright = mod.kind === "plate" && !!SHELLS[bomb.archetype]?.plate.upright;
  return (
    <group
      position={moduleHome(bomb, mod, exploded)}
      rotation={upright ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
      scale={upright ? 0.92 : 1}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "pointer-part", id: mod.id });
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useGame.getState().setInspect(mod.id);
      }}
      {...hoverHandlers(`m:${mod.id}`)}
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
        <Post key={t.id} id={t.id} position={t.local} owner={mod.id} />
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

function Post({ id, position, rotation, owner }: { id: string; position: Vec3; rotation?: Vec3; owner?: string }) {
  const dispatch = useGame((s) => s.dispatch);
  const pending = useGame((s) => s.probeA === id || s.pendingJumper === id);
  const hovered = useGame((s) => s.hoverId === `t:${id}`);
  // Lit when the pointer is on a wire that lands here: the wire shows where it goes.
  const wired = useGame((s) => {
    const key = s.hoverId?.startsWith("w:") ? s.hoverId.slice(2) : s.selectedId;
    const wire = key ? s.bomb?.wires.find((w) => w.id === key) : undefined;
    return !!wire && (wire.a === id || wire.b === id);
  });
  const named = useGame((s) => !!owner && s.inspectId === owner);
  const lit = pending || hovered || wired;
  const tone = pending ? "#ffb020" : hovered ? "#fff2c4" : "#ffd27a";
  return (
    <group position={position}>
      <mesh
        rotation={rotation}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: "pointer-terminal", id });
        }}
        {...hoverHandlers(`t:${id}`)}
      >
        <cylinderGeometry args={[0.03, 0.034, 0.075, 14]} />
        <meshStandardMaterial
          color={lit ? tone : "#e6e0d4"}
          emissive={lit ? tone : "#000000"}
          emissiveIntensity={pending ? 0.7 : lit ? 0.45 : 0}
          metalness={0.9}
          roughness={0.22}
        />
      </mesh>
      {(lit || named) && <Tag text={terminalLabel(id)} />}
    </group>
  );
}

/** A small name plate that always faces the camera and is never hidden behind a part. */
function Tag({ text }: { text: string }) {
  const width = Math.max(0.09, text.length * 0.0175 + 0.03);
  const map = useMemo(
    () =>
      paint(`tag-${text}`, 512, 96, (ctx) => {
        ctx.fillStyle = "rgba(16,14,12,0.92)";
        ctx.fillRect(0, 0, 512, 96);
        ctx.strokeStyle = "#ffb020";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 508, 92);
        ctx.fillStyle = "#f4efe6";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '600 52px "IBM Plex Mono", monospace';
        ctx.fillText(text, 256, 52, 480);
      }),
    [text],
  );
  return (
    <Billboard position={[0, 0.085, 0]}>
      <mesh renderOrder={20}>
        <planeGeometry args={[width, 0.034]} />
        <meshBasicMaterial map={map} toneMapped={false} transparent depthTest={false} />
      </mesh>
    </Billboard>
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

/** Where the UV digit is painted: right wall, left wall, back wall, deck by the catches. */
function uvPlaces(shell: ShellFit | undefined): { position: Vec3; rotation: Vec3 }[] {
  if (!shell) {
    return [
      { position: [1.072, -0.08, -0.2], rotation: [0, Math.PI / 2, 0] },
      { position: [-1.072, -0.08, 0.2], rotation: [0, -Math.PI / 2, 0] },
      { position: [0.62, -0.08, -0.922], rotation: [0, Math.PI, 0] },
      { position: [0.5, 0.04, 0.66], rotation: [-Math.PI / 2, 0, 0] },
    ];
  }
  const deck = { position: [0.36, 0.034, 0.7] as Vec3, rotation: [-Math.PI / 2, 0, 0] as Vec3 };
  if (shell.uv) return [...shell.uv, deck];
  return [
    { position: [shell.sideX + 0.012, shell.wallMidY, -0.2], rotation: [0, Math.PI / 2, 0] },
    { position: [-shell.sideX - 0.012, shell.wallMidY, 0.2], rotation: [0, -Math.PI / 2, 0] },
    { position: [0.62, shell.wallMidY, shell.backZ - 0.012], rotation: [0, Math.PI, 0] },
    deck,
  ];
}

/** Invisible in stage light. Under the UV lamp it glows, on whichever face this scene put it. */
function UvMark() {
  const uv = useGame((s) => s.uv);
  const digit = useGame((s) => s.bomb?.uvDigit ?? "");
  const spot = useGame((s) => s.bomb?.uvSpot ?? 0);
  const phase = useGame((s) => s.phase);
  const map = useMemo(
    () =>
      paint(`uv-${digit}`, 256, 128, (ctx) => {
        ctx.clearRect(0, 0, 256, 128);
        ctx.fillStyle = "#c9a6ff";
        ctx.textBaseline = "middle";
        ctx.font = '600 92px "IBM Plex Mono", monospace';
        ctx.fillText(digit, 96, 68);
        ctx.font = '600 30px "IBM Plex Mono", monospace';
        ctx.fillText("I", 28, 68);
        ctx.strokeStyle = "#c9a6ff";
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, 236, 108);
      }),
    [digit],
  );
  const archetype = useGame((s) => s.bomb?.archetype ?? "valigetta");
  if (!uv || phase === "boot") return null;
  const places = uvPlaces(SHELLS[archetype]);
  const place = places[spot % places.length]!;
  return (
    <mesh position={place.position} rotation={place.rotation}>
      <planeGeometry args={[0.26, 0.13]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} />
    </mesh>
  );
}

/** The first probe, or the first crocodile clip, stays on its post while the hand goes for the second. */
function Planted() {
  const bomb = useGame((s) => s.bomb);
  const exploded = useGame((s) => s.exploded);
  const probe = useGame((s) => s.probeA);
  const clip = useGame((s) => s.pendingJumper);
  const id = probe ?? clip;
  const at = bomb && id ? pointOf(bomb, id, exploded) : null;
  if (!at) return null;
  return (
    <group position={[at.x, at.y + 0.04, at.z]} rotation={[0.25, 0, -0.35]}>
      <mesh position={[0, 0.03, 0]}>
        <coneGeometry args={[0.004, 0.06, 10]} />
        <meshStandardMaterial color="#c9c6bf" metalness={0.92} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <capsuleGeometry args={[0.01, 0.14, 6, 12]} />
        <meshStandardMaterial color={probe ? "#1d1b19" : "#c9d46a"} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** A short burst of sparks where the cutters closed. Plays once, when the cut wire first appears. */
function Sparks({ at }: { at: THREE.Vector3 }) {
  const group = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const bits = useMemo(
    () =>
      Array.from({ length: 14 }, () => ({
        v: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.25, Math.random() - 0.5).multiplyScalar(0.9),
      })),
    [],
  );
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    born.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    g.visible = t < 0.55;
    if (!g.visible) return;
    g.children.forEach((child, i) => {
      const v = bits[i]!.v;
      child.position.set(v.x * t, v.y * t - 2.2 * t * t, v.z * t);
      child.scale.setScalar(Math.max(0.05, 1 - t / 0.55));
    });
  });
  return (
    <group ref={group} position={at}>
      {bits.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.006, 6, 6]} />
          <meshBasicMaterial color={[6, 3.6, 1.2]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A wire rises off its terminal, runs level over the modules and drops onto the other one,
 * instead of cutting straight through whatever stands in between. `lane` spreads wires
 * that would otherwise lie on top of each other.
 */
function wirePath(a: THREE.Vector3, b: THREE.Vector3, lane: number): THREE.CatmullRomCurve3 {
  const span = a.distanceTo(b);
  const top = span < 0.25 ? Math.max(a.y, b.y) + 0.05 + span * 0.25 : Math.max(a.y, b.y, 0.19) + 0.04 + lane * 0.009;
  const side = new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar((lane - 1.5) * 0.014);
  const at = (t: number) => a.clone().lerp(b, t).add(side).setY(top);
  const lift = (p: THREE.Vector3) => p.clone().setY(p.y + (top - p.y) * 0.6);
  return new THREE.CatmullRomCurve3([a, lift(a), at(0.22), at(0.5), at(0.78), lift(b), b], false, "catmullrom", 0.35);
}

/** One loose end of a cut wire: the stretch of the path from `from` to `to`, sagging toward the cut. */
function stub(path: THREE.CatmullRomCurve3, from: number, to: number): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    const p = path.getPoint(from + (to - from) * k);
    p.y -= k * k * 0.07;
    points.push(p);
  }
  return new THREE.CatmullRomCurve3(points);
}

function HarnessWires() {
  const bomb = useGame((s) => s.bomb);
  const cutIds = useGame((s) => s.cutIds);
  const exploded = useGame((s) => s.exploded);
  const unlocked = useGame((s) => s.codeUnlocked);
  const jumpers = useGame((s) => s.jumpers);
  const selected = useGame((s) => s.selectedId);
  const hovered = useGame((s) => (s.hoverId?.startsWith("w:") ? s.hoverId.slice(2) : null));
  const marked = useGame((s) => s.markedIds);
  const dispatch = useGame((s) => s.dispatch);
  const built = useMemo(() => {
    if (!bomb) return [];
    return bomb.wires.flatMap((wire, n) => {
      const a = pointOf(bomb, wire.a, exploded);
      const b = pointOf(bomb, wire.b, exploded);
      if (!a || !b) return [];
      const path = wirePath(a, b, n % 4);
      const cut = cutIds.includes(wire.id);
      const curves = cut ? [stub(path, 0, 0.4), stub(path, 1, 0.6)] : [path];
      return curves.map((curve, index) => ({
        wire,
        index,
        cut,
        path,
        visible: new THREE.TubeGeometry(curve, cut ? 16 : 48, 0.013, 8, false),
        hit: new THREE.TubeGeometry(curve, cut ? 8 : 20, 0.045, 5, false),
      }));
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

  if (!bomb) return null;
  const guarded = unlocked
    ? undefined
    : built.find((item) => item.wire.role === "sicura" && !item.cut && (item.wire.a === "det-inhibit" || item.wire.b === "det-inhibit"));
  return (
    <group>
      {built.map((item) => {
        const id = item.wire.id;
        const tape = marked.includes(id);
        const lit = hovered === id || selected === id;
        return (
          <group key={`${id}-${item.index}`}>
            <mesh geometry={item.visible} castShadow>
              <meshStandardMaterial
                color={colorHex(item.wire.color)}
                roughness={0.42}
                metalness={0.18}
                emissive={lit ? colorHex(item.wire.color) : tape ? "#e2b43a" : "#000000"}
                emissiveIntensity={lit ? 0.9 : tape ? 0.55 : 0}
              />
            </mesh>
            <mesh
              geometry={item.hit}
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "pointer-wire", id });
              }}
              {...hoverHandlers(`w:${id}`)}
            >
              <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
            </mesh>
            {tape && item.index === 0 && (
              <mesh position={item.path.getPoint(item.cut ? 0.2 : 0.5)}>
                <sphereGeometry args={[0.022, 10, 10]} />
                <meshStandardMaterial color="#e2b43a" roughness={0.7} />
              </mesh>
            )}
            {item.index === 0 && item.wire.diode && !item.cut && <DiodeBead wire={item.wire} path={item.path} />}
            {item.index === 0 && item.cut && <Sparks at={item.path.getPoint(0.5)} />}
          </group>
        );
      })}
      {guarded && (
        <mesh position={guarded.path.getPoint(0.5)}>
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

/** One-way bead threaded on the wire, its point showing the way current may go. */
function DiodeBead({ wire, path }: { wire: Wire; path: THREE.CatmullRomCurve3 }) {
  const forward = wire.diode === "a-b";
  const t = forward ? 0.62 : 0.38;
  const dir = path.getTangent(t);
  if (!forward) dir.negate();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <mesh position={path.getPoint(t)} quaternion={q}>
      <coneGeometry args={[0.026, 0.065, 9]} />
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
    <group position={[0, benchY("valigetta"), 0]}>
      <ShellModel fit={SHELLS.valigetta!} open={false} xray={false} />
    </group>
  );
}
