import * as THREE from 'three';
import { rng, smooth, clamp, lerp, easeInOut, softTexture } from './util.js';
import { windify, dissolvable } from './engine.js';
import { makeTree, makeFruits, makeRobiniaExtras, treeMaterials, juvenileSpec, scaleTexture, SPECIES } from './tree.js';
import { buildBase, addNature, LANDING, disposeScene } from './realms.js';
import { lebensModell } from './data.js';
import { barkMat } from './props.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const WINGED = ['kiefer', 'fichte', 'tanne', 'laerche', 'douglasie'];

// ---------- Materialien mit Auflösen ----------
function lifeMats(id, sp) {
  const base = treeMaterials(id, sp);
  const uBark = { vis: { value: 0 }, cut: { value: 1e6 } }, uLeaf = { vis: { value: 0 }, cut: { value: 1e6 } };
  const bark = base.bark.clone(); dissolvable(bark, uBark);
  const leaf = base.leaf.clone(); windify(leaf, { amp: 0.09, sway: true }); dissolvable(leaf, uLeaf);
  return { mats: { bark, leaf, depth: base.depth }, uBark, uLeaf };
}

// ---------- Samen (Form je Art, in Metern, für die Kamera ×3 vergrößert) ----------
function seedModel(id) {
  const g = new THREE.Group();
  const brown = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  if (WINGED.includes(id)) {
    const dims = { kiefer: [0.004, 0.016], fichte: [0.004, 0.015], tanne: [0.008, 0.022], laerche: [0.0035, 0.011], douglasie: [0.006, 0.016] }[id];
    const nut = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), brown(id === 'tanne' ? '#7a5a3a' : '#3a2616', 0.5));
    nut.scale.set(dims[0] * 0.55, dims[0] * 0.35, dims[0]); g.add(nut);
    const w = new THREE.Shape(); const L = dims[1], W = L * (id === 'tanne' ? 0.55 : 0.4);
    w.moveTo(0, -dims[0] * 0.5); w.bezierCurveTo(W, 0, W * 0.9, L * 0.7, W * 0.2, L); w.bezierCurveTo(-W * 0.3, L * 0.8, -W * 0.5, L * 0.2, 0, -dims[0] * 0.5);
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(w), new THREE.MeshStandardMaterial({ color: id === 'tanne' ? '#c8a070' : '#b08050', roughness: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    wing.rotation.x = -Math.PI / 2; wing.rotation.z = 0.2; g.add(wing);
    g.userData.size = dims[1];
  } else if (id === 'eiche') {
    const prof = [[0, 0], [0.008, 0.002], [0.011, 0.01], [0.009, 0.022], [0.003, 0.028], [0, 0.029]].map(([x, y]) => new THREE.Vector2(x, y));
    const a = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: 0.35 }));
    a.geometry.translate(0, -0.014, 0); g.add(a); g.userData.size = 0.03;
  } else if (id === 'buche') {
    const nut = new THREE.Mesh(new THREE.TetrahedronGeometry(0.009, 1), new THREE.MeshStandardMaterial({ color: '#6a3a1e', roughness: 0.4 }));
    nut.scale.set(1, 1.5, 1); g.add(nut); g.userData.size = 0.018;
  } else { // Robinie: flache, nierenförmige Bohne
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 10, 8), new THREE.MeshStandardMaterial({ color: '#3a2216', roughness: 0.3 }));
    b.scale.set(1.6, 0.6, 1); g.add(b); g.userData.size = 0.006;
  }
  g.scale.setScalar(3);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- Fruchtstand am Zweig (vor dem Fall) ----------
