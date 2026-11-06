import * as THREE from 'three';
import { rng, smooth, fbm } from './util.js';
import { makeSky, makeTerrain, makeRidges, makeGrass, makeCards, makeRocks, makeMist, makeShafts, makeParticles, makeFallingLeaves, makeWater, makeLights } from './env.js';
import { makeTree, makeFruits, makeForest, makeRobiniaExtras } from './tree.js';
import { makeDisc, makeBoard, makeStack, makeHardness, makeResin, makeSign, makePedestal, barkMat } from './props.js';
import * as W from './werk.js';
import { HOLZ_BY_ID, WERK_INFO } from './data.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Standard-Stillleben (Eigenschaften) – je Reich leicht verschiebbar
const PROPS = { disc: [-2.7, 4.3, 0.3], board: [-0.9, 4.9, 0.35], hardness: [1.2, 4.6, -0.35], stack: [-6.6, -1.6, 0.55], sign: [3.7, 5.0, -0.38] };

export const REALMS = {
  kiefer: {
    sky: { skyTop: '#59708f', skyHorizon: '#f7c47c', skyBottom: '#c89a68', sunDir: V(-0.75, 0.16, -1), sunColor: '#ffb257', sunIntensity: 3.4, glow: 0.9, hemi: 0.9, fill: 0.9, hemiSky: '#a8bcd4', hemiGround: '#c8a878' },
    fog: ['#e8b77e', 0.0075], ground: ['#d8c090', '#b8a070', '#8a8458'], groundTex: ['#e0c89a', '#c0a670', '#8a8052'], groundKind: 'sand',
    grass: ['#8c8a3c', '#c8a650'], grassCount: 5500, grassClump: -0.05, ridgeColor: '#6a523a', treeline: 'conifer',
    post: { tint: '#ffe0b0', tintAmt: 0.1, sepia: 0.0, focus: 15, dof: 0.35, bloom: 0.7, exposure: 1.12 },
    hero: { pos: [-1.6, -9.5], seed: 4, scale: 1.05 }, extra: [[-13, -7, 0.85, 7], [11, -17, 0.9, 9], [16, -6, 0.75, 13]],
    forest: { n: 26, r: [34, 80] },
    cards: [{ kind: 'fern', c1: '#6a3a6a', c2: '#b07ab0', n: 70, size: [0.6, 0.45] }],
    particles: [['rise', '#ffae40', 90, [-6, 4, 0.5, 9, -14, -4], 0.09], ['motes', '#ffd890', 140, [-14, 14, 0.5, 8, -20, 8], 0.07]],
    shafts: { n: 7, origin: V(-1, 17, -9), spread: 9, strength: 0.12 }, mist: 3,
    werk: [{ fn: 'dachstuhl', pos: [9.0, -8.5], rot: -0.55, scale: 1 }, { fn: 'fenster', pos: [-5.0, 1.0], rot: 0.45, pedestal: true, scale: 1.1, float: 0.3 }],
    audio: { wind: 0.5, leaves: 0.2, birds: 0.5, crickets: 0.25, drone: 0.4, droneNote: 98 },
  },
  fichte: {
    sky: { skyTop: '#7d97ae', skyHorizon: '#dfe3e2', sunDir: V(0.55, 0.55, -0.7), sunColor: '#fff1d6', sunIntensity: 2.4, glow: 0.5, hemi: 0.75, hemiSky: '#b8cad8', hemiGround: '#4a5a40' },
    fog: ['#b9c6c9', 0.021], ground: ['#3d4e33', '#56653c', '#5a5a48'], groundTex: ['#4a5a36', '#66704a', '#3a4030'], groundKind: 'moss',
    grass: ['#4f6a34', '#7a8a4a'], grassCount: 4000, grassClump: 0.1, ridgeColor: '#33433a', treeline: 'conifer',
    post: { tint: '#d6e4ec', tintAmt: 0.16, sepia: 0.05, focus: 17, dof: 0.6, bloom: 0.5, exposure: 1.0, hatch: 0.34 },
    hero: { pos: [0, -10.5], seed: 3, scale: 1.18 }, extra: [[-8, -6, 1.05, 2], [8.5, -9, 1.1, 5], [-13, -14, 1.2, 8], [14, -3, 0.95, 11], [-4, -22, 1.2, 12], [5, -26, 1.25, 14]],
    forest: { n: 55, r: [22, 75] },
    cards: [{ kind: 'fern', c1: '#3a5a2a', c2: '#6a8a40', n: 110, size: [1.2, 1.0] }],
    rocks: [[-7.5, 3.5, 0.9], [7.5, 2.5, 0.7], [-11, -4, 1.3]],
    particles: [['motes', '#f4f6ff', 180, [-14, 14, 0.3, 9, -22, 8], 0.06]],
    shafts: { n: 9, origin: V(2, 20, -10), spread: 11, strength: 0.2 }, mist: 6,
    werk: [{ fn: 'bshTraeger', pos: [3.4, -4.2], rot: 1.25, scale: 1 }, { fn: 'geige', pos: [-5.0, 1.0], rot: 0.3, pedestal: true, scale: 2.6, float: 0.55, spin: 0.35 }],
    audio: { wind: 0.35, leaves: 0.15, birds: 0.7, water: 0.25, drone: 0.35, droneNote: 110 },
  },
  tanne: {
    sky: { skyTop: '#0a1326', skyHorizon: '#3d4d6e', skyBottom: '#1a2236', sunDir: V(0.45, 0.42, -1), sunColor: '#c9d8ff', sunIntensity: 2.6, glow: 0.8, stars: 1, moon: 1, sunSize: 4, hemi: 1.0, fill: 0.9, fillColor: '#8aa0d8', hemiSky: '#6a7ab0', hemiGround: '#2a3040' },
    fog: ['#2b3652', 0.017], ground: ['#2c3b3c', '#3c4b4a', '#4a5254'], groundTex: ['#3c4a4c', '#56646a', '#2a3436'], groundKind: 'moss',
    grass: ['#4a6066', '#8aa0a8'], grassCount: 5000, grassClump: 0.0, ridgeColor: '#141c2c', treeline: 'conifer',
    post: { tint: '#c4d2ff', tintAmt: 0.18, sepia: 0.0, focus: 15, dof: 0.45, bloom: 0.8, bloomThreshold: 0.75, exposure: 1.6, hatch: 0.34 },
    hero: { pos: [-2.2, -10], seed: 6, scale: 1.0 }, extra: [[-11, -5, 0.9, 3], [10, -12, 0.95, 4], [14, -2, 0.8, 9], [-6, -20, 1.0, 10]],
    forest: { n: 40, r: [24, 70] },
    cards: [{ kind: 'fern', c1: '#3a5a5a', c2: '#7a9a9a', n: 60, size: [0.9, 0.8] }],
    particles: [['firefly', '#bcd4ff', 70, [-10, 10, 0.4, 5, -16, 6], 0.18], ['motes', '#dfe8ff', 160, [-14, 14, 0.3, 10, -22, 8], 0.05]],
    mist: 5, shafts: { n: 5, origin: V(3, 18, -10), spread: 8, strength: 0.1 },
    werk: [{ fn: 'wandverkleidung', pos: [4.4, -5.0], rot: -0.35, scale: 1 }, { fn: 'schrank', pos: [4.1, -3.9], rot: -0.35, scale: 1 }],
    lamps: [[2.6, 1.0, -3.2, '#ffb868', 7]],
    audio: { wind: 0.3, crickets: 0.55, owl: 0.5, drone: 0.5, droneNote: 73 },
  },
  laerche: {
    sky: { skyTop: '#6886a8', skyHorizon: '#f3d9a2', sunDir: V(-0.55, 0.42, -1), sunColor: '#ffcf7a', sunIntensity: 3.0, glow: 0.45, hemi: 0.75, fill: 0.7, hemiSky: '#a8bcd0', hemiGround: '#8a6a3a' },
    fog: ['#e6cf9e', 0.009], ground: ['#7c6a3c', '#9a7c42', '#6a5a3a'], groundTex: ['#8a7442', '#a88a50', '#6a5634'], groundKind: 'grass',
    grass: ['#b08a40', '#dcb862'], grassCount: 6500, ridgeColor: '#5a4a3a', treeline: 'conifer',
    height: (x, z) => { const d = Math.hypot(x, z + 6); const lake = smooth(-7.5, -11, z) * smooth(36, 26, Math.abs(x)); return fbm(x * 0.06, z * 0.06, 3) * 0.3 * (1 - lake) + smooth(24, 70, d) * (fbm(x * 0.012, z * 0.012, 4) * 8 + 5) * (1 - lake * 0.8) - lake * 2.2; },
    water: { y: -0.35, z: -40, w: 160, d: 64 },
    post: { tint: '#ffe0a0', tintAmt: 0.14, sepia: 0.0, focus: 16, dof: 0.45, bloom: 0.42, bloomThreshold: 0.95, exposure: 0.9 },
    hero: { pos: [-6.5, -6.5], seed: 8, scale: 1.0 }, extra: [[-14, -2, 0.9, 3], [12, -3, 0.85, 6], [16, -10, 0.9, 7], [-20, -9, 1.0, 9]],
    forest: { n: 30, r: [55, 90], arc: [-160, -20] },
    particles: [['motes', '#ffe2a0', 140, [-14, 14, 0.3, 8, -20, 8], 0.06]], falling: ['larch', '#d8a030', '#f6d070', 50, [-12, 6, 0, 10, -12, 6]],
    shafts: { n: 5, origin: V(-6, 17, -8), spread: 7, strength: 0.12 }, mist: 3,
    werk: [{ fn: 'terrasse', pos: [1.6, -5.4], rot: 0, scale: 1 }, { fn: 'steg', pos: [1.6, -7.0], rot: 0, scale: 1, y: -0.55 }, { fn: 'bootshaus', pos: [6.4, -6.0], rot: -0.3, scale: 1 }],
    audio: { wind: 0.45, leaves: 0.35, birds: 0.45, water: 0.6, drone: 0.4, droneNote: 87 },
  },
  douglasie: {
    sky: { skyTop: '#2f2a4a', skyHorizon: '#ff9563', skyBottom: '#8a4a48', sunDir: V(0.8, 0.12, -1), sunColor: '#ff7a3c', sunIntensity: 3.0, glow: 1.0, hemi: 0.8, fill: 0.8, hemiSky: '#6a5a8a', hemiGround: '#5a3a2a' },
    fog: ['#c27a68', 0.011], ground: ['#4a3e2e', '#6a5838', '#5a4a3a'], groundTex: ['#5a4a32', '#76603e', '#3a2e22'], groundKind: 'moss',
    grass: ['#6a6a3a', '#a08a4a'], grassCount: 4500, ridgeColor: '#3a2840', treeline: 'conifer',
    ridges: [{ R: 150, h: 26, base: -2 }, { R: 240, h: 60, base: -2 }, { R: 340, h: 120, base: -4 }],
    post: { tint: '#ffc0a0', tintAmt: 0.2, sepia: 0.04, focus: 18, dof: 0.5, bloom: 0.85, exposure: 1.1 },
    hero: { pos: [-3.2, -10.5], seed: 5, scale: 1.0 }, extra: [[-12, -6, 0.95, 2], [11, -15, 1.05, 6], [16, -4, 0.9, 7], [-7, -24, 1.1, 9]],
    forest: { n: 34, r: [26, 75] },
    cards: [{ kind: 'fern', c1: '#3a5a2a', c2: '#7a8a40', n: 120, size: [1.3, 1.1] }],
    rocks: [[-7, 3, 0.8], [9, 5, 0.6]],
    particles: [['firefly', '#ffb070', 60, [-10, 10, 0.4, 4, -14, 6], 0.15], ['motes', '#ffc090', 120, [-14, 14, 0.3, 8, -20, 8], 0.06]],
    shafts: { n: 6, origin: V(4, 16, -10), spread: 9, strength: 0.14 }, mist: 3,
    werk: [{ fn: 'haus', pos: [5.6, -7.6], rot: -0.5, scale: 1 }],
    audio: { wind: 0.4, leaves: 0.15, crickets: 0.45, birds: 0.2, drone: 0.45, droneNote: 82 },
  },
  eiche: {
    sky: { skyTop: '#5689c2', skyHorizon: '#eaead0', sunDir: V(0.35, 0.75, -0.5), sunColor: '#fff0c8', sunIntensity: 3.3, glow: 0.6, hemi: 0.65, hemiSky: '#a8c4e0', hemiGround: '#4a6a2a' },
    fog: ['#c8d2b2', 0.0085], ground: ['#4a6a2a', '#6a8a3a', '#5a6a3a'], groundTex: ['#4e6e2c', '#78923e', '#4a5a30'], groundKind: 'grass',
    grass: ['#5a8a2a', '#a6c050'], grassCount: 12000, grassH: 1.25, ridgeColor: '#3a5a3a', treeline: 'round',
    post: { tint: '#f0f4d0', tintAmt: 0.1, sepia: 0.04, focus: 17, dof: 0.5, bloom: 0.5, exposure: 1.0 },
    hero: { pos: [0.5, -9.5], seed: 2, scale: 1.0 }, extra: [[-16, -12, 0.8, 4], [17, -16, 0.85, 6]],
    forest: { n: 26, r: [32, 80], tree: 'eiche' },
    rocks: [[-4.5, -6, 1.0], [5.5, -6.5, 0.9], [-6, -11, 1.1], [6.8, -12, 1.0], [-3, -15, 0.9], [3.5, -15.5, 1.0]], rockColor: '#8a8678',
    particles: [['motes', '#fff4c0', 160, [-14, 14, 0.3, 9, -20, 8], 0.06]],
    shafts: { n: 6, origin: V(1, 19, -9), spread: 8, strength: 0.1 }, mist: 2,
    werk: [{ fn: 'fachwerk', pos: [-8.8, -5.5], rot: 0.55, scale: 1 }, { fn: 'parkett', pos: [4.6, -3.6], rot: -0.3, scale: 1 }, { fn: 'fass', pos: [4.6, -3.6], rot: 0.2, scale: 1, y: 0.25 }],
    audio: { wind: 0.4, leaves: 0.45, birds: 0.75, drone: 0.35, droneNote: 65 },
  },
  robinie: {
    sky: { skyTop: '#59718f', skyHorizon: '#e3e8cc', sunDir: V(-0.5, 0.55, -0.65), sunColor: '#fff1d0', sunIntensity: 2.9, glow: 0.6, hemi: 0.6, hemiSky: '#a8b8d0', hemiGround: '#5a6a3a' },
    fog: ['#c3caa9', 0.0105], ground: ['#5a6a3a', '#7a7a4a', '#6a6040'], groundTex: ['#606c3c', '#80804c', '#5a5236'], groundKind: 'grass',
    grass: ['#6a8a3a', '#a8b456'], grassCount: 8000, ridgeColor: '#4a5038', treeline: 'round',
    post: { tint: '#f0f0d0', tintAmt: 0.12, sepia: 0.05, focus: 16, dof: 0.5, bloom: 0.6, exposure: 1.02, hatch: 0.36 },
    hero: { pos: [-3.0, -8.5], seed: 3, scale: 1.0 }, extra: [[-10, -5, 0.85, 4], [-13, -12, 0.95, 5], [10, -13, 0.9, 7], [14, -6, 0.8, 8], [-6, -18, 0.9, 10]],
    forest: { n: 28, r: [28, 75] },
    particles: [['snow', '#fffaf0', 120, [-10, 8, 0, 9, -14, 6], 0.07], ['motes', '#ffffd0', 100, [-14, 14, 0.3, 8, -20, 8], 0.05]],
    shafts: { n: 5, origin: V(-3, 17, -8), spread: 8, strength: 0.1 }, mist: 2,
    werk: [{ fn: 'spielplatz', pos: [4.6, -5.0], rot: -0.35, scale: 1 }, { fn: 'zaun', pos: [-15, -1.5], rot: 0.12, scale: 1 }],
    audio: { wind: 0.45, leaves: 0.35, birds: 0.55, bees: 0.4, drone: 0.4, droneNote: 92 },
  },
  buche: {
    sky: { skyTop: '#7a8aa2', skyHorizon: '#f2c98e', sunDir: V(-0.3, 0.38, -1), sunColor: '#ffbc6c', sunIntensity: 2.9, glow: 0.8, hemi: 0.6, hemiSky: '#a8b0c0', hemiGround: '#8a4a20' },
    fog: ['#d8a676', 0.0155], ground: ['#8a4a20', '#a86a30', '#6a4020'], groundTex: ['#9a5424', '#c07a38', '#6a3a1a'], groundKind: 'leaves',
    grass: ['#7a5a2a', '#a8803a'], grassCount: 1500, ridgeColor: '#5a3a2a', treeline: 'round',
    post: { tint: '#ffd0a0', tintAmt: 0.18, sepia: 0.05, focus: 17, dof: 0.6, bloom: 0.75, exposure: 1.05 },
    hero: { pos: [0, -10], seed: 7, scale: 1.0 },
    rows: { xs: [-7, 7, -12.5, 12.5], z0: -4, step: 6.5, n: 6, scale: [0.95, 1.1] },
    forest: { n: 24, r: [40, 80] },
    cards: [{ kind: 'beech', c1: '#a84a1c', c2: '#e09040', n: 320, size: [0.9, 0.9], flat: true, radius: 18 }],
    particles: [['motes', '#ffd08a', 180, [-14, 14, 0.3, 10, -22, 8], 0.06]], falling: ['beech', '#b8541c', '#f0a040', 60, [-12, 12, 0, 12, -16, 6]],
    shafts: { n: 10, origin: V(-1, 20, -10), spread: 10, strength: 0.2 }, mist: 4,
    werk: [{ fn: 'bugholzstuhl', pos: [-5.0, 1.0], rot: 0.6, pedestal: true, scale: 1, float: 0.25 }, { fn: 'werkzeuge', pos: [-9.5, -3.5], rot: 0.3, pedestal: true, scale: 1, float: 0.45, spin: 0.4 }, { fn: 'morsch', pos: [7.6, -1.6], rot: -0.4, scale: 1 }],
    audio: { wind: 0.4, leaves: 0.55, birds: 0.5, drone: 0.4, droneNote: 77 },
  },
};

