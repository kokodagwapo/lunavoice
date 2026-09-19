import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";

export type SingularityState = {
  name: string;
  coreIntensity: number;
  diskSpeed: number;
  particleSpeed: number;
  colorShift: number;
  pulseRate: number;
  turbulence: number;
};

export const DEFAULT_SINGULARITY_STATES: SingularityState[] = [
  { name: "NOMINAL", coreIntensity: 1.0, diskSpeed: 0.3, particleSpeed: 0.5, colorShift: 0.0, pulseRate: 1.0, turbulence: 0.1 },
  { name: "AWAKENING", coreIntensity: 1.3, diskSpeed: 0.5, particleSpeed: 0.8, colorShift: 0.2, pulseRate: 1.5, turbulence: 0.2 },
  { name: "TURBULENT", coreIntensity: 1.8, diskSpeed: 0.8, particleSpeed: 1.2, colorShift: 0.5, pulseRate: 2.5, turbulence: 0.5 },
  { name: "COLLAPSE", coreIntensity: 2.5, diskSpeed: 1.5, particleSpeed: 2.0, colorShift: 1.0, pulseRate: 4.0, turbulence: 0.8 },
];

export type SingularityHorizonProps = {
  width?: string | number;
  height?: string | number;
  particles?: number;
  hud?: boolean;
  interactive?: boolean;
  autoRotate?: boolean;
  hudTitle?: string;
  hudSubtitle?: string;
  state?: SingularityState;
  className?: string;
  style?: CSSProperties;
};

const CORE_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const CORE_FRAG = `#version 300 es
precision highp float;
uniform float u_time;
uniform float u_intensity;
uniform float u_colorShift;
uniform float u_pulseRate;
uniform vec2 u_resolution;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = v_uv * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;
  
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  
  float pulse = sin(u_time * u_pulseRate) * 0.1 + 1.0;
  float core = smoothstep(0.4 * pulse, 0.0, dist) * u_intensity;
  
  float n = noise(uv * 3.0 + u_time * 0.5);
  core += n * 0.2 * smoothstep(0.3, 0.0, dist);
  
  vec3 color1 = vec3(0.1, 0.4, 0.8);
  vec3 color2 = vec3(0.8, 0.2, 0.5);
  vec3 color3 = vec3(0.2, 0.8, 0.6);
  
  float shift = u_colorShift + sin(u_time * 0.3) * 0.2;
  vec3 coreColor = mix(color1, mix(color2, color3, shift), shift);
  
  float glow = exp(-dist * 2.5) * u_intensity * 0.5;
  vec3 glowColor = mix(coreColor, vec3(1.0), 0.3);
  
  vec3 finalColor = coreColor * core + glowColor * glow;
  float alpha = core + glow * 0.5;
  
  fragColor = vec4(finalColor, alpha);
}`;

const DISK_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
uniform float u_time;
uniform float u_speed;
uniform float u_turbulence;
uniform mat4 u_rotation;
out vec2 v_uv;
out float v_depth;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  
  float angle = atan(a_position.y, a_position.x) + u_time * u_speed;
  float dist = length(a_position);
  
  vec2 warped = vec2(cos(angle), sin(angle)) * dist;
  float wave = sin(angle * 6.0 + u_time * 2.0) * u_turbulence * 0.1;
  
  vec4 pos = u_rotation * vec4(warped.x, wave, warped.y * 0.3, 1.0);
  v_depth = pos.z * 0.5 + 0.5;
  
  gl_Position = vec4(pos.xy, 0.0, 1.0);
}`;

const DISK_FRAG = `#version 300 es
precision highp float;
uniform float u_time;
uniform float u_colorShift;
in vec2 v_uv;
in float v_depth;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv * 2.0 - 1.0;
  float dist = length(uv);
  
  float ring = smoothstep(0.2, 0.25, dist) * smoothstep(1.0, 0.8, dist);
  float bands = sin(dist * 30.0 - u_time * 3.0) * 0.5 + 0.5;
  ring *= 0.7 + bands * 0.3;
  
  vec3 color1 = vec3(0.2, 0.5, 0.9);
  vec3 color2 = vec3(0.9, 0.3, 0.4);
  vec3 diskColor = mix(color1, color2, u_colorShift + dist * 0.3);
  
  float depthFade = mix(0.3, 1.0, v_depth);
  
  fragColor = vec4(diskColor * ring * depthFade, ring * 0.6);
}`;

const PARTICLE_VERT = `#version 300 es
precision highp float;
in vec3 a_position;
in float a_size;
in float a_alpha;
uniform float u_time;
uniform float u_speed;
uniform mat4 u_rotation;
uniform float u_aspect;
out float v_alpha;
out float v_dist;

