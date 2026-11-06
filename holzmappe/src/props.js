import * as THREE from 'three';
import { rng, woodTextures, endGrainCanvas, texFromCanvas, canvas, clamp, smooth, barkTextures } from './util.js';
import { emblemSVG, svgToImage, EINSATZ_LABEL } from './icons.js';
import { SPECIES } from './tree.js';
import { U } from './engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Holzbild je Art
export const WOODVIS = {
  kiefer: { early: '#ecc994', late: '#b8703c', heart: '#c98a52', sap: '#efd6a0', contrast: 0.75, rings: 12, figure: 1, knots: 5, resinDots: true, sapRatio: 0.38, barkCol: '#6a4a34' },
  fichte: { early: '#f2e3c4', late: '#d6b386', heart: '#eedcb6', sap: '#f1e1bf', contrast: 0.5, rings: 16, figure: 0.8, knots: 6, resinDots: true, sapRatio: 0.0, barkCol: '#6a4430' },
  tanne: { early: '#efe8da', late: '#cfc2aa', heart: '#e2d7c3', sap: '#eee6d6', contrast: 0.42, rings: 14, figure: 0.8, knots: 3, sapRatio: 0.0, barkCol: '#8a8a84' },
  laerche: { early: '#e4ae7c', late: '#8c4628', heart: '#bb683c', sap: '#ebcb98', contrast: 0.85, rings: 22, figure: 1, knots: 3, resinDots: true, sapRatio: 0.14, barkCol: '#6a4a3c' },
  douglasie: { early: '#ebb48a', late: '#a3522c', heart: '#c87a4a', sap: '#edd3aa', contrast: 0.88, rings: 11, figure: 1.4, sharp: 1.6, knots: 2, resinDots: true, sapRatio: 0.2, barkCol: '#5a3e30' },
  eiche: { early: '#cba374', late: '#8e6a42', heart: '#a98458', sap: '#ddc9a2', contrast: 0.5, rings: 18, figure: 0.9, rays: 0.9, pores: 1, sapRatio: 0.12, barkCol: '#5a534a' },
  robinie: { early: '#cdb766', late: '#7a6428', heart: '#a99341', sap: '#eadf9e', contrast: 0.7, rings: 16, figure: 1, pores: 0.9, sapRatio: 0.08, barkCol: '#5a4c3e' },
  buche: { early: '#ebc4a4', late: '#d3a484', heart: '#ddb394', sap: '#ebc8a8', contrast: 0.25, rings: 20, figure: 0.5, rays: 0.6, sapRatio: 0.0, barkCol: '#8a8b84' },
};

const WMAT = new Map();
export function woodMat(id, { repeat = [1, 1], rough = 0.62, color = '#ffffff' } = {}) {
  const key = id + repeat.join() + rough + color;
  if (WMAT.has(key)) return WMAT.get(key);
  const t = woodTextures(id, WOODVIS[id]);
  const map = t.map.clone(), normal = t.normal.clone();
  map.repeat.set(repeat[0], repeat[1]); normal.repeat.set(repeat[0], repeat[1]); map.needsUpdate = normal.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map, normalMap: normal, normalScale: new THREE.Vector2(0.5, 0.5), roughness: rough, color });
  WMAT.set(key, m);
  return m;
}
export function barkMat(id) {
  const sp = SPECIES[id]; const t = barkTextures(sp.bark.kind, sp.bark.base, sp.bark.dark);
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, roughness: 0.95 });
}
export const metal = (c = '#9a9a9a', rough = 0.35) => new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: rough });
export const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };
export const cyl = (r1, r2, h, mat, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); m.castShadow = m.receiveShadow = true; return m; };

// ---------- Stammscheibe mit Schwindrissen ----------
export function makeDisc(id, h) {
  const ratio = h.schwund.tangential / h.schwund.radial;
  const cracks = Math.round(clamp(2 + (ratio - 1.4) * 5 + (h.schwund.tangential - 7) * 1.2, 1, 9));
  const cw = clamp(h.schwund.tangential / 100 * 0.25, 0.012, 0.035);
  const vis = WOODVIS[id];
  const top = new THREE.MeshStandardMaterial({ map: texFromCanvas(endGrainCanvas(id, vis, { cracks, crackWidth: cw, seed: id.length }), { repeat: [1, 1] }), roughness: 0.75, transparent: false });
  const side = barkMat(id);
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.2, 48), [side, top, top]);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return g;
}