const FN = { dachstuhl: W.dachstuhl, fenster: (id) => W.fenster(id), bshTraeger: W.bshTraeger, geige: W.geige, schrank: W.schrank, wandverkleidung: W.wandverkleidung, terrasse: W.terrasse, steg: W.steg, bootshaus: W.bootshaus, haus: W.haus, fachwerk: W.fachwerk, parkett: W.parkett, fass: W.fass, spielplatz: W.spielplatz, zaun: W.zaun, bugholzstuhl: W.bugholzstuhl, werkzeuge: W.werkzeuge, morsch: (id) => W.morscherStamm(barkMat(id)) };

// Gemeinsame Bühne: Himmel, Gelände, Licht, Mutterbaum, Wald, Wasser
export function buildBase(id, engine, { life = false } = {}) {
  const cfg = REALMS[id], h = HOLZ_BY_ID[id];
  const q = engine.q, r = rng(id.length * 131 + 17);
  const pal = { ...cfg.sky, ground: cfg.ground, groundTex: cfg.groundTex, groundKind: cfg.groundKind, grass: cfg.grass, grassCount: cfg.grassCount, grassClump: cfg.grassClump, grassH: cfg.grassH, ridgeColor: cfg.ridgeColor, treeline: cfg.treeline, ridges: cfg.ridges, fog: cfg.fog[0], height: cfg.height, rock: cfg.rockColor };
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(cfg.fog[0], cfg.fog[1]);
  scene.background = new THREE.Color(cfg.sky.skyHorizon);
  scene.add(makeSky(pal));
  const skyScene = new THREE.Scene(); skyScene.add(makeSky(pal)); scene.environment = engine.envFromScene(skyScene);
  const terrain = makeTerrain(pal, r); scene.add(terrain);
  const hf = terrain.userData.height;
  scene.add(makeRidges(pal, r));
  const lights = makeLights(pal, scene, q);
  const updaters = [];
  const addU = (o) => { if (o && o.userData && o.userData.update) updaters.push(o.userData.update); };
  const at = (o, x, z, y = 0, rot = 0) => { o.position.set(x, hf(x, z) + y, z); o.rotation.y = rot; scene.add(o); addU(o); return o; };
  // Held / Mutterbaum
  const hero = makeTree(id, { seed: cfg.hero.seed, scale: cfg.hero.scale });
  at(hero.group, cfg.hero.pos[0], cfg.hero.pos[1], -0.05);
  const fr = makeFruits(id, hero.tips); if (fr) hero.group.add(fr);
  if (id === 'robinie') hero.group.add(makeRobiniaExtras(hero.tips));
  const resin = makeResin(hero, h.harzLevel); hero.group.add(resin); addU(resin);
  // weitere Bäume (im Lebenslauf: Platz um den Landepunkt frei halten)
  const keep = life ? LANDING[id] : null;
  const extras = [...(cfg.extra || [])];
  if (cfg.rows) { const R = cfg.rows; for (const x of R.xs) for (let i = 0; i < R.n; i++) extras.push([x + r.range(-1, 1), R.z0 - i * R.step + r.range(-1, 1), r.range(R.scale[0], R.scale[1]), 20 + i + x]); }
  const detail = q.density >= 0.6 ? 1 : 0.4;
  extras.forEach(([x, z, s, seed], i) => {
    if (keep && Math.hypot(x - keep[0], z - keep[1]) < 6) return;
    const near = Math.hypot(x, z + 6) < 13;
    const t = makeTree(id, { seed, scale: s, detail: (i < 4 && !cfg.rows) || near ? detail : 0.4 });
    at(t.group, x, z, -0.05, r() * 6);
    if (id === 'robinie') t.group.add(makeRobiniaExtras(t.tips, { seed: i + 3 }));
  });
  if (cfg.forest) {
    const F = cfg.forest, pos = [], arc = F.arc || [-175, -5];
    for (let i = 0; i < F.n; i++) { const a = (arc[0] + r() * (arc[1] - arc[0])) * Math.PI / 180, d = r.range(F.r[0], F.r[1]); const x = Math.cos(a) * d, z = Math.sin(a) * d - 6; pos.push(V(x, hf(x, z) - 0.1, z)); }
    scene.add(makeForest(F.tree || id, pos, { seed: 31, scaleRange: [0.75, 1.2] }));
  }
  if (cfg.water) { const wtr = makeWater(pal, { y: cfg.water.y, z: cfg.water.z, w: cfg.water.w, d: cfg.water.d }); scene.add(wtr); addU(wtr); }
  return { id, cfg, h, q, r, pal, scene, terrain, hf, lights, updaters, addU, at, hero };
}

