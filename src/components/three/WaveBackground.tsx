import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Full-screen flowing colour-wave background (Linearity-style), in a blue /
 * marine palette. A single fullscreen quad runs a domain-warped fbm shader so
 * the colour fields drift and fold organically. Mouse adds a little flow.
 *
 * This is a client-only island — WebGL can't be server-rendered — so the page's
 * text stays SSR'd for SEO while this paints behind it.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // fullscreen clip-space quad — ignores the camera entirely
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;
  uniform float uScroll;  // 0 (top) .. 1 (bottom)

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
    vec2 p = vUv;
    p.x *= aspect;
    float t = uTime * 0.05;

    // domain warp — the "flowing" motion
    vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.7));
    vec2 r = vec2(fbm(p * 1.6 + q * 1.9 + uMouse * 0.35 + t * 1.3),
                  fbm(p * 1.6 + q * 1.9 - t * 0.9 + 2.1));
    float f = fbm(p * 1.6 + r * 2.0);
    f = f * 0.5 + 0.5;

    // blue / marine palette — travels through the cool family as you scroll
    float s = uScroll;
    vec3 deep  = mix(vec3(0.015, 0.035, 0.09), vec3(0.03, 0.02, 0.10), s);   // navy → indigo-black
    vec3 navy  = mix(vec3(0.04,  0.10,  0.32), vec3(0.10, 0.06, 0.36), s);   // marine → indigo
    vec3 azure = mix(vec3(0.18,  0.42,  1.00), vec3(0.42, 0.28, 1.00), s);   // azure → violet-blue
    vec3 cyan  = mix(vec3(0.34,  0.74,  1.00), vec3(0.30, 0.85, 0.92), s);   // cyan → teal

    vec3 col = mix(deep, navy, smoothstep(0.10, 0.55, f));
    col = mix(col, azure, smoothstep(0.45, 0.85, f) * 0.85);
    col = mix(col, cyan, smoothstep(0.70, 0.98, r.x * 0.5 + 0.5) * 0.30);

    // soft vignette so hero text reads
    float vig = smoothstep(1.25, 0.25, length(vUv - 0.5));
    col *= 0.55 + 0.45 * vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Waves({ reduced }: { reduced: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size } = useThree();
  const target = useMemo(() => new THREE.Vector2(0, 0), []);
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
    // ease the scroll-driven colour shift
    u.uScroll.value += (scroll.current - u.uScroll.value) * 0.06;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function WaveBackground() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Canvas
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      orthographic
      camera={{ position: [0, 0, 1] }}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <Waves reduced={reduced} />
    </Canvas>
  );
}
