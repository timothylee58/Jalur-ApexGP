import * as THREE from "three";

/**
 * Late-afternoon Sepang: a low, warm sun in the west, humid haze that
 * turns the horizon gold, and banks of tropical cumulus drifting across.
 * One shader on a dome — gradient, sun disc and glow, and fbm clouds
 * projected onto a flat cloud layer so they foreshorten toward the
 * horizon like real ones.
 */

export const SUN_DIRECTION = new THREE.Vector3(-0.72, 0.2, 0.36).normalize();
/** The haze colour distant geometry fades into — matches the horizon. */
export const HAZE = new THREE.Color("#d9b48a");

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 zenith = vec3(0.20, 0.38, 0.62);
    vec3 mid = vec3(0.55, 0.68, 0.80);
    vec3 horizon = vec3(0.97, 0.80, 0.58);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
    col = mix(col, zenith, smoothstep(0.22, 0.85, h));

    float sd = max(dot(d, normalize(uSun)), 0.0);
    col += vec3(1.0, 0.66, 0.32) * pow(sd, 6.0) * 0.45;
    col += vec3(1.0, 0.86, 0.62) * pow(sd, 90.0) * 0.8;
    col = mix(col, vec3(1.0, 0.96, 0.86), smoothstep(0.99955, 0.9998, sd));

    if (h > 0.0) {
      vec2 uv = d.xz / (h + 0.09);
      uv += vec2(uTime * 0.006, uTime * 0.002);
      float base = fbm(uv * 0.9);
      float detail = fbm(uv * 3.1 + base);
      float c = base * 0.75 + detail * 0.35;
      float cover = smoothstep(0.58, 0.86, c) * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.55, 0.95, h) * 0.6);
      // Lit on the sun side, grey-violet in their bellies.
      vec3 lit = mix(vec3(0.98, 0.90, 0.80), vec3(1.0, 0.80, 0.55), pow(sd, 2.0));
      vec3 shade = vec3(0.56, 0.55, 0.62);
      vec3 cloud = mix(shade, lit, smoothstep(0.55, 0.95, c + 0.12 * pow(sd, 3.0)));
      col = mix(col, cloud, cover * 0.92);
    }

    // Below the horizon line: the haze the far plantation sinks into.
    col = mix(col, vec3(0.80, 0.70, 0.56), smoothstep(0.0, -0.06, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky() {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uSun: { value: SUN_DIRECTION.clone() }, uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.scale.setScalar(5000);
  return {
    mesh,
    update: (time: number, centre: THREE.Vector3) => {
      material.uniforms.uTime.value = time;
      mesh.position.copy(centre);
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
