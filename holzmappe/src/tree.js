import * as THREE from 'three';
import { rng, fbm, noise2, clamp, smooth, lerp, pushTube, pushCard, newBuf, bufToGeo, barkTextures, foliageTexture, canvas, texFromCanvas } from './util.js';
import { windify } from './engine.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ---------- Artparameter ----------
export const SPECIES = {
  kiefer: {
    form: 'decurrent', H: 17, R0: 0.42, flare: 0.35, trunkTo: 0.6, lean: 0.06, crook: 0.2, leader: true,
    splits: [3, 4], depth: 4, children: [3, 3, 2, 3], angle: [0.85, 0.9, 0.8, 0.7], lenRatio: [0.6, 0.6, 0.55, 0.5], limbLen: 5.0, up: 0.04, grav: 0.13, flat: 0.85,
    bark: { kind: 'plates', base: '#8a7564', dark: '#2e221a' }, barkColor: (t) => t > 0.42 ? [1.65, 0.95, 0.6] : (t > 0.32 ? [1.3, 0.9, 0.72] : [0.95, 0.88, 0.82]),
    leaf: { kind: 'pine', c1: '#2c4a34', c2: '#5f7a48', w: 1.9, h: 1.7, per: 11, spread: 0.9, upward: 0.2, plate: true },
    fruit: { kind: 'cone_pine', n: 40 }, stubs: 9,
  },
  fichte: {
    form: 'excurrent', H: 21, R0: 0.4, flare: 0.5, crownBase: 0.12, whorls: 30, perWhorl: [4, 6], Lmax: 4.6,
    profile: t => Math.pow(1 - t, 0.92) * (0.35 + 0.65 * smooth(0, 0.12, t + 0.05)), droop: 0.32, droopLow: 0.25, upturn: 0.55, sag: 0.2,
    sub: { n: 7, len: 0.45, hang: 0.85 },
    bark: { kind: 'scales', base: '#8b5a3c', dark: '#3a2418' }, barkColor: () => [1, 0.95, 0.9],
    leaf: { kind: 'spray', c1: '#1f3a2a', c2: '#3c5e3a', w: 1.2, h: 1.25, spacing: 0.55, tilt: 0.5 },
    fruit: { kind: 'cone_spruce', n: 34 },
  },
  tanne: {
    form: 'excurrent', H: 20, R0: 0.42, flare: 0.4, crownBase: 0.18, whorls: 26, perWhorl: [4, 5], Lmax: 4.4,
    profile: t => (t > 0.86 ? 0.45 * (1 - t) / 0.14 + 0.15 : Math.pow(1 - t, 0.55)) * (0.4 + 0.6 * smooth(0, 0.1, t + 0.04)), droop: 0.06, droopLow: 0.12, upturn: 0.15, sag: 0.05,
    sub: { n: 6, len: 0.5, hang: 0.0, flat: true },
    bark: { kind: 'smooth', base: '#a9aba4', dark: '#5d5f5a' }, barkColor: () => [1, 1, 1.02],
    leaf: { kind: 'flatspray', c1: '#233f2e', c2: '#3d6146', w: 1.35, h: 1.2, spacing: 0.55, tilt: 0.15 },
    fruit: { kind: 'cone_fir', n: 26, top: 0.22 },
  },
  laerche: {
    form: 'excurrent', H: 20, R0: 0.4, flare: 0.4, crownBase: 0.2, whorls: 20, perWhorl: [3, 5], Lmax: 4.0,
    profile: t => Math.pow(1 - t, 0.9) * (0.45 + 0.55 * smooth(0, 0.1, t + 0.05)), droop: 0.15, droopLow: 0.3, upturn: 0.35, sag: 0.25,
    sub: { n: 5, len: 0.5, hang: 1.0 },
    bark: { kind: 'furrow', base: '#8a6c5a', dark: '#3a2620' }, barkColor: () => [1.05, 0.92, 0.85],
    leaf: { kind: 'larch', c1: '#c9902b', c2: '#f0c75a', w: 1.25, h: 1.3, spacing: 0.75, tilt: 0.7, sparse: 0.75 },
    fruit: { kind: 'cone_larch', n: 60 },
  },
  douglasie: {
    form: 'excurrent', H: 26, R0: 0.55, flare: 0.5, crownBase: 0.3, whorls: 28, perWhorl: [4, 5], Lmax: 4.8,
    profile: t => Math.pow(1 - t, 0.85) * (0.4 + 0.6 * smooth(0, 0.08, t + 0.04)), droop: 0.2, droopLow: 0.35, upturn: 0.3, sag: 0.25,
    sub: { n: 6, len: 0.45, hang: 0.4 },
    bark: { kind: 'furrow', base: '#7a5a48', dark: '#2a1a14' }, barkColor: (t) => [1.1, 0.9, 0.82],
    leaf: { kind: 'spray', c1: '#27452f', c2: '#55784a', w: 1.25, h: 1.25, spacing: 0.6, tilt: 0.45 },
    fruit: { kind: 'cone_douglas', n: 36 },
  },
  eiche: {
    form: 'decurrent', H: 19, R0: 0.95, flare: 0.6, trunkTo: 0.3, lean: 0.02, crook: 0.24,
    splits: [4, 5], depth: 4, children: [3, 3, 3, 3], angle: [0.8, 0.85, 0.8, 0.75], lenRatio: [0.6, 0.6, 0.58, 0.52], limbLen: 6.4, up: 0.1, grav: 0.07, flat: 0.55,
    bark: { kind: 'deepfurrow', base: '#7d7468', dark: '#2a241f' }, barkColor: (t) => t < 0.12 ? [0.82, 0.95, 0.72] : [1, 1, 1],
    leaf: { kind: 'oak', c1: '#2f4a22', c2: '#6e8a3c', w: 1.7, h: 1.7, per: 7, spread: 1.0, upward: 0.2 },
    fruit: { kind: 'acorn', n: 70 },
  },
  robinie: {
    form: 'decurrent', H: 16, R0: 0.5, flare: 0.3, trunkTo: 0.38, lean: 0.08, crook: 0.42,
    splits: [3, 3], depth: 3, children: [3, 2, 3], angle: [0.7, 0.85, 0.9], lenRatio: [0.65, 0.6, 0.55], limbLen: 6.2, up: 0.1, grav: 0.1, flat: 0.5,
    bark: { kind: 'net', base: '#7a6a58', dark: '#241c16' }, barkColor: () => [1, 0.97, 0.92],
    leaf: { kind: 'robinia', c1: '#4f6e2a', c2: '#9ab45a', w: 1.7, h: 1.7, per: 8, spread: 1.0, upward: 0.1 },
    fruit: { kind: 'pod', n: 60 }, flowers: 70, thorns: true,
  },
  buche: {
    form: 'decurrent', H: 24, R0: 0.62, flare: 0.45, trunkTo: 0.48, lean: 0.0, crook: 0.12,
    splits: [3, 4], depth: 4, children: [3, 3, 2, 3], angle: [0.5, 0.65, 0.75, 0.8], lenRatio: [0.65, 0.65, 0.6, 0.55], limbLen: 7.0, up: 0.22, grav: 0.06, flat: 0.35,
    bark: { kind: 'beech', base: '#9c9d96', dark: '#5f625c' }, barkColor: (t) => t < 0.08 ? [0.85, 0.95, 0.8] : [1, 1, 1],
    leaf: { kind: 'beech', c1: '#a8501f', c2: '#e3a04a', w: 1.5, h: 1.5, per: 6, spread: 1.0, upward: 0.25 },
    fruit: { kind: 'beechnut', n: 50 },
  },
};

