import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

export type NeuralNetState = {
  name: string;
  activity: number;
  pulseRate: number;
  colorShift: number;
  turbulence: number;
  wave?: number;
  spin?: number;
};

export type NeuralTheme = "dark" | "light";

export type NeuralNetworkProps = {
  width?: string | number;
  height?: string | number;
  nodes?: number;
  state?: NeuralNetState;
  interactive?: boolean;
  autoRotate?: boolean;
  theme?: NeuralTheme;
  className?: string;
  style?: CSSProperties;
};

const NODE_VERT = `#version 300 es
precision highp float;
in vec3 a_position;
in float a_size;
in vec3 a_color;
in float a_seed;
uniform float u_time;
uniform float u_activity;
uniform float u_pulseRate;
uniform float u_turbulence;
uniform float u_wave;
uniform float u_aspect;
uniform vec2 u_pointer;
uniform float u_pointerActive;
uniform float u_light;
uniform mat4 u_rotation;
out vec3 v_color;
out float v_alpha;
out float v_hover;

void main() {
  float radius = length(a_position);
  float ripple = sin(radius * 16.0 - u_time * (4.2 + u_pulseRate * 1.8) + a_seed * 6.0);
  float breathe = 1.0 + sin(u_time * u_pulseRate + a_seed * 12.0) * (0.03 + u_turbulence * 0.04) + u_wave * 0.1 + ripple * u_wave * 0.07;
  vec3 dir = normalize(a_position + 0.0001);
  vec3 pos = a_position * breathe;
  pos += dir * ripple * u_wave * 0.085;
  pos += dir * sin(u_time * (5.5 + u_pulseRate) + a_seed * 9.0) * (u_turbulence * 0.02 + u_wave * 0.05);
  vec4 rotated = u_rotation * vec4(pos, 1.0);
  rotated.x /= max(u_aspect, 0.001);
  vec2 away = rotated.xy - u_pointer;
  float awayR2 = dot(away, away);
  float repel = exp(-awayR2 * mix(88.0, 102.0, u_light)) * u_pointerActive;
  float repelStrength = mix(0.095, 0.075, u_light);
  rotated.xy += away * (repel * repelStrength / (awayR2 + 0.006));
  float depth = rotated.z * 0.5 + 0.5;
  float pulse = 0.62 + 0.38 * sin(u_time * (1.8 + a_seed * 4.0) + a_seed * 20.0);
  vec3 toned = mix(a_color, a_color * vec3(0.22, 0.38, 0.62), u_light * 0.82);
  v_color = toned;
  v_hover = repel * (1.0 - smoothstep(0.0, 0.22, sqrt(awayR2)));
  float edgeFade = mix(1.0, smoothstep(1.14, 0.9, length(rotated.xy)), u_light);
  v_alpha = mix(0.72, 1.0, depth) * pulse * (0.92 + u_wave * 0.42) * (1.0 - v_hover * 0.42) * edgeFade;
  gl_Position = vec4(rotated.xy, 0.0, 1.0);
  gl_PointSize = a_size * (0.82 + depth * 0.42) * (1.0 + u_activity * 0.16 + u_wave * 0.62) * (1.0 - v_hover * 0.18);
}`;

const NODE_FRAG = `#version 300 es
precision highp float;
uniform float u_light;
in vec3 v_color;
in float v_alpha;
in float v_hover;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);
  float core = smoothstep(0.34, 0.0, dist);
  float halo = smoothstep(1.0, 0.2, dist);
  vec3 hot = mix(vec3(0.9, 0.97, 1.0), vec3(0.04, 0.3, 0.62), u_light);
  vec3 color = mix(v_color, hot, core * mix(0.45, 0.55, u_light));
  float alpha = (halo * mix(0.55, 0.36, u_light) + core * mix(1.12, 0.9, u_light)) * v_alpha;
  fragColor = vec4(color, alpha * mix(1.15, 1.08, u_light));
}`;