// Vegetation und Atmosphäre
export function addNature(ctx, engine, avoid) {
  const { cfg, pal, scene, terrain, q, r, addU } = ctx;
  const grass = makeGrass(pal, terrain, q.density, r, { radius: 24, avoid }); if (grass) scene.add(grass);
  (cfg.cards || []).forEach(c => scene.add(makeCards(c.kind, c.c1, c.c2, terrain, Math.round(c.n * Math.max(0.5, q.density)), r, { size: c.size, avoid, radius: c.radius || 20, upright: !c.flat })));
  if (cfg.rocks) scene.add(makeRocks(pal, terrain, cfg.rocks, r));
  if (cfg.mist) { const m = makeMist({ ...pal, mist: 0.3 }, cfg.mist, r); scene.add(m); addU(m); }
  if (cfg.shafts) { const s = makeShafts({ ...pal, shafts: cfg.shafts.strength }, r, cfg.shafts); scene.add(s); addU(s); }
  if (!engine.reducedMotion) {
    (cfg.particles || []).forEach(([k, c, n, b, size]) => scene.add(makeParticles(k, c, Math.round(n * Math.max(0.5, q.density)), b, { size })));
    if (cfg.falling) { const [k, c1, c2, n, b] = cfg.falling; const f = makeFallingLeaves(k, c1, c2, n, b); scene.add(f); addU(f); }
  }
}

