import * as THREE from 'three';
import { rng, fbm, smooth, clamp, canvas, texFromCanvas, leatherTexture, softTexture, easeInOut, woodTextures } from './util.js';
import { makeParticles, makeShafts } from './env.js';
import { makeForest } from './tree.js';
import { woodMat, metal, box, cyl, WOODVIS } from './props.js';
import { beam } from './werk.js';
import { logoSVG, svgToImage } from './icons.js';
import { HOELZER } from './data.js';
import { REALMS, disposeScene } from './realms.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function flame() {
  const g = new THREE.Group();
  const tex = softTexture('dot');
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffd28a', blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.set(0.09, 0.22, 1); g.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ff9a40', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45 }));
  halo.scale.set(0.6, 0.6, 1); g.add(halo);
  const light = new THREE.PointLight('#ffae5a', 6, 9, 1.6); light.castShadow = false; g.add(light);
  g.userData.update = (dt, t) => { const f = 0.85 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.07 + Math.sin(t * 23) * 0.03; light.intensity = 6 * f; core.scale.set(0.09, 0.22 * f, 1); halo.material.opacity = 0.4 * f; };
  return g;
}

function candle(x, z) {
  const g = new THREE.Group();
  const wax = cyl(0.07, 0.075, 0.5, new THREE.MeshStandardMaterial({ color: '#efe4cc', roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 0.12 }), 20); wax.position.y = 0.25; g.add(wax);
  const holder = cyl(0.16, 0.18, 0.04, metal('#b08a4a', 0.4), 24); holder.position.y = 0.02; g.add(holder);
  const f = flame(); f.position.y = 0.62; g.add(f);
  g.position.set(x, 0, z); g.userData.update = f.userData.update;
  return g;
}

async function goldLogoTexture(base) {
  const S = 1024, c = canvas(S, S), ctx = c.getContext('2d');
  ctx.drawImage(base.image, 0, 0, S, S);
  ctx.strokeStyle = 'rgba(216,178,106,0.9)'; ctx.lineWidth = 6; ctx.strokeRect(50, 50, S - 100, S - 100); ctx.lineWidth = 2; ctx.strokeRect(70, 70, S - 140, S - 140);
  const img = await svgToImage(logoSVG({ size: 600, gold: true }));
  if (img) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.drawImage(img, S / 2 - 300, S / 2 - 330, 600, 600); }
  ctx.shadowBlur = 0; ctx.fillStyle = '#d8b26a'; ctx.textAlign = 'center'; ctx.font = '64px "IM Fell English SC","IM Fell English", Georgia, serif';
  ctx.fillText('HOLZMAPPE', S / 2, S - 140);
  return texFromCanvas(c);
}

function pagesTexture() {
  const c = canvas(256, 64), ctx = c.getContext('2d'); ctx.fillStyle = '#efe2c4'; ctx.fillRect(0, 0, 256, 64);
  for (let y = 0; y < 64; y += 2) { ctx.fillStyle = `rgba(120,90,50,${0.08 + Math.random() * 0.1})`; ctx.fillRect(0, y, 256, 1); }
  return texFromCanvas(c);
}

