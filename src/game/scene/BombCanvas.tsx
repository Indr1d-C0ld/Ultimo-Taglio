import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { fx, useGame } from "../store";
import { Device } from "./Device";

export function BombCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [1.85, 1.45, 2.35], fov: 34, near: 0.08, far: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.setClearColor("#100e0c");
        gl.toneMappingExposure = 1.12;
      }}
    >
      <color attach="background" args={["#100e0c"]} />
      <fog attach="fog" args={["#100e0c", 7.5, 16]} />
      <hemisphereLight args={["#f0d2b4", "#1a120e", 0.55]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[4.2, 7.2, 2.6]}
        intensity={2.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={18}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <spotLight
        position={[-2.4, 3.6, 1.6]}
        angle={0.62}
        penumbra={0.65}
        intensity={24}
        color={"#ffd2a8"}
        castShadow
      />
      <pointLight position={[0.15, 0.55, 0.1]} color={"#e23b2b"} intensity={2.2} distance={4.2} />
      <pointLight position={[-1.2, 0.8, -1.1]} color={"#ffb020"} intensity={0.6} distance={5} />
      <Room />
      <Shake>
        <Device />
      </Shake>
      <Controls />
      <Clock />
      <Maneggio />
    </Canvas>
  );
}

function Shake({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const st = useGame.getState();
    let amp = fx.shake;
    if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - d * 0.55);
    else {
      if (st.phase === "play" && st.mode === "ripresa" && st.secondsLeft > 0 && st.secondsLeft <= 12) {
        amp = 0.004 + (12 - st.secondsLeft) * 0.0014;
      }
      if (st.phase === "play" && st.bridgeHot && st.bridge > 0.7) {
        amp = Math.max(amp, 0.012 + (st.bridge - 0.7) * 0.06);
      }
    }
    if (!ref.current) return;
    if (amp <= 0) {
      ref.current.position.set(0, 0, 0);
      return;
    }
    ref.current.position.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp * 0.65, 0);
  });
  return <group ref={ref}>{children}</group>;
}

function Clock() {
  const acc = useRef(0);
  useFrame((_, delta) => {
    // Real elapsed time, so a low frame rate does not slow the countdown.
    // The reducer clamps a single tick, which covers a stalled tab.
    const d = Math.min(delta, 0.5);
    const st = useGame.getState();
    if (st.phase !== "play") return;
    acc.current += d;
    const need = st.listenLeft > 0 ? 0.1 : 0.25;
    if (acc.current >= need) {
      const step = acc.current;
      acc.current = 0;
      useGame.getState().dispatch({ type: "tick", dt: step });
    }
  });
  return null;
}

function Maneggio() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (useGame.getState().tool !== "maneggio" || useGame.getState().phase !== "play") return;
      last = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const dx = (e.clientX - last.x) / 260;
      const dy = (e.clientY - last.y) / 260;
      last = { x: e.clientX, y: e.clientY };
      useGame.getState().dispatch({ type: "rotate", dx: dy, dz: -dx });
    };
    const up = () => {
      last = null;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);
  return null;
}

function Controls() {
  const tool = useGame((s) => s.tool);
  const phase = useGame((s) => s.phase);
  const camera = useThree((s) => s.camera);
  const controls = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    const onView = (event: Event) => {
      const type = (event as CustomEvent<string>).detail;
      const c = controls.current;
      if (!c) return;
      if (type === "reset") {
        c.target.set(0, 0.05, 0);
        camera.position.set(1.85, 1.45, 2.35);
      } else if (type === "zoom-in" || type === "zoom-out") {
        const offset = camera.position.clone().sub(c.target);
        offset.multiplyScalar(type === "zoom-in" ? 0.82 : 1.2);
        const dist = offset.length();
        if (dist > 1.05 && dist < 9) camera.position.copy(c.target.clone().add(offset));
      } else if (type === "focus") {
        const st = useGame.getState();
        const mod = st.bomb?.modules.find((m) => m.id === st.selectedId);
        if (mod) {
          const e = st.exploded ? mod.explode : [0, 0, 0];
          c.target.set(mod.position[0] + e[0], 0.12 + e[1], mod.position[2] + e[2]);
        } else if (st.selectedId?.startsWith("w")) {
          c.target.set(0, 0.2, 0);
        }
      }
      c.update();
    };
    window.addEventListener("ut-view", onView);
    return () => window.removeEventListener("ut-view", onView);
  }, [camera]);

  return (
    <OrbitControls
      ref={controls}
      enabled={!(tool === "maneggio" && phase === "play")}
      enablePan
      minDistance={1.15}
      maxDistance={8.5}
      maxPolarAngle={Math.PI * 0.92}
      minPolarAngle={0.18}
      target={[0, 0.05, 0]}
    />
  );
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.46, 0]} receiveShadow>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#161210" roughness={1} />
      </mesh>
      <mesh position={[0, -0.36, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.6, 0.16, 2.8]} />
        <meshStandardMaterial color="#2a211c" roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh position={[0, -0.27, 0]} receiveShadow>
        <boxGeometry args={[4.15, 0.03, 2.35]} />
        <meshStandardMaterial color="#3a2c24" roughness={0.55} metalness={0.12} />
      </mesh>
      <Lamp />
      <Slate />
    </group>
  );
}

function Lamp() {
  return (
    <group position={[-1.85, 0.2, 0.95]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 1.1, 10]} />
        <meshStandardMaterial color="#1c1916" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.25, 1.12, -0.05]} rotation={[0.2, 0, -0.7]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 8]} />
        <meshStandardMaterial color="#2a2622" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0.48, 1.28, -0.12]} castShadow>
        <coneGeometry args={[0.16, 0.22, 12, 1, true]} />
        <meshStandardMaterial color="#14110f" side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0.48, 1.22, -0.12]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Slate() {
  const map = useRef<THREE.CanvasTexture | null>(null);
  if (!map.current) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 320;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#1a1814";
      g.fillRect(0, 0, 512, 320);
      g.strokeStyle = "#e23b2b";
      g.lineWidth = 10;
      g.strokeRect(12, 12, 488, 296);
      g.fillStyle = "#f4efe6";
      g.font = "600 64px sans-serif";
      g.fillText("ULTIMO", 36, 120);
      g.fillText("TAGLIO", 36, 190);
      g.fillStyle = "#ffb020";
      g.font = "28px sans-serif";
      g.fillText("SCENA  ·  COPIONE", 40, 250);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    map.current = tex;
  }
  return (
    <group position={[1.55, -0.05, -0.85]} rotation={[0, -0.5, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.72, 0.46, 0.04]} />
        <meshStandardMaterial color="#141210" />
      </mesh>
      <mesh position={[0, 0, 0.024]}>
        <planeGeometry args={[0.66, 0.4]} />
        <meshBasicMaterial map={map.current} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.28, 0.02]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.74, 0.06, 0.06]} />
        <meshStandardMaterial color="#cfc6b8" />
      </mesh>
    </group>
  );
}
