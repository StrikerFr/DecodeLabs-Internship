import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Float } from "@react-three/drei";
import * as THREE from "three";
import { MOVIES } from "@/constants/movies";

function Poster({
  index,
  total,
  texture,
  scrollRef,
  hoverRef,
}: {
  index: number;
  total: number;
  texture: THREE.Texture;
  scrollRef: React.MutableRefObject<number>;
  hoverRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const hovered = useRef(0);

  // distribute on two rings + center
  const layout = useMemo(() => {
    // ring 0: outer; ring 1: inner; ring 2: closer
    const ringSpec = [
      { count: 6, radius: 4.6, y: 0.3 },
      { count: 4, radius: 2.6, y: -0.6 },
      { count: 2, radius: 1.2, y: 0.8 },
    ];
    let acc = 0;
    for (const r of ringSpec) {
      if (index < acc + r.count) {
        const local = index - acc;
        const angle = (local / r.count) * Math.PI * 2 + (r.radius * 0.3);
        return { angle, radius: r.radius, y: r.y, ring: r };
      }
      acc += r.count;
    }
    return { angle: 0, radius: 3, y: 0, ring: ringSpec[0] };
  }, [index, total]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    // slow orbit
    const speed = 0.04 + (1 / (layout.radius + 1)) * 0.02;
    const a = layout.angle + t * speed;
    const x = Math.cos(a) * layout.radius;
    const z = Math.sin(a) * layout.radius - scrollRef.current * 6;
    const y = layout.y + Math.sin(t * 0.6 + index) * 0.18;

    ref.current.position.x += (x - ref.current.position.x) * 0.08;
    ref.current.position.y += (y - ref.current.position.y) * 0.08;
    ref.current.position.z += (z - ref.current.position.z) * 0.08;

    // face camera-ish with slight tilt
    const targetRotY = -a + Math.PI / 2 + Math.sin(t * 0.3 + index) * 0.1;
    const targetRotX = Math.sin(t * 0.4 + index) * 0.08;
    ref.current.rotation.y += (targetRotY - ref.current.rotation.y) * 0.06;
    ref.current.rotation.x += (targetRotX - ref.current.rotation.x) * 0.06;

    // hover magnetic effect
    const targetHover = hoverRef.current === index ? 1 : 0;
    hovered.current += (targetHover - hovered.current) * 0.12;
    const scale = 1 + hovered.current * 0.18;
    ref.current.scale.setScalar(scale);
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.15 + hovered.current * 0.8;
    }
  });

  return (
    <group
      ref={ref}
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverRef.current = index;
        document.body.classList.add("cm-hover");
      }}
      onPointerOut={() => {
        if (hoverRef.current === index) hoverRef.current = -1;
        document.body.classList.remove("cm-hover");
      }}
    >
      <mesh castShadow>
        <planeGeometry args={[1.05, 1.55]} />
        <meshStandardMaterial
          ref={matRef}
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#88aaff")}
          emissiveIntensity={0.15}
          metalness={0.4}
          roughness={0.35}
          transparent
        />
      </mesh>
      {/* soft glow halo */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[1.4, 1.95]} />
        <meshBasicMaterial color="#6a8cff" transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Nebula() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.z = s.clock.getElapsedTime() * 0.01;
  });
  return (
    <mesh ref={ref} position={[0, 0, -18]}>
      <planeGeometry args={[80, 50]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
        `}
        fragmentShader={`
          varying vec2 vUv;
          // simple value noise
          float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
          float noise(vec2 p){
            vec2 i=floor(p); vec2 f=fract(p);
            float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
            vec2 u=f*f*(3.0-2.0*f);
            return mix(a,b,u.x)+ (c-a)*u.y*(1.0-u.x)+ (d-b)*u.x*u.y;
          }
          float fbm(vec2 p){
            float v=0.0; float a=0.5;
            for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5;}
            return v;
          }
          void main(){
            vec2 uv = vUv - 0.5;
            float d = length(uv);
            float n = fbm(vUv*3.0);
            float n2 = fbm(vUv*7.0 + n);
            vec3 col = mix(vec3(0.02,0.03,0.06), vec3(0.10,0.16,0.32), n);
            col += vec3(0.20,0.30,0.55) * pow(n2, 3.0) * 0.6;
            col *= smoothstep(0.85, 0.1, d);
            gl_FragColor = vec4(col, smoothstep(0.85,0.1,d) * 0.85);
          }
        `}
      />
    </mesh>
  );
}

function CameraRig({
  mouseRef,
  scrollRef,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  scrollRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const tx = mouseRef.current.x * 0.6;
    const ty = mouseRef.current.y * 0.4 + 0.1;
    const tz = 7 - scrollRef.current * 4;
    camera.position.x += (tx - camera.position.x) * 0.04;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.position.z += (tz - camera.position.z) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function Scene({
  mouseRef,
  scrollRef,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  scrollRef: React.MutableRefObject<number>;
}) {
  const hoverRef = useRef<number>(-1);

  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    return MOVIES.slice(0, 12).map((movie) => {
      const tex = loader.load(movie.poster);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      return tex;
    });
  }, []);

  return (
    <Canvas
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.2, 7], fov: 42, near: 0.1, far: 100 }}
    >
      <color attach="background" args={["#05060a"]} />
      <fog attach="fog" args={["#05060a", 6, 22]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 5, 8]} intensity={0.8} color="#bcd0ff" />
      <pointLight position={[-6, -2, 3]} intensity={1.4} color="#5b7bff" distance={20} decay={2} />
      <pointLight position={[6, 3, -4]} intensity={1.0} color="#ffd1a8" distance={20} decay={2} />

      <Stars radius={60} depth={40} count={2200} factor={3} saturation={0} fade speed={0.4} />
      <Nebula />

      <Float speed={0.6} rotationIntensity={0.15} floatIntensity={0.4}>
        <group>
          {textures.map((tex, i) => (
            <Poster
              key={i}
              index={i}
              total={textures.length}
              texture={tex}
              scrollRef={scrollRef}
              hoverRef={hoverRef}
            />
          ))}
        </group>
      </Float>

      <CameraRig mouseRef={mouseRef} scrollRef={scrollRef} />
    </Canvas>
  );
}