// ---------- Prolog ----------
export async function buildProlog(engine, onOpened) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0806'); scene.fog = new THREE.FogExp2('#0d0806', 0.08);
  const amb = new THREE.HemisphereLight('#6a5a7a', '#2a1a10', 0.35); scene.add(amb);
  const moon = new THREE.DirectionalLight('#9ab0ff', 0.9); moon.position.set(-6, 8, -3); moon.castShadow = engine.q.shadows > 0; moon.shadow.mapSize.set(1024, 1024); scene.add(moon);
  const table = box(7, 0.2, 4.4, woodMat('eiche', { repeat: [2, 0.6], rough: 0.4 })); table.position.y = -0.1; scene.add(table);
  // Buch
  const book = new THREE.Group(); scene.add(book);
  const lt = leatherTexture('#5a2a18');
  const leather = new THREE.MeshStandardMaterial({ map: lt.map, normalMap: lt.normal, roughness: 0.55 });
  const coverTex = await goldLogoTexture(lt.map);
  const coverTop = new THREE.MeshStandardMaterial({ map: coverTex, normalMap: lt.normal, roughness: 0.5, metalness: 0.15 });
  const pages = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.9 });
  const back = box(1.7, 0.06, 2.2, leather); back.position.y = 0.03; book.add(back);
  const block = box(1.58, 0.26, 2.08, pages); block.position.set(0.04, 0.19, 0); book.add(block);
  const spine = cyl(0.17, 0.17, 2.2, leather, 16); spine.rotation.x = Math.PI / 2; spine.scale.set(0.9, 1, 1); spine.position.set(-0.84, 0.19, 0); book.add(spine);
  const hinge = new THREE.Group(); hinge.position.set(-0.85, 0.35, 0); book.add(hinge);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 2.2), [leather, leather, coverTop, leather, leather, leather]); cover.position.set(0.85, 0, 0); cover.castShadow = true; hinge.add(cover);
  const brass = metal('#c49a52', 0.3);
  for (const [x, z] of [[1.6, 1.0], [1.6, -1.0]]) { const c = box(0.18, 0.07, 0.18, brass); c.position.set(x, 0, z); hinge.add(c); }
  // Lichtseite (leuchtet beim Öffnen)
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffe8b8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.0), glowMat); glow.rotation.x = -Math.PI / 2; glow.position.set(0.04, 0.33, 0); book.add(glow);
  book.rotation.y = -0.18; book.userData.pickId = 'buch';
  // Requisiten: Kerzen, Zollstock, Bleistift, Späne
  const c1 = candle(1.9, -0.9), c2 = candle(-2.2, -1.2); c2.scale.setScalar(0.8); scene.add(c1, c2);
  const rule = new THREE.Group(); const ym = new THREE.MeshStandardMaterial({ color: '#e8c050', roughness: 0.5 });
  for (let i = 0; i < 5; i++) { const s = box(0.2, 0.012, 0.016, ym); s.position.set(i * 0.19, 0.006, 0); s.rotation.y = i % 2 ? 0.25 : -0.25; rule.add(s); }
  rule.position.set(1.4, 0.0, 1.2); rule.rotation.y = 0.6; scene.add(rule);
  const pencil = box(0.4, 0.02, 0.05, new THREE.MeshStandardMaterial({ color: '#b0281a', roughness: 0.5 })); pencil.position.set(-1.5, 0.01, 1.1); pencil.rotation.y = -0.4; scene.add(pencil);
  const shavM = woodMat('kiefer', { rough: 0.6 });
  const r = rng(5);
  for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r.range(0.05, 0.09), 0.012, 4, 16, r.range(3, 6)), shavM); t.position.set(r.range(-3, 3), 0.03, r.range(0.8, 1.9)); t.rotation.set(Math.PI / 2 + r.range(-0.4, 0.4), 0, r() * 6); t.scale.z = 0.3; scene.add(t); }
  scene.add(makeParticles('motes', '#ffd8a0', 160, [-3, 3, 0.2, 3, -2, 2], { size: 0.03, speed: 0.4 }));
  const shafts = makeShafts({ sunDir: V(-6, 8, -3), sunColor: '#9ab0ff', shafts: 0.06 }, r, { n: 4, origin: V(-1, 5, -1), spread: 2 }); scene.add(shafts);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  let opening = null;
  const updaters = [c1.userData.update, c2.userData.update, shafts.userData.update];
  const world = {
    scene, camera, pick: [book],
    rig: { pos: V(0.2, 3.1, 3.9), target: V(0.05, 0.1, 0.05), from: V(-1.2, 4.2, 6), fromTarget: V(0, 0.2, 0), dur: 4, sway: 0.25 },
    post: { hatch: 0.28, outline: 0.7, tint: '#ffd8b0', tintAmt: 0.15, focus: 4.6, dof: 0.8, bloom: 0.9, bloomThreshold: 0.75, exposure: 1.25, vignette: 0.8 },
    audio: { crackle: 0.5, drone: 0.4, droneNote: 65, wind: 0.12 },
    onPick: (id) => { if (id === 'buch' && !opening) open(); },
    update(dt, t, eng) {
      updaters.forEach(u => u(dt, t));
      const hv = eng.hover(); eng.canvas.style.cursor = hv && !opening ? 'pointer' : '';
      if (!opening) glowMat.opacity = 0.0;
      if (opening) {
        opening.t += dt; const k = easeInOut(Math.min(1, opening.t / 1.8));
        hinge.rotation.z = k * Math.PI * 0.97;
        glowMat.opacity = smooth(0.3, 1.0, k) * 0.9 + smooth(1.8, 2.6, opening.t) * 2;
        if (opening.t > 2.6 && !opening.done) { opening.done = true; onOpened && onOpened(); }
      }
    },
    dispose() { disposeScene(scene); },
  };
  const open = () => { opening = { t: 0 }; engine.flyTo(V(0.1, 1.6, 0.9), V(0.05, 0.3, 0), 2.6); };
  world.open = open;
  return world;
}

