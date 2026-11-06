import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, canvas, texFromCanvas, woodTextures, pushTube, newBuf, bufToGeo, noise2 } from './util.js';
import { woodMat, metal, box, cyl, WOODVIS } from './props.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Balken zwischen zwei Punkten
export function beam(a, b, w, h, mat, roll = 0) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
  m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.rotateZ(roll);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const glass = () => new THREE.MeshPhysicalMaterial({ color: '#cfe6f0', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.22, envMapIntensity: 2, side: THREE.DoubleSide });

// ---------- Kiefer ----------
export function dachstuhl(id = 'kiefer') {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.2, 2] });
  const X = 2.3, Zh = 2.4, ridge = 2.7;
  // Bundbalken + Fußpfetten
  for (const z of [-1.6, 1.6]) g.add(beam(V(-X - 0.2, 0.25, z), V(X + 0.2, 0.25, z), 0.14, 0.2, m));
  for (const x of [-X, X]) g.add(beam(V(x, 0.42, -Zh - 0.3), V(x, 0.42, Zh + 0.3), 0.14, 0.14, m));
  // Stiele, Firstpfette, Kopfbänder
  for (const z of [-1.6, 1.6]) { g.add(beam(V(0, 0.35, z), V(0, ridge - 0.1, z), 0.14, 0.14, m)); g.add(beam(V(0, ridge - 0.75, z), V(0, ridge - 0.08, z + (z > 0 ? -0.7 : 0.7)), 0.1, 0.1, m)); g.add(beam(V(0, ridge - 0.75, z), V(0, ridge - 0.08, z + (z > 0 ? 0.7 : -0.7)), 0.1, 0.1, m)); }
  g.add(beam(V(0, ridge, -Zh - 0.3), V(0, ridge, Zh + 0.3), 0.14, 0.18, m));
  // Sparren
  for (let z = -Zh; z <= Zh + 0.01; z += 0.8) {
    for (const s of [-1, 1]) { const a = V(s * (X + 0.55), 0.22, z), b = V(0, ridge + 0.18, z); g.add(beam(a, b, 0.08, 0.16, m)); }
  }
  // Lattung auf einer Dachseite (halb fertig)
  const lat = woodMat('fichte', { repeat: [0.1, 2] });
  for (let i = 0; i < 9; i++) { const t = 0.08 + i * 0.1; const x = -(X + 0.5) * (1 - t), y = 0.32 + (ridge + 0.12 - 0.32) * t; g.add(beam(V(x, y + 0.1, -Zh - 0.1), V(x, y + 0.1, i < 6 ? Zh + 0.1 : 0.4), 0.05, 0.03, lat)); }
  return g;
}

export function fenster(id, { w = 1.0, h = 1.35, sprossen = true } = {}) {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.15, 1] }), gl = glass();
  const t = 0.07, d = 0.08;
  // Blendrahmen
  g.add(beam(V(-w / 2, 0, 0), V(-w / 2, h, 0), t, d, m), beam(V(w / 2, 0, 0), V(w / 2, h, 0), t, d, m), beam(V(-w / 2 - t / 2, 0, 0), V(w / 2 + t / 2, 0, 0), t, d, m), beam(V(-w / 2 - t / 2, h, 0), V(w / 2 + t / 2, h, 0), t, d, m));
  // zwei Flügel
  for (const s of [-1, 1]) {
    const cx = s * w / 4, fw = w / 2 - t * 0.6, f = 0.055;
    const x0 = cx - fw / 2, x1 = cx + fw / 2, y0 = t * 0.6, y1 = h - t * 0.6;
    g.add(beam(V(x0, y0, 0.03), V(x0, y1, 0.03), f, 0.06, m), beam(V(x1, y0, 0.03), V(x1, y1, 0.03), f, 0.06, m), beam(V(x0, y0, 0.03), V(x1, y0, 0.03), f, 0.06, m), beam(V(x0, y1, 0.03), V(x1, y1, 0.03), f, 0.06, m));
    if (sprossen) { g.add(beam(V(cx, y0, 0.03), V(cx, y1, 0.03), 0.025, 0.035, m)); for (const k of [0.36, 0.68]) g.add(beam(V(x0, y0 + (y1 - y0) * k, 0.03), V(x1, y0 + (y1 - y0) * k, 0.03), 0.025, 0.035, m)); }
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(fw - f, y1 - y0 - f), gl); pane.position.set(cx, (y0 + y1) / 2, 0.03); g.add(pane);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), metal('#c9a35a')); knob.position.set(cx - s * fw / 2 + s * 0.04, h / 2, 0.08); g.add(knob);
  }
  return g;
}

