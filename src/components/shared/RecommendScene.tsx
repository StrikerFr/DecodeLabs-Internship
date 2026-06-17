import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import type { Movie } from "@/types/movie";

function PosterMesh({
  index,
  total,
  texture,
  rankRef,
  scoreRef,
  phaseRef,
  finalIndexRef,
}: {
  index: number;
  total: number;
  texture: THREE.Texture;
  rankRef: React.MutableRefObject<number[]>;
  scoreRef: React.MutableRefObject<number>;
  phaseRef: React.MutableRefObject<"scan" | "converge" | "reveal">;
  finalIndexRef: React.MutableRefObject<number>;
}) {
  const group = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const baseAngle = useMemo(() => (index / total) * Math.PI * 2, [index, total]);
  const firstFrame = useRef(true);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    const phase = phaseRef.current;
    const rank = rankRef.current.indexOf(index); // 0 = best match
    const isFinal = finalIndexRef.current === index;

    let tx = 0, ty = 0, tz = 0, ts = 1, rotY = 0, opacity = 1;

    if (phase === "scan") {
      // wide cylindrical carousel around camera
      const spin = t * 0.18;
      const radius = 5.2;
      tx = Math.cos(baseAngle + spin) * radius;
      tz = Math.sin(baseAngle + spin) * radius;
      ty = Math.sin(t * 0.4 + index) * 0.4 + (index % 3 - 1) * 0.5;
      rotY = -(baseAngle + spin) + Math.PI / 2;
      ts = 1;
      opacity = 1;
    } else if (phase === "converge") {
      // top ranked move toward center, others drift back
      const closeness = Math.max(0, 1 - rank / 4);
      const radius = 5.2 - closeness * 3.0;
      const spin = t * 0.12;
      tx = Math.cos(baseAngle + spin) * radius;
      tz = Math.sin(baseAngle + spin) * radius - closeness * 0.6;
      ty = Math.sin(t * 0.3 + index) * 0.3 + (1 - closeness) * 0.6;
      rotY = -(baseAngle + spin) + Math.PI / 2;
      ts = 0.8 + closeness * 0.6;
      opacity = 0.25 + closeness * 0.75;
    } else {
      // reveal: winner front and center, others sink away
      if (isFinal) {
        tx = 0; ty = 0.1; tz = 2.3;
        rotY = 0; ts = 2.4; opacity = 1;
      } else {
        const radius = 9 + (rank > 0 ? rank * 0.5 : 0);
        const spin = t * 0.05 + baseAngle;
        tx = Math.cos(spin) * radius;
        tz = Math.sin(spin) * radius - 4;
        ty = -1.5 + Math.sin(t * 0.3 + index) * 0.2;
        rotY = -spin + Math.PI / 2;
        ts = 0.7;
        opacity = 0.15;
      }
    }

    const k = firstFrame.current ? 1 : 0.06;
    const kr = firstFrame.current ? 1 : 0.06;
    const ks = firstFrame.current ? 1 : 0.08;
    group.current.position.x += (tx - group.current.position.x) * k;
    group.current.position.y += (ty - group.current.position.y) * k;
    group.current.position.z += (tz - group.current.position.z) * k;
    group.current.rotation.y += (rotY - group.current.rotation.y) * kr;
    group.current.rotation.x += (Math.sin(t * 0.4 + index) * 0.06 - group.current.rotation.x) * (firstFrame.current ? 1 : 0.05);
    const s = group.current.scale.x + (ts - group.current.scale.x) * ks;
    group.current.scale.setScalar(s);
    if (mat.current && firstFrame.current) mat.current.opacity = opacity;
    firstFrame.current = false;

    if (mat.current) {
      mat.current.opacity += (opacity - mat.current.opacity) * 0.08;
      mat.current.emissiveIntensity =
        phase === "reveal" && isFinal ? 0.9 : 0.15 + (rank < 3 ? 0.25 : 0);
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[1.2, 1.78]} />
        <meshStandardMaterial
          ref={mat}
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#9bb4ff")}
          emissiveIntensity={0.15}
          metalness={0.4}
          roughness={0.35}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[1.55, 2.15]} />
        <meshBasicMaterial color="#6a8cff" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Pulse({ phaseRef }: { phaseRef: React.MutableRefObject<"scan" | "converge" | "reveal"> }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.getElapsedTime();
    const beat = Math.sin(t * 2.0) * 0.5 + 0.5;
    const intensity = phaseRef.current === "scan" ? 0.6 : phaseRef.current === "converge" ? 0.9 : 0.2;
    const scale = 4 + beat * 0.8 + (phaseRef.current === "converge" ? 1.2 : 0);
    ref.current.scale.setScalar(scale);
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = (0.04 + beat * 0.05) * intensity;
  });
  return (
    <mesh ref={ref} position={[0, 0, -2]}>
      <ringGeometry args={[0.9, 1, 64]} />
      <meshBasicMaterial color="#88aaff" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function CameraRig({
  mouseRef,
  phaseRef,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  phaseRef: React.MutableRefObject<"scan" | "converge" | "reveal">;
}) {
  const { camera } = useThree();
  const firstFrame = useRef(true);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    const phase = phaseRef.current;
    let tz = 8;
    let ty = 0.3;
    if (phase === "scan") {
      tz = 8 + Math.sin(t * 0.2) * 0.3;
      ty = 0.3 + Math.sin(t * 0.15) * 0.15;
    } else if (phase === "converge") {
      tz = 6.5;
      ty = 0.2;
    } else {
      tz = 4.2;
      ty = 0.2;
    }
    const tx = mouseRef.current.x * 0.4;
    const myy = ty + mouseRef.current.y * 0.2;
    const k = firstFrame.current ? 1 : 0.05;
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (myy - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * (firstFrame.current ? 1 : 0.04);
    camera.lookAt(0, 0, phase === "reveal" ? 2.3 : 0);
    firstFrame.current = false;
  });
  return null;
}