// ---------- Arbeitendes Brett (schüsselt) ----------
export function makeBoard(id, h) {
  const W = 0.34, L = 1.5, T = 0.05;
  const geo = new THREE.BoxGeometry(W, T, L, 16, 1, 2);
  const base = geo.attributes.position.array.slice();
  const ends = new THREE.MeshStandardMaterial({ map: texFromCanvas(endGrainCanvas(id, { ...WOODVIS[id], endRings: 50 }, { cracks: 0 }), { repeat: [0.4, 0.15] }), roughness: 0.7 });
  ends.map.offset.set(0.3, 0.75);
  const side = woodMat(id, { repeat: [0.25, 1] });
  const mesh = new THREE.Mesh(geo, [side, side, side, side, ends, ends]);
  mesh.castShadow = mesh.receiveShadow = true;
  const amp = h.diff.tNum * 0.28; // Buche (0,41) ≈ 11 cm, Douglasie (0,27) ≈ 7,5 cm – überzeichnet
  mesh.userData.update = (dt, t) => {
    const k = amp * (0.55 + 0.45 * Math.sin(t * 0.55));
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { const x = base[i] / (W / 2); p[i + 1] = base[i + 1] + k * (x * x) * 0.5; }
    // leichtes Verdrehen bei schlechtem Stehvermögen
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  };
  const g = new THREE.Group();
  const blockMat = woodMat(id, { repeat: [0.3, 0.3] });
  const b1 = box(0.12, 0.1, 0.1, blockMat), b2 = b1.clone(); b1.position.set(0, 0.05, -0.55); b2.position.set(0, 0.05, 0.55);
  mesh.position.y = 0.1 + T / 2;
  g.add(b1, b2, mesh);
  g.userData.update = mesh.userData.update;
  return g;
}

// ---------- Trocknungsstapel ----------
export function makeStack(id, h, r = rng(4)) {
  const g = new THREE.Group();
  const wm = woodMat(id, { repeat: [0.3, 1.6] }), sticker = woodMat('fichte', { repeat: [0.1, 1] });
  const defects = {
    kiefer: { tint: '#5b7a9a', amt: 0.5, label: 'Bläue' }, tanne: { core: '#7b6a50' }, buche: { tint: '#9a7a5a', amt: 0.35, spots: true },
    eiche: { cracks: 4 }, robinie: { cracks: 3 }, laerche: { cracks: 2 }, douglasie: { cracks: 1 }, fichte: { cracks: 1 },
  }[id] || {};
  const endMat = (k) => {
    const c = endGrainCanvas(id, { ...WOODVIS[id], endRings: 26 }, { cracks: defects.cracks ? defects.cracks + (k % 2) : 0, crackWidth: 0.03, seed: k + 1 });
    const ctx = c.getContext('2d');
    if (defects.tint && (k % 3 !== 1)) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = defects.tint; ctx.globalAlpha = defects.amt; ctx.beginPath(); ctx.arc(256, 256, 250, 0, 7); ctx.arc(256, 256, 150, 0, 7, true); ctx.fill(); }
    if (defects.core) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = defects.core; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(256, 256, 120, 100, 0.3, 0, 7); ctx.fill(); }
    if (defects.spots) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; for (let i = 0; i < 14; i++) { ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(r.range(80, 430), r.range(80, 430), r.range(10, 35), 0, 7); ctx.fill(); } }
    return new THREE.MeshStandardMaterial({ map: texFromCanvas(c), roughness: 0.8 });
  };
  const ends = [endMat(0), endMat(1), endMat(2)];
  const BW = 0.2, BT = 0.045, BL = 1.6;
  // Unterleger
  for (const z of [-0.6, 0, 0.6]) { const s = box(1.3, 0.12, 0.12, sticker); s.position.set(0, 0.06, z); g.add(s); }
  let y = 0.12;
  for (let layer = 0; layer < 5; layer++) {
    for (let b = 0; b < 5; b++) {
      const e = ends[(layer + b) % 3];
      const m = new THREE.Mesh(new THREE.BoxGeometry(BW, BT, BL), [wm, wm, wm, wm, e, e]);
      m.position.set(-0.5 + b * 0.25, y + BT / 2, r.range(-0.02, 0.02)); m.rotation.y = r.range(-0.01, 0.01);
      m.castShadow = m.receiveShadow = true; g.add(m);
    }
    y += BT;
    if (layer < 4) { for (const z of [-0.6, 0, 0.6]) { const s = box(1.3, 0.025, 0.035, sticker); s.position.set(0, y + 0.0125, z); g.add(s); } y += 0.025; }
  }
  // Abdeckung + Steine
  const cover = box(1.35, 0.03, 1.75, woodMat('fichte', { repeat: [0.5, 1] })); cover.position.y = y + 0.015; cover.rotation.z = 0.03; g.add(cover);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#7a756c', roughness: 0.95 });
  for (const [x, z] of [[-0.4, -0.5], [0.4, 0.5]]) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 1), stoneMat); st.scale.set(1, 0.7, 1.2); st.position.set(x, y + 0.1, z); st.castShadow = true; g.add(st); }
  return g;
}

