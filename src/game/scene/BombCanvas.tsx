import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { fx, useGame } from "../store";
import { Device, inspectPoint } from "./Device";
import { HandSurface, ToolInHand } from "./Hand";

export function BombCanvas() {
  return (
    <Canvas
      // three no longer ships the old soft variant: its plain PCF map is the filtered one now.
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [1.85, 1.45, 2.35], fov: 34, near: 0.08, far: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.setClearColor("#100e0c");
        gl.toneMappingExposure = 1.12;
      }}
    >
      <color attach="background" args={["#100e0c"]} />
      <fog attach="fog" args={["#100e0c", 7.5, 16]} />
      <Lights />
      <HandSurface>
        <Room />
        <Shake>
          <Suspense fallback={null}>
            <Device />
          </Suspense>
        </Shake>
      </HandSurface>
      <ToolInHand />
      <Controls />
      <Clock />
      <Maneggio />
      <Effects />
    </Canvas>
  );
}

/**
 * Lens work: lamps and the LCD bleed light, the frame darkens toward the corners, and a
 * close look throws everything but the inspected part out of focus. With the composer
 * running the renderer no longer tone-maps, so the last pass does it.
 */
function Effects() {
  const on = useGame((s) => s.effects);
  const bomb = useGame((s) => s.bomb);
  const inspectId = useGame((s) => s.inspectId);
  const exploded = useGame((s) => s.exploded);
  const focus = useMemo(() => (bomb && inspectId ? inspectPoint(bomb, inspectId, exploded) : null), [bomb, inspectId, exploded]);
  if (!on) return null;
  return (
    <EffectComposer multisampling={4}>
      {focus ? <DepthOfField target={focus} worldFocusRange={0.55} bokehScale={3.2} resolutionScale={0.5} /> : <></>}
      {/* Threshold well above white: only lamps, the filament and the displays bleed, not lit leather. */}
      <Bloom mipmapBlur luminanceThreshold={1.7} luminanceSmoothing={0.2} intensity={0.6} radius={0.68} />
      <Vignette offset={0.22} darkness={0.62} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}

/** Stage lighting. With the UV lamp on, the set goes dark and violet so the hidden mark can glow. */
function Lights() {
  const uv = useGame((s) => s.uv && s.phase !== "boot");
  const blackout = useGame((s) => s.phase === "play" && s.mods.includes("luci-basse"));
  const dim = uv ? 0.14 : blackout ? 0.05 : 1;
  return (
    <>
      <hemisphereLight args={[uv ? "#7a52d6" : "#f0d2b4", "#1a120e", uv ? 0.5 : 0.55]} />
      <ambientLight intensity={0.18 * dim} />
      <directionalLight
        position={[4.2, 7.2, 2.6]}
        intensity={2.6 * dim}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={18}
        // The frustum hugs the table: the same map covers a quarter of the area it used to.
        shadow-camera-left={-2.4}
        shadow-camera-right={2.4}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-2.4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      <spotLight
        position={[-2.4, 3.6, 1.6]}
        angle={0.62}
        penumbra={0.65}
        intensity={24 * dim}
        color={"#ffd2a8"}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />
      <pointLight position={[0.15, 0.55, 0.1]} color={"#e23b2b"} intensity={2.2 * dim} distance={4.2} />
      <pointLight position={[-1.2, 0.8, -1.1]} color={"#ffb020"} intensity={0.6 * dim} distance={5} />
      {uv && <pointLight position={[0.4, 1.6, 1.2]} color={"#8a5cff"} intensity={9} distance={7} />}
      {/* Built in code, no download: gives chrome and glass something to reflect. */}
      {blackout && <Torch />}
      <Environment resolution={256} environmentIntensity={uv ? 0.1 : blackout ? 0.06 : 0.55}>
        <color attach="background" args={["#0b0a09"]} />
        <Lightformer form="rect" intensity={3} color="#ffd9b0" position={[-3, 4, 2]} scale={[5, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#9fb4c8" position={[4, 2, -3]} scale={[4, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={2} color="#ff5a3c" position={[0, 3, -4]} scale={2} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}

/** Blackout: a hand torch that sits at the camera and lights whatever it looks at. */
function Torch() {
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ camera }) => {
    if (!light.current) return;
    light.current.position.copy(camera.position);
    camera.getWorldDirection(target.position).multiplyScalar(3).add(camera.position);
    target.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={target} />
      <spotLight ref={light} target={target} angle={0.3} penumbra={0.55} intensity={38} distance={9} color="#fff1d6" />
    </>
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

const HOME = { target: new THREE.Vector3(0, 0.05, 0), eye: new THREE.Vector3(1.85, 1.45, 2.35) };

/** Width of the modules that are wider than the common small footprint. */
const FOOTPRINT: Partial<Record<string, number>> = { harness: 1.15, plate: 0.9, timer: 0.78, leds: 0.62 };

function Controls() {
  const tool = useGame((s) => s.tool);
  const phase = useGame((s) => s.phase);
  const inspectId = useGame((s) => s.inspectId);
  const exploded = useGame((s) => s.exploded);
  const camera = useThree((s) => s.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  /** Where the camera is flying to; null once it has arrived or the player takes over. */
  const flight = useRef<{ target: THREE.Vector3; eye: THREE.Vector3 } | null>(null);
  const wasInspecting = useRef(false);

  // Close look: fly in over the module, keeping the side the player was looking from.
  useEffect(() => {
    const c = controls.current;
    const bomb = useGame.getState().bomb;
    const point = inspectId && bomb ? inspectPoint(bomb, inspectId, exploded) : null;
    if (point && c) {
      const from = camera.position.clone().sub(c.target).setY(0);
      if (from.lengthSq() < 1e-4) from.set(0, 0, 1);
      // Stand back far enough to frame the whole module: the bus strip is three times a keypad.
      const kind = bomb?.modules.find((m) => m.id === inspectId)?.kind;
      const reach = 0.55 + (kind ? (FOOTPRINT[kind] ?? 0.46) : 0.46) * 1.05;
      from.normalize().multiplyScalar(reach * 0.6);
      flight.current = { target: point, eye: point.clone().add(new THREE.Vector3(from.x, reach * 0.8, from.z)) };
      wasInspecting.current = true;
    } else if (wasInspecting.current) {
      flight.current = { target: HOME.target.clone(), eye: HOME.eye.clone() };
      wasInspecting.current = false;
    }
  }, [inspectId, exploded, camera]);

  useEffect(() => {
    controls.current?.target.copy(HOME.target);
    controls.current?.update();
  }, []);

  useFrame((_, delta) => {
    const c = controls.current;
    const goal = flight.current;
    if (!c || !goal) return;
    const k = 1 - Math.exp(-7 * Math.min(delta, 0.1));
    c.target.lerp(goal.target, k);
    camera.position.lerp(goal.eye, k);
    c.update();
    if (camera.position.distanceTo(goal.eye) < 0.004 && c.target.distanceTo(goal.target) < 0.004) flight.current = null;
  });

  useEffect(() => {
    const onView = (event: Event) => {
      const type = (event as CustomEvent<string>).detail;
      const c = controls.current;
      if (!c) return;
      const st = useGame.getState();
      if (type === "reset") {
        if (st.inspectId) st.setInspect(null);
        else flight.current = { target: HOME.target.clone(), eye: HOME.eye.clone() };
      } else if (type === "zoom-in" || type === "zoom-out") {
        flight.current = null;
        const offset = camera.position.clone().sub(c.target);
        offset.multiplyScalar(type === "zoom-in" ? 0.82 : 1.2);
        const dist = offset.length();
        if (dist > 0.4 && dist < 9) camera.position.copy(c.target.clone().add(offset));
        c.update();
      } else if (type === "focus") {
        if (st.bomb?.modules.some((m) => m.id === st.selectedId)) st.setInspect(st.selectedId);
      }
    };
    window.addEventListener("ut-view", onView);
    return () => window.removeEventListener("ut-view", onView);
  }, [camera]);

  return (
    <OrbitControls
      ref={controls}
      enabled={!(tool === "maneggio" && phase === "play")}
      enablePan
      // A drag or a pinch always wins over a flight in progress.
      onStart={() => {
        flight.current = null;
      }}
      minDistance={inspectId ? 0.3 : 1.15}
      maxDistance={8.5}
      maxPolarAngle={Math.PI * 0.92}
      minPolarAngle={0.18}
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
