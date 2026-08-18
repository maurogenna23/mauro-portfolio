import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

/** points around a circle in the XY plane (front-facing to the camera) */
function circlePoints(radius: number, segments = 160): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return pts;
}

/**
 * Hero scene — a client-only WebGL island (content stays SSR for SEO).
 *
 *  1. WavesQuad     — fullscreen domain-warped fbm shader (blue/marine),
 *                     colour shifts through the cool family as you scroll.
 *  2. ParticleCore  — a ~2.6k-point "AI core" sphere that spins, breathes and
 *                     tilts toward the cursor; tightens a little as you scroll.
 *
 * Kept deliberately light (capped dpr, additive points, no postprocessing) so
 * the hero stays fast on mobile.
 */

type ScrollRef = React.MutableRefObject<number>;

/* ----------------------------- background waves ----------------------------- */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0); // fullscreen clip-space quad
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;
  uniform float uScroll;

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.55;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = vUv; p.x *= aspect;
    float t = uTime * 0.05;

    vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.7));
    vec2 r = vec2(fbm(p * 1.6 + q * 1.9 + uMouse * 0.35 + t * 1.3),
                  fbm(p * 1.6 + q * 1.9 - t * 0.9 + 2.1));
    float f = fbm(p * 1.6 + r * 2.0);
    f = f * 0.5 + 0.5;

    float s = uScroll;
    vec3 deep  = mix(vec3(0.015, 0.035, 0.09), vec3(0.03, 0.02, 0.10), s);
    vec3 navy  = mix(vec3(0.04,  0.10,  0.32), vec3(0.10, 0.06, 0.36), s);
    vec3 azure = mix(vec3(0.18,  0.42,  1.00), vec3(0.42, 0.28, 1.00), s);
    vec3 cyan  = mix(vec3(0.34,  0.74,  1.00), vec3(0.30, 0.85, 0.92), s);

    vec3 col = mix(deep, navy, smoothstep(0.10, 0.55, f));
    col = mix(col, azure, smoothstep(0.45, 0.85, f) * 0.80);
    col = mix(col, cyan, smoothstep(0.70, 0.98, r.x * 0.5 + 0.5) * 0.28);

    float vig = smoothstep(1.25, 0.25, length(vUv - 0.5));
    col *= 0.55 + 0.45 * vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function WavesQuad({ reduced, scroll }: { reduced: boolean; scroll: ScrollRef }) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size } = useThree();
  const target = useMemo(() => new THREE.Vector2(0, 0), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uScroll: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const u = matRef.current?.uniforms;
    if (!u) return;
    u.uTime.value = reduced ? 2.0 : state.clock.elapsedTime;
    u.uRes.value.set(size.width, size.height);
    target.set(state.pointer.x, state.pointer.y);
    (u.uMouse.value as THREE.Vector2).lerp(target, 0.04);
    u.uScroll.value += (scroll.current - u.uScroll.value) * 0.06;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------ particle core ------------------------------ */

function ParticleCore({ reduced, scroll }: { reduced: boolean; scroll: ScrollRef }) {
  const ref = useRef<THREE.Points>(null!);
  const N = 2600;

  const positions = useMemo(() => {
    const arr = new Float32Array(N * 3);
    const golden = Math.PI * (1 + Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2; // 1 .. -1
      const radius = Math.sqrt(1 - y * y);
      const theta = golden * i;
      arr[i * 3] = Math.cos(theta) * radius;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(theta) * radius;
    }
    return arr;
  }, []);

  const tiltTarget = useRef(new THREE.Vector2());

  useFrame((state, dt) => {
    const p = ref.current;
    if (!p) return;
    const spin = reduced ? 0 : 1;
    p.rotation.y += dt * 0.08 * spin;
    // ease tilt toward the cursor
    tiltTarget.current.set(state.pointer.y * 0.5, state.pointer.x * 0.5);
    p.rotation.x += (tiltTarget.current.x - p.rotation.x) * 0.03;
    p.rotation.z += (-state.pointer.x * 0.12 - p.rotation.z) * 0.03;
    // breathe + tighten a touch as you scroll
    const breathe = reduced ? 1 : 1 + Math.sin(state.clock.elapsedTime * 0.6) * 0.03;
    const s = (2.35 - scroll.current * 0.45) * breathe;
    p.scale.setScalar(s);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        sizeAttenuation
        color="#8fbaff"
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* --------------------- blueprint construction (Oryzo-style) --------------------- */

function Construction({ reduced, scroll }: { reduced: boolean; scroll: ScrollRef }) {
  const group = useRef<THREE.Group>(null!);
  const rings = useMemo(() => [2.75, 3.35], []);
  const nodeAngles = useMemo(() => [0, 90, 180, 270], []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.z += dt * 0.03 * (reduced ? 0 : 1);
    g.rotation.x += (state.pointer.y * 0.28 - g.rotation.x) * 0.03;
    g.rotation.y += (state.pointer.x * 0.28 - g.rotation.y) * 0.03;
    g.scale.setScalar(1 + scroll.current * 0.18);
  });

  return (
    <group ref={group}>
      {/* dashed guide rings */}
      {rings.map((r, i) => (
        <Line
          key={`ring-${i}`}
          points={circlePoints(r)}
          color="#5b9bff"
          lineWidth={1}
          dashed
          dashSize={0.16}
          gapSize={0.12}
          transparent
          opacity={0.34}
        />
      ))}
      {/* crosshair guides */}
      <Line
        points={[new THREE.Vector3(-4.4, 0, 0), new THREE.Vector3(4.4, 0, 0)]}
        color="#5b9bff" lineWidth={1} dashed dashSize={0.1} gapSize={0.16} transparent opacity={0.12}
      />
      <Line
        points={[new THREE.Vector3(0, -4.4, 0), new THREE.Vector3(0, 4.4, 0)]}
        color="#5b9bff" lineWidth={1} dashed dashSize={0.1} gapSize={0.16} transparent opacity={0.12}
      />
      {/* node handles at cardinal points */}
      {rings.map((r) =>
        nodeAngles.map((deg) => {
          const a = (deg * Math.PI) / 180;
          return (
            <mesh key={`node-${r}-${deg}`} position={[Math.cos(a) * r, Math.sin(a) * r, 0]}>
              <planeGeometry args={[0.075, 0.075]} />
              <meshBasicMaterial color="#a9c7ff" transparent opacity={0.95} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

/* --------------------------------- island --------------------------------- */

export default function WaveBackground() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scroll = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <Canvas
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      camera={{ fov: 50, position: [0, 0, 6] }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <WavesQuad reduced={reduced} scroll={scroll} />
      <ParticleCore reduced={reduced} scroll={scroll} />
      <Construction reduced={reduced} scroll={scroll} />
    </Canvas>
  );
}