// ---------- Materialien (gecacht je Art) ----------
const MATS = new Map();
export function treeMaterials(id, sp) {
  if (MATS.has(id)) return MATS.get(id);
  const bt = barkTextures(sp.bark.kind, sp.bark.base, sp.bark.dark);
  const bark = new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.93, vertexColors: true });
  const lt = foliageTexture(sp.leaf.kind, sp.leaf.c1, sp.leaf.c2);
  const leaf = new THREE.MeshStandardMaterial({ map: lt, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72, metalness: 0, emissive: new THREE.Color(sp.leaf.c2).multiplyScalar(0.06) });
  windify(leaf, { amp: 0.09, sway: true });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lt, alphaTest: 0.42 });
  const m = { bark, leaf, depth };
  MATS.set(id, m);
  return m;
}

// ---------- Generator ----------
export function makeTree(id, { seed = 1, detail = 1, scale = 1 } = {}) {
  const sp = SPECIES[id];
  const r = rng(seed * 7919 + id.length);
  const bark = newBuf(true), leaves = newBuf(true); leaves.sway = [];
  const tips = [];       // Fruchtpositionen
  const trunk = { pts: [], radii: [] };
  const H = sp.H * scale, R0 = sp.R0 * scale;
  const radial = detail >= 1 ? 14 : 7;
  const lc1 = new THREE.Color(sp.leaf.c1), lc2 = new THREE.Color(sp.leaf.c2);
  const tint = () => { const k = r.range(0.78, 1.18); return [k * r.range(0.92, 1.08), k, k * r.range(0.88, 1.04)]; };
  const barkCol = (p) => sp.barkColor(clamp(p.y / H, 0, 1));
  const leafScale = (detail >= 1 ? 1 : 1.6) * scale;

  // ---- Stamm ----
  const trunkTop = sp.form === 'excurrent' ? H : H * sp.trunkTo;
  const nT = detail >= 1 ? 26 : 10;
  const leanDir = V(r.range(-1, 1), 0, r.range(-1, 1)).normalize();
  for (let i = 0; i <= nT; i++) {
    const t = i / nT, y = t * trunkTop;
    const wob = sp.form === 'excurrent' ? 0.12 : (sp.crook || 0.1) * 0.8;
    const p = V(fbm(t * 2.5, seed, 2) * wob * H * 0.03 + leanDir.x * (sp.lean || 0) * y, y, fbm(seed, t * 2.5, 2) * wob * H * 0.03 + leanDir.z * (sp.lean || 0) * y);
    trunk.pts.push(p);
    const taper = sp.form === 'excurrent' ? Math.pow(1 - t, 0.85) * 0.97 + 0.03 : 1 - t * 0.35;
    const flare = 1 + sp.flare * Math.exp(-t * (sp.form === 'excurrent' ? 18 : 10) * (trunkTop / H));
    trunk.radii.push(R0 * taper * flare);
  }
  pushTube(bark, trunk.pts, trunk.radii, radial, 0.35 / scale, barkCol);
  // Wurzelanläufe
  if (detail >= 1) {
    const nr = sp.form === 'excurrent' ? 5 : 7;
    for (let k = 0; k < nr; k++) {
      const a = (k / nr) * Math.PI * 2 + r.range(-0.3, 0.3), d = V(Math.cos(a), 0, Math.sin(a));
      const pts = [], rad = [];
      for (let s = 0; s <= 6; s++) { const t = s / 6; pts.push(V(d.x * (R0 * 0.3 + t * R0 * 3.2), lerp(R0 * 1.4, -0.12, Math.pow(t, 0.6)), d.z * (R0 * 0.3 + t * R0 * 3.2))); rad.push(R0 * 0.5 * (1 - t) + 0.03); }
      pushTube(bark, pts, rad, 8, 0.35, barkCol);
    }
  }
  const trunkAt = (y) => { const t = clamp(y / trunkTop, 0, 1) * nT; const i = Math.min(nT - 1, Math.floor(t)); const f = t - i; return { p: trunk.pts[i].clone().lerp(trunk.pts[i + 1], f), r: lerp(trunk.radii[i], trunk.radii[i + 1], f) }; };

  const addLeaf = (pos, dir, up, sz = 1) => {
    pushCard(leaves, pos, dir, up, sp.leaf.w * sz * leafScale * r.range(0.8, 1.15), sp.leaf.h * sz * leafScale * r.range(0.8, 1.15), tint());
  };

  if (sp.form === 'excurrent') {
    const cb = sp.crownBase * H, whorls = Math.max(6, Math.round(sp.whorls * (detail >= 1 ? 1 : 0.55)));
    let az0 = r() * 6.28;
    for (let w = 0; w < whorls; w++) {
      const t = w / whorls, y = cb + t * (H * 0.985 - cb);
      const k = Math.round(r.range(sp.perWhorl[0], sp.perWhorl[1] + 0.99));
      az0 += 0.7 + r() * 0.6;
      const tk = trunkAt(y);
      for (let b = 0; b < k; b++) {
        if (sp.leaf.sparse && r() > sp.leaf.sparse + 0.2) continue;
        const az = az0 + (b / k) * Math.PI * 2 + r.range(-0.25, 0.25);
        const L = sp.Lmax * scale * sp.profile(t) * r.range(0.82, 1.1);
        if (L < 0.25) continue;
        const hd = V(Math.cos(az), 0, Math.sin(az));
        const droop = sp.droop + (1 - t) * sp.droopLow;
        const pts = [], rad = [], n = 7;
        const r0 = Math.max(0.03, tk.r * 0.32);
        for (let s = 0; s <= n; s++) {
          const u = s / n;
          const p = tk.p.clone().addScaledVector(hd, tk.r * 0.8 + u * L);
          p.y += -droop * u * L - sp.sag * u * u * L * (1 - t) + sp.upturn * Math.pow(u, 3) * L * 0.35;
          p.x += noise2(u * 3, b + w) * 0.08 * L; p.z += noise2(b - w, u * 3) * 0.08 * L;
          pts.push(p); rad.push(lerp(r0, 0.012, Math.pow(u, 0.8)));
        }
        if (detail >= 1 || L > 1.4) pushTube(bark, pts, rad, detail >= 1 ? 5 : 3, 0.5, barkCol);
        // Nebenzweige + Nadelkarten
        const subN = Math.max(2, Math.round(sp.sub.n * (detail >= 1 ? 1 : 0.5) * (0.5 + L / sp.Lmax)));
        for (let s = 0; s < subN; s++) {
          const u = 0.2 + (s / subN) * 0.8;
          const i = Math.min(n - 1, Math.floor(u * n)), f = u * n - i;
          const p = pts[i].clone().lerp(pts[i + 1], f);
          const along = pts[i + 1].clone().sub(pts[i]).normalize();
          const side = along.clone().cross(UP).normalize().multiplyScalar(s % 2 ? 1 : -1);
          let d2 = along.clone().multiplyScalar(0.55).add(side.multiplyScalar(0.8));
          d2.y -= sp.sub.hang * r.range(0.6, 1.2); d2.normalize();
          const l2 = L * sp.sub.len * (1.1 - u) * r.range(0.8, 1.2);
          const end = p.clone().addScaledVector(d2, l2);
          if (detail >= 1) pushTube(bark, [p, p.clone().lerp(end, 0.5), end], [0.018, 0.012, 0.006], 3, 0.5, barkCol);
          const cards = Math.max(1, Math.round(l2 / (sp.leaf.spacing * 1.2)));
          for (let c = 0; c < cards; c++) {
            const q = p.clone().lerp(end, c / cards);
            const upv = sp.sub.flat ? V(r.range(-0.1, 0.1), 1, r.range(-0.1, 0.1)) : V(r.range(-1, 1) * sp.leaf.tilt, 1, r.range(-1, 1) * sp.leaf.tilt);
            addLeaf(q, d2, upv.normalize(), 0.9);
          }
        }
        // Karten entlang des Hauptastes
        const cardsMain = Math.max(1, Math.round(L / sp.leaf.spacing));
        for (let c = 0; c < cardsMain; c++) {
          const u = 0.25 + (c / cardsMain) * 0.78; const i = Math.min(n - 1, Math.floor(u * n)), f = u * n - i;
          const p = pts[i].clone().lerp(pts[i + 1], f), d = pts[i + 1].clone().sub(pts[i]).normalize();
          addLeaf(p, d, V(r.range(-1, 1) * sp.leaf.tilt, 1, r.range(-1, 1) * sp.leaf.tilt).normalize(), 1.0);
          if (r() < 0.35) addLeaf(p, d.clone().add(V(r.range(-0.5, 0.5), r.range(-0.3, 0.6), r.range(-0.5, 0.5))).normalize(), V(r.range(-1, 1), 0.4, r.range(-1, 1)).normalize(), 0.85);
        }
        // Früchte
        if (sp.fruit) {
          const top = sp.fruit.top || 1;
          if (t > 1 - top || !sp.fruit.top) tips.push({ p: pts[n].clone(), d: pts[n].clone().sub(pts[n - 1]).normalize(), t });
          if (!sp.fruit.top && r() < 0.5) tips.push({ p: pts[Math.floor(n * 0.6)].clone(), d: pts[n].clone().sub(pts[n - 1]).normalize(), t });
        }
      }
    }
    // Wipfel
    for (let i = 0; i < 6; i++) addLeaf(V(0, H * (0.93 + i * 0.012), 0).add(trunk.pts[nT].clone().setY(0)), V(r.range(-0.3, 0.3), 1, r.range(-0.3, 0.3)).normalize(), V(r.range(-1, 1), 0, r.range(-1, 1)).normalize(), 0.7);
  } else {
    // ---- Laubbaum / Kiefer: rekursive Gabelung ----
    const top = trunk.pts[nT], topR = trunk.radii[nT];
    const maxD = detail >= 1 ? sp.depth : sp.depth - 1;
    const grow = (p0, dir, len, r0, depth) => {
      const n = depth === 0 ? 8 : 6;
      const pts = [p0.clone()], rad = [r0];
      let d = dir.clone(), p = p0.clone();
      for (let s = 1; s <= n; s++) {
        const u = s / n;
        d.add(V(noise2(p.x * 0.7, p.z * 0.7 + depth) * sp.crook, noise2(p.y * 0.7 + depth, p.x) * sp.crook * 0.5, noise2(p.z * 0.7, p.y * 0.7) * sp.crook));
        d.addScaledVector(dir, 0.3); // Richtung halten, kein Abdriften
        d.y += sp.up - sp.grav * (depth + 1) * 0.5;
        // Kronen-Abflachung: horizontale Ausbreitung
        d.y *= 1 - sp.flat * 0.15 * u;
        d.normalize();
        p = p.clone().addScaledVector(d, len / n);
        pts.push(p); rad.push(lerp(r0, r0 * 0.55, u));
      }
      pushTube(bark, pts, rad, Math.max(4, Math.round(radial * (depth === 0 ? 0.8 : 0.55 - depth * 0.08))), 0.35, barkCol);
      if (depth >= maxD) {
        // Blätter an den Endtrieben
        const per = Math.round(sp.leaf.per * (detail >= 1 ? 1 : 0.8));
        for (let k = 0; k < per; k++) {
          const u = 0.35 + 0.65 * (k / per);
          const i = Math.floor(u * n), q = pts[Math.min(n, i)].clone();
          const out = q.clone().sub(V(top.x, top.y + H * 0.15, top.z)); out.y *= 0.5; out.normalize();
          if (sp.leaf.plate) { // flache Nadelpolster (Kiefer)
            const dd = V(out.x + r.range(-0.7, 0.7), r.range(-0.08, 0.15), out.z + r.range(-0.7, 0.7)).normalize();
            addLeaf(q.clone().add(V(0, r.range(-0.15, 0.25), 0)), dd, V(r.range(-0.12, 0.12), 1, r.range(-0.12, 0.12)).normalize(), r.range(0.8, 1.2));
          } else {
            const dd = d.clone().multiplyScalar(0.5).add(out).add(V(r.range(-0.6, 0.6), sp.leaf.upward + r.range(-0.3, 0.5), r.range(-0.6, 0.6))).normalize();
            addLeaf(q, dd, V(r.range(-1, 1), 0.6, r.range(-1, 1)).normalize(), 1);
          }
        }
        tips.push({ p: p.clone(), d: d.clone(), t: 1 });
        return;
      }
      const nc = sp.children[depth] + (r() < 0.3 ? 1 : 0);
      const perp = d.clone().cross(Math.abs(d.y) > 0.9 ? V(1, 0, 0) : UP).normalize();
      let az = r() * 6.28;
      for (let c = 0; c < nc; c++) {
        const apical = c === 0;
        const u = apical ? 1 : r.range(0.45, 0.95);
        const i = Math.min(n, Math.round(u * n));
        const base = pts[i], br = rad[i] * (apical ? 0.82 : 0.62);
        az += 2.4;
        const ang = sp.angle[Math.min(depth, sp.angle.length - 1)] * (apical ? 0.35 : r.range(0.75, 1.15));
        const ax = perp.clone().applyAxisAngle(d, az);
        const nd = d.clone().applyAxisAngle(ax, ang);
        const nl = len * sp.lenRatio[Math.min(depth, sp.lenRatio.length - 1)] * r.range(0.8, 1.15) * (apical ? 1.05 : 1);
        grow(base, nd, nl, Math.max(0.012, br), depth + 1);
      }
    };
    const ns = Math.round(r.range(sp.splits[0], sp.splits[1] + 0.99));
    if (sp.leader) grow(top.clone(), V(r.range(-0.1, 0.1), 1, r.range(-0.1, 0.1)).normalize(), sp.limbLen * scale * 0.9, topR * 0.8, 0);
    for (let s = 0; s < ns; s++) {
      const a = (s / ns) * Math.PI * 2 + r.range(-0.3, 0.3);
      const out = V(Math.cos(a), 0, Math.sin(a));
      const d = UP.clone().multiplyScalar(lerp(1.2, 0.55, sp.flat)).add(out).normalize();
      grow(top.clone().addScaledVector(V(0, -1, 0), topR * 0.5), d, sp.limbLen * scale * r.range(0.85, 1.1), topR * 0.68, 0);
    }
    // abgestorbene Aststummel am Stamm (Kiefer)
    if (sp.stubs && detail >= 1) for (let k = 0; k < sp.stubs; k++) {
      const y = r.range(0.25, 0.9) * trunkTop, tk = trunkAt(y), a = r() * 6.28, d = V(Math.cos(a), r.range(-0.2, 0.2), Math.sin(a)).normalize();
      const p0 = tk.p.clone().addScaledVector(d, tk.r * 0.7);
      pushTube(bark, [p0, p0.clone().addScaledVector(d, r.range(0.3, 0.8))], [0.05, 0.015], 5, 0.5, () => [0.7, 0.62, 0.55]);
    }
  }

  // ---- Meshes ----
  const mats = treeMaterials(id, sp);
  const group = new THREE.Group();
  const barkGeo = bufToGeo(bark), leafGeo = bufToGeo(leaves);
  const barkMesh = new THREE.Mesh(barkGeo, mats.bark), leafMesh = new THREE.Mesh(leafGeo, mats.leaf);
  barkMesh.castShadow = true; barkMesh.receiveShadow = true;
  leafMesh.castShadow = true; leafMesh.receiveShadow = true; leafMesh.customDepthMaterial = mats.depth;
  group.add(barkMesh, leafMesh);
  group.userData = { H, trunkAt, tips, trunkTop };
  return { group, barkGeo, leafGeo, mats, tips, trunkAt, H, trunkTop };
}

