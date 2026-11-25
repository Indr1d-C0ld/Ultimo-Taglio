import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { beep } from "../audio";
import { BEAT, beatCycle, formatClock } from "../logic";
import { useGame } from "../store";
import { createLcd, drawLcd } from "./lcd";
import { paint } from "./paint";
import { glaze, materialsOf, useProp, useSelectionGlow, type Prop } from "./Prop";

const LAMP = /Indicator_Lens|^Lamp_/;

/** Turns a named lens into a lamp the frame loop can drive. */
function useLamp(prop: Prop, pattern: RegExp, color: string): THREE.MeshStandardMaterial[] {
  return useMemo(() => {
    const mats = prop.parts(pattern).flatMap(materialsOf);
    for (const m of mats) {
      m.userData.lamp = true;
      m.emissive = new THREE.Color(color);
      m.emissiveMap = null;
      m.toneMapped = false;
      m.emissiveIntensity = 0.05;
    }
    return mats;
  }, [prop, pattern, color]);
}

/** Flat panel laid just over a part's top face: displays, legends. */
function Face({
  box,
  map,
  inset = 1,
  lift = 0.002,
  glow = 1,
}: {
  box: THREE.Box3;
  map: THREE.Texture;
  inset?: number;
  lift?: number;
  /** Above 1 the panel is brighter than white, which is what makes it bloom like a lit display. */
  glow?: number;
}) {
  const size = box.getSize(new THREE.Vector3());
  const mid = box.getCenter(new THREE.Vector3());
  // Without the bloom pass there is nothing to catch the overshoot: it would just clip to white.
  const level = useGame((s) => (s.effects ? glow : 1));
  return (
    <mesh position={[mid.x, box.max.y + lift, mid.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size.x * inset, size.z * inset]} />
      <meshBasicMaterial map={map} color={[level, level, level]} toneMapped={false} transparent />
    </mesh>
  );
}

export function TimerModule({ selected }: { selected: boolean }) {
  const prop = useProp("timer", 0.78);
  useSelectionGlow(prop, selected, LAMP);
  const lamp = useLamp(prop, /Indicator_Lens/, "#e23b2b");
  const window = useMemo(() => prop.boxOf(prop.parts(/^Display_Window/)[0] ?? prop.object), [prop]);

  const seconds = useGame((s) => s.secondsLeft);
  const dead = useGame((s) => s.displayDead);
  const phase = useGame((s) => s.phase);
  const mode = useGame((s) => s.mode);
  // While the twin counts, this display sits frozen and green: the lie of the false ending.
  const frozen = useGame((s) => s.twinLeft !== null);
  const { canvas, tex } = useMemo(() => createLcd(), []);
  useEffect(() => {
    const tone = dead ? "dead" : phase === "safe" || frozen ? "safe" : mode === "prova" ? "idle" : "arm";
    drawLcd(canvas, phase === "boot" ? "8888" : formatClock(seconds).replace(":", ""), tone);
    tex.needsUpdate = true;
  }, [canvas, tex, seconds, dead, phase, mode, frozen]);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(({ clock }) => {
    const urgent = phase === "play" && mode === "ripresa" && seconds <= 15;
    const level = phase === "safe" ? 0.15 : 0.9 + Math.sin(clock.elapsedTime * (urgent ? 10 : 2.4)) * 0.8;
    for (const m of lamp) m.emissiveIntensity = Math.max(0.05, level);
  });

  return (
    <group>
      <primitive object={prop.object} />
      <Face box={window} map={tex} inset={0.96} glow={2.4} />
    </group>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];

function legend(key: string) {
  return paint(`key-${key}`, 128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = key === "OK" ? "#f4efe6" : "#d8d2c6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${key.length > 1 ? 52 : 72}px "IBM Plex Mono", monospace`;
    ctx.fillText(key, 64, 68);
  });
}

function readout(text: string) {
  return paint(`pad-${text}`, 512, 64, (ctx) => {
    ctx.fillStyle = "#100c09";
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = "#ffb020";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '600 46px "IBM Plex Mono", monospace';
    ctx.fillText(text.split("").join(" "), 256, 34);
  });
}

