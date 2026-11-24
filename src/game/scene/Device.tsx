import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { formatClock } from "../logic";
import { colorHex } from "../palette";
import { useGame } from "../store";
import type { Bomb, Module, Vec3, Wire } from "../types";
import { createLcd, drawLcd } from "./lcd";

const texCache = new Map<string, THREE.CanvasTexture>();

function paint(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

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

function Attitude({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const a = useGame.getState().attitude;
    if (!ref.current) return;
    ref.current.rotation.x += (a.x - ref.current.rotation.x) * Math.min(1, d * 8);
    ref.current.rotation.z += (a.z - ref.current.rotation.z) * Math.min(1, d * 8);
  });
  return (
    <group ref={ref} position={[0, -0.08, 0]}>
      {children}
    </group>
  );
}

function Chassis() {
  const archetype = useGame((s) => s.bomb?.archetype ?? "valigetta");
  const open = useGame((s) => s.lidOpen);
  const xray = useGame((s) => s.xray);
  const dispatch = useGame((s) => s.dispatch);
  const shell = archetype === "valigetta" ? "#4a1e22" : archetype === "cilindro" ? "#3c4248" : "#3d4634";
  const opacity = xray ? 0.16 : 1;
  return (
    <group>
      <mesh position={[0, -0.1, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[2.12, 0.26, 1.78]} />
        <meshStandardMaterial
          color={shell}
          roughness={0.62}
          metalness={archetype === "valigetta" ? 0.18 : 0.55}
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
      {archetype === "valigetta" && (
        <mesh position={[0, 0.18, -0.86]} castShadow>
          <torusGeometry args={[0.16, 0.028, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#c8c0b2" metalness={0.8} roughness={0.3} />
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
  const at: [number, number, number] = [pos[0] + extra[0], pos[1] + extra[1], pos[2] + extra[2]];
  return (
    <group
      position={at}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "pointer-part", id: mod.id });
      }}
    >
      {mod.kind === "timer" && <TimerMesh selected={selected} />}
      {mod.kind === "battery" && <BatteryMesh selected={selected} />}
      {mod.kind === "detonator" && <DetonatorMesh selected={selected} />}
      {mod.kind === "cap" && <CapMesh selected={selected} />}
      {mod.kind === "keypad" && <KeypadMesh selected={selected} />}
      {mod.kind === "tilt" && <TiltMesh selected={selected} />}
      {mod.kind === "receiver" && <ReceiverMesh selected={selected} />}
      {mod.kind === "leds" && <LedsMesh selected={selected} />}
      {mod.kind === "dial" && <DialMesh selected={selected} />}
      {mod.kind === "plate" && <PlateMesh selected={selected} />}
      {mod.kind === "harness" && <HarnessMesh selected={selected} />}
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

function Post({ id, position }: { id: string; position: Vec3 }) {
  const dispatch = useGame((s) => s.dispatch);
  const pending = useGame((s) => s.probeA === id || s.pendingJumper === id);
  return (
    <mesh
      position={position}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "pointer-terminal", id });
      }}
    >
      <cylinderGeometry args={[0.045, 0.05, 0.09, 12]} />
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

function TimerMesh({ selected }: { selected: boolean }) {
  const seconds = useGame((s) => s.secondsLeft);
  const dead = useGame((s) => s.displayDead);
  const phase = useGame((s) => s.phase);
  const mode = useGame((s) => s.mode);
  const { canvas, tex } = useMemo(() => createLcd(), []);
  const text =
    phase === "boot" || seconds <= 0
      ? "8888"
      : `${String(Math.floor(Math.max(0, Math.ceil(seconds)) / 60)).padStart(2, "0")}${String(
          Math.max(0, Math.ceil(seconds)) % 60,
        ).padStart(2, "0")}`;
  useEffect(() => {
    const tone = dead ? "dead" : phase === "safe" ? "safe" : mode === "prova" ? "idle" : "arm";
    drawLcd(canvas, phase === "boot" ? "8888" : formatClock(seconds).replace(":", ""), tone);
    tex.needsUpdate = true;
  }, [canvas, tex, seconds, dead, phase, mode]);
  useEffect(() => () => tex.dispose(), [tex]);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!led.current) return;
    const urgent = phase === "play" && mode === "ripresa" && seconds <= 15;
    const speed = urgent ? 10 : 2.4;
    led.current.emissiveIntensity = phase === "safe" ? 0.15 : 0.35 + Math.sin(clock.elapsedTime * speed) * 0.35;
  });
  return (
    <group>
      <mesh castShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[0.78, 0.16, 0.42]} />
        <Mat color="#161412" selected={selected} metal={0.4} rough={0.5} />
      </mesh>
      <mesh position={[0, 0.17, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.52, 0.2]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[-0.3, 0.17, 0.14]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshStandardMaterial ref={led} color="#3a1010" emissive="#e23b2b" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      <Silk title="TEMPO" sub="LCD DI SCENA" y={0.175} z={-0.14} w={0.28} h={0.08} />
    </group>
  );
}