// ---------- Fichte ----------
export function bshTraeger(id = 'fichte') {
  const g = new THREE.Group();
  const L = 6.5, n = 14, lh = 0.04, W = 0.18;
  const tex = woodTextures(id, WOODVIS[id]);
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshStandardMaterial({ map: tex.map.clone(), normalMap: tex.normal, roughness: 0.6, color: new THREE.Color().setHSL(0.09, 0.25, 0.86 + ((i * 37) % 7) / 70) });
    mat.map.repeat.set(0.3, 3); mat.map.offset.set(i * 0.17, i * 0.31); mat.map.needsUpdate = true;
    const b = box(W, lh - 0.002, L, mat); b.position.set(0, 0.55 + i * lh, 0); g.add(b);
  }
  const stone = new THREE.MeshStandardMaterial({ color: '#8a857a', roughness: 0.9 });
  for (const z of [-2.8, 2.8]) { const s = box(0.5, 0.55, 0.6, stone); s.position.set(0, 0.275, z); g.add(s); }
  return g;
}

export function geige(id = 'fichte') {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  // Korpus-Umriss (halbe Seite gespiegelt)
  const P = [[0, 0], [0.105, 0.012], [0.135, 0.065], [0.12, 0.13], [0.085, 0.165], [0.09, 0.2], [0.11, 0.25], [0.1, 0.31], [0.05, 0.352], [0, 0.358]];
  s.moveTo(0, 0);
  s.bezierCurveTo(0.08, 0, 0.14, 0.02, 0.135, 0.075); s.bezierCurveTo(0.13, 0.13, 0.08, 0.13, 0.082, 0.18); s.bezierCurveTo(0.085, 0.22, 0.118, 0.23, 0.112, 0.29); s.bezierCurveTo(0.105, 0.345, 0.04, 0.358, 0, 0.358);
  s.bezierCurveTo(-0.04, 0.358, -0.105, 0.345, -0.112, 0.29); s.bezierCurveTo(-0.118, 0.23, -0.085, 0.22, -0.082, 0.18); s.bezierCurveTo(-0.08, 0.13, -0.13, 0.13, -0.135, 0.075); s.bezierCurveTo(-0.14, 0.02, -0.08, 0, 0, 0);
  const body = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 4, curveSegments: 24 });
  body.translate(0, -0.18, 0);
  // UVs der Decke auf Bounding-Box normalisieren
  const uv = body.attributes.uv, pos = body.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 0.14) / 0.28, (pos.getY(i) + 0.18) / 0.36);
  const varnish = new THREE.Color('#c0682a');
  const top = woodMat(id, { repeat: [1, 1], rough: 0.25, color: '#e7a660' });
  const sideM = new THREE.MeshPhysicalMaterial({ color: varnish, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const bm = new THREE.Mesh(body, [top, sideM]); bm.castShadow = true; g.add(bm);
  const ebony = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.35 });
  // f-Löcher
  for (const sx of [-1, 1]) {
    const f = new THREE.Shape(); f.moveTo(0, 0); f.bezierCurveTo(0.012 * sx, 0.03, -0.012 * sx, 0.05, 0.002 * sx, 0.08); f.lineTo(0.006 * sx, 0.08); f.bezierCurveTo(-0.006 * sx, 0.05, 0.016 * sx, 0.03, 0.004 * sx, 0); f.lineTo(0, 0);
    const fm = new THREE.Mesh(new THREE.ShapeGeometry(f), ebony); fm.position.set(sx * 0.045, -0.03, 0.0435); g.add(fm);
  }
  // Hals, Griffbrett, Schnecke, Steg, Saiten, Saitenhalter
  const neck = box(0.026, 0.13, 0.022, sideM); neck.position.set(0, 0.24, 0.025); g.add(neck);
  const fb = box(0.03, 0.27, 0.008, ebony); fb.position.set(0, 0.19, 0.058); g.add(fb);
  const pegbox = box(0.024, 0.07, 0.03, sideM); pegbox.position.set(0, 0.34, 0.03); g.add(pegbox);
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.009, 8, 20, Math.PI * 1.7), sideM); scroll.rotation.y = Math.PI / 2; scroll.position.set(0, 0.385, 0.03); g.add(scroll);
  for (let i = 0; i < 4; i++) { const peg = cyl(0.004, 0.004, 0.06, ebony, 6); peg.rotation.z = Math.PI / 2; peg.position.set(0, 0.32 + i * 0.013, 0.03 + (i % 2 ? 0.01 : -0.01)); g.add(peg); }
  const bridge = box(0.045, 0.004, 0.02, woodMat('buche', { rough: 0.5 })); bridge.position.set(0, -0.02, 0.055); g.add(bridge);
  const tail = box(0.03, 0.08, 0.006, ebony); tail.position.set(0, -0.12, 0.05); g.add(tail);
  const strM = metal('#e0d8c8', 0.2);
  for (let i = 0; i < 4; i++) { const x = -0.009 + i * 0.006; const st = beam(V(x, -0.09, 0.054), V(x * 0.6, 0.33, 0.062), 0.0012, 0.0012, strM); g.add(st); }
  return g;
}