// Landepunkt des Samens im Lebenslauf
export const LANDING = { kiefer: [3.0, -1.5], fichte: [4.0, -1.0], tanne: [2.5, -1.0], laerche: [-0.5, -1.5], douglasie: [2.5, -1.0], eiche: [3.5, -1.0], robinie: [2.0, -2.0], buche: [1.5, -2.0] };

const num = (x) => String(x).replace('.', ',');
function propInfo(h) {
  const ratio = (h.schwund.tangential / h.schwund.radial).toFixed(1).replace('.', ',');
  const mm = (200 * h.diff.tNum / 100 * 6).toFixed(1).replace('.', ',');
  return {
    disc: ['Stammscheibe: Schwindrisse', `${h.name} schwindet tangential um ${num(h.schwund.tangential)} %, radial nur um ${num(h.schwund.radial)} % (Verhältnis ${ratio} : 1). Die Jahrringe wollen sich stärker verkürzen als die Radien, deshalb reißt die Scheibe beim Trocknen keilförmig von außen nach innen.`],
    board: ['Brett: Arbeiten und Schüsseln', `Ein Seitenbrett schüsselt beim Trocknen von der Kernseite weg. Differentielles Schwindmaß tangential: ${h.diff.tangential} % je % Holzfeuchte. Ein 20 cm breites Brett, das von 18 auf 12 % trocknet, wird rund ${mm} mm schmaler. ${h.stehvermoegen}`],
    stack: ['Trocknungsstapel', `Bretter auf Stapellatten, abgedeckt und beschwert: Luft zieht gleichmäßig durch, nichts verzieht sich. ${h.trocknung}`],
    hardness: ['Brinell-Prüfung', `Eine 10-mm-Stahlkugel wird mit festgelegter Kraft in die Seitenfläche gedrückt. Je kleiner der Eindruck, desto härter das Holz. ${h.name}: ${h.brinell}. Zum Vergleich: Fichte 12, Robinie 46–48 N/mm².`],
    trunk: ['Stamm, Rinde und Harz', h.harz],
  };
}