// ---------- Weltkarte ----------
export const MAP_POS = {
  kiefer: [-15, 4.5], fichte: [-12.5, -4.5], tanne: [-6.5, -8.5], laerche: [-4.5, -0.5], douglasie: [-8.5, 7],
  eiche: [4.5, 6], robinie: [12.5, 1.5], buche: [7, -7], werkstatt: [15, -8.5],
};
function landField(x, z) {
  const a = 1 - ((x + 9) / 11.6) ** 2 - (z / 10.6) ** 2;
  const b = 1 - ((x - 10) / 10.8) ** 2 - (z / 10.4) ** 2;
  let m = Math.max(a, b) + fbm(x * 0.14, z * 0.14, 4) * 0.32;
  const rx = 0.7 + Math.sin(z * 0.32) * 1.3;
  m -= (1 - smooth(0.4, 1.5, Math.abs(x - rx))) * 0.6;
  return m;
}
function mapHeight(x, z) {
  const m = landField(x, z);
  if (m <= 0) return Math.max(-0.26, -0.12 + m * 0.3);
  const mount = Math.exp(-(((x + 12.5) ** 2) + ((z + 6) ** 2)) / 18) * 2.2 + Math.exp(-(((x + 6) ** 2) + ((z + 10) ** 2)) / 10) * 1.2 + Math.exp(-(((x - 14) ** 2) + ((z + 3) ** 2)) / 14) * 0.6;
  return 0.12 + smooth(0, 0.4, m) * 0.45 + mount * smooth(0, 0.3, m) + fbm(x * 0.5, z * 0.5, 3) * 0.12 * smooth(0, 0.2, m);
}