function BatteryMesh({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.09, 0]}>
        <boxGeometry args={[0.46, 0.18, 0.28]} />
        <Mat color="#1e2420" selected={selected} />
      </mesh>
      <mesh position={[0, 0.09, 0.145]}>
        <boxGeometry args={[0.36, 0.1, 0.01]} />
        <meshStandardMaterial color="#d6e38a" />
      </mesh>
      <mesh position={[0.08, 0.09, 0.15]}>
        <boxGeometry args={[0.08, 0.1, 0.012]} />
        <meshStandardMaterial color="#1e2420" />
      </mesh>
      <Silk title="CELLA" sub="PALCO 9V" y={0.19} />
    </group>
  );
}

function DetonatorMesh({ selected }: { selected: boolean }) {
  const filament = useRef<THREE.MeshStandardMaterial>(null);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.PointLight>(null);
  const xray = useGame((s) => s.xray);
  useFrame(({ clock }) => {
    const st = useGame.getState();
    const heat = st.phase === "play" ? st.bridge : st.phase === "boom" ? 1 : 0;
    const pulse = st.bridgeHot ? 0.82 + Math.sin(clock.elapsedTime * 14) * 0.18 : 1;
    if (filament.current) {
      filament.current.emissiveIntensity = (0.15 + heat * 3.4) * pulse;
      filament.current.emissive.set(heat > 0.55 ? "#ff2a1a" : "#ffb020");
    }
    if (lamp.current) {
      const held = st.phase === "play" && !st.bridgeHot;
      lamp.current.emissiveIntensity = held ? 1.6 : st.bridgeHot ? (Math.sin(clock.elapsedTime * 18) > 0 ? 1.8 : 0.15) : 0.05;
    }
    if (glow.current) glow.current.intensity = heat * pulse * 2.2;
  });
  return (
    <group>
      <mesh castShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.28]} />
        <Mat color="#2a2826" selected={selected} />
      </mesh>
      <mesh castShadow position={[0, 0.14, -0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.058, 0.058, 0.3, 20]} />
        <meshStandardMaterial color="#4a1816" roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.14, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.22, 16]} />
        <meshPhysicalMaterial
          color="#2a0908"
          transparent
          opacity={xray ? 0.18 : 0.55}
          roughness={0.12}
          metalness={0.05}
          transmission={0.35}
          thickness={0.04}
        />
      </mesh>
      <mesh position={[0, 0.14, -0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.2, 8]} />
        <meshStandardMaterial ref={filament} color="#3a2418" emissive="#ffb020" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      <mesh position={[0.16, 0.14, -0.02]}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshStandardMaterial ref={lamp} color="#102018" emissive="#7dce6a" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[0, 0.2, 0.05]} color="#ff6a2a" intensity={0.3} distance={1.4} />
      <mesh position={[0, 0.14, -0.02]}>
        <boxGeometry args={[0.3, 0.02, 0.08]} />
        <meshStandardMaterial color="#cfc6b4" metalness={0.7} roughness={0.3} />
      </mesh>
      <Silk title="INNESCO" sub="PONTE" y={0.24} />
    </group>
  );
}

function CapMesh({ selected }: { selected: boolean }) {
  const dumped = useGame((s) => s.capDumped);
  return (
    <group>
      <mesh castShadow position={[-0.02, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.28, 16]} />
        <Mat color="#c4552a" selected={selected} metal={0.35} rough={0.45} />
      </mesh>
      <mesh position={[0.02, 0.1, 0]}>
        <boxGeometry args={[0.05, 0.09, 0.16]} />
        <meshStandardMaterial color="#e2b43a" />
      </mesh>
      <mesh position={[0.2, 0.07, 0.06]} castShadow>
        <boxGeometry args={[0.16, 0.1, 0.12]} />
        <meshStandardMaterial color="#2c4a38" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          color={dumped ? "#355" : "#ffb020"}
          emissive={dumped ? "#000" : "#ffb020"}
          emissiveIntensity={dumped ? 0 : 1.4}
          toneMapped={false}
        />
      </mesh>
      <Silk title="SCARICA" sub="CARICO FITTIZIO" y={0.2} z={-0.12} w={0.36} h={0.08} />
    </group>
  );
}

function KeypadMesh({ selected }: { selected: boolean }) {
  const dispatch = useGame((s) => s.dispatch);
  const entry = useGame((s) => s.keypad);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];
  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.46, 0.1, 0.42]} />
        <Mat color="#17191c" selected={selected} />
      </mesh>
      {keys.map((key, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <mesh
            key={key}
            position={[-0.12 + col * 0.12, 0.11, -0.12 + row * 0.09]}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "keypad", key: key === "OK" ? "OK" : key });
            }}
          >
            <boxGeometry args={[0.09, 0.025, 0.07]} />
            <meshStandardMaterial color={key === "OK" ? "#8d241c" : "#2a2e33"} metalness={0.4} roughness={0.45} />
          </mesh>
        );
      })}
      <DigitReadout text={entry.padEnd(4, "·")} y={0.12} z={-0.2} />
    </group>
  );
}

