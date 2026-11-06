// Gestochene SVG-Grafiken: Logo-Siegel, Einsatz-Wappen, Kleingrafiken.
const INK = '#2a1c12';

const hatch = (id, ang = 45, gap = 3, col = INK, w = 0.7) => `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})"><line x1="0" y1="0" x2="0" y2="${gap}" stroke="${col}" stroke-width="${w}"/></pattern>`;

export function logoSVG({ size = 240, ink = INK, paper = 'none', gold = false } = {}) {
  const c = gold ? '#d8b26a' : ink;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}">
  <defs>${hatch('lh1', 45, 2.6, c, 0.6)}${hatch('lh2', -45, 2.6, c, 0.5)}
    <path id="ring" d="M120,120 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"/>
    <path id="ringb" d="M120,120 m-74,0 a74,74 0 1,0 148,0 a74,74 0 1,0 -148,0"/>
  </defs>
  ${paper !== 'none' ? `<circle cx="120" cy="120" r="118" fill="${paper}"/>` : ''}
  <circle cx="120" cy="120" r="114" fill="none" stroke="${c}" stroke-width="3"/>
  <circle cx="120" cy="120" r="108" fill="none" stroke="${c}" stroke-width="0.8"/>
  ${Array.from({ length: 72 }, (_, i) => { const a = i * 5 * Math.PI / 180; return `<line x1="${120 + Math.cos(a) * 108}" y1="${120 + Math.sin(a) * 108}" x2="${120 + Math.cos(a) * 113}" y2="${120 + Math.sin(a) * 113}" stroke="${c}" stroke-width="0.8"/>`; }).join('')}
  <text font-family="'IM Fell English SC','IM Fell English',Georgia,serif" font-size="21" letter-spacing="3.2" fill="${c}"><textPath href="#ring" startOffset="50%" text-anchor="middle">PETERS ✦ ZIMMEREI</textPath></text>
  <text font-family="'IM Fell English SC','IM Fell English',Georgia,serif" font-size="12" letter-spacing="4" fill="${c}"><textPath href="#ringb" startOffset="50%" text-anchor="middle">BERLIN ✦ HOLZMAPPE</textPath></text>
  <circle cx="120" cy="120" r="68" fill="none" stroke="${c}" stroke-width="1.6"/>
  <!-- Jahrringe -->
  <g fill="none" stroke="${c}" stroke-width="0.7" opacity="0.85">
    ${[8, 15, 21, 28, 34, 41, 47, 54, 60].map((r, i) => `<path d="M${120 - r},120 a${r},${r * 0.98} 0 1,1 ${2 * r},0 a${r},${r * 1.02} 0 1,1 ${-2 * r},0" stroke-width="${i % 2 ? 0.5 : 1}"/>`).join('')}
  </g>
  <circle cx="120" cy="120" r="66" fill="url(#lh1)" opacity="0.22"/>
  <!-- Zimmermannswinkel -->
  <g transform="rotate(-38 120 120)">
    <path d="M78,96 h88 v10 h-78 v58 h-10 z" fill="${gold ? '#c9a45a' : '#f3e7cf'}" stroke="${c}" stroke-width="1.6"/>
    <path d="M78,96 h88 v10 h-78 v58 h-10 z" fill="url(#lh2)" opacity="0.35"/>
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${92 + i * 8}" y1="96" x2="${92 + i * 8}" y2="${i % 2 ? 100 : 102}" stroke="${c}" stroke-width="0.8"/>`).join('')}
  </g>
  <!-- Breitbeil -->
  <g transform="rotate(32 120 120)">
    <rect x="116" y="70" width="8" height="100" rx="3" fill="${gold ? '#a37a3a' : '#e8d6b0'}" stroke="${c}" stroke-width="1.5"/>
    <rect x="116" y="70" width="8" height="100" fill="url(#lh1)" opacity="0.4"/>
    <path d="M110,70 q-30,4 -38,30 q20,-6 38,-6 z" fill="${gold ? '#d7c08a' : '#d9d2c4'}" stroke="${c}" stroke-width="1.6"/>
    <path d="M110,70 q-30,4 -38,30 q20,-6 38,-6 z" fill="url(#lh2)" opacity="0.45"/>
    <rect x="109" y="66" width="22" height="30" rx="2" fill="${gold ? '#c9a45a' : '#cfc6b6'}" stroke="${c}" stroke-width="1.6"/>
  </g>
  </svg>`;
}

// Einsatz-Wappen: kind = innen|aussen|tragend|dekorativ, state = ja|bedingt|nein
export function emblemSVG(kind, state = 'ja', { size = 90, ink = INK, fill = '#f3e7cf' } = {}) {
  const op = state === 'nein' ? 0.35 : 1;
  let body = '';
  switch (kind) {
    case 'innen': body = `<path d="M24,58 L50,34 L76,58" fill="none" stroke="${ink}" stroke-width="3"/><rect x="31" y="56" width="38" height="28" fill="url(#eh)" stroke="${ink}" stroke-width="2.2"/><rect x="45" y="66" width="10" height="18" fill="${fill}" stroke="${ink}" stroke-width="1.6"/><path d="M36,62 h6 v6 h-6 z M58,62 h6 v6 h-6 z" fill="${fill}" stroke="${ink}" stroke-width="1.2"/>`; break;
    case 'aussen': body = `<circle cx="40" cy="44" r="10" fill="url(#eh)" stroke="${ink}" stroke-width="2"/>${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${40 + Math.cos(a) * 14}" y1="${44 + Math.sin(a) * 14}" x2="${40 + Math.cos(a) * 19}" y2="${44 + Math.sin(a) * 19}" stroke="${ink}" stroke-width="2"/>`; }).join('')}<path d="M52,58 q4,-12 16,-8 q10,0 10,10 q6,2 4,9 h-30 q-6,-4 0,-11 z" fill="${fill}" stroke="${ink}" stroke-width="2"/>${[58, 66, 74].map(x => `<line x1="${x}" y1="74" x2="${x - 3}" y2="82" stroke="${ink}" stroke-width="1.8"/>`).join('')}`; break;
    case 'tragend': body = `<path d="M50,24 v18 M44,36 l6,8 l6,-8" fill="none" stroke="${ink}" stroke-width="2.6"/><rect x="20" y="48" width="60" height="12" fill="url(#eh)" stroke="${ink}" stroke-width="2.2"/><path d="M22,60 l-6,20 h18 z M78,60 l-6,20 h18 z" fill="${fill}" stroke="${ink}" stroke-width="2"/><line x1="12" y1="82" x2="88" y2="82" stroke="${ink}" stroke-width="2"/>`; break;
    case 'dekorativ': body = `${Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return `<ellipse cx="${50 + Math.cos(a) * 14}" cy="${55 + Math.sin(a) * 14}" rx="11" ry="5.5" transform="rotate(${a * 180 / Math.PI} ${50 + Math.cos(a) * 14} ${55 + Math.sin(a) * 14})" fill="url(#eh)" stroke="${ink}" stroke-width="1.8"/>`; }).join('')}<circle cx="50" cy="55" r="6" fill="${fill}" stroke="${ink}" stroke-width="2"/>`; break;
  }
  const ring = state === 'bedingt' ? `stroke-dasharray="5 4"` : '';
  const cross = state === 'nein' ? `<line x1="22" y1="22" x2="78" y2="88" stroke="#7a1c10" stroke-width="5" stroke-linecap="round"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" width="${size}" height="${size * 1.1}">
    <defs>${hatch('eh', 45, 3, ink, 0.7)}</defs>
    <path d="M10,8 h80 v50 q0,36 -40,48 q-40,-12 -40,-48 z" fill="${fill}" stroke="${ink}" stroke-width="3" ${ring}/>
    <path d="M15,13 h70 v45 q0,31 -35,42 q-35,-11 -35,-42 z" fill="none" stroke="${ink}" stroke-width="0.8"/>
    <g opacity="${op}">${body}</g>${cross}</svg>`;
}