// ---------- Tanne ----------
export function schrank(id = 'tanne') {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.3, 1] }), mh = woodMat(id, { repeat: [1, 0.3] });
  const W = 1.1, H = 1.95, D = 0.55, t = 0.03;
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  g.add(at(box(t, H, D, m), -W / 2 + t / 2, H / 2 + 0.1, 0), at(box(t, H, D, m), W / 2 - t / 2, H / 2 + 0.1, 0));
  g.add(at(box(W, t, D, mh), 0, 0.1 + t / 2, 0), at(box(W, H, t, m), 0, H / 2 + 0.1, -D / 2 + t / 2));
  // Sockel + Kranz
  const sock = box(W + 0.04, 0.1, D + 0.03, mh); sock.position.set(0, 0.05, 0.01); g.add(sock);
  const kr1 = box(W + 0.1, 0.05, D + 0.08, mh); kr1.position.set(0, H + 0.12, 0.02); g.add(kr1);
  const kr2 = box(W + 0.16, 0.04, D + 0.12, mh); kr2.position.set(0, H + 0.165, 0.03); g.add(kr2);
  // Rahmen-Füllungstüren
  for (const s of [-1, 1]) {
    const dw = W / 2 - 0.02, cx = s * (W / 4), z = D / 2;
    const fr = 0.08, y0 = 0.14, y1 = H + 0.08;
    g.add(beam(V(cx - dw / 2 + fr / 2, y0, z), V(cx - dw / 2 + fr / 2, y1, z), fr, 0.025, m), beam(V(cx + dw / 2 - fr / 2, y0, z), V(cx + dw / 2 - fr / 2, y1, z), fr, 0.025, m));
    for (const y of [y0 + fr / 2, (y0 + y1) / 2, y1 - fr / 2]) g.add(beam(V(cx - dw / 2, y, z), V(cx + dw / 2, y, z), fr, 0.025, mh));
    for (const [ya, yb] of [[y0 + fr, (y0 + y1) / 2 - fr / 2], [(y0 + y1) / 2 + fr / 2, y1 - fr]]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(dw - fr * 2, yb - ya, 0.02), m); panel.position.set(cx, (ya + yb) / 2, z - 0.006); panel.castShadow = true; g.add(panel);
      const raise = new THREE.Mesh(new THREE.BoxGeometry(dw - fr * 2 - 0.08, yb - ya - 0.08, 0.02), m); raise.position.set(cx, (ya + yb) / 2, z + 0.004); g.add(raise);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), metal('#b8925a')); knob.position.set(cx - s * (dw / 2 - 0.05), H * 0.55, z + 0.025); g.add(knob);
  }
  return g;
}

export function wandverkleidung(id = 'tanne') {
  const g = new THREE.Group();
  const n = 26, bw = 0.125, H = 2.5;
  const tex = woodTextures(id, WOODVIS[id]);
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshStandardMaterial({ map: tex.map.clone(), normalMap: tex.normal, roughness: 0.6, color: new THREE.Color(1, 1, 1).multiplyScalar(0.9 + ((i * 53) % 11) / 100) });
    mat.map.repeat.set(0.25, 1.4); mat.map.offset.set(i * 0.29, i * 0.13); mat.map.needsUpdate = true;
    const b = box(bw - 0.008, H, 0.02, mat); b.position.set(-n * bw / 2 + i * bw + bw / 2, H / 2 + 0.12, 0); g.add(b);
    // Fase (V-Fuge)
    const v = box(0.004, H, 0.012, new THREE.MeshStandardMaterial({ color: '#4a3a2a' })); v.position.set(-n * bw / 2 + i * bw, H / 2 + 0.12, -0.004); g.add(v);
  }
  const trim = woodMat(id, { repeat: [3, 0.2] });
  const top = box(n * bw + 0.06, 0.1, 0.05, trim); top.position.set(0, H + 0.17, 0.01); g.add(top);
  const bot = box(n * bw + 0.06, 0.14, 0.05, trim); bot.position.set(0, 0.07, 0.01); g.add(bot);
  for (const x of [-1.2, 1.2]) g.add(beam(V(x, 0, -1.0), V(x, 2.2, -0.04), 0.08, 0.08, trim));
  return g;
}