function TiltMesh({ selected }: { selected: boolean }) {
  const dispatch = useGame((s) => s.dispatch);
  const bead = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const a = useGame.getState().attitude;
    if (bead.current) bead.current.position.x = Math.max(-0.1, Math.min(0.1, a.z * 0.45));
  });
  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.18]} />
        <Mat color="#242220" selected={selected} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.32, 12]} />
        <meshPhysicalMaterial color="#d5e7ee" transparent opacity={0.45} roughness={0.08} metalness={0.05} />
      </mesh>
      <mesh ref={bead} position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshStandardMaterial color="#d9d3c6" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh
        position={[0.18, 0.1, 0]}
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ type: "pointer-tilt" });
        }}
      >
        <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
        <meshStandardMaterial color="#b7b1a4" metalness={0.85} roughness={0.3} />
      </mesh>
      <Silk title="GRANO" sub="BLOCCO" y={0.16} z={0.1} w={0.24} h={0.07} />
    </group>
  );
}

function ReceiverMesh({ selected }: { selected: boolean }) {
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const blink = useGame((s) => Number(s.bomb?.code[2] ?? 3));
  useFrame(({ clock }) => {
    if (!led.current) return;
    const span = 0.22 * blink + 0.55;
    const t = clock.elapsedTime % span;
    const slot = 0.22;
    const index = Math.floor(t / slot);
    const on = index < blink && t % slot < 0.1;
    led.current.emissiveIntensity = on ? 2.4 : 0.05;
  });
  return (
    <group>
      <mesh castShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[0.36, 0.12, 0.24]} />
        <Mat color="#20242a" selected={selected} />
      </mesh>
      <mesh position={[-0.05, 0.28, -0.04]} rotation={[0.15, 0, 0.1]}>
        <cylinderGeometry args={[0.012, 0.012, 0.42, 8]} />
        <meshStandardMaterial color="#d5d0c6" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0.12, 0.14, 0.08]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshStandardMaterial ref={led} color="#1a1208" emissive="#ffb020" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      <Silk title="RX" sub="COPIONE" y={0.14} z={-0.08} w={0.22} h={0.07} />
    </group>
  );
}

function LedsMesh({ selected }: { selected: boolean }) {
  const count = useGame((s) => s.bomb?.ledBlink ?? 4);
  const blind = useGame((s) => s.ledsBlind);
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    const span = 0.18 * count + 0.45;
    const t = clock.elapsedTime % span;
    const index = Math.floor(t / 0.18);
    mats.current.forEach((m, i) => {
      if (!m) return;
      const on = !blind && index < count && i === index % 6 && t % 0.18 < 0.1;
      m.emissiveIntensity = on ? 2.6 : 0.04;
    });
  });
  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.62, 0.1, 0.2]} />
        <Mat color="#141618" selected={selected} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-0.22 + i * 0.09, 0.12, 0]}>
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshStandardMaterial
            ref={(node) => {
              mats.current[i] = node;
            }}
            color="#102018"
            emissive="#d6e38a"
            emissiveIntensity={0.05}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function DialMesh({ selected }: { selected: boolean }) {
  const digits = useGame((s) => s.dialDigits);
  const dispatch = useGame((s) => s.dispatch);
  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[0.5, 0.1, 0.24]} />
        <Mat color="#2a241c" selected={selected} />
      </mesh>
      {digits.map((n, i) => (
        <group key={i} position={[-0.14 + i * 0.14, 0.12, 0]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "dial", index: i as 0 | 1 | 2, dir: 1 });
            }}
          >
            <cylinderGeometry args={[0.05, 0.05, 0.04, 16]} />
            <meshStandardMaterial color="#111" metalness={0.5} roughness={0.4} />
          </mesh>
          <DigitReadout text={String(n)} y={0.05} z={0} />
        </group>
      ))}
    </group>
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

function HarnessMesh({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[1.15, 0.06, 0.22]} />
        <Mat color="#1a1c1e" selected={selected} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.05, 0.02, 0.08]} />
        <meshStandardMaterial color="#3a342c" />
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
  if (!uv || phase === "boot") return null;
  return (
    <mesh position={[1.08, 0.05, -0.2]} rotation={[0, Math.PI / 2, 0]}>
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
  const { canvas, tex } = useMemo(() => createLcd(), []);
  useEffect(() => {
    drawLcd(canvas, "8888", "idle");
    tex.needsUpdate = true;
  }, [canvas, tex]);
  return (
    <group position={[0, -0.05, 0]}>
      <mesh position={[0, -0.02, 0]} castShadow>
        <boxGeometry args={[1.7, 0.42, 1.15]} />
        <meshStandardMaterial color="#4a1e22" roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.62, 0.08, 1.05]} />
        <meshStandardMaterial color="#161412" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.26, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.48, 0.18]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.32, -0.48]}>
        <torusGeometry args={[0.14, 0.02, 8, 14, Math.PI]} />
        <meshStandardMaterial color="#ddd4c6" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}