void main() {
  float angle = atan(a_position.z, a_position.x) + u_time * u_speed * (0.5 + a_position.y * 0.5);
  float radius = length(vec2(a_position.x, a_position.z));
  
  vec3 pos = vec3(
    cos(angle) * radius,
    a_position.y + sin(u_time * 2.0 + a_position.x * 10.0) * 0.05,
    sin(angle) * radius
  );
  
  vec4 rotated = u_rotation * vec4(pos, 1.0);
  
  v_alpha = a_alpha * (0.5 + 0.5 * sin(u_time * 3.0 + a_position.x * 5.0));
  v_dist = length(rotated.xy);
  
  gl_Position = vec4(rotated.xy, 0.0, 1.0);
  gl_PointSize = a_size * (1.0 - v_dist * 0.3);
}`;

const PARTICLE_FRAG = `#version 300 es
precision highp float;
uniform float u_colorShift;
in float v_alpha;
in float v_dist;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);
  float circle = smoothstep(1.0, 0.3, dist);
  
  vec3 color = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.4, 0.6), u_colorShift);
  
  fragColor = vec4(color, circle * v_alpha * 0.6);
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
  return new Float32Array([
    c, 0, s, 0,
    0, 1, 0, 0,
    -s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

function mat4RotateX(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, -s, 0,
    0, s, c, 0,
    0, 0, 0, 1,
  ]);
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] = 
        a[i * 4] * b[j] +
        a[i * 4 + 1] * b[4 + j] +
        a[i * 4 + 2] * b[8 + j] +
        a[i * 4 + 3] * b[12 + j];
    }
  }
  return result;
}