// ---------- Brinell-Prüfstand ----------
export function makeHardness(id, h) {
  const g = new THREE.Group();
  const brass = metal('#c9a35a', 0.32), steel = metal('#d0d4d8', 0.15), iron = metal('#3a3a3c', 0.55);
  const plate = box(0.8, 0.05, 0.55, brass); plate.position.y = 0.025; g.add(plate);
  const post1 = cyl(0.03, 0.03, 0.9, iron), post2 = post1.clone(); post1.position.set(-0.3, 0.5, -0.15); post2.position.set(0.3, 0.5, -0.15); g.add(post1, post2);
  const bar = box(0.72, 0.08, 0.12, iron); bar.position.set(0, 0.95, -0.15); g.add(bar);
  const sample = box(0.36, 0.12, 0.3, woodMat(id, { repeat: [0.3, 0.3] })); sample.position.set(0, 0.11, 0); g.add(sample);
  // Eindruck: Fläche ~ 1/HB (bei gleicher Kraft)
  const d = 0.11 * Math.sqrt(12 / h.brinellNum);
  const dent = new THREE.Mesh(new THREE.CircleGeometry(d / 2, 32), new THREE.MeshStandardMaterial({ color: '#2a1a0e', roughness: 0.6 }));
  dent.rotation.x = -Math.PI / 2; dent.position.set(0, 0.171, 0); g.add(dent);
  const rim = new THREE.Mesh(new THREE.RingGeometry(d / 2, d / 2 + 0.008, 32), new THREE.MeshStandardMaterial({ color: '#d8b07a', emissive: '#ffb050', emissiveIntensity: 0.6 }));
  rim.rotation.x = -Math.PI / 2; rim.position.set(0, 0.172, 0); g.add(rim);
  const spindle = cyl(0.018, 0.018, 0.5, steel); g.add(spindle);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), steel); ball.castShadow = true; g.add(ball);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24), iron); wheel.rotation.x = Math.PI / 2; g.add(wheel);
  // Skalenschild
  const c = canvas(512, 128), ctx = c.getContext('2d');
  ctx.fillStyle = '#e8d29a'; ctx.fillRect(0, 0, 512, 128); ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#2a1a0e'; ctx.font = '600 52px "IM Fell English", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(`HB ≈ ${h.brinellNum} N/mm²`, 256, 84);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.14), new THREE.MeshStandardMaterial({ map: texFromCanvas(c), metalness: 0.6, roughness: 0.4 }));
  sign.position.set(0, 0.035, 0.28); sign.rotation.x = -0.9; g.add(sign);
  g.userData.update = (dt, t) => {
    const ph = (t * 0.35) % 1; const down = smooth(0.1, 0.4, ph) * (1 - smooth(0.7, 0.95, ph));
    const y = 0.171 + 0.05 + (1 - down) * 0.22 - down * 0.01;
    ball.position.set(0, y, 0); spindle.position.set(0, y + 0.27, 0); wheel.position.set(0, y + 0.5, 0); wheel.rotation.z = t;
    rim.material.emissiveIntensity = 0.3 + down * 1.6;
  };
  return g;
}

// ---------- Harztropfen am Stamm ----------
export function makeResin(tree, level, r = rng(9)) {
  const g = new THREE.Group(); if (!level) return g;
  const n = level * 9;
  const mat = new THREE.MeshPhysicalMaterial({ color: '#f0a020', emissive: '#ff8a10', emissiveIntensity: 1.6, roughness: 0.05, clearcoat: 1, transmission: 0.0 });
  for (let i = 0; i < n; i++) {
    const y = r.range(0.6, Math.min(tree.trunkTop * 0.55, 7)); const tk = tree.trunkAt(y); const a = r.range(-1.4, 1.4) + Math.PI / 2; // zur Kamera hin
    const p = tk.p.clone().add(V(Math.cos(a) * tk.r * 0.98, 0, Math.sin(a) * tk.r * 0.98));
    const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mat); drop.scale.set(0.035, 0.06, 0.035).multiplyScalar(r.range(0.7, 1.4)); drop.position.copy(p);
    g.add(drop);
    if (r() < 0.6) { const st = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, r.range(0.15, 0.5), 3, 6), mat); st.position.copy(p).add(V(0, -0.15, 0)); g.add(st); }
  }
  g.userData.update = (dt, t) => { mat.emissiveIntensity = 1.3 + Math.sin(t * 1.7) * 0.5; };
  return g;
}