// ---------- Lärche ----------
export function terrasse(id = 'laerche', { w = 4.5, d = 3.2 } = {}) {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.2, 1.2] }), uk = woodMat(id, { repeat: [0.2, 1.2], color: '#9a8a7a' });
  for (let x = -w / 2 + 0.2; x <= w / 2; x += 0.55) g.add(beam(V(x, 0.12, -d / 2), V(x, 0.12, d / 2), 0.06, 0.08, uk));
  const bw = 0.14, gap = 0.008;
  for (let z = -d / 2 + bw / 2; z < d / 2; z += bw + gap) { const b = box(w, 0.026, bw, m); b.position.set(0, 0.173, z); b.material = m; g.add(b); }
  return g;
}

export function steg(id = 'laerche', { L = 9, W = 1.6 } = {}) {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.2, 1.2] }), post = woodMat(id, { repeat: [0.3, 1], color: '#8a7a6a' });
  for (let z = 0; z <= L; z += 1.8) for (const x of [-W / 2, W / 2]) { const p = cyl(0.09, 0.1, 2.8, post, 10); p.position.set(x, -0.9, -z); g.add(p); }
  for (const x of [-W / 2 + 0.1, 0, W / 2 - 0.1]) g.add(beam(V(x, 0.42, 0.2), V(x, 0.42, -L - 0.2), 0.07, 0.12, post));
  for (let z = 0; z <= L; z += 0.155) { const b = box(W + 0.1, 0.03, 0.145, m); b.position.set(0, 0.5, -z); g.add(b); }
  // Geländer einseitig
  for (let z = 0; z <= L; z += 1.8) { const p = box(0.07, 1.0, 0.07, post); p.position.set(W / 2 + 0.05, 1.0, -z); g.add(p); }
  g.add(beam(V(W / 2 + 0.05, 1.5, 0), V(W / 2 + 0.05, 1.5, -L), 0.08, 0.05, m));
  // Laterne am Ende
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffcf80' }));
  lamp.position.set(W / 2 + 0.05, 1.75, -L); g.add(lamp);
  const pl = new THREE.PointLight('#ffb860', 3, 8, 2); pl.position.copy(lamp.position); g.add(pl);
  return g;
}

export function bootshaus(id = 'laerche') {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.2, 1] }), dark = new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 0.9 });
  const W = 3.2, D = 3.4, H = 2.6;
  // Boden-Deckel-Schalung: breite Bretter + Deckleisten
  const walls = [[0, D / 2, W, 0], [0, -D / 2, W, Math.PI], [W / 2, 0, D, Math.PI / 2], [-W / 2, 0, D, -Math.PI / 2]];
  walls.forEach(([x, z, len, rot], wi) => {
    const wall = new THREE.Group();
    for (let s = -len / 2 + 0.11; s < len / 2; s += 0.22) {
      if (wi === 0 && Math.abs(s) < 0.5 && true) { const lint = box(0.2, 0.5, 0.025, m); lint.position.set(s, H - 0.25, 0); wall.add(lint); continue; } // Türöffnung
      const b = box(0.2, H, 0.025, m); b.position.set(s, H / 2, 0); wall.add(b);
      const lat = box(0.05, H, 0.02, m); lat.position.set(s + 0.11, H / 2, 0.02); wall.add(lat);
    }
    wall.position.set(x, 0, z); wall.rotation.y = rot; g.add(wall);
  });
  // Giebel + Dach
  const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(0, 1.3); gable.lineTo(-W / 2, 0);
  for (const z of [D / 2, -D / 2]) { const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.03, bevelEnabled: false }), m); gm.position.set(0, H, z - 0.015); gm.castShadow = true; g.add(gm); }
  const roofLen = Math.hypot(W / 2 + 0.4, 1.4);
  for (const s of [-1, 1]) { const r = box(roofLen, 0.06, D + 0.6, dark); r.position.set(s * (W / 4 + 0.1), H + 0.65, 0); r.rotation.z = -s * Math.atan2(1.4, W / 2 + 0.4); g.add(r); }
  const door = box(0.9, H - 0.55, 0.02, new THREE.MeshStandardMaterial({ color: '#1a120c' })); door.position.set(0, (H - 0.55) / 2, D / 2 - 0.02); g.add(door);
  return g;
}