function releaseProp(id) {
  const g = new THREE.Group(); const parts = {};
  const lathe = (prof, mat) => new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 16), mat);
  if (id === 'tanne') {
    // aufrechter Zapfen aus Schuppen um eine Spindel
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.14, 8), new THREE.MeshStandardMaterial({ color: '#4a3a2a' }));
    spindle.position.y = 0.07; g.add(spindle);
    parts.scales = [];
    const sm = new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.7 });
    for (let i = 0; i < 26; i++) { const sc = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0025, 0.02), sm); const a = i * 2.4, y = 0.015 + (i / 26) * 0.12; sc.position.set(Math.cos(a) * 0.022, y, Math.sin(a) * 0.022); sc.rotation.y = -a; sc.rotation.z = 0.35; sc.userData.base = sc.position.clone(); sc.userData.a = a; g.add(sc); parts.scales.push(sc); }
  } else if (WINGED.includes(id)) {
    const hang = id === 'fichte' || id === 'douglasie';
    const len = { kiefer: 0.05, fichte: 0.13, laerche: 0.03, douglasie: 0.08 }[id];
    const cone = lathe([[0, 0], [len * 0.3, len * 0.05], [len * 0.38, len * 0.35], [len * 0.3, len * 0.75], [len * 0.12, len * 0.95], [0, len]], new THREE.MeshStandardMaterial({ map: scaleTexture('#b08050', '#5a3a22'), roughness: 0.8 }));
    if (hang) cone.rotation.x = Math.PI; g.add(cone);
  } else if (id === 'eiche') {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6a5638', roughness: 1 }));
    cup.rotation.x = Math.PI; cup.position.y = 0.002; g.add(cup);
  } else if (id === 'buche') {
    parts.valves = [];
    const vm = new THREE.MeshStandardMaterial({ color: '#7a5a30', roughness: 1 });
    for (let i = 0; i < 4; i++) { const p = new THREE.Group(); const v = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 6, 0, Math.PI / 2, 0, Math.PI / 2), vm); v.rotation.y = i * Math.PI / 2; p.add(v); g.add(p); parts.valves.push(p); p.userData.i = i; }
    // Stacheln
    const sp = new THREE.InstancedMesh(new THREE.ConeGeometry(0.0012, 0.006, 4), vm, 40); const m = new THREE.Matrix4(), r = rng(3);
    for (let i = 0; i < 40; i++) { const a = r() * 6.28, b = r() * 1.4; const d = V(Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b)); m.compose(d.clone().multiplyScalar(0.012), new THREE.Quaternion().setFromUnitVectors(UP, d), V(1, 1, 1)); sp.setMatrixAt(i, m); }
    g.add(sp); g.rotation.x = Math.PI;
  } else { // Robinie: hängende Hülse, die sich verdreht und öffnet
    parts.halves = [];
    const pm = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.7, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 10, 1, true, s > 0 ? 0 : Math.PI, Math.PI), pm); h.scale.z = 0.35; h.position.y = -0.045; const p = new THREE.Group(); p.add(h); g.add(p); parts.halves.push(p); }
  }
  g.scale.setScalar(3);
  g.userData.parts = parts;
  return g;
}