export function KeypadModule({ selected }: { selected: boolean }) {
  const prop = useProp("tastierino", 0.46);
  useSelectionGlow(prop, selected);
  const dispatch = useGame((s) => s.dispatch);
  const entry = useGame((s) => s.keypad);
  const unlocked = useGame((s) => s.codeUnlocked);

  // Read the grid off the model: rows run back to front, away from the display strip.
  const keys = useMemo(() => {
    const found = prop.parts(/^Key_\d+/).map((node) => ({ node, box: prop.boxOf(node), rest: node.position.y }));
    const rows = [...found].sort((a, b) => a.box.min.z - b.box.min.z);
    const grid: typeof found = [];
    for (let r = 0; r < 4; r++) grid.push(...rows.slice(r * 3, r * 3 + 3).sort((a, b) => a.box.min.x - b.box.min.x));
    return grid.map((k, i) => ({ ...k, key: KEYS[i]! }));
  }, [prop]);
  const window = useMemo(() => prop.boxOf(prop.parts(/^Display_Window/)[0] ?? prop.object), [prop]);

  const pressed = useRef(new Map<string, number>());
  useFrame(() => {
    const now = performance.now() / 1000;
    for (const k of keys) {
      const since = now - (pressed.current.get(k.key) ?? -1);
      const dip = since < 0.14 ? Math.sin((since / 0.14) * Math.PI) * 0.012 : 0;
      k.node.position.y = k.rest - dip / prop.unit;
    }
  });

  return (
    <group>
      <primitive object={prop.object} />
      {keys.map((k) => {
        const size = k.box.getSize(new THREE.Vector3());
        const mid = k.box.getCenter(new THREE.Vector3());
        return (
          <group key={k.key}>
            <Face box={k.box} map={legend(k.key)} inset={0.62} lift={0.0015} />
            <mesh
              position={[mid.x, mid.y, mid.z]}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                pressed.current.set(k.key, performance.now() / 1000);
                dispatch({ type: "keypad", key: k.key });
              }}
            >
              <boxGeometry args={[size.x, size.y + 0.02, size.z]} />
              <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
      <Face box={window} map={readout(unlocked ? "APERTO" : entry.padEnd(4, "·"))} glow={1.8} />
    </group>
  );
}

export function BatteryModule({ selected }: { selected: boolean }) {
  const prop = useProp("cella", 0.46);
  useSelectionGlow(prop, selected);
  return <primitive object={prop.object} />;
}

export function DetonatorModule({ selected }: { selected: boolean }) {
  const prop = useProp("innesco", 0.42);
  useSelectionGlow(prop, selected, /Sight_Glass|Indicator_Lens/);
  const lamp = useLamp(prop, /Indicator_Lens/, "#7dce6a");
  const tube = useMemo(() => {
    const glass = prop.parts(/^Sight_Glass/)[0];
    if (glass) glaze(glass);
    return prop.boxOf(glass ?? prop.object);
  }, [prop]);
  const mid = tube.getCenter(new THREE.Vector3());
  const span = tube.getSize(new THREE.Vector3());

  const filament = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const st = useGame.getState();
    const heat = st.phase === "play" ? st.bridge : st.phase === "boom" ? 1 : 0;
    const pulse = st.bridgeHot ? 0.82 + Math.sin(clock.elapsedTime * 14) * 0.18 : 1;
    if (filament.current) {
      filament.current.emissiveIntensity = (0.15 + heat * 3.4) * pulse;
      filament.current.emissive.set(heat > 0.55 ? "#ff2a1a" : "#ffb020");
    }
    const held = st.phase === "play" && !st.bridgeHot;
    const level = held ? 1.6 : st.bridgeHot ? (Math.sin(clock.elapsedTime * 18) > 0 ? 1.8 : 0.15) : 0.05;
    for (const m of lamp) m.emissiveIntensity = level;
    if (glow.current) glow.current.intensity = heat * pulse * 2.2;
  });

  return (
    <group>
      <primitive object={prop.object} />
      {/* The bridge: a filament strung along the axis of the sight glass. */}
      <mesh position={mid} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, span.x * 0.92, 8]} />
        <meshStandardMaterial ref={filament} color="#3a2418" emissive="#ffb020" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[mid.x + side * span.x * 0.46, mid.y, mid.z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, 0.012, 12]} />
          <meshStandardMaterial color="#b9b2a4" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <pointLight ref={glow} position={[mid.x, mid.y + 0.06, mid.z]} color="#ff6a2a" intensity={0.3} distance={1.4} />
    </group>
  );
}

