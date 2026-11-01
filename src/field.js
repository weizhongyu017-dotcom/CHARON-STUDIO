import { HOME_PALETTE } from "./palette.js";

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mode;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.52;
  }
  return v;
}

vec3 saturateCol(vec3 c, float amount) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, amount);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_res.x / u_res.y;

  vec2 m = u_mouse * 2.0 - 1.0;
  m.x *= u_res.x / u_res.y;

  // keep motion calm; push contrast via shape + chroma instead
  float t = u_time * (0.065 + u_mode * 0.04);

  // deeper domain warp → clearer color islands
  vec2 q = p * 0.78;
  float warp = fbm(q * 1.35 + t * 0.55);
  q += (warp - 0.5) * 1.15;
  q += vec2(sin(t * 0.55 + warp), cos(t * 0.42 - warp)) * 0.38;
  q += (m - p) * 0.16;

  float n = fbm(q * 1.55 + t);
  float n2 = fbm(q * 2.2 - t * 0.9 + n * 1.4);
  float n3 = fbm(q * 3.1 + n2 + t * 0.35);

  float vein = smoothstep(0.32, 0.78, n2);
  float bloom = smoothstep(0.55, 0.95, n3);
  float ember = smoothstep(0.2, 0.7, n) * (0.55 + 0.45 * (1.0 - uv.y));
  float mist = smoothstep(0.4, 0.95, n2 + n * 0.25);

  vec3 c0 = saturateCol(u_c0, 1.28);
  vec3 c1 = saturateCol(u_c1, 1.32);
  vec3 c2 = saturateCol(u_c2, 1.35);
  vec3 c3 = saturateCol(u_c3, 1.38);

  vec3 ink = vec3(0.0, 0.005, 0.015);
  vec3 col = mix(c0, c1, smoothstep(0.15, 0.85, n));
  col = mix(col, c2, mist * 0.82);
  col = mix(col, c3, ember * 0.78);
  col = mix(col, c3 * 0.5 + c1 * 0.4, vein * 0.48);
  col += c2 * bloom * 0.2;
  col += c3 * bloom * ember * 0.16;

  // middle exposure: readable color, still nocturnal
  col = mix(ink, col, 0.88);
  col *= 0.55 + vein * 0.38 + bloom * 0.22;
  col = saturateCol(col, 1.15 + u_mode * 0.12);
  col = pow(max(col, vec3(0.0)), vec3(0.98));

  float vignette = smoothstep(1.5, 0.1, length(p * 0.8));
  col *= mix(0.42, 1.0, vignette);

  gl_FragColor = vec4(col, 1.0);
}
`;

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function startField(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return { setPalette() {}, setMode() {}, destroy() {} };

  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );

  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "u_res");
  const uTime = gl.getUniformLocation(program, "u_time");
  const uMouse = gl.getUniformLocation(program, "u_mouse");
  const uMode = gl.getUniformLocation(program, "u_mode");
  const uC = [0, 1, 2, 3].map((i) => gl.getUniformLocation(program, `u_c${i}`));

  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  const onMove = (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = 1 - e.clientY / window.innerHeight;
  };
  window.addEventListener("pointermove", onMove);

  let current = HOME_PALETTE.map((c) => [...c]);
  let target = HOME_PALETTE.map((c) => [...c]);
  let mode = 0;
  let modeT = 0;

  const applyUniforms = () => {
    current.forEach((c, i) => gl.uniform3f(uC[i], c[0], c[1], c[2]));
  };
  applyUniforms();

  let raf = 0;
  const t0 = performance.now();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = document.hidden;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener("resize", resize);

  const paint = (now) => {
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    modeT += (mode - modeT) * 0.04;
    for (let i = 0; i < 4; i++) current[i] = lerp3(current[i], target[i], 0.035);
    applyUniforms();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    const time = reducedMotion.matches ? 0 : (now - t0) / 1000;
    gl.uniform1f(uTime, time);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uMode, modeT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const tick = (now) => {
    paint(now);
    if (!paused && !reducedMotion.matches) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
    }
  };

  const start = () => {
    if (raf || paused) return;
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onVisibility = () => {
    paused = document.hidden;
    if (paused) stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onMotionChange = () => {
    stop();
    paint(performance.now());
    if (!reducedMotion.matches) start();
  };
  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener("change", onMotionChange);
  } else if (reducedMotion.addListener) {
    reducedMotion.addListener(onMotionChange);
  }

  paint(performance.now());
  if (!reducedMotion.matches && !paused) start();

  return {
    setPalette(colors) {
      if (!colors || colors.length < 4) return;
      target = colors.map((c) => [...c]);
      if (reducedMotion.matches || paused) paint(performance.now());
    },
    setMode(next) {
      mode = next ? 1 : 0;
      if (reducedMotion.matches || paused) paint(performance.now());
    },
    destroy() {
      stop();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
