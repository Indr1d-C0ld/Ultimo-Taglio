import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import { inspectPoint } from "./Device";

/** How a scene ends on the bench: a blast from the igniter, or a quiet green light. */
export function Finale() {
  const phase = useGame((s) => s.phase);
  const bomb = useGame((s) => s.bomb);
  const exploded = useGame((s) => s.exploded);
  const at = useMemo(() => (bomb ? inspectPoint(bomb, "detonator", exploded) : null), [bomb, exploded]);
  if (!at) return null;
  if (phase === "boom") return <Blast at={at} />;
  if (phase === "safe") return <Relief at={at} />;
  return null;
}

const DEBRIS = 70;
const SMOKE = 12;

function Blast({ at }: { at: THREE.Vector3 }) {
  const light = useRef<THREE.PointLight>(null);
  const ball = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const debris = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const bits = useMemo(
    () =>
      Array.from({ length: DEBRIS }, () => {
        const a = Math.random() * Math.PI * 2;
        const out = 0.6 + Math.random() * 2.6;
        return {
          v: new THREE.Vector3(Math.cos(a) * out, 1.2 + Math.random() * 3.4, Math.sin(a) * out),
          spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(14),
          size: 0.012 + Math.random() * 0.03,
          hot: Math.random() < 0.55,
        };
      }),
    [],
  );
  const puffs = useMemo(
    () =>
      Array.from({ length: SMOKE }, () => ({
        drift: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5),
        start: new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.2, (Math.random() - 0.5) * 0.5),
        grow: 0.5 + Math.random() * 0.7,
      })),
    [],
  );
  useEffect(() => {
    born.current = null;
  }, [at]);

  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    if (light.current) light.current.intensity = 420 * Math.exp(-t * 5.5) + 6 * Math.exp(-t * 0.8) * (0.7 + Math.sin(t * 40) * 0.3);
    if (ball.current) {
      const k = Math.min(1, t / 0.32);
      ball.current.scale.setScalar(0.05 + (1 - (1 - k) ** 3) * 1.5);
      (ball.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 0.55);
      ball.current.visible = t < 0.55;
    }
    if (ring.current) {
      ring.current.scale.setScalar(0.2 + t * 7);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - t / 0.6);
      ring.current.visible = t < 0.6;
    }
    debris.current?.children.forEach((child, i) => {
      const b = bits[i]!;
      // Fly, fall, and stop where the table is.
      const y = b.v.y * t - 4.9 * t * t;
      child.position.set(b.v.x * t * Math.exp(-t * 0.4), Math.max(-0.2, y), b.v.z * t * Math.exp(-t * 0.4));
      if (y > -0.2) child.rotation.set(b.spin.x * t, b.spin.y * t, b.spin.z * t);
      child.visible = t < 6;
    });
    smoke.current?.children.forEach((child, i) => {
      const p = puffs[i]!;
      const life = Math.max(0, t - 0.15);
      child.position.copy(p.start).addScaledVector(p.drift, life);
      child.scale.setScalar(0.15 + life * p.grow);
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.34 * Math.min(1, life * 4) * (1 - life / 5));
      child.visible = life > 0 && life < 5;
    });
  });

  return (
    <group position={at}>
      <pointLight ref={light} color="#ffb060" intensity={0} distance={14} />
      <mesh ref={ball}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshBasicMaterial color={[9, 4.2, 1.1]} transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <ringGeometry args={[0.82, 1, 64]} />
        <meshBasicMaterial color={[5, 3.2, 1.6]} transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={debris}>
        {bits.map((b, i) => (
          <mesh key={i} castShadow={!b.hot}>
            <boxGeometry args={[b.size, b.size * 0.6, b.size * 1.6]} />
            {b.hot ? (
              <meshBasicMaterial color={[6, 2.4, 0.5]} toneMapped={false} />
            ) : (
              <meshStandardMaterial color="#2a2623" roughness={0.8} metalness={0.3} />
            )}
          </mesh>
        ))}
      </group>
      <group ref={smoke}>
        {puffs.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 14, 14]} />
            <meshBasicMaterial color="#17130f" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Defused: the set breathes out. A soft green light comes up over the tube that never fired. */
function Relief({ at }: { at: THREE.Vector3 }) {
  const light = useRef<THREE.PointLight>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const t = clock.elapsedTime - born.current;
    if (light.current) light.current.intensity = 5 * (1 - Math.exp(-t * 1.5)) * (0.92 + Math.sin(t * 1.4) * 0.08);
  });
  return <pointLight ref={light} position={[at.x, at.y + 0.5, at.z]} color="#b8f08a" intensity={0} distance={5} />;
}