// ---------- Keimling (Einheit: Höhe 1, wird skaliert) ----------
function seedlingModel(id, u) {
  const g = new THREE.Group(); const conifer = WINGED.includes(id);
  const stemM = new THREE.MeshStandardMaterial({ color: conifer ? '#8a4a3a' : id === 'eiche' ? '#6a5a3a' : '#9aa060', roughness: 0.7 });
  const leafM = new THREE.MeshStandardMaterial({ color: conifer ? '#5a8a3a' : '#6a9a3a', roughness: 0.6, side: THREE.DoubleSide, emissive: '#2a4a10', emissiveIntensity: 0.15 });
  const cotM = new THREE.MeshStandardMaterial({ color: id === 'buche' ? '#7aa04a' : '#88aa50', roughness: 0.5, side: THREE.DoubleSide });
  [stemM, leafM, cotM].forEach(m => dissolvable(m, u));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1, 8), stemM); stem.geometry.translate(0, 0.5, 0); g.add(stem);
  const root = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.002, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#efe6d0' })); root.geometry.translate(0, -0.25, 0); g.add(root);
  const cots = new THREE.Group(); cots.position.y = 1; g.add(cots);
  const leaves = new THREE.Group(); leaves.position.y = 1; g.add(leaves);
  const n = { kiefer: 6, fichte: 8, tanne: 5, laerche: 6, douglasie: 7 }[id];
  if (conifer) {
    for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.32, 5), cotM); c.geometry.translate(0, 0.16, 0); const p = new THREE.Group(); p.rotation.y = i / n * 6.283; c.rotation.z = -0.9; p.add(c); cots.add(p); }
    for (let i = 0; i < 40; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.2, 4), leafM); c.geometry.translate(0, 0.1, 0); const p = new THREE.Group(); p.rotation.y = i * 2.4; p.position.y = -0.55 + i * 0.015; c.rotation.z = -0.5 - (i % 3) * 0.2; p.add(c); leaves.add(p); }
  } else {
    const leafShape = (w, l, kind) => { const s = new THREE.Shape(); s.moveTo(0, 0); if (kind === 'kidney') { s.bezierCurveTo(w, l * 0.1, w * 1.1, l * 0.9, w * 0.3, l); s.bezierCurveTo(0.02, l * 0.85, -0.02, l * 0.85, -w * 0.3, l); s.bezierCurveTo(-w * 1.1, l * 0.9, -w, l * 0.1, 0, 0); } else if (kind === 'oak') { for (let i = 1; i <= 4; i++) s.quadraticCurveTo(w * (i % 2 ? 1.2 : 0.6), l * (i - 0.5) / 4, w * (i % 2 ? 0.7 : 0.9) * (1 - i / 6), l * i / 4); s.lineTo(0, l * 1.05); for (let i = 4; i >= 1; i--) s.quadraticCurveTo(-w * (i % 2 ? 1.2 : 0.6), l * (i - 0.5) / 4, -w * 0.7 * (1 - i / 6), l * (i - 1) / 4); } else { s.bezierCurveTo(w, l * 0.2, w, l * 0.8, 0, l); s.bezierCurveTo(-w, l * 0.8, -w, l * 0.2, 0, 0); } return new THREE.ShapeGeometry(s, 8); };
    if (id === 'buche' || id === 'robinie') {
      for (const s of [-1, 1]) { const m = new THREE.Mesh(leafShape(id === 'buche' ? 0.2 : 0.08, id === 'buche' ? 0.3 : 0.18, id === 'buche' ? 'kidney' : 'oval'), cotM); m.rotation.set(-0.3, s > 0 ? 0 : Math.PI, s * -1.1); const p = new THREE.Group(); p.add(m); cots.add(p); }
    }
    const tl = id === 'eiche' ? 'oak' : 'oval';
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(leafShape(id === 'eiche' ? 0.09 : 0.08, id === 'eiche' ? 0.3 : 0.22, tl), leafM); m.rotation.set(-0.7 + i * 0.03, 0, 0); const p = new THREE.Group(); p.rotation.y = i * 2.4; p.position.y = -0.62 + i * 0.08; p.add(m); leaves.add(p); }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // Zustand nach Alter (Jahre, 0..2)
  g.userData.set = (a) => {
    const germ = smooth(0.0, 0.08, a);
    root.scale.set(1, smooth(0.0, 0.05, a) * 1.2 + 0.001, 1);
    stem.scale.set(1, Math.max(0.001, germ), 1);
    // epigäisch: Haken streckt sich
    stem.rotation.z = (1 - smooth(0.04, 0.12, a)) * 0.9 * (id === 'eiche' ? 0 : 1);
    cots.position.y = germ; leaves.position.y = germ;
    cots.visible = id !== 'eiche' && a > 0.03;
    const open = smooth(0.06, 0.16, a); cots.children.forEach(p => { p.scale.setScalar(Math.max(0.001, open)); });
    leaves.visible = a > 0.18; const nL = leaves.children.length; leaves.children.forEach((p, i) => { const k = (nL - 1 - i) / nL; p.scale.setScalar(Math.max(0.001, smooth(0.18 + k * 1.2, 0.35 + k * 1.5, a))); });
  };
  return g;
}