async function mapTexture() {
  const W = 2048, H = 1434, c = canvas(W, H), ctx = c.getContext('2d');
  const toX = x => (x + 20) / 40 * W, toY = z => (z + 14) / 28 * H;
  // Pergament
  ctx.fillStyle = '#ecdcb6'; ctx.fillRect(0, 0, W, H);
  const r = rng(21);
  for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, rr = r.range(60, 300); const g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(150,110,60,${r.range(0.03, 0.1)})`); g.addColorStop(1, 'rgba(150,110,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  // Gitter für Maske
  const GW = 400, GH = 280, M = new Float32Array((GW + 1) * (GH + 1));
  for (let j = 0; j <= GH; j++) for (let i = 0; i <= GW; i++) M[j * (GW + 1) + i] = landField(i / GW * 40 - 20, j / GH * 28 - 14);
  const at = (i, j) => M[j * (GW + 1) + i];
  // Land einfärben
  // (schneller: Landflächen über Gitterzellen füllen)
  const cw = W / GW, chh = H / GH;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const m = at(i, j); if (m <= 0) continue;
    const x = i / GW * 40 - 20;
    ctx.fillStyle = x < 0.7 ? `rgba(150,170,120,${0.5 + smooth(0, 0.5, m) * 0.25})` : `rgba(196,176,110,${0.5 + smooth(0, 0.5, m) * 0.25})`;
    ctx.fillRect(i * cw, j * chh, cw + 0.6, chh + 0.6);
  }
  // Meer leicht getönt
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const m = at(i, j); if (m > 0) continue; ctx.fillStyle = `rgba(120,140,150,${0.18 + Math.min(0.25, -m * 0.2)})`; ctx.fillRect(i * cw, j * chh, cw + 0.6, chh + 0.6); }
  // Meer-Schraffur (waagerechte Stichlinien)
  ctx.strokeStyle = 'rgba(60,70,80,0.35)'; ctx.lineWidth = 1.2;
  for (let y = 0; y < H; y += 7) {
    ctx.beginPath(); let on = false;
    for (let x = 0; x <= W; x += 6) {
      const i = Math.min(GW, Math.round(x / cw)), j = Math.min(GH, Math.round(y / chh));
      const sea = at(i, j) < -0.04;
      const yy = y + Math.sin(x * 0.02 + y) * 1.2;
      if (sea && !on) { ctx.moveTo(x, yy); on = true; } else if (sea) ctx.lineTo(x, yy); else on = false;
    }
    ctx.stroke();
  }
  // Küstenlinien (Marching Squares) mit Wellenlinien davor
  const contour = (lvl, width, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const a = at(i, j) - lvl, b = at(i + 1, j) - lvl, cc = at(i + 1, j + 1) - lvl, d = at(i, j + 1) - lvl;
      const idx = (a > 0) | ((b > 0) << 1) | ((cc > 0) << 2) | ((d > 0) << 3);
      if (idx === 0 || idx === 15) continue;
      const P = [];
      const ip = (p, q, x0, y0, x1, y1) => { const t = p / (p - q); return [(x0 + (x1 - x0) * t) * cw, (y0 + (y1 - y0) * t) * chh]; };
      if ((a > 0) !== (b > 0)) P.push(ip(a, b, i, j, i + 1, j));
      if ((b > 0) !== (cc > 0)) P.push(ip(b, cc, i + 1, j, i + 1, j + 1));
      if ((cc > 0) !== (d > 0)) P.push(ip(cc, d, i + 1, j + 1, i, j + 1));
      if ((d > 0) !== (a > 0)) P.push(ip(d, a, i, j + 1, i, j));
      for (let k = 0; k + 1 < P.length; k += 2) { ctx.moveTo(P[k][0], P[k][1]); ctx.lineTo(P[k + 1][0], P[k + 1][1]); }
    }
    ctx.stroke();
  };
  [[-0.16, 1, 'rgba(50,40,30,0.25)'], [-0.1, 1.2, 'rgba(50,40,30,0.35)'], [-0.05, 1.4, 'rgba(50,40,30,0.5)']].forEach(a => contour(...a));
  ctx.fillStyle = 'rgba(0,0,0,0)';
  contour(0, 3.2, 'rgba(40,26,14,0.95)');
  contour(0.25, 0.8, 'rgba(60,40,20,0.35)');
  // Waldsymbole
  for (let k = 0; k < 900; k++) {
    const x = r.range(-19, 19), z = r.range(-13.5, 13.5); const m = landField(x, z); if (m < 0.08) continue;
    if (Object.values(MAP_POS).some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.4)) continue;
    const X = toX(x), Y = toY(z), s = r.range(7, 11);
    ctx.strokeStyle = 'rgba(40,30,18,0.75)'; ctx.lineWidth = 1.2;
    if (x < 0.7) { ctx.fillStyle = 'rgba(80,100,70,0.35)'; ctx.beginPath(); ctx.moveTo(X, Y - s * 1.6); ctx.lineTo(X + s * 0.6, Y); ctx.lineTo(X - s * 0.6, Y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(110,120,70,0.35)'; ctx.beginPath(); ctx.arc(X, Y - s * 0.7, s * 0.7, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y + s * 0.4); ctx.stroke();
  }
  // Reiseroute
  const order = ['kiefer', 'fichte', 'tanne', 'laerche', 'douglasie', 'eiche', 'robinie', 'buche', 'werkstatt'];
  ctx.setLineDash([10, 9]); ctx.strokeStyle = 'rgba(120,30,20,0.75)'; ctx.lineWidth = 3; ctx.beginPath();
  order.forEach((id, i) => { const [x, z] = MAP_POS[id]; const X = toX(x), Y = toY(z); if (!i) ctx.moveTo(X, Y); else { const [px, pz] = MAP_POS[order[i - 1]]; ctx.quadraticCurveTo((toX(px) + X) / 2 + 40, (toY(pz) + Y) / 2 - 40, X, Y); } });
  ctx.stroke(); ctx.setLineDash([]);
  // Landnamen
  const spaced = (t, x, y, size, col = 'rgba(40,26,14,0.75)') => { ctx.font = `${size}px "IM Fell English SC","IM Fell English", Georgia, serif`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(t.split('').join(String.fromCharCode(8202)), x, y); };
  spaced('NADELHÖLZER', toX(-9), toY(-12.2), 54);
  spaced('LAUBHÖLZER', toX(10), toY(-12.2), 54);
  // Windrose
  const rx = toX(-17), ry = toY(11.2), R = 90;
  ctx.save(); ctx.translate(rx, ry); ctx.strokeStyle = 'rgba(40,26,14,0.9)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, 7); ctx.stroke();
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, L = i % 4 === 0 ? R * 1.2 : i % 2 ? R * 0.55 : R * 0.8; ctx.fillStyle = i % 2 ? 'rgba(236,220,182,1)' : 'rgba(60,40,22,0.85)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.12) * L * 0.3, Math.sin(a - 0.12) * L * 0.3); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a + 0.12) * L * 0.3, Math.sin(a + 0.12) * L * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.font = '34px "IM Fell English SC", Georgia, serif'; ctx.fillStyle = 'rgba(40,26,14,0.95)'; ctx.textAlign = 'center'; ctx.fillText('N', 0, -R * 1.25 - 6);
  ctx.restore();
  // Kartusche
  const img = await svgToImage(logoSVG({ size: 220 }));
  ctx.save(); ctx.translate(toX(13.5), toY(10.8));
  ctx.fillStyle = 'rgba(236,220,182,0.92)'; ctx.strokeStyle = 'rgba(40,26,14,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-300, -95, 600, 190, 30); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-288, -83, 576, 166, 24); ctx.stroke();
  if (img) ctx.drawImage(img, -285, -80, 160, 160);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(40,26,14,0.95)'; ctx.font = '50px "IM Fell English SC", Georgia, serif'; ctx.fillText('Die Holzwelten', -110, -10);
  ctx.font = 'italic 30px "IM Fell English", Georgia, serif'; ctx.fillText('Peters Zimmerei · Holzmappe', -110, 38);
  ctx.restore();
  // Rand
  ctx.strokeStyle = 'rgba(40,26,14,0.9)'; ctx.lineWidth = 10; ctx.strokeRect(18, 18, W - 36, H - 36); ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, H - 80);
  for (let x = 40; x < W - 40; x += 40) { ctx.fillStyle = (x / 40) % 2 ? 'rgba(40,26,14,0.9)' : 'rgba(236,220,182,1)'; ctx.fillRect(x, 22, 40, 14); ctx.fillRect(x, H - 36, 40, 14); }
  return texFromCanvas(c, { aniso: 8 });
}

function houseMini() {
  const g = new THREE.Group();
  const wall = box(1, 0.7, 0.8, woodMat('fichte', { repeat: [0.4, 0.4] })); wall.position.y = 0.35; g.add(wall);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.6, 4), new THREE.MeshStandardMaterial({ color: '#7a3a28', roughness: 0.8 })); roof.position.y = 1.0; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const chim = box(0.12, 0.35, 0.12, new THREE.MeshStandardMaterial({ color: '#6a5a4a' })); chim.position.set(0.25, 1.1, 0.1); g.add(chim);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ color: '#ffcf80' })); win.position.set(0.25, 0.4, 0.401); g.add(win);
  return g;
}

export async function buildMap(engine, { visited = new Set(), onEnter, container } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a1410'); scene.fog = new THREE.Fog('#1a1410', 40, 90);
  const sun = new THREE.DirectionalLight('#fff0d8', 1.9); sun.position.set(-14, 16, 8); sun.castShadow = engine.q.shadows > 0; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 18, bottom: -18, near: 1, far: 70 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0005;
  scene.add(sun, new THREE.HemisphereLight('#c8d0e0', '#5a4a30', 0.5));
  const geo = new THREE.PlaneGeometry(40, 28, 260, 182); geo.rotateX(-Math.PI / 2);
  const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, mapHeight(pa.getX(i), pa.getZ(i)));
  geo.computeVertexNormals();
  const tex = await mapTexture();
  const map = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 })); map.receiveShadow = true; scene.add(map);
  // Tisch darunter
  const table = box(48, 0.6, 36, woodMat('eiche', { repeat: [3, 1], rough: 0.5 })); table.position.y = -0.95; scene.add(table);
  // Landmarken
  const marks = []; const r = rng(4);
  for (const h of HOELZER) {
    const [x, z] = MAP_POS[h.id]; const pos = [];
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + r(), d = i ? r.range(0.5, 1.0) : 0; const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; pos.push(V(px, mapHeight(px, pz) - 0.02, pz)); }
    const f = makeForest(h.id, pos, { seed: 7, scaleRange: [0.07, 0.095] });
    f.userData.pickId = h.id; scene.add(f); marks.push(f);
    if (h.id === 'laerche') { const lake = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), new THREE.MeshStandardMaterial({ color: '#5a7a8a', roughness: 0.1, metalness: 0.2 })); lake.rotation.x = -Math.PI / 2; lake.position.set(x + 1.3, mapHeight(x + 1.3, z + 0.6) + 0.03, z + 0.6); scene.add(lake); }
  }
  const [wx, wz] = MAP_POS.werkstatt; const ws = houseMini(); ws.scale.setScalar(0.9); ws.position.set(wx, mapHeight(wx, wz), wz); ws.userData.pickId = 'werkstatt'; scene.add(ws); marks.push(ws);
  // Hover-Ringe und Siegel
  const rings = {};
  for (const id of Object.keys(MAP_POS)) {
    const [x, z] = MAP_POS[id];
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.45, 48), new THREE.MeshBasicMaterial({ color: '#ffcf80', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, mapHeight(x, z) + 0.06, z); scene.add(ring); rings[id] = ring;
    if (visited.has(id)) { const seal = cyl(0.32, 0.32, 0.06, new THREE.MeshStandardMaterial({ color: '#8a1a10', roughness: 0.35 }), 20); seal.position.set(x + 1.2, mapHeight(x + 1.2, z + 1) + 0.1, z + 1); scene.add(seal); }
  }
  // Wolken über der Karte
  const clouds = new THREE.Group(); const ct = softTexture('cloud');
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.35, depthWrite: false, color: '#fff8ec' })); m.rotation.x = -Math.PI / 2; m.position.set(r.range(-22, 22), 5 + r() * 2, r.range(-14, 14)); m.userData.v = r.range(0.3, 0.7); clouds.add(m); }
  scene.add(clouds);
  scene.add(makeParticles('motes', '#ffe8c0', 120, [-20, 20, 0.5, 6, -14, 14], { size: 0.05, speed: 0.4 }));
  // DOM-Beschriftungen (auch klickbar – wichtig auf dem Tablet)
  const layer = document.createElement('div'); layer.className = 'map-labels';
  const labels = {};
  for (const id of Object.keys(MAP_POS)) {
    const h = HOELZER.find(x => x.id === id);
    const b = document.createElement('button'); b.className = 'map-label' + (visited.has(id) ? ' visited' : '');
    b.innerHTML = h ? `<span class="realm">${h.reich}</span><span class="species">${h.name}</span>` : `<span class="realm">Die Werkstatt</span><span class="species">Holzmappe</span>`;
    b.addEventListener('click', () => go(id)); layer.appendChild(b); labels[id] = b;
  }
  (container || engine.container).appendChild(layer);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  let hover = null, busy = false;
  const go = async (id) => {
    if (busy) return; busy = true; layer.classList.add('fade');
    const [x, z] = MAP_POS[id], y = mapHeight(x, z);
    await engine.flyTo(V(x, y + 2.2, z + 3.2), V(x, y + 0.5, z), 2.0);
    onEnter && onEnter(id);
  };
  const tmp = V();
  return {
    scene, camera, pick: marks,
    rig: { pos: V(0, 33, 24), target: V(0, 0, 1.6), from: V(0, 40, 34), fromTarget: V(0, 0, 0), dur: 3.5, sway: 1.4 },
    post: { hatch: 0.22, outline: 0.6, tint: '#ffe8c8', tintAmt: 0.1, focus: 34, dof: 0.25, bloom: 0.35, exposure: 0.92, lineFadeStart: 40, lineFadeEnd: 160 },
    audio: { wind: 0.35, drone: 0.35, droneNote: 98, birds: 0.15, paper: 0.2 },
    onPick: (id) => go(id),
    update(dt, t, eng) {
      hover = eng.hover(); eng.canvas.style.cursor = hover ? 'pointer' : '';
      for (const [id, ring] of Object.entries(rings)) { const target = hover === id ? 0.9 : 0.0; ring.material.opacity += (target - ring.material.opacity) * Math.min(1, dt * 6); ring.scale.setScalar(1 + Math.sin(t * 2) * 0.04); }
      clouds.children.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 26) c.position.x = -26; });
      const w = eng.container.clientWidth, hh = eng.container.clientHeight;
      for (const [id, el] of Object.entries(labels)) {
        const [x, z] = MAP_POS[id]; tmp.set(x, mapHeight(x, z) + (id === 'werkstatt' ? 1.6 : 2.0), z).project(camera);
        el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * hh}px) translate(-50%, -100%)`;
        el.classList.toggle('hover', hover === id);
      }
    },
    dispose() { layer.remove(); disposeScene(scene); },
  };
}