export function CapModule({ selected }: { selected: boolean }) {
  const prop = useProp("condensatore", 0.46);
  useSelectionGlow(prop, selected, LAMP);
  const lamp = useLamp(prop, /Indicator_Lens/, "#ffb020");
  const dumped = useGame((s) => s.capDumped);
  useFrame(({ clock }) => {
    // Charged: a slow breathing glow. Dumped: dark.
    const level = dumped ? 0.02 : 1.3 + Math.sin(clock.elapsedTime * 3) * 0.35;
    for (const m of lamp) m.emissiveIntensity = level;
  });
  return <primitive object={prop.object} />;
}

export function ReceiverModule({ selected }: { selected: boolean }) {
  const prop = useProp("ricevitore", 0.38);
  useSelectionGlow(prop, selected, LAMP);
  const lamp = useLamp(prop, /Indicator_Lens/, "#ffb020");
  const beats = useGame((s) => Number(s.bomb?.code[2] ?? 3));
  const listening = useGame((s) => s.listenKind === "receiver" && s.listenLeft > 0);
  const since = useRef(0);
  const last = useRef(-1);
  useEffect(() => {
    since.current = performance.now() / 1000;
    last.current = -1;
  }, [listening]);
  useFrame(() => {
    // Silent and dark until the stethoscope is on it. Then: `beats` pulses, a pause, and again.
    let on = false;
    if (listening) {
      const t = (performance.now() / 1000 - since.current - 0.5) % beatCycle(beats);
      const index = Math.floor(t / BEAT);
      on = t >= 0 && index < beats && t % BEAT < 0.14;
      const stamp = Math.floor((performance.now() / 1000 - since.current - 0.5) / beatCycle(beats)) * 100 + index;
      if (on && stamp !== last.current) {
        last.current = stamp;
        beep(330);
      }
    }
    for (const m of lamp) m.emissiveIntensity = on ? 2.8 : 0.04;
  });
  return <primitive object={prop.object} />;
}

export function LedsModule({ selected }: { selected: boolean }) {
  const prop = useProp("lampade", 0.62);
  useSelectionGlow(prop, selected, LAMP);
  const count = useGame((s) => s.bomb?.ledBlink ?? 4);
  const blind = useGame((s) => s.ledsBlind);
  const lamps = useMemo(() => {
    const found = prop
      .parts(/^Lamp_\d+/)
      .map((node) => ({ node, x: prop.boxOf(node).min.x }))
      .sort((a, b) => a.x - b.x);
    return found.map(({ node }) => {
      const mats = materialsOf(node);
      for (const m of mats) {
        m.userData.lamp = true;
        m.emissive = new THREE.Color("#d6e38a");
        m.emissiveMap = null;
        m.toneMapped = false;
      }
      return mats;
    });
  }, [prop]);
  useFrame(({ clock }) => {
    const slot = 0.18;
    const t = clock.elapsedTime % (slot * count + 0.45);
    const index = Math.floor(t / slot);
    lamps.forEach((mats, i) => {
      const on = !blind && index < count && i === index % lamps.length && t % slot < 0.1;
      for (const m of mats) m.emissiveIntensity = on ? 2.4 : 0.03;
    });
  });
  return <primitive object={prop.object} />;
}