export default function SingularityHorizon({
  width = "100%",
  height = "100%",
  particles = 4000,
  hud = true,
  interactive = true,
  autoRotate = true,
  hudTitle = "SINGULARITY HORIZON",
  hudSubtitle = "LUNA VOICE ACTIVE",
  state = DEFAULT_SINGULARITY_STATES[0],
  className = "",
  style = {},
}: SingularityHorizonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const rotationRef = useRef({ x: 0.3, y: 0 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [metrics, setMetrics] = useState({ fps: 60, particles: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  }, [interactive]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    rotationRef.current.y += dx * 0.005;
    rotationRef.current.x += dy * 0.005;
    rotationRef.current.x = Math.max(-1, Math.min(1, rotationRef.current.x));
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    const coreProgram = createProgram(gl, CORE_VERT, CORE_FRAG);
    const diskProgram = createProgram(gl, DISK_VERT, DISK_FRAG);
    const particleProgram = createProgram(gl, PARTICLE_VERT, PARTICLE_FRAG);

    if (!coreProgram || !diskProgram || !particleProgram) return;

    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const diskVerts: number[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      diskVerts.push(0, 0);
      diskVerts.push(Math.cos(angle), Math.sin(angle));
      diskVerts.push(Math.cos(angle + Math.PI * 2 / segments), Math.sin(angle + Math.PI * 2 / segments));
    }
    const diskBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, diskBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diskVerts), gl.STATIC_DRAW);

    const particleData: number[] = [];
    for (let i = 0; i < particles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.6;
      const height = (Math.random() - 0.5) * 0.3;
      particleData.push(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
        2 + Math.random() * 3,
        0.3 + Math.random() * 0.7
      );
    }
    const particleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particleData), gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    let startTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = startTime;

    const render = () => {
      const now = performance.now();
      const time = reducedMotion ? 0 : (now - startTime) / 1000;
      frameCount++;

      if (now - lastFpsUpdate > 1000) {
        setMetrics({ fps: Math.round(frameCount * 1000 / (now - lastFpsUpdate)), particles });
        frameCount = 0;
        lastFpsUpdate = now;
      }

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (autoRotate && !dragRef.current.active && !reducedMotion) {
        rotationRef.current.y += 0.002;
      }

      const rotY = mat4RotateY(rotationRef.current.y);
      const rotX = mat4RotateX(rotationRef.current.x);
      const rotation = mat4Multiply(rotX, rotY);

      gl.useProgram(diskProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, diskBuffer);
      const diskPosLoc = gl.getAttribLocation(diskProgram, "a_position");
      gl.enableVertexAttribArray(diskPosLoc);
      gl.vertexAttribPointer(diskPosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(diskProgram, "u_time"), time);
      gl.uniform1f(gl.getUniformLocation(diskProgram, "u_speed"), state.diskSpeed);
      gl.uniform1f(gl.getUniformLocation(diskProgram, "u_turbulence"), state.turbulence);
      gl.uniform1f(gl.getUniformLocation(diskProgram, "u_colorShift"), state.colorShift);
      gl.uniformMatrix4fv(gl.getUniformLocation(diskProgram, "u_rotation"), false, rotation);
      gl.drawArrays(gl.TRIANGLES, 0, diskVerts.length / 2);

      gl.useProgram(particleProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      const partPosLoc = gl.getAttribLocation(particleProgram, "a_position");
      const partSizeLoc = gl.getAttribLocation(particleProgram, "a_size");
      const partAlphaLoc = gl.getAttribLocation(particleProgram, "a_alpha");
      gl.enableVertexAttribArray(partPosLoc);
      gl.enableVertexAttribArray(partSizeLoc);
      gl.enableVertexAttribArray(partAlphaLoc);
      gl.vertexAttribPointer(partPosLoc, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(partSizeLoc, 1, gl.FLOAT, false, 20, 12);
      gl.vertexAttribPointer(partAlphaLoc, 1, gl.FLOAT, false, 20, 16);
      gl.uniform1f(gl.getUniformLocation(particleProgram, "u_time"), time);
      gl.uniform1f(gl.getUniformLocation(particleProgram, "u_speed"), state.particleSpeed);
      gl.uniform1f(gl.getUniformLocation(particleProgram, "u_colorShift"), state.colorShift);
      gl.uniform1f(gl.getUniformLocation(particleProgram, "u_aspect"), w / h);
      gl.uniformMatrix4fv(gl.getUniformLocation(particleProgram, "u_rotation"), false, rotation);
      gl.drawArrays(gl.POINTS, 0, particles);

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(coreProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const corePosLoc = gl.getAttribLocation(coreProgram, "a_position");
      gl.enableVertexAttribArray(corePosLoc);
      gl.vertexAttribPointer(corePosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(coreProgram, "u_time"), time);
      gl.uniform1f(gl.getUniformLocation(coreProgram, "u_intensity"), state.coreIntensity);
      gl.uniform1f(gl.getUniformLocation(coreProgram, "u_colorShift"), state.colorShift);
      gl.uniform1f(gl.getUniformLocation(coreProgram, "u_pulseRate"), state.pulseRate);
      gl.uniform2f(gl.getUniformLocation(coreProgram, "u_resolution"), w, h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
      gl.deleteProgram(coreProgram);
      gl.deleteProgram(diskProgram);
      gl.deleteProgram(particleProgram);
      gl.deleteBuffer(quadBuffer);
      gl.deleteBuffer(diskBuffer);
      gl.deleteBuffer(particleBuffer);
    };
  }, [particles, state, autoRotate, reducedMotion]);

  const containerStyle: CSSProperties = {
    position: "relative",
    width,
    height,
    overflow: "hidden",
    borderRadius: "12px",
    background: "#000",
    ...style,
  };

  const canvasStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "block",
    cursor: interactive ? "grab" : "default",
  };

  const hudStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "16px",
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: "rgba(100, 200, 255, 0.8)",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  };

  const cornerStyle: CSSProperties = {
    position: "absolute",
    width: "20px",
    height: "20px",
    border: "1px solid rgba(100, 200, 255, 0.4)",
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} style={canvasStyle} />
      
      {hud && (
        <div style={hudStyle}>
          <div style={{ ...cornerStyle, top: 0, left: 0, borderRight: "none", borderBottom: "none" }} />
          <div style={{ ...cornerStyle, top: 0, right: 0, borderLeft: "none", borderBottom: "none" }} />
          <div style={{ ...cornerStyle, bottom: 0, left: 0, borderRight: "none", borderTop: "none" }} />
          <div style={{ ...cornerStyle, bottom: 0, right: 0, borderLeft: "none", borderTop: "none" }} />
          
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>{hudTitle}</div>
            <div style={{ opacity: 0.6 }}>{hudSubtitle}</div>
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ opacity: 0.6 }}>STATE</div>
              <div style={{ fontSize: "11px", color: "rgba(150, 230, 255, 0.9)" }}>{state.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ opacity: 0.6 }}>METRICS</div>
              <div style={{ fontSize: "9px" }}>
                {metrics.fps} FPS • {metrics.particles.toLocaleString()} PX
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