const EDGE_VERT = `#version 300 es
precision highp float;
in vec3 a_start;
in vec3 a_end;
in float a_side;
in float a_along;
in float a_seed;
uniform float u_time;
uniform float u_activity;
uniform float u_pulseRate;
uniform float u_wave;
uniform float u_aspect;
uniform float u_lineWidth;
uniform vec2 u_pointer;
uniform float u_pointerActive;
uniform float u_light;
uniform mat4 u_rotation;
out float v_along;
out float v_seed;
out float v_depth;
out float v_fade;
out float v_hover;

void main() {
  float mid = a_along * (1.0 - a_along) * 4.0;
  float ripple = sin(u_time * (5.0 + u_pulseRate) + a_seed * 18.0 + a_along * 10.0) * u_wave * 0.028 * mid;
  vec3 start = a_start * (1.0 + u_wave * 0.08);
  vec3 endp = a_end * (1.0 + u_wave * 0.08);
  vec4 s = u_rotation * vec4(start, 1.0);
  vec4 e = u_rotation * vec4(endp, 1.0);
  s.x /= max(u_aspect, 0.001);
  e.x /= max(u_aspect, 0.001);
  vec2 dir = e.xy - s.xy;
  float len = max(length(dir), 0.0001);
  vec2 n = vec2(-dir.y, dir.x) / len;
  vec4 p = mix(s, e, a_along);
  p.xy += n * (a_side * u_lineWidth * (1.0 + u_wave * 0.85) + ripple);
  vec2 away = p.xy - u_pointer;
  float awayR2 = dot(away, away);
  float repel = exp(-awayR2 * mix(92.0, 108.0, u_light)) * u_pointerActive;
  p.xy += away * (repel * mix(0.072, 0.058, u_light) / (awayR2 + 0.006));
  v_along = a_along;
  v_seed = a_seed;
  v_depth = p.z * 0.5 + 0.5;
  v_hover = repel * (1.0 - smoothstep(0.0, 0.2, sqrt(awayR2)));
  v_fade = mix(1.0, smoothstep(1.14, 0.9, length(p.xy)), u_light);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`;

const EDGE_FRAG = `#version 300 es
precision highp float;
uniform float u_time;
uniform float u_activity;
uniform float u_pulseRate;
uniform float u_colorShift;
uniform float u_wave;
uniform float u_light;
in float v_along;
in float v_seed;
in float v_depth;
in float v_fade;
in float v_hover;
out vec4 fragColor;

void main() {
  float signal = fract(v_along - u_time * (0.18 + u_activity * 0.22 + u_wave * 0.45) * u_pulseRate - v_seed);
  float packet = smoothstep(0.1, 0.0, abs(signal - 0.5));
  vec3 darkBase = mix(vec3(0.42, 0.74, 1.0), vec3(0.95, 0.52, 0.8), u_colorShift);
  vec3 lightBase = mix(vec3(0.05, 0.34, 0.72), vec3(0.48, 0.2, 0.55), u_colorShift);
  vec3 base = mix(darkBase, lightBase, u_light);
  vec3 spark = mix(vec3(0.85, 0.96, 1.0), vec3(0.12, 0.42, 0.82), u_light);
  vec3 color = mix(base, spark, packet + u_wave * 0.25);
  float depthGain = mix(0.58, 0.42, u_light);
  float alpha = (mix(0.14, 0.22, u_light) + packet * mix(0.42, 0.5, u_light) + u_wave * mix(0.12, 0.16, u_light)) * mix(depthGain, 1.0, v_depth) * v_fade * (1.0 - v_hover * 0.55);
  fragColor = vec4(color, alpha * mix(0.92, 0.88, u_light));
}`;

