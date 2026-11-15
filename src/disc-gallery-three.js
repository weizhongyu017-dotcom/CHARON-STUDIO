/**
 * Disc gallery ported from a24.raviklaassens.com (Three.js r178).
 * Pose: x=sin(θ)*hGap*2.4, z=-cos(θ)*depth*2.4+depth*2.4, θ=(i-p)*0.35
 * Gallery tilt: galleryRotX/Y = -30°
 * Mesh: Ring face + Lathe edge + 3-part hub (frost/matrix/hub), rotX=π/2
 * Cover: evenodd punch through hub; Ring UV remapped like A24 `an()`
 * Hover halo: homepage-style floating water ripple, tinted by cover palette
 */
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

try {
  RectAreaLightUniformsLib.init();
} catch {
  /* ignore */
}

const CFG = {
  galleryScale: 1.12,
  hGap: 2.3,
  depthGap: 1,
  activeDiscY: 0.06,
  galleryRotX: -30,
  galleryRotY: -30,
  inactiveScale: 0.8,
  cameraDistance: 3.85,
  cameraFOV: 40,
  exposure: 1,
  holeSize: 0.14,
  hubSize: 0.24,
  hubMatrixWidth: 0.4,
  hubFrostedEdge: 0.54,
  discThickness: 0.01,
  edgeBevel: 1,
  edgeBleed: 0.026,
  edgeColor: "#FFFFFF",
  edgeRoughness: 0.04,
  edgeMetalness: 0.55,
  hubColor: "#FFFFFF",
  hubTransmission: 0.68,
  hubRoughness: 0.38,
  hubIOR: 2,
  frontRough: 0.48,
  frontMetal: 0.08,
  frontClearcoat: 0.35,
  keyIntensity: 0.85,
  keyColor: "#FFF9E8",
  fillIntensity: 0.45,
  rimIntensity: 0.55,
  rimColor: "#499FF5",
  topStripIntensity: 1.9,
  flowLean: 0.055,
  flowLeanMax: 0.3,
  flowBank: 0.32,
  flowDip: 0.014,
  flowDipMax: 0.09,
  followTight: 15,
  followBase: 11,
  followFalloff: 1.15,
  followMin: 6.5,
  hoverTiltStrength: 0.21,
  friction: 0.89,
  spinGain: 0.0032,
  spinMax: 7,
  spinFollow: 9,
  spinFriction: 2.4,
  idleSpin: -0.14,
  renderRadius: 5,
  rippleLag: 12,
  rippleSize: 2.55,
  artResolution: 1024,
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** A24 `an()` — map ring XY → UV so square cover fills the disc face */
function remapRingUV(geo) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    uv.setXY(i, pos.getX(i) * 0.5 + 0.5, pos.getY(i) * 0.5 + 0.5);
  }
  uv.needsUpdate = true;
}

/** A24 edge lathe — profile in XY, then mesh.rotation.x = π/2 */
function makeEdgeGeometry(thickness, bevel) {
  const half = thickness / 2;
  const t = 0.0015 + bevel * Math.min(thickness * 0.55, 0.018);
  const inner = 1 - CFG.edgeBleed;
  const pts = [
    new THREE.Vector2(inner, half),
    new THREE.Vector2(1 - t, half),
    new THREE.Vector2(1, half - t),
    new THREE.Vector2(1, -half + t),
    new THREE.Vector2(1 - t, -half),
    new THREE.Vector2(inner, -half),
  ];
  const geo = new THREE.LatheGeometry(pts, 256);
  geo.computeVertexNormals();
  return geo;
}

/** A24 hub lathe `tn(innerR, outerR, thickness, profile, segs)` */
function makeHubLathe(innerR, outerR, thickness, profile, segs = 160) {
  const half = thickness / 2;
  const r0 = Math.max(0.002, innerR);
  const span = Math.max(1e-4, outerR - r0);
  const pts = [new THREE.Vector2(r0, -half), new THREE.Vector2(r0, half)];
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    const r = r0 + span * t;
    const y = half * (1 - profile) + half * profile * (0.6 + 0.4 * Math.cos(t * Math.PI * 3));
    pts.push(new THREE.Vector2(r, y));
  }
  pts.push(new THREE.Vector2(outerR, half * 0.92));
  pts.push(new THREE.Vector2(outerR, -half * 0.92));
  for (let i = 5; i >= 0; i -= 1) {
    const t = i / 5;
    const r = r0 + span * t;
    const y = -(half * (1 - profile) + half * profile * (0.6 + 0.4 * Math.cos(t * Math.PI * 3)));
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, segs);
  geo.computeVertexNormals();
  return geo;
}

function makeMatrixTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(256, 256, 40.96, 256, 256, 256);
  g.addColorStop(0, "#d9dde4");
  g.addColorStop(0.42, "#f0f2f5");
  g.addColorStop(0.72, "#cfd4dc");
  g.addColorStop(1, "#b8bec8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineWidth = 1;
  [0.255, 0.285, 0.315, 0.345].forEach((r, n) => {
    ctx.strokeStyle = `rgba(255,255,255,${0.14 - n * 0.018})`;
    ctx.beginPath();
    ctx.arc(256, 256, 512 * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function hexToRgb01(hex) {
  const c = new THREE.Color(hex || "#8fb38a");
  return [c.r, c.g, c.b];
}

function paletteFromHue(hex) {
  const [r, g, b] = hexToRgb01(hex);
  const lift = (t) => [
    Math.min(1, r * (1 - t) + 0.92 * t),
    Math.min(1, g * (1 - t) + 0.94 * t),
    Math.min(1, b * (1 - t) + 0.96 * t),
  ];
  const deep = (t) => [
    Math.max(0.04, r * (1 - t) * 0.7 + 0.05),
    Math.max(0.04, g * (1 - t) * 0.65 + 0.04),
    Math.max(0.05, b * (1 - t) * 0.75 + 0.06),
  ];
  return [lift(0.12), [r, g, b], deep(0.25), lift(0.45)];
}

/**
 * Homepage-field-style floating water ripple around the focused disc.
 * Soft concentric rings + fbm warp; colors follow cover palette.
 */
function makeWaterRipple() {
  const uniforms = {
    uTime: { value: 0 },
    uStrength: { value: 0 },
    uC0: { value: new THREE.Vector3(0.55, 0.72, 0.68) },
    uC1: { value: new THREE.Vector3(0.35, 0.55, 0.62) },
    uC2: { value: new THREE.Vector3(0.22, 0.38, 0.48) },
    uC3: { value: new THREE.Vector3(0.7, 0.82, 0.78) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.NormalBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uC0;
      uniform vec3 uC1;
      uniform vec3 uC2;
      uniform vec3 uC3;

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
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.05;
          a *= 0.52;
        }
        return v;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r0 = length(p);
        if (r0 < 0.74 || r0 > 1.0 || uStrength < 0.01) discard;

        float t = uTime * 0.62;
        float ang = atan(p.y, p.x);

        // domain-warp like homepage field — soft water drift
        vec2 q = p * 1.45;
        float warp = fbm(q * 1.55 + t * 0.4);
        q += (warp - 0.5) * 0.2;
        q += 0.05 * vec2(sin(t * 0.65 + ang * 2.0), cos(t * 0.5 - ang * 1.5));

        float n = fbm(q * 2.0 + t * 0.35);
        float n2 = fbm(q * 3.4 - t * 0.7 + n * 1.2);

        // radius wobble → floating irregular rings
        float r = r0 + (n - 0.5) * 0.045 + (n2 - 0.5) * 0.025;

        float band = 0.0;
        // outer traveling ripples
        float w1 = abs(sin((r - 0.82) * 42.0 - t * 3.1 + n * 2.2));
        band += smoothstep(0.55, 0.08, w1);
        float w2 = abs(sin((r - 0.78) * 28.0 + t * 2.2 + n2 * 1.8));
        band += 0.7 * smoothstep(0.5, 0.1, w2);
        float w3 = abs(sin((r - 0.86) * 18.0 - t * 1.4));
        band += 0.45 * smoothstep(0.42, 0.12, w3);

        // soft chromatic mist between rings (field bloom)
        float mist = smoothstep(0.4, 0.92, n2) * smoothstep(0.76, 0.88, r0) * 0.35;

        float veil = smoothstep(0.76, 0.86, r0) * (1.0 - smoothstep(0.94, 1.0, r0));
        veil *= 0.75 + 0.25 * sin(ang * 3.0 + t + n);

        vec3 col = mix(uC0, uC1, smoothstep(0.15, 0.9, n));
        col = mix(col, uC2, mist * 0.85);
        col = mix(col, uC3, band * 0.65);
        col += uC1 * band * 0.2;

        float alpha = (band * 0.78 + mist * 0.32) * veil * uStrength;
        alpha = clamp(alpha, 0.0, 0.8);
        if (alpha < 0.025) discard;

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CFG.rippleSize, CFG.rippleSize), mat);
  mesh.renderOrder = 900;
  mesh.visible = false;
  mesh.frustumCulled = false;

  const targetColors = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  const currentColors = [
    uniforms.uC0.value.clone(),
    uniforms.uC1.value.clone(),
    uniforms.uC2.value.clone(),
    uniforms.uC3.value.clone(),
  ];

  function setPalette(colors, hexFallback) {
    let cols = colors;
    if (!cols || cols.length < 4) cols = paletteFromHue(hexFallback);
    for (let i = 0; i < 4; i += 1) {
      const c = cols[i] || cols[0];
      targetColors[i].set(c[0], c[1], c[2]);
    }
  }

  function update(dt, time, strength) {
    uniforms.uTime.value = time;
    uniforms.uStrength.value = lerp(uniforms.uStrength.value, strength, Math.min(1, dt * 8));
    for (let i = 0; i < 4; i += 1) {
      currentColors[i].lerp(targetColors[i], Math.min(1, dt * 3.2));
      uniforms[`uC${i}`].value.copy(currentColors[i]);
    }
    mesh.visible = uniforms.uStrength.value > 0.01;
  }

  return {
    mesh,
    mat,
    setPalette,
    update,
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

function punchCoverTexture(image, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const hole = size * 0.5 * Math.max(CFG.holeSize, CFG.hubSize);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.arc(size / 2, size / 2, hole, 0, Math.PI * 2, true);
  ctx.clip("evenodd");
  ctx.fillStyle = "#0c0c0e";
  ctx.fillRect(0, 0, size, size);
  const aspect = image.naturalWidth / image.naturalHeight;
  let dw = size;
  let dh = size;
  if (aspect > 1) dw = dh * aspect;
  else dh = dw / aspect;
  ctx.drawImage(image, -dw / 2 + size / 2, -dh / 2 + size / 2, dw, dh);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function loadCoverTexture(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        resolve(punchCoverTexture(img, CFG.artResolution));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function bindDiscGallery(root, { items, startIndex = 0, onActive, onOpen } = {}) {
  const host = root.querySelector(".disc-viewport");
  if (!host || !items?.length) return () => {};

  const track = root.querySelector(".disc-track");
  if (track) track.remove();
  const oldRing = root.querySelector(".disc-focus-ring");
  if (oldRing) oldRing.remove();

  const metaTitle = root.querySelector("[data-disc-title]");
  const metaArtist = root.querySelector("[data-disc-artist]");
  const metaYear = root.querySelector("[data-disc-year]");
  const metaMonth = root.querySelector("[data-disc-month]");
  const metaStar = root.querySelector("[data-disc-star]");
  const metaPlays = root.querySelector("[data-disc-plays]");
  const metaQuote = root.querySelector("[data-disc-quote]");

  let active = clamp(startIndex, 0, items.length - 1);
  let progress = active;
  let velocity = 0;
  let target = null;
  let dragging = false;
  let dragLastX = 0;
  let dragLastT = 0;
  let moved = false;
  let hoverIndex = -1;
  let lastEmit = -1;
  let destroyed = false;
  let raf = 0;
  let faceSpin = 0;
  let faceSpinVel = 0;
  const rippleT0 = performance.now();

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CFG.exposure;
  host.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, {
    width: "100%",
    height: "100%",
    display: "block",
    touchAction: "none",
  });

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(CFG.cameraFOV, 1, 0.1, 100);
  camera.position.set(0, 0, CFG.cameraDistance);
  camera.lookAt(0, 0, 0);

  const gallery = new THREE.Group();
  gallery.rotation.x = THREE.MathUtils.degToRad(CFG.galleryRotX);
  gallery.rotation.y = THREE.MathUtils.degToRad(CFG.galleryRotY);
  gallery.scale.setScalar(CFG.galleryScale);
  scene.add(gallery);

  const key = new THREE.DirectionalLight(CFG.keyColor, CFG.keyIntensity);
  key.position.set(2.5, 1.5, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, CFG.fillIntensity);
  fill.position.set(-4, 0.5, 4);
  scene.add(fill);
  const faceFill = new THREE.DirectionalLight(0xffffff, 0.28);
  faceFill.position.set(0, 0, 7);
  scene.add(faceFill);
  const rim = new THREE.DirectionalLight(CFG.rimColor, CFG.rimIntensity);
  rim.position.set(0, 3, -6);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.48));

  // A24 top strip — RectAreaLight for hub specular (fallback to directional)
  let topStrip = null;
  try {
    topStrip = new THREE.RectAreaLight(0xffffff, CFG.topStripIntensity, 6, 0.4);
    topStrip.position.set(0, 3.2, 3);
    topStrip.lookAt(0, 0, 0);
    scene.add(topStrip);
  } catch {
    const topDir = new THREE.DirectionalLight(0xffffff, CFG.topStripIntensity * 0.55);
    topDir.position.set(0, 3.2, 3);
    scene.add(topDir);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  // Brighter multi-light env so hub transmission reads as clear plastic, not tinted glass
  const envScene = new THREE.Scene();
  envScene.add(new THREE.AmbientLight(0xffffff, 1.15));
  envScene.add(new THREE.HemisphereLight(0xffffff, 0xa8b0bc, 1.2));
  const envKey = new THREE.DirectionalLight(0xfff7ea, 1.6);
  envKey.position.set(2.2, 4.5, 3.2);
  envScene.add(envKey);
  const envFill = new THREE.DirectionalLight(0xdfe8ff, 0.9);
  envFill.position.set(-3, 1.5, 2);
  envScene.add(envFill);
  const envRim = new THREE.DirectionalLight(0x9ec5ff, 0.7);
  envRim.position.set(0, 2, -4);
  envScene.add(envRim);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();

  // --- shared geometries (exact A24 layout) ---
  const holeR = CFG.holeSize; // Xt/2
  const hubR = CFG.hubSize; // Zt
  const span = hubR - holeR;
  const frostOuter = holeR + span * 0.34;
  const matrixOuter = frostOuter + span * CFG.hubMatrixWidth;
  const hubThick = CFG.discThickness * 1.02;
  const faceOuter = 1 - CFG.edgeBleed;

  const edgeGeo = makeEdgeGeometry(CFG.discThickness, CFG.edgeBevel);
  const frontGeo = new THREE.RingGeometry(hubR, faceOuter, 220, 1);
  const backGeo = new THREE.RingGeometry(hubR, faceOuter, 220, 1);
  remapRingUV(frontGeo);
  remapRingUV(backGeo);
  const hubGeo = makeHubLathe(matrixOuter, hubR, hubThick, 0.22, 160);
  const matrixGeo = makeHubLathe(frostOuter, matrixOuter, hubThick * 0.88, 0.12, 128);
  const frostGeo = makeHubLathe(holeR, frostOuter, hubThick * 0.96, 0.4, 128);
  const pickGeo = new THREE.CircleGeometry(1, 24);

  // Exact A24 materials
  const edgeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(CFG.edgeColor),
    roughness: CFG.edgeRoughness,
    metalness: CFG.edgeMetalness,
    clearcoat: 0.7,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
  });
  const matrixTex = makeMatrixTexture();
  const hubMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(CFG.hubColor),
    roughness: CFG.hubRoughness,
    metalness: 0,
    transmission: CFG.hubTransmission,
    thickness: 0.6,
    ior: CFG.hubIOR,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.3,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const matrixMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(14672873),
    map: matrixTex,
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.45,
    side: THREE.DoubleSide,
  });
  const frostMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(15659509),
    roughness: 0.25 + CFG.hubFrostedEdge * 0.55,
    metalness: 0,
    transmission: (1 - CFG.hubFrostedEdge) * 0.5,
    thickness: 0.3,
    ior: 1.5,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.9,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a1e2a,
    roughness: 0.23,
    metalness: 1,
    clearcoat: 0.34,
    clearcoatRoughness: 0.06,
    iridescence: 1,
    iridescenceIOR: 1.86,
    iridescenceThicknessRange: [140, 900],
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  });
  const placeholder = document.createElement("canvas");
  placeholder.width = 16;
  placeholder.height = 16;
  const pctx = placeholder.getContext("2d");
  pctx.fillStyle = "#0c0c0e";
  pctx.fillRect(0, 0, 16, 16);
  const placeholderTex = new THREE.CanvasTexture(placeholder);
  placeholderTex.colorSpace = THREE.SRGBColorSpace;

  const ripple = makeWaterRipple();
  gallery.add(ripple.mesh);
  ripple.setPalette(null, items[active]?.hue || "#8fb38a");

  const halfT = CFG.discThickness / 2;

  const discs = items.map((item, index) => {
    const group = new THREE.Group();
    const spin = new THREE.Group();
    group.add(spin);

    const frontMat = new THREE.MeshPhysicalMaterial({
      map: placeholderTex,
      color: 0xffffff,
      roughness: CFG.frontRough,
      metalness: CFG.frontMetal,
      clearcoat: CFG.frontClearcoat,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.35,
      side: THREE.FrontSide,
    });

    const front = new THREE.Mesh(frontGeo, frontMat);
    front.position.z = halfT + 0.0006;
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.z = -halfT - 0.0006;
    back.rotation.y = Math.PI;

    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.rotation.x = Math.PI / 2;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    const matrix = new THREE.Mesh(matrixGeo, matrixMat);
    matrix.rotation.x = Math.PI / 2;
    const frost = new THREE.Mesh(frostGeo, frostMat);
    frost.rotation.x = Math.PI / 2;

    // A24 order: front, back, edge, hub, matrix, frost
    spin.add(front, back, edge, hub, matrix, frost);

    const pick = new THREE.Mesh(
      pickGeo,
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide, depthWrite: false })
    );
    pick.userData.index = index;
    pick.renderOrder = -1;
    group.add(pick);
    group.visible = false;
    gallery.add(group);

    loadCoverTexture(item.cover).then((tex) => {
      if (destroyed) {
        tex?.dispose();
        return;
      }
      if (tex) {
        frontMat.map = tex;
        frontMat.needsUpdate = true;
      }
    });

    return { item, index, group, spin, frontMat, pick, hover: 0 };
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function depthRadius() {
    return Math.max(CFG.discThickness * 3, 0.12, CFG.depthGap);
  }

  function applyMeta(item) {
    if (!item) return;
    if (metaTitle) metaTitle.textContent = item.title || "";
    if (metaArtist) metaArtist.textContent = item.artist || "";
    if (metaYear) metaYear.textContent = item.year || "";
    if (metaMonth) metaMonth.textContent = item.monthLabel || "";
    if (metaStar) metaStar.textContent = item.star || "";
    if (metaPlays) metaPlays.textContent = item.plays || "";
    if (metaQuote) metaQuote.textContent = item.quote || "";
  }

  function setActive(i, { force } = {}) {
    active = clamp(i, 0, items.length - 1);
    applyMeta(items[active]);
    if (force || lastEmit !== active) {
      ripple.setPalette(items[active]?.palette || null, items[active]?.hue || "#8fb38a");
    }
    if ((force || lastEmit !== active) && typeof onActive === "function") {
      lastEmit = active;
      onActive({ index: active, ...items[active] });
    }
  }

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function poseDiscs(dt) {
    const focus = Math.round(clamp(progress, 0, items.length - 1));
    const lean = clamp(
      Math.sign(velocity) * Math.sqrt(Math.abs(velocity)) * CFG.flowLean * 40,
      -CFG.flowLeanMax,
      CFG.flowLeanMax
    );
    const dip = Math.min(CFG.flowDipMax, Math.abs(velocity) * CFG.flowDip * 40);
    const depthR = depthRadius();
    let focusDisc = null;

    discs.forEach((d) => {
      const m = d.index - progress;
      const abs = Math.abs(m);
      const isActive = d.index === focus;
      const theta = m * 0.35;
      const x = Math.sin(theta) * CFG.hGap * 2.4;
      const y = (isActive ? CFG.activeDiscY : 0) - dip * (isActive ? 0.7 : 1);
      const z = -Math.cos(theta) * depthR * 2.4 + depthR * 2.4;

      // A24: rotY = -theta + lean — orbit yaw, not a flat diagonal translate
      let rotX = 0;
      let rotY = -theta + lean * (isActive ? 1 : 1.12);
      let rotZ = -lean * CFG.flowBank * (isActive ? 0.7 : 1);

      const follow = clamp(
        (isActive ? CFG.followTight : CFG.followBase) - abs * CFG.followFalloff,
        CFG.followMin,
        CFG.followTight
      );
      const scale = isActive
        ? 1
        : Math.max(CFG.inactiveScale, 1 - abs * (1 - CFG.inactiveScale) * 0.6);

      d.hover = lerp(d.hover, hoverIndex === d.index ? 1 : 0, Math.min(1, dt * 10));
      if (d.hover > 0.001) {
        rotX += d.hover * CFG.hoverTiltStrength;
        rotY += d.hover * CFG.hoverTiltStrength * 0.35;
      }

      const visible = abs <= CFG.renderRadius + 0.5;
      d.group.visible = visible;
      if (!visible) return;

      const k = clamp(follow * dt, 0.08, 1);
      d.group.position.x = lerp(d.group.position.x, x, k);
      d.group.position.y = lerp(d.group.position.y, y, k);
      d.group.position.z = lerp(d.group.position.z, z, k);
      d.group.rotation.x = lerp(d.group.rotation.x, rotX, k);
      d.group.rotation.y = lerp(d.group.rotation.y, rotY, k);
      d.group.rotation.z = lerp(d.group.rotation.z, rotZ, k);
      const s = lerp(d.group.scale.x, scale, k);
      d.group.scale.setScalar(s);
      d.group.renderOrder = Math.round(500 + z * 10);

      if (isActive) {
        d.spin.rotation.z = faceSpin;
        focusDisc = d;
      } else {
        d.spin.rotation.z = lerp(d.spin.rotation.z, 0, Math.min(1, dt * 4));
      }
    });

    if (focusDisc) {
      const lag = 1 - Math.exp(-Math.max(0, CFG.rippleLag) * dt);
      ripple.mesh.position.lerp(focusDisc.group.position, lag);
      ripple.mesh.position.z = focusDisc.group.position.z + 0.05;
      ripple.mesh.quaternion.slerp(focusDisc.group.quaternion, lag);
      ripple.mesh.scale.lerp(focusDisc.group.scale, lag);
    }
  }

  let lastT = performance.now();
  function tick(now) {
    if (destroyed) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!dragging) {
      if (target != null) {
        progress = lerp(progress, target, 1 - Math.exp(-dt * 10));
        if (Math.abs(progress - target) < 0.002) {
          progress = target;
          target = null;
          velocity = 0;
        }
      } else {
        progress += velocity * dt * 8;
        velocity *= Math.pow(CFG.friction, dt * 60);
        if (Math.abs(velocity) < 0.0005) velocity = 0;

        if (progress < 0) {
          progress = lerp(progress, 0, 0.2);
          velocity *= 0.5;
        } else if (progress > items.length - 1) {
          progress = lerp(progress, items.length - 1, 0.2);
          velocity *= 0.5;
        }

        if (Math.abs(velocity) < 0.01) {
          const snap = Math.round(clamp(progress, 0, items.length - 1));
          progress = lerp(progress, snap, 1 - Math.exp(-dt * 12));
          if (Math.abs(progress - snap) < 0.003) {
            progress = snap;
            velocity = 0;
          }
        }
      }
    }

    {
      const targetSpin = clamp(-velocity * CFG.spinGain * 120, -CFG.spinMax, CFG.spinMax);
      if (Math.abs(targetSpin) > Math.abs(faceSpinVel) * 0.5) {
        faceSpinVel = lerp(faceSpinVel, targetSpin, Math.min(1, dt * CFG.spinFollow));
      } else {
        faceSpinVel *= Math.exp(-dt * CFG.spinFriction);
      }
      faceSpin = (faceSpin + (faceSpinVel + CFG.idleSpin * 0.35) * dt) % (Math.PI * 2);
    }

    const idx = Math.round(clamp(progress, 0, items.length - 1));
    if (idx !== active) setActive(idx);

    poseDiscs(dt);

    {
      const hovering = hoverIndex === active;
      const strength = hovering ? 1 : 0.48;
      ripple.update(dt, (now - rippleT0) / 1000, strength);
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  function scrollToIndex(i) {
    target = clamp(i, 0, items.length - 1);
    velocity = 0;
    hoverIndex = -1;
  }

  function pickIndex(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      discs.filter((d) => d.group.visible).map((d) => d.pick),
      false
    );
    if (!hits.length) return -1;
    return hits[0].object.userData.index;
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    target = null;
    velocity += delta * 0.0016;
    hoverIndex = -1;
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest?.("[data-jump-year]")) return;
    dragging = true;
    moved = false;
    dragLastX = e.clientX;
    dragLastT = performance.now();
    velocity = 0;
    target = null;
    renderer.domElement.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    const i = pickIndex(e.clientX, e.clientY);
    hoverIndex = i;
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - dragLastX;
    const dt = Math.max(8, now - dragLastT);
    if (Math.abs(dx) > 3) moved = true;
    progress -= dx / 280;
    velocity = (-dx / dt) * 0.35;
    dragLastX = e.clientX;
    dragLastT = now;
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!moved) {
      const i = pickIndex(e.clientX, e.clientY);
      if (i < 0) return;
      if (i !== active) scrollToIndex(i);
      else if (typeof onOpen === "function" && items[i].href) onOpen(items[i].href);
    }
  }

  host.addEventListener("wheel", onWheel, { passive: false });
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("resize", resize);

  root.querySelectorAll("[data-jump-year]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const y = Number(btn.dataset.jumpYear);
      const i = items.findIndex((it) => Number(it.year) === y);
      if (i >= 0) scrollToIndex(i);
    });
  });

  root.__discGallery = {
    get progress() {
      return progress;
    },
    setProgress(v) {
      target = null;
      progress = clamp(v, 0, items.length - 1);
      velocity = 0;
    },
    setRipplePalette(colors, hue) {
      ripple.setPalette(colors, hue || items[active]?.hue);
    },
    getCFG: () => CFG,
    gallery,
    camera,
  };

  resize();
  setActive(active, { force: true });
  const depthR = depthRadius();
  discs.forEach((d) => {
    const m = d.index - progress;
    const theta = m * 0.35;
    d.group.position.set(
      Math.sin(theta) * CFG.hGap * 2.4,
      d.index === active ? CFG.activeDiscY : 0,
      -Math.cos(theta) * depthR * 2.4 + depthR * 2.4
    );
    d.group.rotation.set(0, -theta, 0);
    d.group.scale.setScalar(d.index === active ? 1 : CFG.inactiveScale);
    d.group.visible = Math.abs(m) <= CFG.renderRadius;
  });
  raf = requestAnimationFrame(tick);

  return function destroy() {
    destroyed = true;
    cancelAnimationFrame(raf);
    host.removeEventListener("wheel", onWheel);
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("resize", resize);
    discs.forEach((d) => {
      if (d.frontMat.map && d.frontMat.map !== placeholderTex) d.frontMat.map.dispose();
      d.frontMat.dispose();
    });
    edgeGeo.dispose();
    frontGeo.dispose();
    backGeo.dispose();
    hubGeo.dispose();
    matrixGeo.dispose();
    frostGeo.dispose();
    pickGeo.dispose();
    edgeMat.dispose();
    hubMat.dispose();
    matrixMat.dispose();
    frostMat.dispose();
    backMat.dispose();
    matrixTex.dispose();
    placeholderTex.dispose();
    ripple.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