// ---------- Werkstatt ----------
export async function buildWerkstatt(engine, onOpen) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a120c'); scene.fog = new THREE.FogExp2('#2a1c12', 0.04);
  scene.add(new THREE.HemisphereLight('#8a7a6a', '#3a2a1a', 0.5));
  const sun = new THREE.DirectionalLight('#ffd8a0', 3.2); sun.position.set(-6, 7, 3); sun.target.position.set(0, 0.8, 0); sun.castShadow = engine.q.shadows > 0; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  // Raum
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), woodMat('fichte', { repeat: [6, 1.2], rough: 0.8, color: '#a89070' })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallM = woodMat('tanne', { repeat: [5, 1], color: '#b8a080' });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), wallM); back.position.set(0, 3, -2.6); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallM); left.rotation.y = Math.PI / 2; left.position.set(-5, 3, 2); scene.add(left);
  // Fenster (links) mit Lichtschacht
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), new THREE.MeshBasicMaterial({ color: '#fff1d0' })); win.rotation.y = Math.PI / 2; win.position.set(-4.98, 2.6, 0.4); scene.add(win);
  const fr = new THREE.Group(); const fm = woodMat('kiefer');
  fr.add(beam(V(-4.95, 1.7, -0.4), V(-4.95, 3.5, -0.4), 0.08, 0.08, fm), beam(V(-4.95, 1.7, 1.2), V(-4.95, 3.5, 1.2), 0.08, 0.08, fm), beam(V(-4.95, 2.6, -0.4), V(-4.95, 2.6, 1.2), 0.06, 0.06, fm), beam(V(-4.95, 1.7, 0.4), V(-4.95, 3.5, 0.4), 0.06, 0.06, fm)); scene.add(fr);
  const r = rng(8);
  const shafts = makeShafts({ sunDir: V(-6, 7, 3), sunColor: '#ffd8a0', shafts: 0.12 }, r, { n: 5, origin: V(-4.6, 3.3, 0.4), spread: 0.6 }); scene.add(shafts);
  // Hobelbank
  const top = box(3.4, 0.14, 1.0, woodMat('buche', { repeat: [1, 0.3], rough: 0.5 })); top.position.set(0, 0.9, 0); scene.add(top);
  const legM = woodMat('buche', { repeat: [0.3, 1] });
  for (const x of [-1.4, 1.4]) for (const z of [-0.35, 0.35]) { const l = box(0.1, 0.85, 0.1, legM); l.position.set(x, 0.42, z); scene.add(l); }
  for (const x of [-1.4, 1.4]) { const s = box(0.1, 0.08, 0.8, legM); s.position.set(x, 0.2, 0); scene.add(s); }
  const stretch = box(2.9, 0.1, 0.08, legM); stretch.position.set(0, 0.25, 0); scene.add(stretch);
  const vise = box(0.5, 0.25, 0.08, legM); vise.position.set(-1.45, 0.82, 0.54); scene.add(vise);
  const spindle = cyl(0.025, 0.025, 0.4, legM); spindle.rotation.x = Math.PI / 2; spindle.position.set(-1.45, 0.82, 0.7); scene.add(spindle);
  // Werkzeuge: Hobel, Winkel, Klüpfel, Späne
  const plane = new THREE.Group(); const pb = box(0.5, 0.11, 0.12, woodMat('buche', { rough: 0.4 })); pb.position.y = 0.055; plane.add(pb);
  const horn = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, 16, Math.PI), woodMat('buche')); horn.position.set(0.18, 0.11, 0); plane.add(horn);
  const iron = box(0.02, 0.12, 0.09, metal('#9aa0a6')); iron.position.set(-0.02, 0.12, 0); iron.rotation.z = 0.8; plane.add(iron);
  plane.position.set(1.0, 0.97, -0.15); plane.rotation.y = 0.3; scene.add(plane);
  const sq = new THREE.Group(); sq.add(Object.assign(box(0.5, 0.008, 0.04, metal('#c8c8c8')), {})); const sq2 = box(0.04, 0.008, 0.3, metal('#c8c8c8')); sq2.position.set(-0.23, 0, 0.13); sq.add(sq2); const sqh = box(0.06, 0.03, 0.32, woodMat('eiche')); sqh.position.set(-0.23, 0.01, 0.13); sq.add(sqh);
  sq.position.set(-0.9, 0.975, 0.25); sq.rotation.y = -0.4; scene.add(sq);
  const mallet = new THREE.Group(); const mh = cyl(0.09, 0.08, 0.2, woodMat('robinie'), 16); mh.position.y = 0.3; mallet.add(mh); const mhd = cyl(0.018, 0.022, 0.32, woodMat('eiche'), 10); mhd.position.y = 0.1; mallet.add(mhd);
  mallet.rotation.z = Math.PI / 2; mallet.position.set(1.4, 1.06, 0.3); scene.add(mallet);
  const shavM = woodMat('fichte', { rough: 0.6 });
  for (let i = 0; i < 30; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r.range(0.04, 0.09), 0.012, 4, 16, r.range(3, 6)), shavM); const onBench = i < 12; t.position.set(onBench ? r.range(0.4, 1.6) : r.range(-2, 2.5), onBench ? 0.985 : 0.02, onBench ? r.range(-0.4, 0.4) : r.range(-0.5, 1.8)); t.rotation.set(Math.PI / 2 + r.range(-0.5, 0.5), 0, r() * 6); t.scale.z = 0.35; scene.add(t); }
  // Regal mit Holzproben (alle 8 Arten, beschriftet)
  const shelfM = woodMat('kiefer', { repeat: [1, 0.2] });
  for (const y of [1.7, 2.3]) { const s = box(3.6, 0.05, 0.35, shelfM); s.position.set(0.6, y, -2.4); scene.add(s); }
  HOELZER.forEach((h, i) => {
    const y = i < 4 ? 1.83 : 2.43, x = -0.6 + (i % 4) * 0.8;
    const c = canvas(256, 128), ctx = c.getContext('2d'); ctx.drawImage(woodTextures_img(h.id), 0, 0, 256, 128); ctx.fillStyle = 'rgba(245,232,200,0.85)'; ctx.fillRect(20, 70, 216, 44); ctx.fillStyle = '#2a1a0e'; ctx.font = '30px "IM Fell English SC", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(h.name, 128, 102);
    const front = new THREE.MeshStandardMaterial({ map: texFromCanvas(c), roughness: 0.6 }); const sideM = woodMat(h.id, { repeat: [0.3, 0.3] });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.25), [sideM, sideM, sideM, sideM, front, sideM]); b.position.set(x, y, -2.3); b.castShadow = true; scene.add(b);
  });
  // Die Holzmappe
  const folder = new THREE.Group(); folder.position.set(-0.2, 0.97, 0.05); folder.rotation.y = 0.12; scene.add(folder);
  const lt = leatherTexture('#3e2416'); const lm = new THREE.MeshStandardMaterial({ map: lt.map, normalMap: lt.normal, roughness: 0.55 });
  const coverTex = await goldLogoTexture(lt.map);
  const cTop = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.5, metalness: 0.15 });
  const bottom = box(0.9, 0.025, 1.15, lm); bottom.position.y = 0.012; folder.add(bottom);
  const paper = box(0.86, 0.05, 1.1, new THREE.MeshStandardMaterial({ color: '#f0e4c8', roughness: 0.9 })); paper.position.set(0, 0.05, 0); folder.add(paper);
  const hinge = new THREE.Group(); hinge.position.set(-0.45, 0.085, 0); folder.add(hinge);
  const cov = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 1.15), [lm, lm, cTop, lm, lm, lm]); cov.position.x = 0.45; cov.castShadow = true; hinge.add(cov);
  const ribbon = box(0.03, 0.005, 0.5, new THREE.MeshStandardMaterial({ color: '#8a1a10' })); ribbon.position.set(0.44, 0.08, 0.6); folder.add(ribbon);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.1), new THREE.MeshBasicMaterial({ map: softTexture('dot'), color: '#ffb860', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.002; folder.add(glow);
  folder.userData.pickId = 'mappe';
  const lamp = new THREE.PointLight('#ffb060', 5, 7, 1.5); lamp.position.set(0.6, 2.6, 0.6); scene.add(lamp);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd08a' })); bulb.position.copy(lamp.position); scene.add(bulb);
  const cord = cyl(0.006, 0.006, 3.4, new THREE.MeshBasicMaterial({ color: '#1a1410' })); cord.position.set(0.6, 4.3, 0.6); scene.add(cord);
  scene.add(makeParticles('motes', '#ffe0b0', 200, [-4.5, 2, 0.5, 4, -2, 2], { size: 0.025, speed: 0.3 }));
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  let opening = null;
  return {
    scene, camera, pick: [folder],
    rig: { pos: V(0.3, 2.3, 3.3), target: V(-0.1, 0.95, 0), from: V(1.5, 2.8, 7), fromTarget: V(0, 1.2, -1), dur: 4, sway: 0.4 },
    post: { hatch: 0.3, outline: 0.7, tint: '#ffd8b0', tintAmt: 0.14, focus: 3.3, dof: 0.7, bloom: 0.75, exposure: 1.2, vignette: 0.7 },
    audio: { crackle: 0.25, wind: 0.15, drone: 0.4, droneNote: 73, birds: 0.15 },
    onPick: (id) => { if (id === 'mappe' && !opening) { opening = { t: 0 }; engine.flyTo(V(-0.1, 1.9, 0.9), V(-0.15, 0.98, 0.05), 1.8); } },
    update(dt, t, eng) {
      shafts.userData.update(dt, t);
      const hv = eng.hover(); eng.canvas.style.cursor = hv && !opening ? 'pointer' : '';
      glow.material.opacity = opening ? 0 : (0.22 + Math.sin(t * 2) * 0.1 + (hv ? 0.25 : 0));
      if (opening) { opening.t += dt; hinge.rotation.z = easeInOut(Math.min(1, opening.t / 1.4)) * Math.PI * 0.96; if (opening.t > 1.9 && !opening.done) { opening.done = true; onOpen && onOpen(); } }
    },
    dispose() { disposeScene(scene); },
  };
}

function woodTextures_img(id) { return woodTextures(id, WOODVIS[id]).map.image; }