// ---------- Douglasie ----------
export function haus(id = 'douglasie') {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [2.5, 0.12] });
  const W = 5.2, D = 4.2, H = 2.8;
  const roofM = new THREE.MeshStandardMaterial({ color: '#4a4c50', roughness: 0.6, metalness: 0.3 });
  // Stülpschalung: überlappende, leicht geneigte Bretter
  const sides = [[0, D / 2, W, 0], [0, -D / 2, W, Math.PI], [W / 2, 0, D, Math.PI / 2], [-W / 2, 0, D, -Math.PI / 2]];
  sides.forEach(([x, z, len, rot]) => {
    const wall = new THREE.Group();
    for (let y = 0.15; y < H; y += 0.17) { const b = box(len + 0.04, 0.2, 0.022, m); b.position.set(0, y + 0.1, 0.02); b.rotation.x = -0.06; wall.add(b); }
    wall.position.set(x, 0, z); wall.rotation.y = rot; g.add(wall);
  });
  // Fenster in der Front
  for (const fx of [-1.4, 1.4]) { const f = fenster(id, { w: 1.0, h: 1.2 }); f.position.set(fx, 0.9, D / 2 + 0.05); g.add(f); }
  const door = fenster(id, { w: 0.95, h: 2.1, sprossen: false }); door.position.set(0, 0.15, D / 2 + 0.05); g.add(door);
  // Giebel (Stülpschalung angedeutet)
  const gable = new THREE.Shape(); gable.moveTo(-W / 2, 0); gable.lineTo(W / 2, 0); gable.lineTo(0, 1.9); gable.lineTo(-W / 2, 0);
  for (const z of [D / 2 + 0.03, -D / 2 - 0.03]) { const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.04, bevelEnabled: false }), woodMat(id, { repeat: [0.5, 0.5] })); gm.position.set(0, H + 0.1, z - 0.02); gm.castShadow = true; g.add(gm); }
  const rl = Math.hypot(W / 2 + 0.5, 2.1);
  for (const s of [-1, 1]) { const r = box(rl, 0.08, D + 0.8, roofM); r.position.set(s * (W / 4 + 0.12), H + 1.05, 0); r.rotation.z = -s * Math.atan2(2.1, W / 2 + 0.5); r.castShadow = true; g.add(r); }
  const plinth = box(W + 0.1, 0.15, D + 0.1, new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.9 })); plinth.position.y = 0.075; g.add(plinth);
  // warmes Licht hinter den Fenstern
  const pl = new THREE.PointLight('#ffb070', 4, 6, 2); pl.position.set(0, 1.4, D / 2 - 0.6); g.add(pl);
  return g;
}

// ---------- Eiche ----------
export function fass(id = 'eiche') {
  const g = new THREE.Group();
  const prof = [[0.0, 0], [0.34, 0], [0.36, 0.05], [0.42, 0.25], [0.45, 0.45], [0.42, 0.65], [0.36, 0.85], [0.34, 0.9], [0.0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const tex = woodTextures(id, WOODVIS[id]).map.image;
  const c = canvas(1024, 512), ctx = c.getContext('2d'); ctx.drawImage(tex, 0, 0, 1024, 512);
  ctx.fillStyle = 'rgba(25,14,6,0.85)'; for (let i = 0; i < 22; i++) ctx.fillRect(i * 1024 / 22, 0, 3, 512);
  const mat = new THREE.MeshStandardMaterial({ map: texFromCanvas(c), roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 44), mat); body.castShadow = body.receiveShadow = true; g.add(body);
  const iron = metal('#3a3632', 0.6);
  for (const [y, r] of [[0.08, 0.375], [0.28, 0.43], [0.62, 0.43], [0.82, 0.375]]) { const h = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 48), iron); h.rotation.x = Math.PI / 2; h.position.y = y; g.add(h); }
  const tap = cyl(0.03, 0.03, 0.12, woodMat('buche'), 10); tap.rotation.x = Math.PI / 2; tap.position.set(0, 0.35, 0.47); g.add(tap);
  g.scale.setScalar(1.6);
  return g;
}