// ---------- Früchte ----------
function scaleTexture(c1, c2) {
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = c2; ctx.fillRect(0, 0, S, S);
  for (let y = -1; y < 9; y++) for (let x = -1; x < 9; x++) {
    const cx = (x + (y % 2) * 0.5) * 32, cy = y * 30;
    const g = ctx.createRadialGradient(cx, cy + 6, 2, cx, cy, 22); g.addColorStop(0, c1); g.addColorStop(0.8, c2); g.addColorStop(1, '#1d120a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, 17, 15, 0, 0, Math.PI); ctx.fill();
  }
  return texFromCanvas(c);
}

export function makeFruits(id, tips, { seed = 3, count } = {}) {
  const sp = SPECIES[id]; if (!sp.fruit) return null;
  const r = rng(seed);
  const kind = sp.fruit.kind; const n = Math.min(count || sp.fruit.n, tips.length * 2);
  let geo, mat, len = 0.3;
  const lathe = (prof, seg = 14) => new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  switch (kind) {
    case 'cone_pine': geo = lathe([[0, 0], [0.05, 0.02], [0.07, 0.08], [0.06, 0.14], [0.03, 0.19], [0, 0.21]]); mat = new THREE.MeshStandardMaterial({ map: scaleTexture('#8a6a46', '#4a3420'), roughness: 0.9 }); break;
    case 'cone_spruce': geo = lathe([[0, 0], [0.05, 0.02], [0.08, 0.1], [0.075, 0.3], [0.05, 0.42], [0, 0.46]]); mat = new THREE.MeshStandardMaterial({ map: scaleTexture('#b07a48', '#5a3a22'), roughness: 0.85 }); break;
    case 'cone_fir': geo = lathe([[0, 0], [0.06, 0.02], [0.085, 0.1], [0.085, 0.3], [0.06, 0.4], [0, 0.42]]); mat = new THREE.MeshStandardMaterial({ map: scaleTexture('#7d6a8a', '#3d3048'), roughness: 0.75, emissive: new THREE.Color('#2a2240'), emissiveIntensity: 0.4 }); break;
    case 'cone_larch': geo = lathe([[0, 0], [0.05, 0.01], [0.06, 0.05], [0.05, 0.1], [0.02, 0.13], [0, 0.135]]); mat = new THREE.MeshStandardMaterial({ map: scaleTexture('#a87a52', '#5a3a24'), roughness: 0.85 }); break;
    case 'cone_douglas': geo = lathe([[0, 0], [0.04, 0.02], [0.065, 0.1], [0.06, 0.22], [0.035, 0.3], [0, 0.32]]); mat = new THREE.MeshStandardMaterial({ map: scaleTexture('#b0885a', '#6a4a2a'), roughness: 0.85 }); break;
    case 'acorn': { const g1 = lathe([[0, 0], [0.04, 0.01], [0.05, 0.05], [0.04, 0.1], [0.012, 0.13], [0, 0.135]]); geo = g1; mat = new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: 0.5 }); break; }
    case 'beechnut': geo = new THREE.TetrahedronGeometry(0.06, 1); mat = new THREE.MeshStandardMaterial({ color: '#7a4a28', roughness: 0.8 }); break;
    case 'pod': geo = new THREE.CapsuleGeometry(0.03, 0.4, 3, 8); geo.scale(1, 1, 0.35); geo.translate(0, -0.22, 0); mat = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.7 }); break;
  }
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const tp = tips[Math.floor(r() * tips.length)];
    const p = tp.p.clone().add(V(r.range(-0.3, 0.3), r.range(-0.2, 0.1), r.range(-0.3, 0.3)));
    let dir;
    if (kind === 'cone_fir' || kind === 'cone_larch') dir = V(r.range(-0.15, 0.15), 1, r.range(-0.15, 0.15));        // stehend
    else if (kind === 'cone_spruce' || kind === 'cone_douglas' || kind === 'pod') { dir = V(r.range(-0.2, 0.2), -1, r.range(-0.2, 0.2)); p.y -= 0.1; } // hängend
    else dir = V(r.range(-1, 1), r.range(-1, 0.3), r.range(-1, 1));
    q.setFromUnitVectors(UP, dir.normalize());
    const k = r.range(0.85, 1.25) * (kind === 'pod' ? 1 : 1.6);
    m.compose(p, q, s.set(k, k, k)); mesh.setMatrixAt(i, m);
  }
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  // Eichel-Hütchen
  if (kind === 'acorn') {
    const cup = new THREE.InstancedMesh(new THREE.SphereGeometry(0.052, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 1 }), n);
    for (let i = 0; i < n; i++) { mesh.getMatrixAt(i, m); const t = new THREE.Matrix4().makeTranslation(0, 0.13 * 1, 0); const r2 = new THREE.Matrix4().makeRotationX(Math.PI); cup.setMatrixAt(i, m.clone().multiply(t).multiply(r2)); }
    g.add(cup);
  }
  return g;
}