export async function buildRealm(id, engine) {
  const ctx = buildBase(id, engine);
  const { cfg, h, scene, hf, updaters, addU, at, hero } = ctx;
  const PI = propInfo(h);
  const stations = [];
  const station = (obj, key, info, opts = {}) => { obj.userData.pickId = 'st:' + stations.length; stations.push({ obj, key, title: info[0], text: info[1], ...opts }); };
  // Requisiten (Eigenschaften)
  const P = { ...PROPS, ...(cfg.props || {}) };
  const disc = makeDisc(id, h); at(disc, P.disc[0], P.disc[1], 0.1, P.disc[2]); disc.rotation.x = 0.08; station(disc, 'disc', PI.disc);
  station(at(makeBoard(id, h), P.board[0], P.board[1], 0, P.board[2]), 'board', PI.board);
  station(at(makeHardness(id, h), P.hardness[0], P.hardness[1], 0, P.hardness[2]), 'hardness', PI.hardness);
  station(at(makeStack(id, h), P.stack[0], P.stack[1], 0, P.stack[2]), 'stack', PI.stack);
  station(hero.group, 'trunk', PI.trunk, { focus: hero.group.position.clone().add(V(0, 2.2, 0)), radius: 1.6 });
  const sign = await makeSign(id, h); at(sign, P.sign[0], P.sign[1], 0, P.sign[2]);
  // Werkstücke
  for (const wk of cfg.werk) {
    const obj = FN[wk.fn](id);
    obj.scale.multiplyScalar(wk.scale || 1);
    let target = obj;
    if (wk.pedestal) {
      const ped = makePedestal(); at(ped, wk.pos[0], wk.pos[1], 0, wk.rot);
      const holder = new THREE.Group(); holder.add(obj); holder.position.set(wk.pos[0], hf(wk.pos[0], wk.pos[1]) + ped.userData.top + (wk.float || 0.3), wk.pos[1]); holder.rotation.y = wk.rot;
      const baseY = holder.position.y;
      const bb = new THREE.Box3().setFromObject(obj); obj.position.y -= bb.min.y;
      scene.add(holder);
      updaters.push((dt, t) => { holder.position.y = baseY + Math.sin(t * 1.1) * 0.06; if (wk.spin) holder.rotation.y += dt * wk.spin; });
      addU(obj); target = holder;
    } else at(obj, wk.pos[0], wk.pos[1], wk.y || 0, wk.rot);
    if (WERK_INFO[wk.fn]) station(target, wk.fn, WERK_INFO[wk.fn]);
  }
  (cfg.lamps || []).forEach(([x, y, z, c, i]) => { const l = new THREE.PointLight(c, i, 10, 2); l.position.set(x, hf(x, z) + y, z); scene.add(l); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: c })); bulb.position.copy(l.position); scene.add(bulb); });
  const avoid = [[P.disc[0], P.disc[1], 1.2], [P.board[0], P.board[1], 1.2], [P.hardness[0], P.hardness[1], 0.8], [P.sign[0], P.sign[1], 1.6], [P.stack[0], P.stack[1], 1.4], ...cfg.werk.map(w => [w.pos[0], w.pos[1], w.fn === 'steg' ? 0 : 2.6])];
  addNature(ctx, engine, avoid);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200);
  const rig = { pos: V(0, 3.1, 14.5), target: V(0, 4.3, -6), from: V(-2, 10, 32), fromTarget: V(0, 9, -12), dur: 5 };
  // Nahansicht-Karte (DOM, liegt über der Leinwand)
  const card = document.createElement('div'); card.className = 'st-card'; card.hidden = true;
  card.innerHTML = `<div class="st-k"></div><h3></h3><p></p><div class="st-nav"><button class="st-prev" aria-label="Vorherige Station">‹</button><button class="st-over">Übersicht</button><button class="st-next" aria-label="Nächste Station">›</button></div>`;
  engine.container.appendChild(card);
  let cur = -1, occluders = null; const ray = new THREE.Raycaster();
  const focus = (i) => {
    cur = (i + stations.length) % stations.length; const st = stations[cur];
    scene.updateMatrixWorld(true);
    st.obj.updateWorldMatrix(true, true);
    let c, rad;
    if (st.focus) { c = st.focus.clone(); rad = st.radius; }
    else { const bb = new THREE.Box3().setFromObject(st.obj); c = bb.getCenter(V()); rad = bb.getSize(V()).length() / 2; }
    const base = rig.pos.clone().sub(c); base.y = 0; base.normalize();
    const dist = Math.min(15, Math.max(1.7, rad * 2.3));
    // freien Blickwinkel suchen (nichts zwischen Kamera und Station)
    if (!occluders) { occluders = []; scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.material && !o.material.transparent && o !== ctx.terrain && o.geometry && !(o.geometry.parameters && o.geometry.parameters.radius > 500)) occluders.push(o); }); }
    const own = new Set(); st.obj.traverse(o => own.add(o));
    let dir = null;
    for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.2, -2.2]) {
      const d = base.clone().applyAxisAngle(V(0, 1, 0), a); d.y = 0.42; d.normalize();
      ray.set(c, d); ray.far = dist + 1.4;
      const hit = ray.intersectObjects(occluders, false).find(h => !own.has(h.object) && h.distance > rad * 0.6);
      if (!hit) { dir = d; break; }
    }
    if (!dir) { dir = base.clone(); dir.y = 0.42; dir.normalize(); }
    engine.flyTo(c.clone().addScaledVector(dir, dist), c, 1.6);
    card.querySelector('.st-k').textContent = `Nahansicht ${cur + 1} / ${stations.length}`;
    card.querySelector('h3').textContent = st.title; card.querySelector('p').textContent = st.text; card.hidden = false;
  };
  const overview = () => { cur = -1; card.hidden = true; engine.flyTo(rig.pos.clone(), rig.target.clone(), 1.6); };
  card.querySelector('.st-prev').addEventListener('click', () => focus(cur - 1));
  card.querySelector('.st-next').addEventListener('click', () => focus(cur + 1));
  card.querySelector('.st-over').addEventListener('click', overview);
  let hover = null, hoverT = 0;
  const world = {
    id, scene, camera, rig,
    post: cfg.post, audio: cfg.audio, pick: [sign, ...stations.map(s => s.obj)], stations,
    focus, overview, isFocused: () => cur >= 0,
    // onPick wird von außen gesetzt (Tafel); Stationen hier
    handleStation(pid) { if (pid && pid.startsWith('st:')) { focus(+pid.slice(3)); return true; } return false; },
    update(dt, t, eng) {
      hoverT += dt; if (hoverT > 0.15) { hoverT = 0; hover = eng.hover(); eng.canvas.style.cursor = hover ? 'pointer' : ''; }
      for (const u of updaters) u(dt, t, hover === 'tafel');
    },
    dispose() { card.remove(); disposeScene(scene); },
  };
  return world;
}

export function disposeScene(scene) {
  scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m.userData || !m.userData.keep) m.dispose(); });
  });
  if (scene.environment) scene.environment.dispose();
}