export const EINSATZ_LABEL = { innen: 'Innen', aussen: 'Außen', tragend: 'Tragend', dekorativ: 'Dekorativ' };
export const STATE_LABEL = { ja: 'geeignet', bedingt: 'bedingt', nein: 'ungeeignet' };

// Schwund-Querschnitt (SVG): radial/tangential als Pfeile, Verformung
export function shrinkSVG(h, { w = 260 } = {}) {
  const t = h.schwund.tangential, rr = h.schwund.radial;
  const k = 4.2; // Darstellungsfaktor
  const sq = 80;
  const dt = t * k * 0.5, dr = rr * k * 0.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 196" width="${w}">
    <defs>${hatch('sh', 45, 3, INK, 0.5)}</defs>
    <g transform="translate(70,95)">
      ${[14, 24, 34, 44, 54, 64].map(r => `<path d="M${-r},60 A${r},${r} 0 0 1 ${r},60" transform="translate(0,${-60})" fill="none" stroke="#b98f5c" stroke-width="0.8" opacity="0.6"/>`).join('')}
      <rect x="${-sq / 2}" y="${-sq / 2}" width="${sq}" height="${sq}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="M${-sq / 2 + dt},${-sq / 2 + dr} L${sq / 2 - dt},${-sq / 2 + dr} L${sq / 2 - dt},${sq / 2 - dr} L${-sq / 2 + dt},${sq / 2 - dr} Z" fill="url(#sh)" stroke="${INK}" stroke-width="1.6"/>
      <line x1="${-sq / 2 - 8}" y1="${sq / 2 + 14}" x2="${sq / 2 + 8}" y2="${sq / 2 + 14}" stroke="${INK}" stroke-width="1.2"/>
    </g>
    <text x="70" y="186" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="${INK}">tangential ${String(t).replace('.', ',')} %</text>
    <text x="10" y="98" font-family="Georgia,serif" font-size="11" fill="${INK}" transform="rotate(-90 10 98)" text-anchor="middle">radial ${String(rr).replace('.', ',')} %</text>
    <g transform="translate(150,30)" font-family="Georgia,serif" font-size="11" fill="${INK}">
      <text x="0" y="0" font-weight="bold">Gesamtschwindung</text>
      <text x="0" y="16">frisch → darrtrocken</text>
      <rect x="0" y="28" width="${rr * 9}" height="10" fill="url(#sh)" stroke="${INK}"/><text x="${rr * 9 + 5}" y="37">radial ${String(rr).replace('.', ',')} %</text>
      <rect x="0" y="44" width="${t * 9}" height="10" fill="${INK}" opacity="0.75"/><text x="${t * 9 + 5}" y="53">tang. ${String(t).replace('.', ',')} %</text>
      <text x="0" y="82">gestrichelt: frisch</text><text x="0" y="96">schraffiert: trocken</text><text x="0" y="110">(Querschnitt überzeichnet)</text>
    </g></svg>`;
}

// Härte-Skala: alle Hölzer, aktuelles hervorgehoben
export function hardnessSVG(all, current, { w = 300 } = {}) {
  const max = 50, rows = [...all].sort((a, b) => a.brinellNum - b.brinellNum);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 ${rows.length * 20 + 26}" width="${w}">
    <defs>${hatch('hh', 45, 3, INK, 0.6)}</defs>
    ${rows.map((h, i) => { const y = i * 20 + 6, bw = h.brinellNum / max * 190, me = h.id === current; return `<text x="72" y="${y + 11}" text-anchor="end" font-family="Georgia,serif" font-size="11" fill="${INK}" ${me ? 'font-weight="bold"' : ''}>${h.name}</text><rect x="78" y="${y}" width="${bw}" height="13" fill="${me ? '#7a3a14' : 'url(#hh)'}" stroke="${INK}" stroke-width="${me ? 1.4 : 0.8}"/><text x="${84 + bw}" y="${y + 11}" font-family="Georgia,serif" font-size="11" fill="${INK}">${h.brinellNum}</text>`; }).join('')}
    <text x="78" y="${rows.length * 20 + 22}" font-family="Georgia,serif" font-size="10" fill="${INK}">Brinell-Härte quer zur Faser in N/mm²</text></svg>`;
}

// SVG → Canvas (für 3D-Texturen)
export function svgToImage(svg) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
