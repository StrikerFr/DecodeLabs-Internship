import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

function RuleCube({ active, theme }: { active: boolean; theme: "light" | "dark" }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.22;
    group.current.rotation.x += dt * 0.07;
  });
  const c1 = theme === "light" ? "#1f2a44" : "#7aa6d6";
  const c2 = theme === "light" ? "#3b5378" : "#5a86c4";
  const c3 = theme === "light" ? "#b89968" : "#d4b97a"; // gold accent
  return (
    <group ref={group} visible={active}>
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshBasicMaterial wireframe color={c1} transparent opacity={0.85} />
      </mesh>
      <mesh scale={1.4}>
        <boxGeometry args={[2, 2, 2]} />
        <meshBasicMaterial wireframe color={c2} transparent opacity={0.3} />
      </mesh>
      <mesh scale={1.9}>
        <octahedronGeometry args={[1.4, 0]} />
        <meshBasicMaterial wireframe color={c3} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function AIOrb({
  active,
  intensity,
  theme,
}: {
  active: boolean;
  intensity: number;
  theme: "light" | "dark";
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (mesh.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.04 + intensity * 0.25;
      mesh.current.scale.setScalar(s);
      mesh.current.rotation.y = t * 0.28;
      mesh.current.rotation.x = t * 0.13;
    }
    if (inner.current) {
      inner.current.rotation.y = -t * 0.45;
      inner.current.rotation.z = t * 0.18;
    }
  });
  const outer = theme === "light" ? "#3d2f6b" : "#b9a1f0";
  const innerC = theme === "light" ? "#7d5fbf" : "#9b7cf0";
  const halo = theme === "light" ? "#b89968" : "#d4b97a";
  return (
    <group visible={active}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.4, 3]} />
        <meshBasicMaterial wireframe color={outer} transparent opacity={0.85} />
      </mesh>
      <mesh ref={inner} scale={0.7}>
        <icosahedronGeometry args={[1.4, 1]} />
        <meshBasicMaterial wireframe color={innerC} transparent opacity={0.55} />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={halo} transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

function Particles({ count = 700, color }: { count?: number; color: string }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.015;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color={color} transparent opacity={0.6} />
    </points>
  );
}

export function Scene3D({
  mode,
  voiceIntensity = 0,
  theme,
}: {
  mode: "rule" | "ai" | "transition";
  voiceIntensity?: number;
  theme: "light" | "dark";
}) {
  const particleColor =
    theme === "light"
      ? mode === "ai"
        ? "#7d5fbf"
        : "#3b5378"
      : mode === "ai"
        ? "#c084fc"
        : "#7aa6d6";

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.5} />
      {theme === "dark" && (
        <Stars radius={80} depth={40} count={2500} factor={3} fade speed={0.5} />
      )}
      <Particles color={particleColor} />
      <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.5}>
        <RuleCube active={mode === "rule"} theme={theme} />
        <AIOrb active={mode === "ai"} intensity={voiceIntensity} theme={theme} />
      </Float>
    </Canvas>
  );
}