const HAZE_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const HAZE_FRAG = `#version 300 es
precision highp float;
uniform float u_time;
uniform float u_activity;
uniform float u_colorShift;
uniform float u_wave;
uniform float u_pulseRate;
uniform float u_light;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_pointerActive;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  uv.x *= u_resolution.x / max(u_resolution.y, 1.0);
  float dist = length(uv);
  vec2 away = uv - u_pointer;
  float awayR2 = dot(away, away);
  float ptrVoid = exp(-awayR2 * mix(10.0, 12.0, u_light)) * u_pointerActive;
  vec3 darkTint = mix(vec3(0.12, 0.28, 0.55), vec3(0.42, 0.14, 0.38), u_colorShift);
  vec3 lightTint = mix(vec3(0.58, 0.72, 0.9), vec3(0.78, 0.58, 0.82), u_colorShift);
  vec3 tint = mix(darkTint, lightTint, u_light);
  float hazeAmp = mix(0.11 + u_activity * 0.035 + u_wave * 0.1, 0.022 + u_activity * 0.014 + u_wave * 0.06, u_light);
  float haze = exp(-dist * mix(2.1, 3.2, u_light)) * hazeAmp;
  float breath = 0.9 + 0.1 * sin(u_time * 0.7) + u_wave * 0.12;
  float hazeAlpha = haze * breath * mix(1.0, 0.55, u_light);
  vec3 ptrTint = mix(vec3(0.55, 0.82, 1.0), vec3(0.2, 0.48, 0.78), u_light);
  hazeAlpha *= 1.0 - ptrVoid * mix(0.38, 0.28, u_light);
  fragColor = vec4(mix(tint, ptrTint, u_wave * 0.28), hazeAlpha);
}`;

const SPARK_VERT = `#version 300 es
precision highp float;
in vec3 a_origin;
in vec3 a_vector;
in float a_size;
in vec3 a_color;
in float a_seed;
in float a_mode;
uniform float u_time;
uniform float u_activity;
uniform float u_pulseRate;
uniform float u_wave;
uniform float u_aspect;
uniform vec2 u_pointer;
uniform float u_pointerActive;
uniform float u_light;
uniform mat4 u_rotation;
out vec3 v_color;
out float v_alpha;

void main() {
  float life = fract(u_time * (0.2 + a_seed * 0.28 + u_wave * 0.35) * (0.7 + u_pulseRate * 0.35) + a_seed);
  vec3 pos;
  float fade;
  if (a_mode < 0.5) {
    fade = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.28, 0.78, life));
    pos = a_origin + a_vector * life * (0.16 + a_seed * 0.34 + u_activity * 0.08 + u_wave * 0.22);
  } else if (a_mode < 1.5) {
    float orbit = u_time * (0.12 + a_seed * 0.2 + u_wave * 0.8);
    pos = a_origin * (1.0 + u_wave * 0.08) + vec3(sin(orbit) * a_vector.x, cos(orbit * 1.3) * a_vector.y, sin(orbit * 0.7) * a_vector.z);
    fade = 0.35 + 0.65 * abs(sin(u_time * (2.4 + a_seed * 6.0) + a_seed * 18.0));
  } else {
    float travel = fract(u_time * (0.16 + a_seed * 0.2 + u_wave * 0.4) * u_pulseRate + a_seed);
    pos = a_origin + a_vector * travel;
    fade = 0.25 + 0.75 * smoothstep(0.0, 0.08, travel) * (1.0 - smoothstep(0.82, 1.0, travel));
  }
  vec4 rotated = u_rotation * vec4(pos, 1.0);
  rotated.x /= max(u_aspect, 0.001);
  vec2 away = rotated.xy - u_pointer;
  float awayR2 = dot(away, away);
  float repel = exp(-awayR2 * mix(84.0, 98.0, u_light)) * u_pointerActive;
  rotated.xy += away * (repel * mix(0.088, 0.07, u_light) / (awayR2 + 0.006));
  v_color = mix(a_color, a_color * vec3(0.55, 0.62, 0.78), u_light * 0.35);
  float edgeFade = mix(1.0, smoothstep(1.14, 0.9, length(rotated.xy)), u_light);
  float voidMask = repel * (1.0 - smoothstep(0.0, 0.18, sqrt(awayR2)));
  v_alpha = fade * edgeFade * (1.0 - voidMask * 0.5);
  gl_Position = vec4(rotated.xy, 0.0, 1.0);
  gl_PointSize = a_size * (0.95 + fade * 0.75 + u_wave * 0.55);
}`;