// Robinie: weiße Blütentrauben + Dornen
export function makeRobiniaExtras(tips, { seed = 5 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const n = 150;
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 6, 5), new THREE.MeshStandardMaterial({ color: '#fbf6e8', roughness: 0.6, emissive: '#fff4d8', emissiveIntensity: 0.25 }), n * 9);
  const m = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < n; i++) {
    const tp = tips[Math.floor(r() * tips.length)];
    const base = tp.p.clone().add(V(r.range(-0.5, 0.5), -0.1, r.range(-0.5, 0.5)));
    for (let j = 0; j < 9; j++) { const s = 1 - j * 0.07; m.makeScale(s, s * 0.8, s).setPosition(base.x + Math.sin(j * 2.3) * 0.07, base.y - j * 0.075, base.z + Math.cos(j * 2.3) * 0.07); fl.setMatrixAt(k++, m); }
  }
  g.add(fl);
  return g;
}

// Hintergrundwald: instanzierte, vereinfachte Bäume
export function makeForest(id, positions, { seed = 11, scaleRange = [0.6, 1.0] } = {}) {
  const t = makeTree(id, { seed, detail: 0.4 });
  const r = rng(seed + 3);
  const n = positions.length;
  const bm = new THREE.InstancedMesh(t.barkGeo, t.mats.bark, n), lm = new THREE.InstancedMesh(t.leafGeo, t.mats.leaf, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  positions.forEach((p, i) => {
    q.setFromAxisAngle(UP, r() * 6.28); const k = r.range(scaleRange[0], scaleRange[1]);
    m.compose(p, q, s.set(k, k * r.range(0.9, 1.1), k)); bm.setMatrixAt(i, m); lm.setMatrixAt(i, m);
  });
  lm.customDepthMaterial = t.mats.depth;
  bm.castShadow = lm.castShadow = true; bm.receiveShadow = lm.receiveShadow = true;
  const g = new THREE.Group(); g.add(bm, lm); return g;
}