export function fachwerk(id = 'eiche') {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.2, 1.4], color: '#7a6a5a' });
  const W = 5.6, H = 3.4, t = 0.18;
  g.add(beam(V(-W / 2, t / 2, 0), V(W / 2, t / 2, 0), t, t, m)); // Schwelle
  g.add(beam(V(-W / 2, H, 0), V(W / 2, H, 0), t, t, m));         // Rähm
  const posts = [-W / 2 + t / 2, -W / 4, 0, W / 4, W / 2 - t / 2];
  posts.forEach(x => g.add(beam(V(x, t, 0), V(x, H - t / 2, 0), t, t, m)));
  for (const y of [1.1, 2.25]) g.add(beam(V(-W / 2, y, 0), V(W / 2, y, 0), t * 0.85, t * 0.85, m)); // Riegel
  // Streben („Mann“-Figur)
  g.add(beam(V(-W / 2 + 0.1, t, 0), V(-W / 4, 1.1, 0), t * 0.8, t * 0.8, m), beam(V(W / 2 - 0.1, t, 0), V(W / 4, 1.1, 0), t * 0.8, t * 0.8, m));
  g.add(beam(V(-W / 4, 2.25, 0), V(0, H - 0.1, 0), t * 0.7, t * 0.7, m), beam(V(W / 4, 2.25, 0), V(0, H - 0.1, 0), t * 0.7, t * 0.7, m));
  // Gefache (Lehmputz)
  const plaster = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.98 });
  for (let i = 0; i < 4; i++) for (const [y0, y1] of [[t, 1.1], [1.1, 2.25], [2.25, H]]) {
    const x0 = posts[i], x1 = posts[i + 1];
    const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - t, y1 - y0 - t * 0.85, 0.1), plaster); p.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.02); p.receiveShadow = true; g.add(p);
  }
  // kleines Pultdach
  const roof = box(W + 0.6, 0.06, 1.0, new THREE.MeshStandardMaterial({ color: '#7a3a28', roughness: 0.85 })); roof.position.set(0, H + 0.35, 0.25); roof.rotation.x = 0.35; g.add(roof);
  const stone = box(W + 0.3, 0.4, 0.45, new THREE.MeshStandardMaterial({ color: '#8a8070', roughness: 0.95 })); stone.position.set(0, -0.2, 0); g.add(stone);
  return g;
}

export function parkett(id = 'eiche', { size = 3.2 } = {}) {
  // Französisches Fischgrät: Stäbe unter ±45°, Spitzen treffen sich auf einer Mittellinie
  const geos = []; const L = 0.45, Wd = 0.08, T = 0.02; const r = rng(3);
  const c45 = Math.SQRT1_2, colW = L * c45 * 2, step = Wd / c45, half = size / 2 - 0.12;
  for (let cx = -half + colW / 2; cx < half; cx += colW) for (let z = -half; z < half; z += step) {
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(L, T, Wd - 0.003);
      const uv = g.attributes.uv; const o = r(); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + o, uv.getY(i) * 0.12 + o * 0.7);
      g.rotateY(s * Math.PI / 4);
      g.translate(cx + s * L * c45 / 2, T / 2 + (s > 0 ? 0.0006 : 0), z);
      geos.push(g);
    }
  }
  const merged = mergeGeometries(geos);
  const mesh = new THREE.Mesh(merged, woodMat(id, { rough: 0.3, repeat: [1, 1] })); mesh.receiveShadow = mesh.castShadow = true;
  const g = new THREE.Group();
  const plinth = box(size, 0.25, size, woodMat(id, { repeat: [2, 0.2], color: '#6a5a4a' })); plinth.position.y = 0.125; g.add(plinth);
  mesh.position.y = 0.25; g.add(mesh);
  return g;
}

// ---------- Robinie ----------
function crookedLog(a, b, r0, r1, mat, seed = 1, bend = 0.12) {
  const pts = [], rad = []; const n = 8;
  for (let i = 0; i <= n; i++) { const t = i / n; const p = a.clone().lerp(b, t); const off = Math.sin(t * Math.PI) * bend; p.x += noise2(seed, t * 2) * off; p.z += noise2(t * 2, seed) * off; pts.push(p); rad.push(r0 + (r1 - r0) * t); }
  const o = newBuf(); pushTube(o, pts, rad, 10, 0.5); const m = new THREE.Mesh(bufToGeo(o), mat); m.castShadow = m.receiveShadow = true; return m;
}