export default function RecommendScene({
  movies,
  rankRef,
  phaseRef,
  finalIndexRef,
  scoreRef,
  mouseRef,
}: {
  movies: Movie[];
  rankRef: React.MutableRefObject<number[]>;
  phaseRef: React.MutableRefObject<"scan" | "converge" | "reveal">;
  finalIndexRef: React.MutableRefObject<number>;
  scoreRef: React.MutableRefObject<number>;
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const textures = useRef<THREE.Texture[]>([]);

  const texList = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    return movies.map((m) => {
      const t = loader.load(m.poster);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    });
  }, [movies]);

  useEffect(() => {
    textures.current = texList;
    return () => texList.forEach((t) => t.dispose());
  }, [texList]);

  return (
    <Canvas
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.3, 8], fov: 55, near: 0.1, far: 100 }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    >
      <color attach="background" args={["#04050a"]} />
      <fog attach="fog" args={["#04050a", 4, 18]} />

      <ambientLight intensity={0.3} />
      <pointLight position={[0, 2, 0]} intensity={2} color="#7da0ff" distance={10} decay={2} />
      <pointLight position={[-6, -2, 3]} intensity={1.2} color="#5b7bff" distance={20} decay={2} />
      <pointLight position={[6, 3, -4]} intensity={0.8} color="#ffd1a8" distance={20} decay={2} />

      <Stars radius={50} depth={40} count={2800} factor={3} saturation={0} fade speed={0.6} />
      <Pulse phaseRef={phaseRef} />

      {texList.map((tex, i) => (
        <PosterMesh
          key={i}
          index={i}
          total={texList.length}
          texture={tex}
          rankRef={rankRef}
          scoreRef={scoreRef}
          phaseRef={phaseRef}
          finalIndexRef={finalIndexRef}
        />
      ))}

      <CameraRig mouseRef={mouseRef} phaseRef={phaseRef} />
    </Canvas>
  );
}