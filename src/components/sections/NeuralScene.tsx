import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  intensity: number; // 0..1 -> ramps up while dragging / processing
  phase?: number; // 0..1 -> scroll journey through discovery
};

export function NeuralScene({ intensity, phase = 0 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const intensityRef = useRef(intensity);
  const phaseRef = useRef(phase);
  intensityRef.current = intensity;
  phaseRef.current = phase;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // --- Outer neural field: points + lines emerging from the core ---
    const NODE_COUNT = 320;
    const positions = new Float32Array(NODE_COUNT * 3);
    const basePositions = new Float32Array(NODE_COUNT * 3);
    for (let i = 0; i < NODE_COUNT; i++) {
      // Concentrate density near the core, falling off outward
      const r = 2.6 + Math.pow(Math.random(), 1.6) * 7.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.7;
      const z = r * Math.cos(phi) * 0.45 - 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;
    }

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pointMat = new THREE.PointsMaterial({
      color: 0x7c3aed,
      size: 0.05,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pointGeo, pointMat);
    scene.add(points);

    // Connections (lines between close nodes)
    const linePairs: number[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1.6) linePairs.push(i, j);
      }
    }
    const linePositions = new Float32Array(linePairs.length * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // --- Center AI Core (massive translucent sphere) ---
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0, -1);
    scene.add(coreGroup);

    const CORE_R = 2.2;

    const sphereGeo = new THREE.IcosahedronGeometry(CORE_R, 6);
    const sphereMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uColorA: { value: new THREE.Color("#c4b5fd") },
        uColorB: { value: new THREE.Color("#14b8a6") },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        uniform float uTime;
        uniform float uIntensity;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPos = position;
          vec3 p = position;
          float n = sin(p.x*1.2+uTime*0.6) * sin(p.y*1.2+uTime*0.5) * sin(p.z*1.2+uTime*0.4);
          p += normal * n * (0.06 + uIntensity*0.28);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uIntensity;
        void main() {
          float fres = pow(1.0 - max(dot(vNormal, vec3(0.0,0.0,1.0)), 0.0), 2.2);
          vec3 col = mix(uColorA, uColorB, fres);
          float alpha = 0.10 + fres * 0.55 + uIntensity*0.20;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    coreGroup.add(sphere);

    // Inner data points — dense neural cloud inside the sphere
    const innerCount = 2200;
    const innerPos = new Float32Array(innerCount * 3);
    for (let i = 0; i < innerCount; i++) {
      const r = Math.cbrt(Math.random()) * (CORE_R - 0.05);
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      innerPos[i * 3] = r * Math.sin(p) * Math.cos(t);
      innerPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      innerPos[i * 3 + 2] = r * Math.cos(p);
    }
    const innerGeo = new THREE.BufferGeometry();
    innerGeo.setAttribute("position", new THREE.BufferAttribute(innerPos, 3));
    const innerMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.014,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerPoints = new THREE.Points(innerGeo, innerMat);
    coreGroup.add(innerPoints);

    // Neural pathways — curved lines inside the core
    const PATHWAYS = 14;
    const pathGroup = new THREE.Group();
    coreGroup.add(pathGroup);
    for (let i = 0; i < PATHWAYS; i++) {
      const pts: THREE.Vector3[] = [];
      const seed = Math.random() * 1000;
      for (let s = 0; s <= 40; s++) {
        const u = s / 40;
        const ang = u * Math.PI * 2 + seed;
        const rr = (CORE_R - 0.1) * (0.4 + 0.6 * Math.sin(u * Math.PI));
        pts.push(
          new THREE.Vector3(
            Math.cos(ang) * rr,
            Math.sin(ang * 1.7 + seed) * rr * 0.8,
            Math.sin(ang) * rr * 0.9,
          ),
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(120));
      const m = new THREE.LineBasicMaterial({
        color: i % 2 ? 0x14b8a6 : 0x7c3aed,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(g, m);
      pathGroup.add(line);
    }

    // Orbit rings (around the core)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const ringGeo = new THREE.TorusGeometry(CORE_R * 1.35, 0.006, 8, 200);
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
    (ring2.material as THREE.MeshBasicMaterial).color = new THREE.Color(0x14b8a6);
    ring2.rotation.x = Math.PI / 2.4;
    ring2.scale.setScalar(1.18);
    const ring3 = new THREE.Mesh(ringGeo, ringMat.clone());
    ring3.rotation.x = Math.PI / 1.6;
    ring3.rotation.y = Math.PI / 3;
    ring3.scale.setScalar(1.36);
    const ringsGroup = new THREE.Group();
    ringsGroup.add(ring1, ring2, ring3);
    coreGroup.add(ringsGroup);

    // Soft glow halo
    const haloGeo = new THREE.SphereGeometry(CORE_R * 1.55, 48, 48);
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: { uIntensity: { value: 0 } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `varying vec3 vN; uniform float uIntensity; void main(){ float f = pow(1.0 - max(dot(vN,vec3(0.,0.,1.)),0.0), 2.6); gl_FragColor = vec4(0.486,0.227,0.929, f*(0.12+uIntensity*0.30)); }`,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    coreGroup.add(halo);

    // Mouse
    const mouse = new THREE.Vector2(0, 0);
    const target = new THREE.Vector2(0, 0);
    const onMouseMove = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMouseMove);

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    let smoothed = 0;
    let phaseSmoothed = 0;

    const animate = () => {
      const t = clock.getElapsedTime();
      mouse.x += (target.x - mouse.x) * 0.04;
      mouse.y += (target.y - mouse.y) * 0.04;

      smoothed += (intensityRef.current - smoothed) * 0.06;
      phaseSmoothed += (phaseRef.current - phaseSmoothed) * 0.04;
      const ph = phaseSmoothed;

      sphereMat.uniforms.uTime.value = t;
      sphereMat.uniforms.uIntensity.value = smoothed + ph * 0.4;
      sphereMat.uniforms.uColorA.value.setRGB(0.77 - ph * 0.4, 0.71 + ph * 0.05, 0.99 - ph * 0.3);
      sphereMat.uniforms.uColorB.value.setRGB(0.08 + ph * 0.1, 0.72, 0.65 + ph * 0.1);
      haloMat.uniforms.uIntensity.value = smoothed + ph * 0.3;

      // Outer field: nodes rush inward as intensity rises (file drop reaction)
      const rush = smoothed; // 0..1
      const spread = (1 + ph * 0.35) * (1 - rush * 0.35);
      const pos = pointGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < NODE_COUNT; i++) {
        const bx = basePositions[i * 3] * spread;
        const by = basePositions[i * 3 + 1] * spread;
        const bz = basePositions[i * 3 + 2];
        const wob = Math.sin(t * 0.4 + i * 0.5) * 0.06;
        pos[i * 3] = bx + mouse.x * 0.5 + wob;
        pos[i * 3 + 1] = by + mouse.y * 0.5 + Math.cos(t * 0.3 + i) * 0.04;
        pos[i * 3 + 2] = bz;
      }
      pointGeo.attributes.position.needsUpdate = true;

      const lp = lineGeo.attributes.position.array as Float32Array;
      for (let k = 0; k < linePairs.length; k += 2) {
        const a = linePairs[k];
        const b = linePairs[k + 1];
        lp[(k / 2) * 6] = pos[a * 3];
        lp[(k / 2) * 6 + 1] = pos[a * 3 + 1];
        lp[(k / 2) * 6 + 2] = pos[a * 3 + 2];
        lp[(k / 2) * 6 + 3] = pos[b * 3];
        lp[(k / 2) * 6 + 4] = pos[b * 3 + 1];
        lp[(k / 2) * 6 + 5] = pos[b * 3 + 2];
      }
      lineGeo.attributes.position.needsUpdate = true;
      lineMat.opacity = 0.06 + smoothed * 0.22 + ph * 0.25;

      // Core follows the mouse subtly — "the AI is watching"
      coreGroup.rotation.y = t * 0.06 + mouse.x * 0.25;
      coreGroup.rotation.x = mouse.y * 0.18;

      // Rings tilt toward cursor
      ringsGroup.rotation.x = mouse.y * 0.35;
      ringsGroup.rotation.y = mouse.x * 0.35;

      const breathe = 1 + smoothed * 0.06 + Math.sin(t * 0.6) * 0.01;
      coreGroup.scale.setScalar(breathe);

      // Inner cloud — accelerates and condenses on drop
      innerPoints.scale.setScalar(1 + ph * 0.6 - rush * 0.25);
      (innerPoints.material as THREE.PointsMaterial).opacity = 0.85 - ph * 0.25 + rush * 0.15;
      innerPoints.rotation.y = -t * (0.18 + ph * 0.3 + rush * 0.6);
      innerPoints.rotation.x = t * (0.08 + rush * 0.3);

      pathGroup.rotation.y = t * (0.1 + rush * 0.5);
      pathGroup.rotation.x = t * 0.05;

      ring1.rotation.z = t * (0.15 + ph * 0.2 + rush * 0.5);
      ring2.rotation.z = -t * (0.12 + ph * 0.18 + rush * 0.5);
      ring3.rotation.z = t * (0.09 + ph * 0.15 + rush * 0.5);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      pointGeo.dispose();
      lineGeo.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      ringGeo.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