export function spielplatz(id = 'robinie') {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.4, 1], rough: 0.7 }), deck = woodMat(id, { repeat: [0.2, 1] });
  const P = [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]];
  P.forEach(([x, z], i) => g.add(crookedLog(V(x, -0.3, z), V(x * 0.95, 3.0, z * 0.95), 0.12, 0.09, m, i + 1)));
  // Plattform
  for (let i = 0; i < 9; i++) { const b = box(2.3, 0.04, 0.24, deck); b.position.set(0, 1.3, -1.0 + i * 0.25); g.add(b); }
  g.add(crookedLog(V(-1.2, 1.25, -1.1), V(1.2, 1.25, -1.1), 0.07, 0.07, m, 7, 0.05), crookedLog(V(-1.2, 1.25, 1.1), V(1.2, 1.25, 1.1), 0.07, 0.07, m, 8, 0.05));
  // Brüstung
  for (const z of [-1.1, 1.1]) g.add(crookedLog(V(-1.1, 2.1, z), V(1.1, 2.1, z), 0.05, 0.05, m, 9 + z, 0.06));
  // Dach-Firstholz
  g.add(crookedLog(V(-1.3, 3.25, 0), V(1.3, 3.25, 0), 0.08, 0.08, m, 12, 0.05));
  for (const s of [-1, 1]) for (const x of [-1.1, 1.1]) g.add(crookedLog(V(x, 3.25, 0), V(x, 2.95, s * 1.15), 0.05, 0.05, m, 13 + s + x, 0.02));
  // Leiter
  for (const x of [-0.35, 0.35]) g.add(crookedLog(V(x, 0, 2.3), V(x, 1.35, 1.15), 0.05, 0.045, m, 20 + x, 0.04));
  for (let i = 1; i < 6; i++) { const t = i / 6; g.add(beam(V(-0.35, t * 1.35, 2.3 - t * 1.15), V(0.35, t * 1.35, 2.3 - t * 1.15), 0.05, 0.05, m)); }
  // Schaukel
  g.add(crookedLog(V(1.1, 3.0, 0), V(3.6, 3.0, 0), 0.09, 0.08, m, 30, 0.08));
  g.add(crookedLog(V(3.6, -0.3, -0.9), V(3.6, 3.05, 0), 0.1, 0.08, m, 31, 0.1), crookedLog(V(3.6, -0.3, 0.9), V(3.6, 3.05, 0), 0.1, 0.08, m, 32, 0.1));
  const swing = new THREE.Group(); swing.position.set(2.5, 3.0, 0);
  const rope = new THREE.MeshStandardMaterial({ color: '#c8b48a', roughness: 1 });
  for (const z of [-0.25, 0.25]) { const rr = cyl(0.012, 0.012, 2.3, rope, 6); rr.position.set(0, -1.15, z); swing.add(rr); }
  const seat = box(0.25, 0.04, 0.6, deck); seat.position.y = -2.3; swing.add(seat);
  g.add(swing);
  g.userData.update = (dt, t) => { swing.rotation.z = Math.sin(t * 1.4) * 0.35; };
  return g;
}

export function zaun(id = 'robinie', { n = 9, gap = 1.6 } = {}) {
  const g = new THREE.Group(), m = woodMat(id, { repeat: [0.3, 1], color: '#c8c0a8' });
  for (let i = 0; i < n; i++) { const p = crookedLog(V(i * gap, -0.2, 0), V(i * gap, 1.25, 0), 0.085, 0.07, m, 40 + i, 0.05); g.add(p); const cap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.12, 8), m); cap.position.set(i * gap, 1.3, 0); g.add(cap); }
  for (const y of [0.45, 0.95]) g.add(crookedLog(V(-0.1, y, 0.08), V((n - 1) * gap + 0.1, y, 0.08), 0.045, 0.045, m, 60 + y, 0.06));
  return g;
}