// ---------- Welt ----------
export async function buildLife(id, engine, ui = {}) {
  const ctx = buildBase(id, engine, { life: true });
  const { scene, hf, hero, cfg, updaters, r } = ctx;
  const L = lebensModell(id), sp = SPECIES[id];
  const land = LANDING[id]; const LP = V(land[0], hf(land[0], land[1]), land[1]);
  addNature({ ...ctx, cfg: { ...cfg, mist: Math.min(cfg.mist || 0, 1) } }, engine, [[land[0], land[1], 3.6], [land[0] + 4, land[1], 3]]);
  const motherH = hero.H; const visH = (a) => L.h(a) / L.endH * motherH;

  // Pflanze an der Landestelle
  const plant = new THREE.Group(); plant.position.copy(LP); scene.add(plant);
  const uSeedling = { vis: { value: 1 }, cut: { value: 1e6 } };
  const seedling = seedlingModel(id, uSeedling); plant.add(seedling);
  const J = lifeMats(id, juvenileSpec(id)); const juv = makeTree(id, { spec: juvenileSpec(id), seed: 3, mats: J.mats }); plant.add(juv.group);
  const A = lifeMats(id, sp); const adult = makeTree(id, { seed: cfg.hero.seed + 50, mats: A.mats }); plant.add(adult.group);
  const fruits = makeFruits(id, adult.tips, { seed: 9 }); if (fruits) adult.group.add(fruits);
  const robExtra = id === 'robinie' ? makeRobiniaExtras(adult.tips, { seed: 4 }) : null; if (robExtra) adult.group.add(robExtra);
  // Zerfall: Pilze am Stamm, abbrechende Kronenstücke
  const fungi = new THREE.Group(); const fms = ['#b49a72', '#8a6a48', '#c8b48a'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
  for (let i = 0; i < 16; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(r.range(0.07, 0.16), 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), fms[i % 3]); const y = r.range(0.5, adult.trunkTop * 0.75); const tk = adult.trunkAt(y); const a = r.range(-1.6, 1.6) + Math.PI / 2; f.position.copy(tk.p).add(V(Math.cos(a) * tk.r, 0, Math.sin(a) * tk.r)); f.scale.set(1, r.range(0.3, 0.5), r.range(0.6, 0.9)); f.rotation.set(Math.PI / 2 - 0.15, a, r.range(-0.3, 0.3)); fungi.add(f); }
  adult.group.add(fungi);
  const chunks = new THREE.Group(); const cmat = barkMat(id);
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, r.range(1.5, 3.5), 8), cmat); c.castShadow = true; c.userData.o = V(r.range(-3, 3), adult.H * r.range(0.55, 0.85), r.range(-2, 2)); c.userData.land = V(c.userData.o.x * 1.3 + 2.5, 0.15, c.userData.o.z * 1.2); c.userData.rot = r.range(-1, 1); chunks.add(c); }
  plant.add(chunks);
  // neue Generation (Kreislauf)
  const uS2 = { vis: { value: 1 }, cut: { value: 1e6 } };
  const seedling2 = seedlingModel(id, uS2); scene.add(seedling2);
  const nurseOnLog = id === 'fichte' || id === 'tanne'; // Kadaververjüngung auf morschem Holz
  const darkBark = new THREE.Color('#5d5a4c'), mossy = new THREE.Color('#6f8050'), white = new THREE.Color(1, 1, 1);

  // Same und Fruchtstand am Mutterbaum
  const seed = seedModel(id); scene.add(seed); seed.visible = false;
  const prop = releaseProp(id); scene.add(prop);
  const HP = hero.group.position;
  const toL = V(LP.x - HP.x, 0, LP.z - HP.z).normalize();
  const tips = hero.tips.map(t => ({ ...t, w: t.p.clone().add(HP) })).filter(t => t.w.y > 2.2).map(t => { const rad = V(t.w.x - HP.x, 0, t.w.z - HP.z); return { ...t, rad: rad.length(), face: rad.normalize().dot(toL) }; });
  // Kronenrand, zur Landestelle gewandt; Tanne: Zapfen nur im oberen Kronendrittel
  const score = (t) => -t.rad * 1.0 - t.face * 3 + t.w.y * (id === 'tanne' ? -0.2 : 0.18);
  const pool = id === 'tanne' ? tips.filter(t => t.t > 0.6) : tips.filter(t => t.w.y < motherH * 0.7);
  let tip = (pool.length ? pool : tips).sort((a, b) => score(a) - score(b))[0];
  tip = tip || { w: hero.group.position.clone().add(V(1, 4, 1)) };
  const T0 = tip.w.clone();
  prop.position.copy(T0); if (id === 'robinie' || id === 'eiche') prop.position.y -= 0.02;
  seed.position.copy(T0);
  const yG = LP.y + (seed.userData.size || 0.01) * 0.6;

  // ---------- Zustand ----------
  const S = { phase: 'ready', t: 0, age: 0, playing: false, s: 0 };
  const logEnd = Math.log(L.end + 1);
  const ageOf = (s) => Math.exp(s * logEnd) - 1; const sOf = (a) => Math.log(a + 1) / logEnd;
  // Übergangsalter der Modelle
  const ageAtH = (hv) => { let lo = 0, hi = L.maxAge; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (visH(m) < hv) lo = m; else hi = m; } return lo; };
  const a1 = Math.max(1.2, ageAtH(0.45)), a2 = ageAtH(motherH * 0.42);
  const mann = (L.mann[0] + L.mann[1]) / 2;

  const setAge = (age) => {
    S.age = clamp(age, 0, L.end);
    const a = S.age, d = clamp((a - L.maxAge) / L.decay, 0, 1);
    const hv = Math.max(visH(a), 0.06 * smooth(0.02, 0.6, a));
    // Keimling
    const vSeedling = 1 - smooth(a1, a1 * 1.6, a);
    seedling.visible = vSeedling > 0.01; uSeedling.vis.value = vSeedling;
    seedling.scale.setScalar(Math.max(0.0005, Math.min(hv, 0.9)));
    seedling.userData.set(Math.min(a, 2));
    // Same bleibt sichtbar bis zur Keimung (bei der Eiche länger, hypogäisch)
    if (S.phase === 'life') { seed.visible = a < (id === 'eiche' ? 1.5 : 0.12); }
    // Jungbaum
    const vJ = smooth(a1, a1 * 1.6, a) * (1 - smooth(a2, a2 * 1.3, a));
    juv.group.visible = vJ > 0.01; J.uBark.vis.value = J.uLeaf.vis.value = vJ; juv.group.scale.setScalar(Math.max(0.001, hv / 8));
    juv.group.children.forEach(m => { m.castShadow = vJ > 0.5; });
    // Altbaum
    const vA = smooth(a2, a2 * 1.3, a);
    adult.group.visible = vA > 0.01; A.uBark.vis.value = vA;
    A.uLeaf.vis.value = vA * (1 - smooth(0, 0.22, d));
    adult.group.scale.setScalar(Math.max(0.001, hv / adult.H));
    adult.group.children.forEach(m => { if (m.isMesh) m.castShadow = vA > 0.5; });
    if (fruits) fruits.visible = a >= mann && d < 0.15;
    if (robExtra) robExtra.visible = a >= mann && d < 0.15;
    // Zerfall: Krone bricht (Schnitt in lokaler Höhe), Stamm stürzt, Moos, Pilze
    const cut = lerp(adult.H * 1.2, adult.trunkTop * (sp.form === 'excurrent' ? 0.45 : 0.85), smooth(0.22, 0.42, d));
    A.uBark.cut.value = cut; A.uLeaf.cut.value = cut;
    const fall = easeInOut(smooth(0.48, 0.62, d)) * (Math.PI / 2 - 0.06);
    adult.group.rotation.z = -fall;
    adult.group.position.y = -smooth(0.62, 1, d) * 0.15 * (hv / adult.H);
    const col = white.clone().lerp(darkBark, smooth(0.05, 0.3, d)).lerp(mossy, smooth(0.65, 1, d));
    A.mats.bark.color.copy(col);
    fungi.visible = d > 0.7; fungi.children.forEach((f, i) => f.scale.setScalar(Math.max(0.001, smooth(0.7 + i * 0.02, 0.85 + i * 0.015, d))));
    chunks.visible = d > 0.25 && d < 0.95;
    chunks.children.forEach((c, i) => { const k = smooth(0.26 + i * 0.012, 0.36 + i * 0.012, d); const o = c.userData.o.clone().multiplyScalar(hv / adult.H); const ld = c.userData.land.clone(); c.position.lerpVectors(o, ld, k); c.position.y = lerp(o.y, ld.y, k * k); c.rotation.set(k * 1.5 + c.userData.rot, c.userData.rot, k * Math.PI / 2); });
    // neue Generation
    const a2nd = smooth(0.72, 1, d) * 2;
    seedling2.visible = d > 0.72;
    const logTop = LP.clone().add(V(hv * 0.35, (adult.trunkAt(adult.H * 0.35).r) * (hv / adult.H) * 2 + 0.02, 0));
    seedling2.position.copy(nurseOnLog ? logTop : LP.clone().add(V(-1.2, 0, 1.0)));
    seedling2.scale.setScalar(Math.max(0.001, 0.12 + a2nd * 0.3)); seedling2.userData.set(a2nd);
    ui.onAge && ui.onAge({ age: S.age, h: L.h(S.age), d: L.d(S.age), stage: L.stage(S.age), s: sOf(S.age), end: L.end, nurseOnLog });
    S.hv = hv; S.decay = d; S.fall = fall; S.logLen = cut * (hv / adult.H) * 1.1;
  };

  // ---------- Kamera ----------
  const camPos = V(), camTgt = V(); let camInit = false;
  const dirC = V(0.42, 0.2, 1).normalize();
  const camCtl = (dt) => {
    if (S.phase === 'ready') return null;
    let pos, tgt;
    const side = V().subVectors(T0, hero.group.position); side.y = 0; side.normalize();
    const perp = V(-side.z, 0, side.x);
    if (S.phase === 'release') { tgt = T0.clone(); pos = T0.clone().addScaledVector(side, 1.7).addScaledVector(perp, 0.6).add(V(0, 0.15, 0)); }
    else if (S.phase === 'fall' || S.phase === 'land') { tgt = seed.position.clone(); const away = V(seed.position.x - HP.x, 0, seed.position.z - HP.z).normalize(); pos = seed.position.clone().addScaledVector(away, 1.1).addScaledVector(perp, 0.4).add(V(0, 0.2, 0)); }
    else if (S.phase === 'sink') { tgt = LP.clone().add(V(0, 0.02, 0)); pos = LP.clone().addScaledVector(dirC, 0.42).add(V(0, 0.16, 0)); }
    else {
      let hv = S.hv || 0.06; const f = S.fall || 0;
      if ((S.decay || 0) > 0.3) hv = lerp(hv, Math.min(hv, S.logLen || hv), smooth(0.3, 0.5, S.decay));
      const h2 = hv * 0.48;
      tgt = LP.clone().add(V(Math.sin(f) * h2, Math.cos(f) * h2 * 0.9 + 0.02, 0));
      const dist = clamp(hv * 1.5 + 0.12, 0.2, motherH * 1.7);
      const elev = lerp(0.62, 0.2, smooth(0.3, 4, hv)); // kleine Pflanzen schräg von oben
      const dir = V(dirC.x, 0, dirC.z).normalize().multiplyScalar(Math.cos(elev)); dir.y = Math.sin(elev);
      pos = tgt.clone().addScaledVector(dir, dist);
    }
    if (!camInit) { camPos.copy(engine.world.camera.position); camTgt.copy(engine.curTarget || tgt); camInit = true; }
    const k = S.snap ? 1 : 1 - Math.exp(-dt * (S.phase === 'fall' ? 6 : 2.4));
    if (!camInit && S.snap) { camPos.copy(pos); camTgt.copy(tgt); camInit = true; }
    camPos.lerp(pos, k); camTgt.lerp(tgt, Math.min(1, k * 1.6));
    engine.engrave.uniforms.focus.value = camPos.distanceTo(camTgt);
    return { pos: camPos, target: camTgt, sway: S.phase === 'life' ? Math.min(1.2, (S.hv || 0.1) * 0.15) : 0.05 };
  };

  // ---------- Ablauf ----------
  let fallT = 0, fallDur = 1, D = V(), crumbs = null;
  const startFall = () => {
    S.phase = 'fall'; fallT = 0; seed.visible = true;
    const h = T0.y - yG;
    if (WINGED.includes(id)) fallDur = clamp(h / 1.5, 2.5, 7);
    else if (id === 'robinie') fallDur = Math.max(1.4, h / 2.4);
    else fallDur = Math.sqrt(2 * h / 4.5) + 1.3; // Fall + Springen + Rollen (verlangsamt)
    D.set(T0.x, yG, T0.z);
    ui.onPhase && ui.onPhase('fall');
  };
  const updateFall = (dt) => {
    fallT += dt; const k = clamp(fallT / fallDur, 0, 1);
    if (WINGED.includes(id)) {
      const xz = V().lerpVectors(T0, LP, smooth(0, 1, k));
      const rad = 0.35 * (1 - k);
      seed.position.set(xz.x + Math.cos(fallT * 5) * rad, lerp(T0.y, yG, k), xz.z + Math.sin(fallT * 5) * rad);
      seed.rotation.set(0.5, fallT * 15, 0.25);
    } else if (id === 'robinie') {
      const xz = V().lerpVectors(T0, LP, k);
      seed.position.set(xz.x + Math.sin(fallT * 7) * 0.05, lerp(T0.y, yG, k * k * 0.4 + k * 0.6), xz.z);
      seed.rotation.set(fallT * 9, fallT * 4, 0);
    } else {
      const g = 4.5, h = T0.y - yG, tF = Math.sqrt(2 * h / g), t = fallT;
      if (t < tF) { seed.position.set(T0.x, T0.y - 0.5 * g * t * t, T0.z); seed.rotation.x = t * 3; }
      else {
        const u = clamp((t - tF) / (fallDur - tF), 0, 1); // Springen und Rollen zur Landestelle
        const p = V().lerpVectors(D, LP, smooth(0, 1, u));
        const hop = Math.abs(Math.sin(u * Math.PI * 2.2)) * (1 - u) * 0.35 * (id === 'eiche' ? 1 : 0.4);
        seed.position.set(p.x, yG + hop, p.z); seed.rotation.x = 3 + u * 9; seed.rotation.z = u * 4;
      }
    }
    if (k >= 1) { S.phase = 'sink'; S.t = 0; spawnCrumbs(); ui.onPhase && ui.onPhase('sink'); }
  };
  const spawnCrumbs = () => {
    crumbs = new THREE.Group(); const cm = new THREE.MeshStandardMaterial({ color: '#4a3a28', roughness: 1 });
    for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.004 + Math.random() * 0.004), cm); c.userData.v = V(Math.random() - 0.5, 0.8 + Math.random(), Math.random() - 0.5).multiplyScalar(0.25); c.position.copy(LP); crumbs.add(c); }
    scene.add(crumbs);
  };
  const updateRelease = (dt) => {
    S.t += dt; const k = clamp(S.t / 2.2, 0, 1); const P = prop.userData.parts;
    if (P.scales) P.scales.forEach((sc, i) => { const kk = smooth(i / 26 * 0.7, i / 26 * 0.7 + 0.3, k); sc.position.copy(sc.userData.base).add(V(Math.cos(sc.userData.a) * kk * 0.08, -kk * kk * 0.5, Math.sin(sc.userData.a) * kk * 0.08)); sc.rotation.x = kk * 4; });
    if (P.valves) P.valves.forEach(v => { const i = v.userData.i; v.rotation.set(Math.cos(i * Math.PI / 2 + 0.78) * smooth(0, 0.6, k) * 1.1, 0, Math.sin(i * Math.PI / 2 + 0.78) * smooth(0, 0.6, k) * 1.1); });
    if (P.halves) { prop.rotation.y = smooth(0, 0.6, k) * 3; P.halves.forEach((h, i) => { h.rotation.z = (i ? 1 : -1) * smooth(0.5, 0.9, k) * 0.6; }); }
    if ((k > 0.75 || id === 'eiche') && !seed.visible) seed.visible = true;
    if (k >= 1) startFall();
  };

  const world = {
    id, scene, camera: new THREE.PerspectiveCamera(45, 1, 0.01, 1200),
    rig: { pos: LP.clone().add(V(4, 4.5, 16)), target: V((LP.x + hero.group.position.x) / 2, motherH * 0.4, (LP.z + hero.group.position.z) / 2), from: V(-2, 12, 34), fromTarget: V(0, 9, -12), dur: 4 },
    post: { ...cfg.post, focus: 16, dof: 0.25, bloom: Math.min(cfg.post.bloom ?? 0.5, 0.4), bloomThreshold: 0.95, exposure: (cfg.post.exposure ?? 1) * 0.95 }, audio: cfg.audio, pick: [],
    camCtl,
    phase: () => S.phase, age: () => S.age, model: L, sOf, ageOf, a1, a2,
    start() {
      if (S.phase !== 'ready') return;
      S.phase = 'release'; S.t = 0; setAge(0); seedling.visible = false; juv.group.visible = false; adult.group.visible = false;
      ui.onPhase && ui.onPhase('release');
    },
    play() { if (S.phase !== 'life') return; if (S.age >= L.end - 0.01) setAge(0); S.playing = true; ui.onPlay && ui.onPlay(true); },
    pause() { S.playing = false; ui.onPlay && ui.onPlay(false); },
    setS(s) { if (S.phase !== 'life') return; setAge(ageOf(clamp(s, 0, 1))); },
    // Test/Lesezeichen: direkt ein Alter bzw. eine Phase zeigen
    debug(phase, val) { S.snap = true; prop.visible = phase !== 'life'; if (phase === 'life') { S.phase = 'life'; S.playing = false; setAge(val); seed.visible = val < (id === 'eiche' ? 1.5 : 0.12); seed.position.set(LP.x, yG - (seed.userData.size || 0.01), LP.z); } else if (phase === 'fall') { S.phase = 'fall'; startFall(); fallT = fallDur * val; updateFall(0); S.phase = 'fall'; } else if (phase === 'release') { S.phase = 'release'; S.t = 2.2 * val; updateRelease(0); } ui.onPhase && ui.onPhase(S.phase); },
    restart() { S.phase = 'ready'; S.playing = false; seed.visible = false; prop.visible = true; seed.position.copy(T0); seed.rotation.set(0, 0, 0); if (crumbs) { scene.remove(crumbs); crumbs = null; } setAge(0); seedling.visible = juv.group.visible = adult.group.visible = seedling2.visible = false; camInit = false; ui.onPhase && ui.onPhase('ready'); const P = prop.userData.parts; if (P.scales) P.scales.forEach(sc => { sc.position.copy(sc.userData.base); sc.rotation.x = 0; }); if (P.valves) P.valves.forEach(v => v.rotation.set(0, 0, 0)); if (P.halves) { prop.rotation.y = 0; P.halves.forEach(h => h.rotation.z = 0); } },
    update(dt, t) {
      for (const u of updaters) u(dt, t);
      if (S.phase === 'release') updateRelease(dt);
      else if (S.phase === 'fall') updateFall(dt);
      else if (S.phase === 'sink') {
        S.t += dt; const k = clamp(S.t / 1.6, 0, 1);
        seed.position.y = yG - k * (seed.userData.size || 0.01) * 1.2; seed.rotation.x += dt * 0.3 * (1 - k);
        if (crumbs) crumbs.children.forEach(c => { c.userData.v.y -= dt * 1.2; c.position.addScaledVector(c.userData.v, dt); if (c.position.y < LP.y) { c.position.y = LP.y; c.userData.v.multiplyScalar(0.3); } });
        if (k >= 1) { S.phase = 'life'; setAge(0); S.playing = !engine.reducedMotion; ui.onPhase && ui.onPhase('life'); ui.onPlay && ui.onPlay(S.playing); }
      } else if (S.phase === 'life' && S.playing) {
        const s = sOf(S.age) + dt / 32;
        if (s >= 1) { setAge(L.end); S.playing = false; ui.onPlay && ui.onPlay(false); ui.onPhase && ui.onPhase('end'); }
        else setAge(ageOf(s));
      }
    },
    dispose() { disposeScene(scene); },
  };
  // Startzustand: nichts gewachsen
  setAge(0); seedling.visible = juv.group.visible = adult.group.visible = seedling2.visible = false;
  return world;
}