// ---------- Holztafel (antippbar) ----------
export async function makeSign(id, h) {
  const g = new THREE.Group();
  const post = barkMat(id);
  for (const x of [-1.05, 1.05]) { const p = cyl(0.07, 0.09, 1.95, post, 10); p.position.set(x, 0.97, 0); p.rotation.z = x * 0.02; g.add(p); }
  // Tafeltextur
  const W = 1024, H = 620, c = canvas(W, H), ctx = c.getContext('2d');
  const wt = woodTextures(id, WOODVIS[id]).map.image;
  const pat = ctx.createPattern(wt, 'repeat'); pat.setTransform(new DOMMatrix().scale(0.45, 1.3));
  ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,238,205,0.38)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(40,24,10,0.85)'; ctx.lineWidth = 10; ctx.strokeRect(18, 18, W - 36, H - 36); ctx.lineWidth = 2; ctx.strokeRect(34, 34, W - 68, H - 68);
  const burn = (txt, x, y, font, a = 'center') => { ctx.font = font; ctx.textAlign = a; ctx.fillStyle = 'rgba(255,240,210,0.6)'; ctx.fillText(txt, x + 3, y + 3); ctx.fillStyle = '#1e1006'; ctx.fillText(txt, x, y); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1e1006'; ctx.strokeText(txt, x, y); };
  burn(h.name, W / 2, 150, '138px "IM Fell English SC","IM Fell English", Georgia, serif');
  burn(h.bot, W / 2, 200, 'italic 44px "IM Fell English", Georgia, serif');
  burn(`${h.typ} · ${h.kurz}`, W / 2, 252, '34px "IM Fell English", Georgia, serif');
  const keys = ['innen', 'aussen', 'tragend', 'dekorativ'];
  for (let i = 0; i < 4; i++) {
    const img = await svgToImage(emblemSVG(keys[i], h.einsatz[keys[i]], { size: 140, fill: 'rgba(245,232,205,0.9)' }));
    const x = 120 + i * 205;
    if (img) ctx.drawImage(img, x, 290, 150, 165);
    burn(EINSATZ_LABEL[keys[i]], x + 75, 500, '30px "IM Fell English", Georgia, serif');
  }
  burn('☞ antippen für den Steckbrief', W / 2, 570, 'italic 30px "IM Fell English", Georgia, serif');
  const front = new THREE.MeshStandardMaterial({ map: texFromCanvas(c, { repeat: [1, 1] }), roughness: 0.7, emissive: '#ffcf80', emissiveIntensity: 0.0, emissiveMap: null });
  const edge = woodMat(id, { repeat: [0.2, 0.2] });
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.33, 0.08), [edge, edge, edge, edge, front, edge]);
  board.position.set(0, 1.25, 0.05); board.castShadow = board.receiveShadow = true;
  g.add(board);
  // Leuchtrahmen als Hinweis auf Interaktion
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.5), new THREE.MeshBasicMaterial({ color: '#ffc870', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(0, 1.25, 0.0); g.add(glow);
  g.userData.pickId = 'tafel';
  g.userData.update = (dt, t, hover) => { const k = 0.18 + Math.sin(t * 2) * 0.1 + (hover ? 0.35 : 0); glow.material.opacity = k; front.emissiveIntensity = hover ? 0.08 : 0; };
  return g;
}

// Sockel mit Leuchtring für schwebende Werkstücke
export function makePedestal(stoneColor = '#5e5850', glow = '#ffd38a') {
  const g = new THREE.Group();
  const st = new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.9 });
  const a = cyl(0.55, 0.65, 0.3, st, 8); a.position.y = 0.15; const b = cyl(0.45, 0.5, 0.5, st, 8); b.position.y = 0.55; const c = cyl(0.55, 0.45, 0.12, st, 8); c.position.y = 0.86;
  g.add(a, b, c);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 1.0; g.add(ring);
  g.userData.top = 0.92;
  g.userData.update = (dt, t) => { ring.scale.setScalar(1 + Math.sin(t * 1.5) * 0.05); ring.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.3; };
  return g;
}