// ---------- Buche ----------
export function bugholzstuhl(id = 'buche') {
  const g = new THREE.Group();
  const m = woodMat(id, { repeat: [0.2, 1], rough: 0.35, color: '#a0603a' });
  const tube = (pts, r) => { const c = new THREE.CatmullRomCurve3(pts); const ms = new THREE.Mesh(new THREE.TubeGeometry(c, 48, r, 10), m); ms.castShadow = true; return ms; };
  // Sitzring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 10, 48), m); ring.rotation.x = Math.PI / 2; ring.position.y = 0.46; g.add(ring);
  const cane = canvas(256, 256), cx = cane.getContext('2d'); cx.fillStyle = '#d8b878'; cx.fillRect(0, 0, 256, 256); cx.strokeStyle = '#8a6a38'; cx.lineWidth = 2;
  for (let i = -256; i < 512; i += 10) { cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i + 256, 256); cx.stroke(); cx.beginPath(); cx.moveTo(i, 256); cx.lineTo(i + 256, 0); cx.stroke(); cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i, 256); cx.stroke(); }
  const seat = new THREE.Mesh(new THREE.CircleGeometry(0.205, 40), new THREE.MeshStandardMaterial({ map: texFromCanvas(cane, { repeat: [2, 2] }), roughness: 0.8 })); seat.rotation.x = -Math.PI / 2; seat.position.y = 0.465; g.add(seat);
  // Hinterbeine gehen in die Lehne über (ein gebogenes Stück)
  g.add(tube([V(-0.17, 0, -0.26), V(-0.18, 0.3, -0.2), V(-0.18, 0.46, -0.17), V(-0.17, 0.75, -0.22), V(-0.12, 0.9, -0.26), V(0, 0.95, -0.27), V(0.12, 0.9, -0.26), V(0.17, 0.75, -0.22), V(0.18, 0.46, -0.17), V(0.18, 0.3, -0.2), V(0.17, 0, -0.26)], 0.016));
  g.add(tube([V(-0.13, 0.48, -0.19), V(-0.13, 0.65, -0.22), V(0, 0.72, -0.24), V(0.13, 0.65, -0.22), V(0.13, 0.48, -0.19)], 0.012));
  for (const x of [-0.15, 0.15]) g.add(tube([V(x, 0.45, 0.15), V(x * 1.1, 0.2, 0.18), V(x * 1.25, 0, 0.22)], 0.017));
  const legRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 8, 48), m); legRing.rotation.x = Math.PI / 2; legRing.position.set(0, 0.2, -0.01); g.add(legRing);
  g.scale.setScalar(1.7);
  return g;
}

export function werkzeuge(id = 'buche') {
  const g = new THREE.Group();
  const m = woodMat(id, { repeat: [0.15, 1], rough: 0.4 });
  const steel = metal('#9aa0a6', 0.3);
  // Hammer
  const h = new THREE.Group();
  const handle = cyl(0.018, 0.022, 0.42, m, 12); handle.position.y = 0.21; h.add(handle);
  const head = box(0.16, 0.04, 0.04, steel); head.position.set(0.02, 0.43, 0); h.add(head);
  const face = cyl(0.024, 0.024, 0.03, steel, 14); face.rotation.z = Math.PI / 2; face.position.set(0.105, 0.43, 0); h.add(face);
  h.rotation.z = 0.5; h.position.set(-0.22, 0, 0); h.scale.setScalar(2.2);
  // Beil
  const b = new THREE.Group();
  const hp = [V(0, 0, 0), V(0.01, 0.2, 0), V(-0.01, 0.4, 0), V(0.015, 0.55, 0)];
  const hm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 24, 0.018, 10), m); b.add(hm);
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.05, 0); s.quadraticCurveTo(0.13, -0.04, 0.16, -0.1); s.lineTo(0.17, 0.1); s.quadraticCurveTo(0.12, 0.05, 0.05, 0.06); s.lineTo(0, 0.06); s.lineTo(0, 0);
  const ax = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004 }), steel); ax.position.set(-0.015, 0.5, -0.011); b.add(ax);
  b.rotation.z = -0.4; b.position.set(0.25, 0, 0); b.scale.setScalar(2.2);
  g.add(h, b);
  return g;
}

// morscher Buchenstamm mit Zunderschwämmen (Dauerhaftigkeitsklasse 5 im Außenbereich)
export function morscherStamm(barkMaterial) {
  const g = new THREE.Group();
  const log = cyl(0.42, 0.48, 4.5, barkMaterial, 18); log.rotation.z = Math.PI / 2; log.position.y = 0.38; log.material = barkMaterial.clone(); log.material.color = new THREE.Color('#6a6a5a'); g.add(log);
  const rot = new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 });
  const end = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), rot); end.position.set(2.26, 0.38, 0); end.rotation.y = Math.PI / 2; g.add(end);
  const fm = new THREE.MeshStandardMaterial({ color: '#b8a888', roughness: 0.9 });
  const r = rng(12);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), fm); f.scale.set(r.range(0.6, 1.2), 0.45, r.range(0.6, 1)); f.position.set(r.range(-1.8, 1.8), 0.38 + r.range(0.0, 0.3), 0.44); f.rotation.x = Math.PI / 2 - 0.2; f.castShadow = true; g.add(f); }
  return g;
}
