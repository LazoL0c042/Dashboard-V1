import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { clamp, easeInOut } from './util.js';

// Globale Uniforms (Zeit, Wind) – von allen Materialien geteilt
export const U = { time: { value: 0 }, wind: { value: 1 } };

// Wind-Shader-Patch für Laub, Gras, Nadeln
export function windify(mat, { amp = 0.15, sway = true, freq = 1 } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTime = U.time; sh.uniforms.uWind = U.wind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uWind;\n${sway ? 'attribute float sway;' : ''}`)
      .replace('#include <project_vertex>', `
        float wW = ${sway ? 'sway' : 'uv.y'};
        vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        vec4 wpw = modelMatrix * wp;
        float ph = wpw.x * 0.35 + wpw.z * 0.27;
        float f = ${freq.toFixed(3)};
        wp.x += (sin(uTime * 1.3 * f + ph) * 0.6 + sin(uTime * 3.1 * f + ph * 2.3) * 0.22) * wW * ${amp.toFixed(3)} * uWind;
        wp.z += cos(uTime * 1.07 * f + ph * 1.3) * 0.45 * wW * ${amp.toFixed(3)} * uWind;
        wp.y += sin(uTime * 2.0 * f + ph) * wW * ${(amp * 0.15).toFixed(3)} * uWind;
        vec4 mvPosition = modelViewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => `wind${amp}${sway}${freq}`;
  return mat;
}

