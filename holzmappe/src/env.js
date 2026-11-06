import * as THREE from 'three';
import { rng, fbm, noise2, smooth, clamp, lerp, groundTexture, softTexture, foliageTexture, canvas, texFromCanvas } from './util.js';
import { U, windify } from './engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- Himmel ----------
export function makeSky(p) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(p.skyTop) }, horizon: { value: new THREE.Color(p.skyHorizon) }, bottom: { value: new THREE.Color(p.skyBottom || p.skyHorizon) },
      sunDir: { value: p.sunDir.clone().normalize() }, sunColor: { value: new THREE.Color(p.sunColor) }, sunSize: { value: p.sunSize ?? 1 },
      glow: { value: p.glow ?? 0.6 }, stars: { value: p.stars ?? 0 }, time: U.time, moon: { value: p.moon ?? 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top, horizon, bottom, sunColor; uniform vec3 sunDir; uniform float sunSize, glow, stars, time, moon;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.9, h), 0.55)) : mix(horizon, bottom, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        c += sunColor * (pow(sd, 6.0) * glow * 0.6 + pow(sd, 60.0) * glow * 1.2);
        float disk = smoothstep(0.9994 - 0.0008 * sunSize, 0.9997 - 0.0004 * sunSize, sd);
        c += sunColor * disk * (moon > 0.5 ? 2.2 : 9.0);
        // Horizontdunst
        c = mix(c, horizon * 1.05, (1.0 - smoothstep(0.0, 0.12, abs(h))) * 0.5);
        if (stars > 0.0 && h > 0.0) {
          vec3 g = floor(d * 260.0); float s = hash(g);
          float tw = 0.6 + 0.4 * sin(time * 2.0 + s * 50.0);
          c += vec3(1.0, 0.95, 0.85) * step(0.9965, s) * stars * tw * smoothstep(0.05, 0.4, h) * 2.0;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

// ---------- Gelände ----------
export function makeTerrain(p, r) {
  const size = 340, seg = 180;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const hf = p.height || ((x, z) => {
    const d = Math.hypot(x, z + 6);
    const stage = smooth(16, 60, d);
    return fbm(x * 0.012, z * 0.012, 4) * 10 * stage + fbm(x * 0.06, z * 0.06, 3) * 0.35 + stage * stage * 6;
  });
  const pos = g.attributes.position, colors = [];
  const c1 = new THREE.Color(p.ground[0]), c2 = new THREE.Color(p.ground[1]), c3 = new THREE.Color(p.ground[2]);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = hf(x, z);
    pos.setY(i, y);
    const n = fbm(x * 0.05 + 4, z * 0.05, 3) * 0.5 + 0.5;
    const c = c1.clone().lerp(c2, smooth(0.3, 0.75, n)).lerp(c3, smooth(3, 14, y) * 0.6);
    const w = new THREE.Color(1, 1, 1).lerp(c, 0.45).multiplyScalar(1.12);
    colors.push(w.r, w.g, w.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const gt = groundTexture(p.groundTex[0], p.groundTex[1], p.groundTex[2], p.groundKind);
  const mat = new THREE.MeshStandardMaterial({ map: gt.map, normalMap: gt.normal, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true, roughness: 0.96 });
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
  m.userData.height = hf;
  return m;
}

// ---------- Ferne Bergketten (Ebenen mit Silhouetten) ----------
export function makeRidges(p, r) {
  const g = new THREE.Group();
  const layers = p.ridges || [
    { R: 150, h: 22, base: -2 }, { R: 230, h: 42, base: -2 }, { R: 330, h: 75, base: -4 },
  ];
  const hor = new THREE.Color(p.skyHorizon), rc = new THREE.Color(p.ridgeColor || '#2a3a30');
  layers.forEach((L, li) => {
    const seg = 360, arc = Math.PI * 1.25, a0 = -Math.PI / 2 - arc / 2;
    const pos = [], col = [], idx = [];
    const tCol = rc.clone().lerp(hor, 0.25 + li * 0.25);
    const bCol = tCol.clone().lerp(hor, 0.55);
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, a = a0 + u * arc;
      const x = Math.cos(a) * L.R, z = Math.sin(a) * L.R;
      let top = L.base + L.h * (0.45 + 0.55 * (fbm(u * 6 + li * 10, li, 4) * 0.5 + 0.5));
      if (p.treeline === 'conifer') { const t = (u * 340 + li * 7) % 1; const k = Math.abs(noise2(u * 400, li * 3)); top += (1 - Math.abs(t * 2 - 1)) * (2 + k * 4) * (1 - li * 0.25); }
      else if (p.treeline === 'round') { top += Math.abs(Math.sin(u * 160 + li)) * 2.4 * (0.5 + Math.abs(noise2(u * 50, li))); }
      pos.push(x, L.base - 30, z, x, top, z);
      col.push(bCol.r, bCol.g, bCol.b, tCol.r, tCol.g, tCol.b);
      if (i < seg) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -5 + li * -1;
    g.add(m);
  });
  return g;
}

// ---------- Gras ----------
export function makeGrass(p, terrain, density, r, { radius = 22, avoid = [] } = {}) {
  const n = Math.round((p.grassCount ?? 9000) * density);
  if (!n) return null;
  const geo = new THREE.PlaneGeometry(0.07, 0.6, 1, 4); geo.translate(0, 0.3, 0);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 0.6; pa.setX(i, pa.getX(i) * (1 - y * 0.9)); pa.setZ(i, y * y * 0.12); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide });
  windify(mat, { amp: 0.18, sway: false, freq: 1.4 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(), cA = new THREE.Color(p.grass[0]), cB = new THREE.Color(p.grass[1]);
  const hf = terrain.userData.height;
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * radius;
    const x = Math.cos(a) * d, z = Math.sin(a) * d - 4;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const clump = fbm(x * 0.15, z * 0.15, 2);
    if (clump < (p.grassClump ?? -0.2)) continue;
    q.setFromAxisAngle(V(0, 1, 0), r() * 6.28);
    const h = r.range(0.5, 1.4) * (0.7 + clump * 0.6) * (p.grassH || 1);
    m.compose(V(x, hf(x, z) - 0.02, z), q, s.set(1, h, 1)); mesh.setMatrixAt(k, m);
    mesh.setColorAt(k, cA.clone().lerp(cB, r()).multiplyScalar(r.range(0.75, 1.15)));
    k++;
  }
  mesh.count = k; mesh.receiveShadow = true;
  return mesh;
}

// Farne / Kräuter / Laubstreu-Karten
export function makeCards(kind, c1, c2, terrain, n, r, { radius = 20, size = [1, 1], center = [0, -4], avoid = [], upright = true } = {}) {
  const tex = foliageTexture(kind, c1, c2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  windify(mat, { amp: 0.06, sway: false });
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
  const g = new THREE.Group(); const hf = terrain.userData.height;
  const mesh = new THREE.InstancedMesh(geo, mat, n * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(); let k = 0;
  for (let i = 0; i < n * 4 && k < n * 2; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * radius, x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const sc = r.range(0.7, 1.3), y = hf(x, z);
    for (let j = 0; j < 2; j++) {
      q.setFromEuler(new THREE.Euler(upright ? r.range(-0.3, 0.1) : -Math.PI / 2 + r.range(-0.2, 0.2), r() * 6.28 + j * 1.57, 0));
      m.compose(V(x, y - 0.03, z), q, s.set(size[0] * sc, size[1] * sc, 1)); mesh.setMatrixAt(k++, m);
    }
  }
  mesh.count = k; mesh.receiveShadow = true; g.add(mesh);
  return g;
}

// Felsen
export function makeRocks(p, terrain, positions, r) {
  const g = new THREE.Group(); const hf = terrain.userData.height;
  const mat = new THREE.MeshStandardMaterial({ color: p.rock || '#6f6a60', roughness: 0.95, flatShading: false });
  const moss = new THREE.Color(p.moss || '#4d6a34');
  positions.forEach(([x, z, s]) => {
    const geo = new THREE.IcosahedronGeometry(1, 3); const pa = geo.attributes.position; const cols = [];
    const sd = r() * 100;
    for (let i = 0; i < pa.count; i++) {
      const v = V(pa.getX(i), pa.getY(i), pa.getZ(i)); const n = fbm(v.x * 1.4 + sd, v.y * 1.4 + v.z, 4);
      v.multiplyScalar(1 + n * 0.35); v.y *= 0.6; pa.setXYZ(i, v.x, v.y, v.z);
      const mc = smooth(0.1, 0.6, v.y + n * 0.3);
      const c = new THREE.Color(1, 1, 1).lerp(moss, mc * 0.8); cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat.clone()); m.material.vertexColors = true;
    m.scale.setScalar(s); m.position.set(x, hf(x, z) + s * 0.1, z); m.rotation.y = r() * 6;
    m.castShadow = m.receiveShadow = true; g.add(m);
  });
  return g;
}

// ---------- Atmosphäre ----------
export function makeMist(p, layers = 4, r) {
  const g = new THREE.Group(); const tex = softTexture('mist');
  for (let i = 0; i < layers; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: p.mistColor || p.fog, transparent: true, opacity: (p.mist ?? 0.35) * (0.6 + r() * 0.5), depthWrite: false, fog: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), mat);
    m.position.set(r.range(-25, 25), r.range(0.5, 4) + i * 0.6, -14 - i * 14);
    m.userData.drift = r.range(0.2, 0.6) * (r() < 0.5 ? -1 : 1);
    g.add(m);
  }
  g.userData.update = (dt) => g.children.forEach(m => { m.position.x += m.userData.drift * dt; if (m.position.x > 40) m.position.x = -40; if (m.position.x < -40) m.position.x = 40; });
  return g;
}

export function makeShafts(p, r, { n = 6, origin = V(0, 18, -8), spread = 10 } = {}) {
  const g = new THREE.Group(); const tex = softTexture('shaft');
  const sd = p.sunDir.clone().normalize();
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: p.shaftColor || p.sunColor, transparent: true, opacity: (p.shafts ?? 0.12) * r.range(0.5, 1.1), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const len = r.range(26, 40);
    const geo = new THREE.PlaneGeometry(r.range(1.2, 3.2), len); geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(origin).add(V(r.range(-spread, spread), r.range(-2, 3), r.range(-spread * 0.5, spread * 0.5)));
    m.quaternion.setFromUnitVectors(V(0, -1, 0), sd.clone().negate());
    m.rotateY(r() * 3);
    m.userData.ph = r() * 6; m.userData.base = mat.opacity;
    g.add(m);
  }
  g.userData.update = (dt, t) => g.children.forEach(m => { m.material.opacity = m.userData.base * (0.65 + 0.35 * Math.sin(t * 0.4 + m.userData.ph)); });
  return g;
}

// Partikel: kind = motes | rise | firefly | snow
export function makeParticles(kind, color, n, box, { size = 0.12, speed = 1 } = {}) {
  const r = rng(n + kind.length);
  const geo = new THREE.BufferGeometry(); const pos = [], seed = [];
  for (let i = 0; i < n; i++) { pos.push(r.range(box[0], box[1]), r.range(box[2], box[3]), r.range(box[4], box[5])); seed.push(r() * 100); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: U.time, color: { value: new THREE.Color(color) }, size: { value: size }, tex: { value: softTexture('dot') }, h: { value: box[3] - box[2] }, kind: { value: { motes: 0, rise: 1, firefly: 2, snow: 3 }[kind] }, speed: { value: speed }, pr: { value: Math.min(2, devicePixelRatio || 1) } },
    vertexShader: `
      attribute float seed; uniform float time, size, h, kind, speed, pr; varying float vA;
      void main(){
        vec3 p = position; float t = time * speed;
        if (kind < 0.5) { p += vec3(sin(t*0.3+seed)*0.8, sin(t*0.23+seed*1.7)*0.5, cos(t*0.27+seed)*0.8); vA = 0.5 + 0.5*sin(t*0.8+seed*3.0); }
        else if (kind < 1.5) { p.y = position.y + mod(t*0.35 + seed, h); p.x += sin(t*0.7+seed)*0.4; vA = sin(3.14159 * mod(t*0.35 + seed, h)/h); }
        else if (kind < 2.5) { p += vec3(sin(t*0.5+seed)*1.2, sin(t*0.9+seed*2.0)*0.4, cos(t*0.4+seed)*1.2); vA = pow(max(0.0, sin(t*1.3+seed*5.0)), 6.0); }
        else { p.y = position.y + h - mod(t*0.6 + seed, h); p.x += sin(t*0.8+seed)*0.6; vA = 0.8; }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = size * pr * 300.0 / max(0.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 color; uniform sampler2D tex; varying float vA; void main(){ vec4 t = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(color * 3.0 * vA, t.a * vA); }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return pts;
}

// Fallende Blätter / Nadeln (CPU, wenige)
export function makeFallingLeaves(kind, c1, c2, n, box) {
  const r = rng(77 + n);
  const tex = foliageTexture(kind, c1, c2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 0.35), mat, n);
  const st = []; for (let i = 0; i < n; i++) st.push({ x: r.range(box[0], box[1]), y: r.range(box[2], box[3]), z: r.range(box[4], box[5]), s: r() * 10, v: r.range(0.4, 0.9) });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  mesh.userData.update = (dt, t) => {
    st.forEach((o, i) => {
      o.y -= o.v * dt; if (o.y < box[2]) o.y = box[3];
      e.set(t * 1.3 + o.s, t * 0.9 + o.s, t * 1.7 + o.s); q.setFromEuler(e);
      m.compose(V(o.x + Math.sin(t * 0.9 + o.s) * 0.8, o.y, o.z + Math.cos(t * 0.7 + o.s) * 0.5), q, V(1, 1, 1)); mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.frustumCulled = false;
  return mesh;
}

// Wasser
export function makeWater(p, { w = 120, d = 60, y = 0, x = 0, z = -30 } = {}) {
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), dd = img.data;
  const hf = (x, y) => fbm(x / S * 6, y / S * 6, 4);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const hx = hf(i + 1, j) - hf(i - 1, j), hy = hf(i, j + 1) - hf(i, j - 1);
    const k = (j * S + i) * 4; dd[k] = (0.5 - hx * 2) * 255; dd[k + 1] = (0.5 - hy * 2) * 255; dd[k + 2] = 255; dd[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const nt = texFromCanvas(c, { srgb: false, repeat: [8, 4] });
  const mat = new THREE.MeshPhysicalMaterial({ color: p.water || '#1d3340', roughness: 0.06, metalness: 0.0, normalMap: nt, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92, envMapIntensity: 1.4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
  m.userData.update = (dt) => { nt.offset.x += dt * 0.01; nt.offset.y += dt * 0.006; };
  return m;
}

// Licht-Setup
export function makeLights(p, scene, q) {
  const sun = new THREE.DirectionalLight(p.sunColor, p.sunIntensity ?? 3);
  sun.position.copy(p.sunDir.clone().normalize().multiplyScalar(60));
  sun.target.position.set(0, 0, -4);
  if (q.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(q.shadows, q.shadows);
    const s = 26; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 5, far: 160 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4; sun.shadow.camera.updateProjectionMatrix();
  }
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(p.hemiSky || p.skyTop, p.hemiGround || p.ground[0], p.hemi ?? 0.6);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(p.fillColor || p.hemiSky || '#ffffff', p.fill ?? 0.75); fill.position.set(4, 8, 30); scene.add(fill);
  if (p.rim) { const rim = new THREE.DirectionalLight(p.rim, p.rimIntensity ?? 0.8); rim.position.set(-20, 10, -30); scene.add(rim); }
  return { sun, hemi };
}