export function TiltModule({ selected }: { selected: boolean }) {
  const prop = useProp("grano", 0.42);
  useSelectionGlow(prop, selected, /Glass_Tube/);
  const dispatch = useGame((s) => s.dispatch);
  const locked = useGame((s) => s.tiltLocked);
  const { tube, screw, screwNode } = useMemo(() => {
    const glass = prop.parts(/^Glass_Tube/)[0];
    if (glass) glaze(glass, 0.28);
    const screwNode = prop.parts(/^Lock_Screw/)[0] ?? null;
    return { tube: prop.boxOf(glass ?? prop.object), screw: prop.boxOf(screwNode ?? prop.object), screwNode };
  }, [prop]);
  const mid = tube.getCenter(new THREE.Vector3());
  const span = tube.getSize(new THREE.Vector3());
  const reach = span.x / 2 - 0.05;
  const bead = useRef<THREE.Mesh>(null);
  const turn = useRef(0);
  useFrame((_, delta) => {
    const a = useGame.getState().attitude;
    // Rolls to the low end; a locked grain stays put.
    if (bead.current) bead.current.position.x = mid.x + (locked ? 0 : THREE.MathUtils.clamp(a.z * 0.6, -reach, reach));
    if (screwNode) {
      turn.current += ((locked ? 1 : 0) - turn.current) * Math.min(1, delta * 6);
      screwNode.rotation.y = turn.current * Math.PI * 1.5;
    }
  });
  const screwMid = screw.getCenter(new THREE.Vector3());
  const screwSize = screw.getSize(new THREE.Vector3());
  return (
    <group>
      <primitive object={prop.object} />
      <mesh ref={bead} position={mid} castShadow>
        <sphereGeometry args={[Math.min(span.y, span.z) * 0.36, 16, 16]} />
        <meshStandardMaterial color="#d9d3c6" metalness={0.9} roughness={0.18} />
      </mesh>
      <mesh
        position={screwMid}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          dispatch({ type: "pointer-tilt" });
        }}
      >
        <boxGeometry args={[screwSize.x + 0.03, screwSize.y + 0.03, screwSize.z + 0.03]} />
        <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
      </mesh>
    </group>
  );
}

function digit(text: string) {
  return paint(`wheel-${text}`, 96, 96, (ctx) => {
    ctx.fillStyle = "#100c09";
    ctx.fillRect(0, 0, 96, 96);
    ctx.fillStyle = "#f4efe6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '600 72px "IBM Plex Mono", monospace';
    ctx.fillText(text, 48, 52);
  });
}

export function DialModule({ selected }: { selected: boolean }) {
  const prop = useProp("contatore", 0.5);
  useSelectionGlow(prop, selected);
  const digits = useGame((s) => s.dialDigits);
  const dispatch = useGame((s) => s.dispatch);
  const { wheels, windows } = useMemo(() => {
    const byX = (pattern: RegExp) =>
      prop
        .parts(pattern)
        .map((node) => ({ node, box: prop.boxOf(node) }))
        .sort((a, b) => a.box.min.x - b.box.min.x);
    return { wheels: byX(/^Wheel_\d+/), windows: byX(/^Digit_Window_\d+/) };
  }, [prop]);
  const spin = useRef([0, 0, 0]);
  const steps = useRef([0, 0, 0]);
  useFrame((_, delta) => {
    wheels.forEach((w, i) => {
      const target = (steps.current[i] ?? 0) * (Math.PI / 5);
      spin.current[i]! += (target - spin.current[i]!) * Math.min(1, delta * 10);
      w.node.rotation.x = spin.current[i]!;
    });
  });
  return (
    <group>
      <primitive object={prop.object} />
      {windows.map((w, i) => (
        <Face key={i} box={w.box} map={digit(String(digits[i] ?? 0))} inset={0.86} lift={-w.box.getSize(new THREE.Vector3()).y * 0.5} />
      ))}
      {wheels.map((w, i) => {
        const mid = w.box.getCenter(new THREE.Vector3());
        const size = w.box.getSize(new THREE.Vector3());
        const roll = (dir: 1 | -1) => (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
          steps.current[i]! += dir;
          dispatch({ type: "dial", index: i as 0 | 1 | 2, dir });
        };
        return (
          // Click rolls a wheel forward, right click rolls it back.
          <mesh key={i} position={mid} onClick={roll(1)} onContextMenu={roll(-1)}>
            <boxGeometry args={[size.x + 0.02, size.y, size.z]} />
            <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

export function HarnessModule({ selected }: { selected: boolean }) {
  const prop = useProp("morsettiera", 1.15);
  useSelectionGlow(prop, selected);
  return <primitive object={prop.object} />;
}