const SPARK_FRAG = `#version 300 es
precision highp float;
uniform float u_light;
in vec3 v_color;
in float v_alpha;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);
  float core = smoothstep(0.2, 0.0, dist);
  float halo = smoothstep(1.0, 0.1, dist);
  vec3 color = mix(v_color, mix(vec3(1.0), vec3(0.06, 0.26, 0.52), u_light), core * mix(0.48, 0.38, u_light));
  float alpha = (halo * mix(0.48, 0.44, u_light) + core * mix(1.2, 1.18, u_light)) * v_alpha;
  fragColor = vec4(color, alpha * mix(1.18, 1.05, u_light));
}`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

function mat4RotateY(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]);
}

function mat4RotateX(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]);
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
    }
  }
  return result;
}

const PALETTE: Array<[number, number, number]> = [
  [0.62, 0.84, 1.0],
  [0.78, 0.62, 1.0],
  [0.45, 0.95, 0.88],
  [1.0, 0.78, 0.52],
  [1.0, 0.52, 0.74],
  [0.55, 0.72, 1.0],
  [0.95, 0.92, 0.55],
  [0.55, 1.0, 0.72],
  [1.0, 0.42, 0.38],
];

function hash01(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function fibonacciSphere(count: number, radius: number): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push([
      Math.cos(theta) * ring * radius,
      y * radius,
      Math.sin(theta) * ring * radius,
    ]);
  }
  return points;
}

function buildNetwork(nodeCount: number) {
  const points = fibonacciSphere(nodeCount, 0.66);
  const nodeData: number[] = [];
  points.forEach((point, index) => {
    const color = PALETTE[index % PALETTE.length];
    nodeData.push(
      point[0],
      point[1],
      point[2],
      3.0 + (index % 5) * 0.4,
      color[0],
      color[1],
      color[2],
      index / points.length,
    );
  });

  const edges: Array<[number, number]> = [];
  const addEdge = (a: number, b: number) => {
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (!edges.some((edge) => edge[0] === start && edge[1] === end)) {
      edges.push([start, end]);
    }
  };

  for (let i = 0; i < points.length; i++) {
    const ranked = points
      .map((point, j) => {
        if (i === j) return { j, d: Number.POSITIVE_INFINITY };
        const dx = points[i][0] - point[0];
        const dy = points[i][1] - point[1];
        const dz = points[i][2] - point[2];
        return { j, d: dx * dx + dy * dy + dz * dz };
      })
      .sort((a, b) => a.d - b.d);
    ranked.slice(0, 4).forEach((item) => addEdge(i, item.j));
  }

  const edgeData: number[] = [];
  for (const [a, b] of edges) {
    const start = points[a];
    const end = points[b];
    const seed = (a * 13 + b * 7) % 100 / 100;
    const quad: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [-1, 1],
      [1, 0],
      [1, 1],
      [-1, 1],
    ];
    for (const [side, along] of quad) {
      edgeData.push(start[0], start[1], start[2], end[0], end[1], end[2], side, along, seed);
    }
  }

  const sparkData: number[] = [];
  const pushSpark = (
    origin: [number, number, number],
    vector: [number, number, number],
    size: number,
    color: [number, number, number],
    seed: number,
    mode: number,
  ) => {
    sparkData.push(origin[0], origin[1], origin[2], vector[0], vector[1], vector[2], size, color[0], color[1], color[2], seed, mode);
  };

  points.forEach((point, index) => {
    for (let burst = 0; burst < 4; burst++) {
      const color = PALETTE[(index + burst * 3) % PALETTE.length];
      const theta = hash01(index, 20 + burst) * Math.PI * 2;
      const phi = hash01(index, 30 + burst) * Math.PI;
      pushSpark(
        point,
        [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)],
        1.35 + hash01(index, 40 + burst) * 1.1,
        color,
        hash01(index, 50 + burst),
        0,
      );
    }
  });

  for (let i = 0; i < 780; i++) {
    const color = PALETTE[i % PALETTE.length];
    pushSpark(
      (() => {
        const theta = hash01(i, 1) * Math.PI * 2;
        const phi = Math.acos(2 * hash01(i, 2) - 1);
        const radius = 0.22 + hash01(i, 3) * 0.38;
        return [
          Math.sin(phi) * Math.cos(theta) * radius,
          Math.cos(phi) * radius,
          Math.sin(phi) * Math.sin(theta) * radius,
        ] as [number, number, number];
      })(),
      [0.04 + hash01(i, 4) * 0.05, 0.03 + hash01(i, 5) * 0.04, 0.04 + hash01(i, 6) * 0.05],
      1.4 + hash01(i, 7) * 1.25,
      color,
      hash01(i, 8),
      1,
    );
  }

  for (const [a, b] of edges) {
    const color = PALETTE[(a + b) % PALETTE.length];
    const start = points[a];
    const end = points[b];
    pushSpark(
      start,
      [end[0] - start[0], end[1] - start[1], end[2] - start[2]],
      1.25,
      color,
      hash01(a * 17 + b, 9),
      2,
    );
  }

  return { nodeData, edgeData, sparkData };
}