// Auflösen (Überblenden/Zerfall): uVis 0..1, uCut = lokale Höhe, ab der weggeschnitten wird
export function dissolvable(mat, u = { vis: { value: 1 }, cut: { value: 1e6 } }) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uVis = u.vis; sh.uniforms.uCut = u.cut;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDWp; varying float vDLy;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vDWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vDLy = transformed.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vDWp; varying float vDLy; uniform float uVis; uniform float uCut;
      float dHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float dNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (vDLy > uCut) discard;
      if (uVis < 0.999) { float n = dNoise(vDWp * 3.1) * 0.65 + dNoise(vDWp * 11.0) * 0.35; if (n > uVis) discard; }`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.customProgramCacheKey = () => key + 'dissolve';
  return u;
}

// ---------- Kupferstich-Pass ----------
const EngraveShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) }, dpr: { value: 1 },
    cameraNear: { value: 0.1 }, cameraFar: { value: 1000 }, time: { value: 0 },
    ink: { value: new THREE.Color(0.035, 0.022, 0.014) },
    hatch: { value: 0.35 }, outline: { value: 0.8 }, lineFadeStart: { value: 25 }, lineFadeEnd: { value: 140 },
    sepia: { value: 0.12 }, tint: { value: new THREE.Color(1, 1, 1) }, tintAmt: { value: 0.0 },
    focus: { value: 12 }, dof: { value: 0.0 }, vignette: { value: 0.55 }, grain: { value: 0.06 },
    hatchScale: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    #include <packing>
    varying vec2 vUv;
    uniform sampler2D tDiffuse; uniform sampler2D tDepth;
    uniform vec2 resolution; uniform float dpr; uniform float cameraNear; uniform float cameraFar; uniform float time;
    uniform vec3 ink; uniform float hatch; uniform float outline; uniform float lineFadeStart; uniform float lineFadeEnd;
    uniform float sepia; uniform vec3 tint; uniform float tintAmt; uniform float focus; uniform float dof;
    uniform float vignette; uniform float grain; uniform float hatchScale;
    float linZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }
    float tl(vec3 c){ c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float lineMask(float c, float period, float w){ float f = abs(fract(c / period) - 0.5) * period; return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.9, f); }
    const vec2 PD[12] = vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));
    void main(){
      vec2 px = 1.0 / resolution;
      float z = linZ(vUv);
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      // Tiefenunschärfe
      if (dof > 0.0) {
        float coc = clamp(abs(z - focus) / max(z, 0.5) * dof, 0.0, 1.0);
        if (coc > 0.03) {
          vec3 acc = col; float ws = 1.0;
          for (int i = 0; i < 12; i++) {
            vec2 o = PD[i] * coc * 9.0 * dpr * px;
            float zs = linZ(vUv + o);
            float cs = clamp(abs(zs - focus) / max(zs, 0.5) * dof, 0.0, 1.0);
            float w = zs < z ? cs : 1.0;
            acc += texture2D(tDiffuse, vUv + o).rgb * w; ws += w;
          }
          col = acc / ws;
        }
      }
      // Konturen aus Tiefe + Helligkeit
      vec2 o1 = px * max(1.0, dpr * 0.85);
      float zl = linZ(vUv - vec2(o1.x, 0.0)), zr = linZ(vUv + vec2(o1.x, 0.0));
      float zu = linZ(vUv + vec2(0.0, o1.y)), zd = linZ(vUv - vec2(0.0, o1.y));
      float dz = (abs(zl - zr) + abs(zu - zd)) / max(z, 0.1);
      float eD = smoothstep(0.035, 0.12, dz);
      float l00 = tl(texture2D(tDiffuse, vUv + vec2(-o1.x, o1.y)).rgb), l10 = tl(texture2D(tDiffuse, vUv + vec2(0.0, o1.y)).rgb), l20 = tl(texture2D(tDiffuse, vUv + vec2(o1.x, o1.y)).rgb);
      float l01 = tl(texture2D(tDiffuse, vUv + vec2(-o1.x, 0.0)).rgb), l21 = tl(texture2D(tDiffuse, vUv + vec2(o1.x, 0.0)).rgb);
      float l02 = tl(texture2D(tDiffuse, vUv + vec2(-o1.x, -o1.y)).rgb), l12 = tl(texture2D(tDiffuse, vUv + vec2(0.0, -o1.y)).rgb), l22 = tl(texture2D(tDiffuse, vUv + vec2(o1.x, -o1.y)).rgb);
      float gx = -l00 - 2.0 * l01 - l02 + l20 + 2.0 * l21 + l22;
      float gy = -l00 - 2.0 * l10 - l20 + l02 + 2.0 * l12 + l22;
      float eL = smoothstep(0.22, 0.55, length(vec2(gx, gy)));
      float far = smoothstep(lineFadeStart, lineFadeEnd, z);
      float edge = max(eD, eL * 0.55) * (1.0 - far) * outline;
      // Schraffur (Bildschirmraum, leicht gewellt wie gestochen)
      float L = tl(col);
      vec2 sc = gl_FragCoord.xy / (dpr * hatchScale);
      float wob = sin(sc.y * 0.07 + sc.x * 0.013) * 1.4 + sin(sc.x * 0.05) * 0.8;
      float h1 = lineMask(sc.x + sc.y + wob, 5.0, 0.9) * (1.0 - smoothstep(0.22, 0.42, L));
      float h2 = lineMask(sc.x - sc.y - wob, 5.0, 0.8) * (1.0 - smoothstep(0.10, 0.22, L));
      float h3 = lineMask(sc.y * 1.6 + wob, 4.0, 0.7) * (1.0 - smoothstep(0.04, 0.12, L));
      float ht = clamp(h1 + h2 * 0.9 + h3 * 0.8, 0.0, 1.0) * hatch * (1.0 - far * 0.85);
      // Farbe: Sepia + Reichsfarbe
      vec3 sep = vec3(dot(col, vec3(0.393, 0.769, 0.189)), dot(col, vec3(0.349, 0.686, 0.168)), dot(col, vec3(0.272, 0.534, 0.131)));
      col = mix(col, sep, sepia);
      col = mix(col, col * tint, tintAmt);
      float inkAmt = clamp(edge + ht, 0.0, 1.0);
      col = mix(col, ink * (0.6 + 0.8 * L), inkAmt);
      // Papierkorn + Vignette
      float g = hash(floor(gl_FragCoord.xy / max(1.0, dpr)) + fract(time * 7.0)) - 0.5;
      float paper = hash(floor(gl_FragCoord.xy / (2.0 * dpr))) - 0.5;
      col *= 1.0 + g * grain + paper * grain * 0.6;
      float vg = smoothstep(0.95, 0.25, length((vUv - 0.5) * vec2(1.15, 1.0)));
      col *= mix(1.0, vg, vignette);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

class EngravePass extends Pass {
  constructor() {
    super();
    this.uniforms = THREE.UniformsUtils.clone(EngraveShader.uniforms);
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: EngraveShader.vertexShader, fragmentShader: EngraveShader.fragmentShader });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  setSize(w, h) { this.uniforms.resolution.value.set(w, h); }
}

// ---------- Engine ----------
export const QUALITY = {
  high: { pr: 2, shadows: 2048, bloom: true, dof: true, density: 1 },
  medium: { pr: 1.5, shadows: 1024, bloom: true, dof: false, density: 0.6 },
  low: { pr: 1, shadows: 0, bloom: false, dof: false, density: 0.32 },
};

export class Engine {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches;
    this.qName = params.get('q') || (touch ? 'medium' : 'high');
    this.maxFrames = +(params.get('frames') || 0); this.frameN = 0;
    this.q = QUALITY[this.qName] || QUALITY.high;

    const canvasEl = document.createElement('canvas');
    canvasEl.className = 'gl';
    this.canvas = canvasEl;
    let gl = null;
    try { gl = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); } catch (e) { gl = null; }
    this.ok = !!gl;
    if (!gl) return;
    this.renderer = gl;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.shadowMap.enabled = this.q.shadows > 0;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pmrem = new THREE.PMREMGenerator(gl);

    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4, THREE.UnsignedIntType) });
    this.composer = new EffectComposer(gl, rt);
    // eigene Tiefentextur je Puffer (clone() teilt sonst die GPU-Textur → Feedback-Schleife)
    this.composer.renderTarget2.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);
    this.composer.readBuffer = this.composer.renderTarget1; this.composer.writeBuffer = this.composer.renderTarget2;
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.engrave = new EngravePass();
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.65, 0.88);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.engrave);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);

    this.world = null;
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2(0, 0); this.pointerS = new THREE.Vector2(0, 0);
    this.tilt = new THREE.Vector2(0, 0);
    this.ray = new THREE.Raycaster();
    this.container = null;
    this.fps = { acc: 0, n: 0, checked: false, t0: 0 };
    this.applyQuality();

    canvasEl.addEventListener('pointermove', e => { const r = canvasEl.getBoundingClientRect(); this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); });
    canvasEl.addEventListener('pointerleave', () => this.pointer.set(0, 0));
    canvasEl.addEventListener('click', e => this.handlePick(e));
    window.addEventListener('deviceorientation', e => { if (e.gamma == null) return; this.tilt.set(clamp(e.gamma / 30, -1, 1), clamp((e.beta - 45) / 30, -1, 1)); });
    this.ro = new ResizeObserver(() => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  applyQuality() {
    const q = this.q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    this.renderer.shadowMap.enabled = q.shadows > 0;
    this.bloom.enabled = q.bloom;
    this.engrave.uniforms.dpr.value = this.renderer.getPixelRatio();
    this.resize();
  }

  mount(el) {
    if (!this.ok) return;
    if (this.container) this.ro.unobserve(this.container);
    this.container = el;
    el.appendChild(this.canvas);
    this.ro.observe(el);
    this.resize();
  }

  resize() {
    if (!this.container || !this.renderer) return;
    const w = Math.max(2, this.container.clientWidth), h = Math.max(2, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.engrave.uniforms.dpr.value = pr;
    if (this.world) { this.world.camera.aspect = w / h; this.world.camera.updateProjectionMatrix(); }
  }

  // world: { scene, camera, rig:{pos,target,from?,fromTarget?,dur?}, post, update(dt,t), pick:[], onPick(o), dispose() }
  setWorld(world) {
    const old = this.world;
    this.world = world;
    this.renderPass.scene = world.scene; this.renderPass.camera = world.camera;
    const p = world.post || {};
    const u = this.engrave.uniforms;
    u.hatch.value = (p.hatch ?? 0.3) * 0.8; u.outline.value = p.outline ?? 0.75; u.sepia.value = p.sepia ?? 0.12;
    u.tint.value.set(p.tint ?? '#ffffff'); u.tintAmt.value = p.tintAmt ?? 0.15;
    u.focus.value = p.focus ?? 14; u.dof.value = this.q.dof ? (p.dof ?? 0.4) * 0.7 : 0;
    u.vignette.value = p.vignette ?? 0.55; u.grain.value = p.grain ?? 0.06;
    u.lineFadeStart.value = p.lineFadeStart ?? 22; u.lineFadeEnd.value = p.lineFadeEnd ?? 120;
    u.cameraNear.value = world.camera.near; u.cameraFar.value = world.camera.far;
    this.bloom.strength = p.bloom ?? 0.55; this.bloom.threshold = p.bloomThreshold ?? 0.88; this.bloom.radius = p.bloomRadius ?? 0.6;
    this.renderer.toneMappingExposure = p.exposure ?? 1.0;
    // Kamera-Rig
    const rig = world.rig;
    this.cam = { base: rig.pos.clone(), target: rig.target.clone(), sway: rig.sway ?? 0.9, t: 0, dur: this.reducedMotion ? 0 : (rig.dur ?? 4.5), from: (rig.from || rig.pos).clone(), fromTarget: (rig.fromTarget || rig.target).clone(), fly: null };
    world.camera.position.copy(this.cam.dur ? this.cam.from : this.cam.base);
    this.resize();
    this.fps = { acc: 0, n: 0, checked: false, t0: performance.now() };
    if (old && old !== world && old.dispose) old.dispose();
  }

  // Welt abbauen und Canvas aushängen (z. B. beim Wechsel ins Buch)
  clear() {
    if (this.world && this.world.dispose) this.world.dispose();
    this.world = null;
    if (this.container) this.ro.unobserve(this.container);
    this.canvas.remove(); this.container = null;
  }

  // Kamerafahrt (z. B. Karte → Reich)
  flyTo(pos, target, dur = 2.2) {
    return new Promise(res => { this.cam.fly = { fromP: this.world.camera.position.clone(), fromT: this.curTarget ? this.curTarget.clone() : this.cam.target.clone(), pos, target, t: 0, dur: this.reducedMotion ? 0.01 : dur, res }; });
  }

  handlePick(e) {
    const w = this.world; if (!w || !w.pick || !w.pick.length) return;
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, w.camera);
    const hits = this.ray.intersectObjects(w.pick, true);
    if (hits.length) {
      let o = hits[0].object; while (o && !o.userData.pickId && o.parent) o = o.parent;
      if (w.onPick) w.onPick(o.userData.pickId, e, hits[0]);
    }
  }

  hover(e) {
    const w = this.world; if (!w || !w.pick || !w.pick.length) return null;
    this.ray.setFromCamera(this.pointer, w.camera);
    const hits = this.ray.intersectObjects(w.pick, true);
    if (!hits.length) return null;
    let o = hits[0].object; while (o && !o.userData.pickId && o.parent) o = o.parent;
    return o.userData.pickId || null;
  }

  loop() {
    if (this.maxFrames && this.frameN >= this.maxFrames) { window.__frames = this.frameN; return; }
    requestAnimationFrame(this.loop);
    if (!this.world || document.hidden || !this.container || !this.container.isConnected) { this.clock.getDelta(); return; }
    let dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.maxFrames) { dt = this.frameN === 0 ? 0 : 0.05; this.cam && (this.cam.t = 99); }
    this.frameN++;
    U.time.value += dt;
    const w = this.world, cam = w.camera, c = this.cam;
    // Zeiger glätten
    const tx = this.pointer.x + this.tilt.x, ty = this.pointer.y - this.tilt.y;
    this.pointerS.x += (tx - this.pointerS.x) * Math.min(1, dt * 2.2);
    this.pointerS.y += (ty - this.pointerS.y) * Math.min(1, dt * 2.2);
    let pos, tgt;
    if (c.fly) {
      const f = c.fly; f.t += dt; const k = easeInOut(Math.min(1, f.t / f.dur));
      pos = f.fromP.clone().lerp(f.pos, k); tgt = f.fromT.clone().lerp(f.target, k);
      if (f.t >= f.dur) { c.fly = null; c.base.copy(f.pos); c.target.copy(f.target); c.t = c.dur; f.res(); }
    } else {
      c.t += dt;
      const k = c.dur ? easeInOut(Math.min(1, c.t / c.dur)) : 1;
      pos = c.from.clone().lerp(c.base, k); tgt = c.fromTarget.clone().lerp(c.target, k);
      if (!this.reducedMotion) {
        const s = c.sway * k;
        const right = new THREE.Vector3().subVectors(tgt, pos).cross(new THREE.Vector3(0, 1, 0)).normalize();
        pos.addScaledVector(right, this.pointerS.x * s);
        pos.y += this.pointerS.y * s * 0.45;
        const tt = U.time.value;
        pos.x += Math.sin(tt * 0.21) * 0.12 * s; pos.y += Math.sin(tt * 0.33) * 0.06 * s;
      }
    }
    // Szenen können die Kamera übernehmen (z. B. Verfolgung des fallenden Samens)
    if (w.camCtl && !c.fly) { const cc = w.camCtl(dt, this); if (cc) { pos = cc.pos.clone(); tgt = cc.target.clone(); if (!this.reducedMotion) { const right = new THREE.Vector3().subVectors(tgt, pos).cross(new THREE.Vector3(0, 1, 0)).normalize(); pos.addScaledVector(right, this.pointerS.x * (cc.sway ?? 0.3)); pos.y += this.pointerS.y * (cc.sway ?? 0.3) * 0.4; } } }
    cam.position.copy(pos); this.curTarget = tgt; cam.lookAt(tgt);
    if (w.update) w.update(dt, U.time.value, this);
    this.engrave.uniforms.time.value = U.time.value;
    this.composer.render(dt);
    // automatische Qualitätsanpassung
    const f = this.fps;
    if (!f.checked) {
      const el = performance.now() - f.t0;
      if (el > 1200) { f.acc += dt; f.n++; }
      if (el > 4200 && f.n > 0) {
        f.checked = true;
        const fpsv = f.n / f.acc;
        if (fpsv < 34 && this.qName !== 'low') {
          this.qName = this.qName === 'high' ? 'medium' : 'low'; this.q = QUALITY[this.qName];
          this.engrave.uniforms.dof.value = 0; this.applyQuality();
          this.fps = { acc: 0, n: 0, checked: false, t0: performance.now() };
        }
      }
    }
  }

  // Standbild für Seitenumblättern
  snapshot() {
    if (!this.world) return null;
    this.composer.render(0);
    try { return this.canvas.toDataURL('image/jpeg', 0.85); } catch (e) { return null; }
  }

  envFromScene(skyScene) {
    const rt = this.pmrem.fromScene(skyScene, 0.035);
    return rt.texture;
  }
}
