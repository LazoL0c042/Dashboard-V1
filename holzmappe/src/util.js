import * as THREE from 'three';

// ---------- Zufall & Rauschen ----------
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
  r.range = (a, b) => a + (b - a) * r();
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  return r;
}

const PERM = new Uint8Array(512);
(() => { const p = []; const r = rng(1337); for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; })();
const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function noise2(x, y) {
  const F2 = 0.3660254, G = 0.2113249;
  const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s);
  const t = (i + j) * G, x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + G, y1 = y0 - j1 + G, x2 = x0 - 1 + 2 * G, y2 = y0 - 1 + 2 * G;
  const ii = i & 255, jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 > 0) { const g = G2[PERM[ii + PERM[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 > 0) { const g = G2[PERM[ii + i1 + PERM[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 > 0) { const g = G2[PERM[ii + 1 + PERM[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
  return 70 * n; // ~[-1,1]
}
export function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}
// kachelbares Rauschen (periodisch in x über Periode px)
export function fbmTileX(u, v, px, oct = 4) {
  const a = u * Math.PI * 2;
  const r = px / (Math.PI * 2);
  // Zylinder-Mapping: zwei 2D-Rauschen gemischt
  return fbm(Math.cos(a) * r + 31.7, v + Math.sin(a) * r, oct);
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = t => 1 - Math.pow(1 - t, 3);

// ---------- Canvas-Helfer ----------
export function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function col(hex) { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; }
function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

export function texFromCanvas(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Normalmap aus Höhenfeld (Float32Array w*h, 0..1)
function normalFromHeight(hf, w, h, strength = 2) {
  const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = hf[y * w + ((x - 1 + w) % w)], r = hf[y * w + ((x + 1) % w)];
    const u = hf[((y - 1 + h) % h) * w + x], dn = hf[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const CACHE = new Map();
function cached(key, fn) { if (!CACHE.has(key)) CACHE.set(key, fn()); return CACHE.get(key); }

// ---------- Holz (Längsfläche) ----------
// spec: { early, late, heart?, sap?, contrast, rings, rays, pores, figure }
export function woodTextures(id, spec, size = 512) {
  return cached('wood:' + id + size, () => {
    const w = size, h = size, c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    const hf = new Float32Array(w * h);
    const E = col(spec.early), L = col(spec.late);
    const rings = spec.rings || 14, con = spec.contrast ?? 0.7;
    const r = rng(id.length * 97 + 3);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const warp = fbmTileX(u * 0.7, v * 0.5, 2.0, 3) * 0.07 + fbmTileX(u * 2.2, v * 1.5, 4, 2) * 0.012;
        // Fladerung (Kathedralen) – Abstand zur gedachten Markröhre unter der Oberfläche
        const cath = spec.figure ? Math.sin(v * Math.PI * 2) * 0.10 * spec.figure : 0;
        let ph = (Math.abs(u - 0.5 + warp) + Math.abs(cath) * (0.6 - Math.abs(u - 0.5))) * rings;
        let t = ph - Math.floor(ph);
        let late = smooth(0.62, 0.88, t) * (1 - smooth(0.95, 1.0, t));
        late = Math.pow(late, spec.sharp || 1.0);
        let cc = mix3(E, L, late * con);
        // Poren / Feinstruktur
        const fine = noise2(u * 220, v * 12) * 0.5 + noise2(u * 60, v * 900) * 0.25;
        const pore = spec.pores ? smooth(0.55, 0.9, noise2(u * 400, v * 30)) * spec.pores * (0.4 + late) : 0;
        let k = 1 + fine * 0.06 - pore * 0.35;
        // Spiegel / Holzstrahlen
        if (spec.rays) { const ry = smooth(0.82, 0.95, noise2(u * 40, v * 160)) * spec.rays; cc = mix3(cc, mix3(E, [255, 245, 225], 0.3), ry * 0.6); }
        const cv = fbm(u * 3 + 10, v * 2, 3) * 0.08;
        k *= 1 + cv;
        const i = (y * w + x) * 4;
        d[i] = clamp(cc[0] * k, 0, 255); d[i + 1] = clamp(cc[1] * k, 0, 255); d[i + 2] = clamp(cc[2] * k, 0, 255); d[i + 3] = 255;
        hf[y * w + x] = 0.5 + late * 0.25 - pore * 0.3 + fine * 0.05;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Äste
    if (spec.knots) {
      for (let n = 0; n < spec.knots; n++) {
        const kx = r() * w, ky = r() * h, kr = r.range(5, 12) * size / 512;
        const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr * 2.2);
        g.addColorStop(0, `rgba(${L[0] * 0.6},${L[1] * 0.5},${L[2] * 0.45},0.95)`);
        g.addColorStop(0.45, `rgba(${L[0] * 0.8},${L[1] * 0.7},${L[2] * 0.6},0.7)`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(kx, ky, kr * 1.6, kr * 2.4, 0, 0, 7); ctx.fill();
      }
    }
    return { map: texFromCanvas(c), normal: texFromCanvas(normalFromHeight(hf, w, h, 3), { srgb: false }) };
  });
}

// ---------- Hirnholz / Stammscheibe ----------
export function endGrainCanvas(id, spec, { cracks = 0, crackWidth = 0.02, size = 512, seed = 7 } = {}) {
  const w = size, c = canvas(w, w), ctx = c.getContext('2d'), img = ctx.createImageData(w, w), d = img.data;
  const H = col(spec.heart || spec.late), S = col(spec.sap || spec.early), E = col(spec.early), L = col(spec.late), B = col(spec.barkCol || '#4a3628');
  const rings = spec.endRings || 32, sapR = spec.sapRatio ?? 0.25;
  const r = rng(seed);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const px = x / w - 0.5, py = y / w - 0.5;
    const a = Math.atan2(py, px);
    let rr = Math.hypot(px, py) * 2 + fbm(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 3) * 0.04;
    const i = (y * w + x) * 4;
    if (rr > 1) { d[i + 3] = 0; continue; }
    if (rr > 0.93) { const n = noise2(a * 30, rr * 40); const b = mix3(B, [20, 15, 10], 0.3 + n * 0.3); d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; d[i + 3] = 255; continue; }
    const ph = rr * rings, t = ph - Math.floor(ph);
    const late = smooth(0.65, 0.9, t) * (1 - smooth(0.96, 1, t));
    const base = rr < 1 - sapR ? mix3(H, mix3(H, S, 0.2), rr / (1 - sapR) * 0.3) : S;
    let cc = mix3(base, mix3(base, L, 0.85), late * (spec.contrast ?? 0.7));
    if (spec.rays) { const ry = smooth(0.86, 0.97, noise2(a * 140, rr * 3)); cc = mix3(cc, mix3(base, [255, 240, 220], 0.35), ry * spec.rays); }
    if (spec.pores) { const p = smooth(0.6, 0.9, noise2(x * 0.9, y * 0.9)) * (1 - late) * spec.pores * (t < 0.25 ? 1 : 0.2); cc = mix3(cc, [40, 28, 18], p * 0.5); }
    if (spec.resinDots) { const p = smooth(0.92, 0.99, noise2(x * 0.5 + 9, y * 0.5)); cc = mix3(cc, [120, 70, 20], p * 0.6); }
    const k = 1 + noise2(x * 0.7, y * 0.7) * 0.04;
    d[i] = cc[0] * k; d[i + 1] = cc[1] * k; d[i + 2] = cc[2] * k; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Schwindrisse: V-förmig von außen nach innen (tangential schwindet stärker als radial)
  ctx.save(); ctx.translate(w / 2, w / 2);
  for (let k = 0; k < cracks; k++) {
    const a = (k / cracks) * Math.PI * 2 + r.range(-0.4, 0.4);
    const len = r.range(0.25, 0.55) * w / 2, wid = crackWidth * w * r.range(0.6, 1.2);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(w * 0.47, 0, w * 0.47 - len, 0);
    g.addColorStop(0, 'rgba(18,10,4,0.95)'); g.addColorStop(1, 'rgba(30,18,8,0.5)');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(w * 0.47, -wid); ctx.lineTo(w * 0.47 - len, 0); ctx.lineTo(w * 0.47, wid); ctx.closePath(); ctx.fill();
    ctx.rotate(-a);
  }
  // Markriss
  if (cracks > 0) { ctx.strokeStyle = 'rgba(20,12,5,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.03, -w * 0.01); ctx.lineTo(w * 0.04, w * 0.015); ctx.stroke(); }
  ctx.restore();
  return c;
}

// ---------- Rinde ----------
// kind: plates | scales | smooth | furrow | deepfurrow | net | beech
export function barkTextures(kind, base, dark, size = 512) {
  return cached('bark:' + kind + base + dark, () => {
    const w = size, h = size * 2, c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    const hf = new Float32Array(w * h);
    const Bc = col(base), Dc = col(dark);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h * 2; let ht = 0.5;
      const nn = (s, t, o = 3) => fbmTileX(u * s, v * t, s, o);
      switch (kind) {
        case 'plates': { // Kiefer unten: grobe Platten mit tiefen Rissen
          const a = Math.abs(nn(5, 1.6)), b = Math.abs(nn(9, 4));
          ht = smooth(0.02, 0.18, a) * 0.7 + smooth(0.0, 0.2, b) * 0.3 + nn(30, 30, 2) * 0.08; break; }
        case 'scales': { // Fichte: feine runde Schuppen
          const s = Math.abs(fbmTileX(u * 14, v * 22, 14, 2)); ht = smooth(0.0, 0.35, s) * 0.8 + nn(40, 40, 2) * 0.1; break; }
        case 'smooth': { // Tanne: glatt, silbrig, Lentizellen
          ht = 0.6 + nn(4, 3) * 0.1 + smooth(0.75, 0.9, noise2(u * 80, v * 300)) * -0.25; break; }
        case 'beech': { // Buche: glatt, marmoriert, Querwülste
          ht = 0.65 + nn(3, 1) * 0.06 + Math.sin(v * 70 + nn(4, 2) * 5) * 0.015 + smooth(0.7, 0.95, noise2(u * 18, v * 70)) * -0.15; break; }
        case 'furrow': { // Lärche/Douglasie: tiefe, borkige Längsrisse, rötlich innen
          const f = Math.abs(Math.sin((u * 9 + nn(3, 1.2) * 1.8) * Math.PI));
          ht = smooth(0.05, 0.6, f) * 0.85 + nn(20, 8, 2) * 0.12 + smooth(0.5, 0.9, noise2(u * 30, v * 6)) * -0.2; break; }
        case 'deepfurrow': { // Eiche: tiefe Längsfurchen, blockig
          const f = Math.abs(Math.sin((u * 8 + nn(2.5, 0.8) * 2.2) * Math.PI));
          const blocks = smooth(0.0, 0.15, Math.abs(Math.sin(v * 28 + nn(6, 3) * 4)));
          ht = smooth(0.1, 0.7, f) * (0.6 + 0.4 * blocks) + nn(25, 25, 2) * 0.1; break; }
        case 'net': { // Robinie: netzartig verflochtene, sehr tiefe Furchen
          const f1 = Math.abs(Math.sin((u * 7 + nn(2, 0.7) * 2.6) * Math.PI));
          const f2 = Math.abs(Math.sin((u * 7 - nn(2.2, 0.9) * 2.6 + 0.5) * Math.PI));
          ht = smooth(0.0, 0.5, Math.min(f1, f2)) * 0.9 + nn(18, 10, 2) * 0.1; break; }
      }
      ht = clamp(ht, 0, 1);
      hf[y * w + x] = ht;
      let cc = mix3(Dc, Bc, ht);
      if (kind === 'furrow') cc = mix3(cc, [150, 70, 40], (1 - ht) * 0.35);
      if (kind === 'beech') cc = mix3(cc, [90, 110, 80], smooth(0.4, 0.8, nn(5, 3)) * 0.25);
      if (kind === 'smooth') cc = mix3(cc, [110, 130, 110], smooth(0.5, 0.8, nn(4, 2)) * 0.15);
      const k = 1 + noise2(x * 0.9, y * 0.9) * 0.05;
      const i = (y * w + x) * 4; d[i] = cc[0] * k; d[i + 1] = cc[1] * k; d[i + 2] = cc[2] * k; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: texFromCanvas(c), normal: texFromCanvas(normalFromHeight(hf, w, h, kind === 'smooth' || kind === 'beech' ? 2 : 6), { srgb: false }) };
  });
}

// ---------- Laub & Nadeln (Karten mit Alpha) ----------
// kind: spray | flatspray | pine | larch | oak | beech | robinia | grass | fern
export function foliageTexture(kind, color, color2) {
  return cached('fol:' + kind + color + color2, () => {
    const S = 512, c = canvas(S, S), ctx = c.getContext('2d');
    const r = rng(kind.length * 31 + 5);
    const C1 = new THREE.Color(color), C2 = new THREE.Color(color2 || color);
    const css = (cc, a = 1, k = 1) => `rgba(${Math.min(255, cc.r * 255 * k) | 0},${Math.min(255, cc.g * 255 * k) | 0},${Math.min(255, cc.b * 255 * k) | 0},${a})`;
    const shade = () => { const t = r(); const cc = C1.clone().lerp(C2, t); return css(cc, 1, r.range(0.75, 1.25)); };
    ctx.lineCap = 'round';
    const needleTwig = (x0, y0, x1, y1, nlen, spacing, spread, width, droop = 0) => {
      ctx.strokeStyle = 'rgba(90,60,35,1)'; ctx.lineWidth = width * 1.6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const len = Math.hypot(x1 - x0, y1 - y0), ax = (x1 - x0) / len, ay = (y1 - y0) / len;
      for (let s = 0; s < len; s += spacing) {
        const px = x0 + ax * s, py = y0 + ay * s, f = 1 - (s / len) * 0.45;
        for (const side of [-1, 1]) {
          const ang = Math.atan2(ay, ax) + side * (spread + r.range(-0.2, 0.2));
          const l = nlen * f * r.range(0.8, 1.1);
          ctx.strokeStyle = shade(); ctx.lineWidth = width;
          ctx.beginPath(); ctx.moveTo(px, py);
          ctx.quadraticCurveTo(px + Math.cos(ang) * l * 0.6, py + Math.sin(ang) * l * 0.6 + droop, px + Math.cos(ang) * l, py + Math.sin(ang) * l + droop * 2); ctx.stroke();
        }
      }
    };
    const leaf = (x, y, ang, L, W, shape) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, shade()); g.addColorStop(1, shade());
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
      if (shape === 'oak') {
        const lobes = 5;
        for (let i = 0; i <= lobes; i++) { const t = i / lobes; const w0 = W * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) * (i % 2 ? 0.55 : 1); ctx.quadraticCurveTo(L * (t - 0.08), -w0 * 1.2, L * t, -w0 * (i % 2 ? 0.5 : 1)); }
        for (let i = lobes; i >= 0; i--) { const t = i / lobes; const w0 = W * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) * (i % 2 ? 0.55 : 1); ctx.quadraticCurveTo(L * (t + 0.08), w0 * 1.2, L * t, w0 * (i % 2 ? 0.5 : 1)); }
      } else {
        ctx.bezierCurveTo(L * 0.25, -W, L * 0.75, -W * 0.9, L, 0);
        ctx.bezierCurveTo(L * 0.75, W * 0.9, L * 0.25, W, 0, 0);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,220,0.25)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.95, 0); ctx.stroke();
      if (shape !== 'robinia') for (let i = 1; i < 7; i++) { const t = i / 7; ctx.beginPath(); ctx.moveTo(L * t, 0); ctx.lineTo(L * (t + 0.08), -W * 0.6); ctx.moveTo(L * t, 0); ctx.lineTo(L * (t + 0.08), W * 0.6); ctx.stroke(); }
      ctx.restore();
    };
    switch (kind) {
      case 'spray': // Fichte / Douglasie: Zweig mit rundum stehenden Nadeln, nach oben gebogen
        for (let k = 0; k < 5; k++) { const x0 = 256 + r.range(-40, 40), y0 = 500; needleTwig(x0, y0, x0 + r.range(-120, 120), r.range(40, 160), 34, 5, 0.9, 3, -1); }
        break;
      case 'flatspray': // Tanne: flach gescheitelte Nadeln
        for (let k = 0; k < 4; k++) { const x0 = 256 + r.range(-30, 30); needleTwig(x0, 505, x0 + r.range(-140, 140), r.range(30, 120), 40, 6, 1.45, 4.5); }
        break;
      case 'pine': // Kiefer: Nadelbüschel, von oben gesehen sternförmig, mit Lücken
        for (let k = 0; k < 9; k++) {
          const bx = r.range(90, 422), by = r.range(90, 422);
          ctx.strokeStyle = 'rgba(120,75,40,1)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(256, 500); ctx.quadraticCurveTo((256 + bx) / 2 + r.range(-40, 40), (500 + by) / 2, bx, by); ctx.stroke();
          for (let n = 0; n < 90; n++) { const a = r.range(0, 6.283), l = r.range(40, 85); ctx.strokeStyle = shade(); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(a) * l * 0.5 + r.range(-4, 4), by + Math.sin(a) * l * 0.5 + r.range(-4, 4), bx + Math.cos(a) * l, by + Math.sin(a) * l); ctx.stroke(); }
        }
        break;
      case 'larch': // Lärche: Kurztriebe mit Nadelrosetten
        for (let k = 0; k < 5; k++) {
          const x0 = 256 + r.range(-40, 40), x1 = x0 + r.range(-200, 200), y1 = r.range(40, 200);
          ctx.strokeStyle = 'rgba(100,70,45,1)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, 510); ctx.lineTo(x1, y1); ctx.stroke();
          for (let s = 0.1; s < 1; s += 0.09) {
            const px = x0 + (x1 - x0) * s, py = 510 + (y1 - 510) * s;
            for (let n = 0; n < 22; n++) { const a = r.range(0, 6.28), l = r.range(18, 34); ctx.strokeStyle = shade(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l * 0.8 - 6); ctx.stroke(); }
          }
        }
        break;
      case 'oak': case 'beech': case 'robinia': {
        const twig = (x0, y0, x1, y1) => { ctx.strokeStyle = 'rgba(85,60,40,1)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + r.range(-30, 30), (y0 + y1) / 2, x1, y1); ctx.stroke(); };
        const N = kind === 'robinia' ? 4 : 5;
        for (let k = 0; k < N; k++) {
          const x0 = 256, y0 = 510, x1 = r.range(60, 452), y1 = r.range(60, 300); twig(x0, y0, x1, y1);
          if (kind === 'robinia') { // gefiederte Blätter
            const ang = Math.atan2(y1 - y0, x1 - x0);
            for (let s = 0.35; s < 1.01; s += 0.11) { const px = x0 + (x1 - x0) * s, py = y0 + (y1 - y0) * s; leaf(px, py, ang - 1.2, 38, 15, 'robinia'); leaf(px, py, ang + 1.2, 38, 15, 'robinia'); }
            leaf(x1, y1, ang, 38, 15, 'robinia');
          } else {
            const cnt = kind === 'oak' ? 5 : 6;
            for (let s = 0; s < cnt; s++) { const t = 0.4 + s / cnt * 0.6; const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t; const a = Math.atan2(y1 - y0, x1 - x0) + r.sign() * r.range(0.5, 1.1); leaf(px, py, a, kind === 'oak' ? r.range(85, 110) : r.range(70, 95), kind === 'oak' ? 32 : 30, kind); }
          }
        }
        break; }
      case 'fern':
        for (let k = 0; k < 5; k++) { const ang = -Math.PI / 2 + (k - 2) * 0.45; const L = r.range(330, 450); const x1 = 256 + Math.cos(ang) * L, y1 = 510 + Math.sin(ang) * L * 0.95;
          ctx.strokeStyle = shade(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(256, 510); ctx.lineTo(x1, y1); ctx.stroke();
          for (let s = 0.1; s < 1; s += 0.05) { const px = 256 + (x1 - 256) * s, py = 510 + (y1 - 510) * s, l = (1 - s) * 70 + 10; for (const side of [-1, 1]) { const a = ang + side * 1.2; ctx.fillStyle = shade(); ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * l / 2, py + Math.sin(a) * l / 2, l / 2, 5, a, 0, 7); ctx.fill(); } } }
        break;
    }
    return texFromCanvas(c, { aniso: 4 });
  });
}

// weiche Punkte/Wolken/Nebel
export function softTexture(kind = 'dot') {
  return cached('soft:' + kind, () => {
    const S = kind === 'dot' ? 64 : 256, c = canvas(S, S), ctx = c.getContext('2d');
    if (kind === 'dot') { const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); }
    else if (kind === 'cloud' || kind === 'mist') {
      const img = ctx.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = x / S - 0.5, v = y / S - 0.5; const fall = 1 - smooth(0.15, 0.5, Math.hypot(u, v * (kind === 'mist' ? 2.2 : 1.4)));
        const n = fbm(x / S * 4 + 3, y / S * 4, 5) * 0.5 + 0.5;
        const a = clamp(fall * smooth(0.3, 0.8, n + fall * 0.3), 0, 1);
        const i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255;
      }
      ctx.putImageData(img, 0, 0);
    } else if (kind === 'shaft') {
      const g = ctx.createLinearGradient(0, 0, S, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      const g2 = ctx.createLinearGradient(0, 0, 0, S); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.15, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = g2; ctx.fillRect(0, 0, S, S);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
}

// Leder, Papier, Metall
export function leatherTexture(color = '#5a2e1c') {
  return cached('leather' + color, () => {
    const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data, hf = new Float32Array(S * S);
    const B = col(color);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = Math.abs(fbm(x / 22, y / 22, 3)); const cell = smooth(0.0, 0.12, n); const big = fbm(x / 160, y / 160, 3);
      const k = 0.75 + cell * 0.3 + big * 0.2; const i = (y * S + x) * 4; d[i] = B[0] * k; d[i + 1] = B[1] * k; d[i + 2] = B[2] * k; d[i + 3] = 255; hf[y * S + x] = cell;
    }
    ctx.putImageData(img, 0, 0);
    return { map: texFromCanvas(c), normal: texFromCanvas(normalFromHeight(hf, S, S, 2), { srgb: false }) };
  });
}

export function groundTexture(c1, c2, c3, kind = 'grass') {
  return cached('ground' + c1 + c2 + c3 + kind, () => {
    const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data, hf = new Float32Array(S * S);
    const A = col(c1), B = col(c2), C = col(c3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const n1 = fbmTileX(u * 6, v * 6, 6, 4) * 0.5 + 0.5, n2 = noise2(x * 0.35, y * 0.35) * 0.5 + 0.5, n3 = fbmTileX(u * 24, v * 24, 24, 2) * 0.5 + 0.5;
      let cc = mix3(A, B, smooth(0.35, 0.7, n1));
      cc = mix3(cc, C, smooth(0.6, 0.85, n3) * (kind === 'sand' ? 0.8 : 0.5));
      const k = 0.85 + n2 * 0.3; const i = (y * S + x) * 4; d[i] = cc[0] * k; d[i + 1] = cc[1] * k; d[i + 2] = cc[2] * k; d[i + 3] = 255; hf[y * S + x] = n1 * 0.6 + n2 * 0.4;
    }
    ctx.putImageData(img, 0, 0);
    return { map: texFromCanvas(c, { repeat: [40, 40] }), normal: texFromCanvas(normalFromHeight(hf, S, S, 2.5), { srgb: false, repeat: [40, 40] }) };
  });
}

// ---------- Geometrie-Helfer ----------
// Verjüngte Röhre entlang Punktliste; schreibt in Arrays (für Merge)
export function pushTube(out, pts, radii, radial = 8, vScale = 1, colorFn = null) {
  const n = pts.length; if (n < 2) return;
  const base = out.pos.length / 3;
  const T = [], N = [], B = [];
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; T.push(b.clone().sub(a).normalize()); }
  let nrm = new THREE.Vector3(0, 0, 1); if (Math.abs(T[0].z) > 0.9) nrm.set(1, 0, 0);
  nrm = nrm.sub(T[0].clone().multiplyScalar(nrm.dot(T[0]))).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) { const ax = T[i - 1].clone().cross(T[i]); if (ax.lengthSq() > 1e-10) { ax.normalize(); const ang = Math.acos(clamp(T[i - 1].dot(T[i]), -1, 1)); nrm.applyAxisAngle(ax, ang); } }
    N.push(nrm.clone()); B.push(T[i].clone().cross(nrm).normalize());
  }
  let vacc = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) vacc += pts[i].distanceTo(pts[i - 1]);
    const r = radii[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = N[i].x * ca + B[i].x * sa, ny = N[i].y * ca + B[i].y * sa, nz = N[i].z * ca + B[i].z * sa;
      out.pos.push(pts[i].x + nx * r, pts[i].y + ny * r, pts[i].z + nz * r);
      out.nor.push(nx, ny, nz);
      out.uv.push(j / radial, vacc * vScale);
      if (out.col) { const cc = colorFn ? colorFn(pts[i], i / (n - 1)) : [1, 1, 1]; out.col.push(cc[0], cc[1], cc[2]); }
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = base + i * (radial + 1) + j, b = a + radial + 1;
    out.idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
}
export function newBuf(withColor = false) { return { pos: [], nor: [], uv: [], idx: [], col: withColor ? [] : null }; }
export function bufToGeo(o) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  if (o.col) g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  if (o.sway) g.setAttribute('sway', new THREE.Float32BufferAttribute(o.sway, 1));
  g.setIndex(o.idx);
  return g;
}
// Quad-Karte (für Laub) in Buffer
export function pushCard(out, center, dir, up, w, h, tint) {
  const base = out.pos.length / 3;
  let sv = dir.clone().cross(up);
  if (sv.lengthSq() < 1e-6) sv = dir.clone().cross(new THREE.Vector3(1, 0, 0));
  const side = sv.normalize().multiplyScalar(w / 2);
  const fwd = dir.clone().normalize().multiplyScalar(h);
  const n = side.clone().cross(fwd).normalize();
  if (n.y < 0) n.negate();
  // leicht nach oben gekippte Normale = weicheres Licht
  n.y += 0.6; n.normalize();
  const p0 = center.clone().sub(side), p1 = center.clone().add(side), p2 = p1.clone().add(fwd), p3 = p0.clone().add(fwd);
  for (const p of [p0, p1, p2, p3]) { out.pos.push(p.x, p.y, p.z); out.nor.push(n.x, n.y, n.z); if (out.col) out.col.push(tint[0], tint[1], tint[2]); }
  out.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
  if (out.sway) { out.sway.push(0.3, 0.3, 1, 1); }
  out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