export default function NeuralNetwork({
  width = "100%",
  height = "100%",
  nodes = 168,
  state = { name: "READY", activity: 0.7, pulseRate: 1, colorShift: 0.12, turbulence: 0.12, wave: 0, spin: 1 },
  interactive = true,
  autoRotate = true,
  theme = "dark",
  className = "",
  style = {},
}: NeuralNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef(0);
  const rotationRef = useRef({ x: 0.12, y: 0.18 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const pointerRef = useRef({ x: 0, y: 0, active: 0 });
  const pointerSmoothRef = useRef({ x: 0, y: 0, active: 0 });
  const stateRef = useRef(state);
  const themeRef = useRef(theme);
  const [reducedMotion, setReducedMotion] = useState(false);
  stateRef.current = state;
  themeRef.current = theme;

  const updatePointer = useCallback((event: React.MouseEvent, hovering: boolean) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    pointerRef.current = {
      x: ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
      y: -(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1),
      active: hovering ? 1 : 0,
    };
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!interactive) return;
    dragRef.current = { active: true, lastX: event.clientX, lastY: event.clientY };
    updatePointer(event, true);
  }, [interactive, updatePointer]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    updatePointer(event, true);
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.lastX;
    const dy = event.clientY - dragRef.current.lastY;
    rotationRef.current.y += dx * 0.005;
    rotationRef.current.x = Math.max(-1, Math.min(1, rotationRef.current.x + dy * 0.005));
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
  }, [updatePointer]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent) => {
      if (!interactive) return;
      updatePointer(event, true);
    },
    [interactive, updatePointer],
  );

  const handleMouseLeave = useCallback(() => {
    dragRef.current.active = false;
    pointerRef.current.active = 0;
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const hazeProgram = createProgram(gl, HAZE_VERT, HAZE_FRAG);
    const edgeProgram = createProgram(gl, EDGE_VERT, EDGE_FRAG);
    const nodeProgram = createProgram(gl, NODE_VERT, NODE_FRAG);
    const sparkProgram = createProgram(gl, SPARK_VERT, SPARK_FRAG);
    if (!hazeProgram || !edgeProgram || !nodeProgram || !sparkProgram) return;

    const { nodeData, edgeData, sparkData } = buildNetwork(nodes);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const nodeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeData), gl.STATIC_DRAW);

    const edgeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeData), gl.STATIC_DRAW);

    const sparkBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sparkData), gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const startTime = performance.now();
    const nodeStride = 32;
    const edgeStride = 36;
    const sparkStride = 48;

    const render = () => {
      const now = performance.now();
      const time = reducedMotion ? 0 : (now - startTime) / 1000;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (themeRef.current === "light") {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      }

      const current = stateRef.current;
      const light = themeRef.current === "light" ? 1 : 0;
      const wave = current.wave ?? 0;
      if (autoRotate && !dragRef.current.active && !reducedMotion) {
        rotationRef.current.y += 0.0016 * (current.spin ?? 1);
      }

      const rotation = mat4Multiply(mat4RotateX(rotationRef.current.x), mat4RotateY(rotationRef.current.y));
      const aspect = w / Math.max(h, 1);
      const pointerTarget = pointerRef.current;
      const pointer = pointerSmoothRef.current;
      pointer.x += (pointerTarget.x - pointer.x) * 0.14;
      pointer.y += (pointerTarget.y - pointer.y) * 0.14;
      pointer.active += (pointerTarget.active - pointer.active) * 0.16;

      gl.useProgram(hazeProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const hazePos = gl.getAttribLocation(hazeProgram, "a_position");
      gl.enableVertexAttribArray(hazePos);
      gl.vertexAttribPointer(hazePos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(hazeProgram, "u_time"), time);
      gl.uniform1f(gl.getUniformLocation(hazeProgram, "u_activity"), current.activity);
      gl.uniform1f(gl.getUniformLocation(hazeProgram, "u_colorShift"), current.colorShift);
      gl.uniform1f(gl.getUniformLocation(hazeProgram, "u_wave"), wave);
      gl.uniform1f(gl.getUniformLocation(hazeProgram, "u_pulseRate"), current.pulseRate);
      gl.uniform1f(gl.getUniformLocation(hazeProgram, "u_light"), light);
      gl.uniform2f(gl.getUniformLocation(hazeProgram, "u_resolution"), w, h);
      gl.uniform2f(gl.getUniformLocation(hazeProgram, "u_pointer"), pointer.x, pointer.y);
      gl.uniform1f(gl.getUniformLocation(hazeProgram, "u_pointerActive"), pointer.active);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.useProgram(edgeProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
      const startLoc = gl.getAttribLocation(edgeProgram, "a_start");
      const endLoc = gl.getAttribLocation(edgeProgram, "a_end");
      const sideLoc = gl.getAttribLocation(edgeProgram, "a_side");
      const alongLoc = gl.getAttribLocation(edgeProgram, "a_along");
      const seedLoc = gl.getAttribLocation(edgeProgram, "a_seed");
      gl.enableVertexAttribArray(startLoc);
      gl.enableVertexAttribArray(endLoc);
      gl.enableVertexAttribArray(sideLoc);
      gl.enableVertexAttribArray(alongLoc);
      gl.enableVertexAttribArray(seedLoc);
      gl.vertexAttribPointer(startLoc, 3, gl.FLOAT, false, edgeStride, 0);
      gl.vertexAttribPointer(endLoc, 3, gl.FLOAT, false, edgeStride, 12);
      gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, edgeStride, 24);
      gl.vertexAttribPointer(alongLoc, 1, gl.FLOAT, false, edgeStride, 28);
      gl.vertexAttribPointer(seedLoc, 1, gl.FLOAT, false, edgeStride, 32);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_time"), time);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_activity"), current.activity);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_pulseRate"), current.pulseRate);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_colorShift"), current.colorShift);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_wave"), wave);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_light"), light);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_aspect"), aspect);
      gl.uniform2f(gl.getUniformLocation(edgeProgram, "u_pointer"), pointer.x, pointer.y);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_pointerActive"), pointer.active);
      gl.uniform1f(gl.getUniformLocation(edgeProgram, "u_lineWidth"), 0.00052);
      gl.uniformMatrix4fv(gl.getUniformLocation(edgeProgram, "u_rotation"), false, rotation);
      gl.drawArrays(gl.TRIANGLES, 0, edgeData.length / 9);

      gl.useProgram(nodeProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer);
      const posLoc = gl.getAttribLocation(nodeProgram, "a_position");
      const sizeLoc = gl.getAttribLocation(nodeProgram, "a_size");
      const colorLoc = gl.getAttribLocation(nodeProgram, "a_color");
      const nodeSeedLoc = gl.getAttribLocation(nodeProgram, "a_seed");
      gl.enableVertexAttribArray(posLoc);
      gl.enableVertexAttribArray(sizeLoc);
      gl.enableVertexAttribArray(colorLoc);
      gl.enableVertexAttribArray(nodeSeedLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, nodeStride, 0);
      gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, nodeStride, 12);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, nodeStride, 16);
      gl.vertexAttribPointer(nodeSeedLoc, 1, gl.FLOAT, false, nodeStride, 28);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_time"), time);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_activity"), current.activity);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_pulseRate"), current.pulseRate);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_turbulence"), current.turbulence);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_wave"), wave);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_light"), light);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_aspect"), aspect);
      gl.uniform2f(gl.getUniformLocation(nodeProgram, "u_pointer"), pointer.x, pointer.y);
      gl.uniform1f(gl.getUniformLocation(nodeProgram, "u_pointerActive"), pointer.active);
      gl.uniformMatrix4fv(gl.getUniformLocation(nodeProgram, "u_rotation"), false, rotation);
      gl.drawArrays(gl.POINTS, 0, nodeData.length / 8);

      gl.useProgram(sparkProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuffer);
      const originLoc = gl.getAttribLocation(sparkProgram, "a_origin");
      const vectorLoc = gl.getAttribLocation(sparkProgram, "a_vector");
      const sparkSizeLoc = gl.getAttribLocation(sparkProgram, "a_size");
      const sparkColorLoc = gl.getAttribLocation(sparkProgram, "a_color");
      const sparkSeedLoc = gl.getAttribLocation(sparkProgram, "a_seed");
      const modeLoc = gl.getAttribLocation(sparkProgram, "a_mode");
      gl.enableVertexAttribArray(originLoc);
      gl.enableVertexAttribArray(vectorLoc);
      gl.enableVertexAttribArray(sparkSizeLoc);
      gl.enableVertexAttribArray(sparkColorLoc);
      gl.enableVertexAttribArray(sparkSeedLoc);
      gl.enableVertexAttribArray(modeLoc);
      gl.vertexAttribPointer(originLoc, 3, gl.FLOAT, false, sparkStride, 0);
      gl.vertexAttribPointer(vectorLoc, 3, gl.FLOAT, false, sparkStride, 12);
      gl.vertexAttribPointer(sparkSizeLoc, 1, gl.FLOAT, false, sparkStride, 24);
      gl.vertexAttribPointer(sparkColorLoc, 3, gl.FLOAT, false, sparkStride, 28);
      gl.vertexAttribPointer(sparkSeedLoc, 1, gl.FLOAT, false, sparkStride, 40);
      gl.vertexAttribPointer(modeLoc, 1, gl.FLOAT, false, sparkStride, 44);
      gl.uniform1f(gl.getUniformLocation(sparkProgram, "u_time"), time);
      gl.uniform1f(gl.getUniformLocation(sparkProgram, "u_activity"), current.activity);
      gl.uniform1f(gl.getUniformLocation(sparkProgram, "u_pulseRate"), current.pulseRate);
      gl.uniform1f(gl.getUniformLocation(sparkProgram, "u_wave"), wave);
      gl.uniform1f(gl.getUniformLocation(sparkProgram, "u_light"), light);
      gl.uniform1f(gl.getUniformLocation(sparkProgram, "u_aspect"), aspect);
      gl.uniform2f(gl.getUniformLocation(sparkProgram, "u_pointer"), pointer.x, pointer.y);
      gl.uniform1f(gl.getUniformLocation(sparkProgram, "u_pointerActive"), pointer.active);
      gl.uniformMatrix4fv(gl.getUniformLocation(sparkProgram, "u_rotation"), false, rotation);
      gl.drawArrays(gl.POINTS, 0, sparkData.length / 12);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
      gl.deleteProgram(hazeProgram);
      gl.deleteProgram(edgeProgram);
      gl.deleteProgram(nodeProgram);
      gl.deleteProgram(sparkProgram);
      gl.deleteBuffer(quadBuffer);
      gl.deleteBuffer(nodeBuffer);
      gl.deleteBuffer(edgeBuffer);
      gl.deleteBuffer(sparkBuffer);
    };
  }, [autoRotate, nodes, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`neural-network neural-network--${theme}${className ? ` ${className}` : ""}`}
      style={{ position: "relative", width, height, overflow: "hidden", background: "transparent", ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: interactive ? "crosshair" : "default",
          background: "transparent",
        }}
      />
    </div>
  );
}
