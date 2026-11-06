import { Engine } from './engine.js';
import { buildRealm } from './realms.js';
import { buildProlog, buildMap, buildWerkstatt } from './special.js';
import { buildLife } from './life.js';
import { lebensModell, WUCHSKLASSEN, LEBEN, QUELLEN } from './data.js';
import { Ambience } from './audio.js';
import { HOELZER } from './data.js';
import { detailHTML, tocHTML, mappeHTML, chapterLabel } from './pages.js';
import { logoSVG } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('holzmappe.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('holzmappe.' + k, JSON.stringify(v)); } catch (e) { /* privat */ } },
};

const app = {
  engine: null, audio: new Ambience(), mode: null, visited: new Set(store.get('visited', [])),
  busy: false, page: 0, pages: [],
};
window.__app = app;

// ---------- Hilfen ----------
function veil(on, text = 'Die Welt entsteht …') {
  const v = $('#veil'); $('#veil .vt').textContent = text; v.classList.toggle('on', on);
}
function flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function markVisited(id) { app.visited.add(id); store.set('visited', [...app.visited]); }
async function setWorld(builder, mountEl) {
  const e = app.engine;
  if (mountEl) e.mount(mountEl);
  const w = await builder();
  e.setWorld(w);
  app.audio.setMix(w.audio || {});
  return w;
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

// ---------- Detail-Overlay (Karte) ----------
function openDetail(i, ev) {
  const h = HOELZER[i], o = $('#detail');
  $('#detail .board-in').innerHTML = detailHTML(h, i);
  const x = ev ? ev.clientX : innerWidth / 2, y = ev ? ev.clientY : innerHeight / 2;
  o.style.setProperty('--ox', x + 'px'); o.style.setProperty('--oy', y + 'px');
  o.classList.add('on'); o.setAttribute('aria-hidden', 'false');
  $('#detail .board-in').scrollTop = 0;
  $('#detail .d-close').focus({ preventScroll: true });
}
function closeDetail() { const o = $('#detail'); o.classList.remove('on'); o.setAttribute('aria-hidden', 'true'); }

// ---------- Mappe ----------
function openMappe() {
  const m = $('#mappe');
  if (!m.dataset.ready) {
    m.innerHTML = mappeHTML(); m.dataset.ready = '1';
    // Im eingebetteten Artefakt ist Drucken gesperrt → Hinweis statt wirkungslosem Knopf
    let framed = true; try { framed = window.self !== window.top; } catch (e) { framed = true; }
    if (framed) { const b = m.querySelector('[data-act=print]'); const n = document.createElement('span'); n.className = 'print-note'; n.textContent = 'Drucken: Datei-Version im Browser öffnen'; b.replaceWith(n); }
  }
  m.classList.add('on'); document.body.classList.add('mappe-open'); m.scrollTop = 0;
  app.audio.setMix({ drone: 0.25, droneNote: 73, paper: 0.1 });
}
function closeMappe() { $('#mappe').classList.remove('on'); document.body.classList.remove('mappe-open'); if (app.engine && app.engine.world) app.audio.setMix(app.engine.world.audio || {}); }

// ---------- HUD ----------
function hud(state) {
  document.body.dataset.mode = state;
  $('#hud').classList.toggle('on', state !== 'prolog' && state !== 'choose');
}
function realmTitle(i) {
  const t = $('#realm-title'), h = HOELZER[i];
  if (i == null) { t.classList.remove('on'); return; }
  t.innerHTML = `<small>${chapterLabel(i)}</small><b>${h.name}</b><span>${h.reich}</span>`;
  t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
}

// ---------- Karten-Modus ----------
async function startMap() {
  app.mode = 'karte'; store.set('mode', 'karte');
  $('#book').classList.remove('on'); hud('karte'); realmTitle(null);
  $('#map-nav').classList.remove('realm');
  veil(true, 'Die Karte wird entrollt …');
  await setWorld(() => buildMap(app.engine, { visited: app.visited, onEnter: (id) => enterFromMap(id), container: $('#stage') }), $('#stage'));
  veil(false);
}
async function enterFromMap(id) {
  if (id === 'werkstatt') return enterWerkstatt($('#stage'));
  const i = HOELZER.findIndex(h => h.id === id);
  return enterRealm(i);
}
async function enterRealm(i) {
  const h = HOELZER[i]; app.current = i;
  flash(); veil(true, `${h.reich} …`);
  const w = await setWorld(() => buildRealm(h.id, app.engine), $('#stage'));
  w.onPick = (id, ev) => { if (w.handleStation(id)) return; if (id === 'tafel') openDetail(i, ev); };
  markVisited(h.id); veil(false); realmTitle(i); stationHint();
  $('#map-nav').classList.add('realm'); $('#map-nav').classList.remove('ws');
  $('#map-nav .prev').disabled = i === 0;
  $('#map-nav .next').textContent = i === HOELZER.length - 1 ? 'Zur Werkstatt →' : `${HOELZER[i + 1].name} →`;
  $('#map-nav .prev').textContent = i === 0 ? '←' : `← ${HOELZER[i - 1].name}`;
}
async function enterWerkstatt(mountEl) {
  app.current = 'werkstatt'; flash(); veil(true, 'Die Werkstatt …');
  await setWorld(() => buildWerkstatt(app.engine, () => openMappe()), mountEl);
  veil(false); realmTitle(null);
  if (app.mode === 'karte') { $('#map-nav').classList.add('realm', 'ws'); $('#map-nav .next').textContent = 'Mappe öffnen'; $('#map-nav .prev').textContent = `← ${HOELZER[7].name}`; $('#map-nav .prev').disabled = false; }
  const hint = $('#hint'); hint.textContent = 'Die Holzmappe auf der Werkbank antippen'; hint.classList.add('on'); setTimeout(() => hint.classList.remove('on'), 5000);
}

// ---------- Buch-Modus ----------
function buildPageList() {
  const P = [{ type: 'toc' }];
  HOELZER.forEach((h, i) => { P.push({ type: 'scene', i }); P.push({ type: 'detail', i }); });
  P.push({ type: 'werkstatt' });
  return P;
}
function pageEl(idx) {
  const p = app.pages[idx];
  const el = document.createElement('div'); el.className = 'page'; el.dataset.idx = idx;
  const front = document.createElement('div'); front.className = 'face front ' + p.type;
  const back = document.createElement('div'); back.className = 'face back';
  const folio = `<div class="folio">${idx + 1}</div>`;
  if (p.type === 'toc') front.innerHTML = `<div class="pg-in">${tocHTML()}</div>${folio}`;
  else if (p.type === 'scene') { const h = HOELZER[p.i]; front.innerHTML = `<header class="sc-head"><small>${chapterLabel(p.i)}</small><h2>${h.name}</h2><p><i>${h.bot}</i> · ${h.reich}</p></header><div class="pg-canvas"><div class="pg-load">Die Welt entsteht …</div></div><div class="sc-foot"><span>Werkstücke und Stationen antippen für Nahansichten · Tafel oder Umblättern für den Steckbrief</span><button class="pg-life" data-life="${p.i}">Vom Samen zum Baum ▸</button></div>${folio}`; }
  else if (p.type === 'detail') front.innerHTML = `<div class="pg-in detail-page">${detailHTML(HOELZER[p.i], p.i)}</div>${folio}`;
  else if (p.type === 'werkstatt') front.innerHTML = `<header class="sc-head"><small>Epilog</small><h2>Die Werkstatt</h2><p>Die Holzmappe liegt auf der Hobelbank.</p></header><div class="pg-canvas"></div><div class="sc-foot">Die Mappe antippen, um sie zu öffnen</div>${folio}`;
  el.append(front, back);
  const lb = el.querySelector('[data-life]'); if (lb) { lb.addEventListener('pointerdown', e => e.stopPropagation()); lb.addEventListener('click', () => enterLife(+lb.dataset.life)); }
  if (p.type === 'toc') el.querySelectorAll('[data-ch]').forEach(li => li.addEventListener('click', () => { const c = li.dataset.ch; goPage(c === 'werkstatt' ? app.pages.length - 1 : 1 + (+c) * 2); }));
  return el;
}
async function prepare(idx, el) {
  const p = app.pages[idx];
  const mount = $('.pg-canvas', el);
  if (p.type === 'scene') {
    const h = HOELZER[p.i];
    const w = await setWorld(() => buildRealm(h.id, app.engine), mount);
    w.onPick = (id) => { if (w.handleStation(id)) return; if (id === 'tafel') goPage(idx + 1); };
    markVisited(h.id); stationHint();
  } else if (p.type === 'werkstatt') await setWorld(() => buildWerkstatt(app.engine, () => openMappe()), mount);
  else app.audio.setMix({ drone: 0.3, droneNote: 73, paper: 0.15, wind: 0.1 });
  const ld = $('.pg-load', el); if (ld) ld.remove();
}
async function startBook(at = 0) {
  app.mode = 'buch'; store.set('mode', 'buch');
  hud('buch'); realmTitle(null); $('#map-nav').classList.remove('realm');
  app.pages = buildPageList();
  const book = $('#book'); book.classList.add('on');
  app.engine.clear();
  const leaves = $('#leaves'); leaves.innerHTML = '';
  app.page = at;
  const el = pageEl(at); leaves.appendChild(el);
  if (app.pages[at].type !== 'toc' && app.pages[at].type !== 'detail') veil(true);
  // Kartenansicht abbauen (Canvas lebt dann in der Buchseite)
  await prepare(at, el); veil(false);
  updateBookNav();
}
function updateBookNav() { $('#book .bn-prev').disabled = app.page === 0; $('#book .bn-next').disabled = app.page === app.pages.length - 1; $('#book .bn-pos').textContent = `${app.page + 1} / ${app.pages.length}`; }
async function goPage(target) {
  if (app.busy || target === app.page || target < 0 || target >= app.pages.length) return;
  app.busy = true;
  const leaves = $('#leaves'), cur = leaves.querySelector('.page'), fwd = target > app.page;
  const nxt = pageEl(target);
  const needs3D = ['scene', 'werkstatt'].includes(app.pages[target].type);
  const reduce = app.engine && app.engine.reducedMotion;
  if (fwd) {
    leaves.insertBefore(nxt, cur);
    if (needs3D) { await nextFrame(); await prepare(target, nxt); }
    else prepare(target, nxt);
    cur.classList.add(reduce ? 'fade-out' : 'turn-out');
    await wait(reduce ? 300 : 1000); cur.remove();
  } else {
    nxt.classList.add('turned'); leaves.appendChild(nxt);
    if (needs3D) { await nextFrame(); await prepare(target, nxt); } else prepare(target, nxt);
    await nextFrame();
    nxt.classList.remove('turned'); nxt.classList.add(reduce ? 'fade-in' : 'turn-in');
    await wait(reduce ? 300 : 1000); cur.remove(); nxt.classList.remove('turn-in', 'fade-in');
  }
  app.page = target; app.busy = false; updateBookNav();
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- Nahansichten ----------
let stHintShown = false;
function stationHint() {
  if (stHintShown) return; stHintShown = true;
  const hint = $('#hint'); hint.textContent = 'Werkstücke und Stationen antippen für Nahansichten'; hint.classList.add('on'); setTimeout(() => hint.classList.remove('on'), 5000);
}

// ---------- Lebenslauf ----------
const fmtAge = (a) => a < 1 ? (a < 0.08 ? `${Math.max(1, Math.round(a * 365))} Tage` : `${Math.max(1, Math.round(a * 12))} Monate`) : `${Math.round(a)} ${Math.round(a) === 1 ? 'Jahr' : 'Jahre'}`;
const fmtLen = (m) => m < 0.01 ? `${(m * 1000).toFixed(0)} mm` : m < 1 ? `${(m * 100).toFixed(0)} cm` : `${m.toFixed(1).replace('.', ',')} m`;
function lifeBand(id) {
  const M = lebensModell(id), band = $('#life .life-band'), marks = $('#life .life-marks');
  const segs = []; let last = null, start = 0;
  for (let i = 0; i <= 400; i++) { const s = i / 400, st = M.stage(Math.exp(s * Math.log(M.end + 1)) - 1); if (st !== last) { if (last) segs.push([last, start, s]); last = st; start = s; } }
  segs.push([last, start, 1]);
  const idx = (n) => WUCHSKLASSEN.findIndex(w => w[0] === n);
  band.innerHTML = segs.map(([n, a, b]) => `<div class="seg s${idx(n)}" style="left:${a * 100}%;width:${(b - a) * 100}%" title="${n}: ${WUCHSKLASSEN[idx(n)][1]}">${b - a > 0.07 ? `<span>${n}</span>` : ''}</div>`).join('');
  const sOf = (a) => Math.log(a + 1) / Math.log(M.end + 1);
  const mk = (a, b, label, cls) => `<div class="mk ${cls}" style="left:${sOf(a) * 100}%;width:${Math.max(0.4, (sOf(b) - sOf(a)) * 100)}%"><span>${label}</span></div>`;
  marks.innerHTML = mk(M.mann[0], M.mann[1], 'Mannbarkeit', 'm1') + mk(M.umtrieb[0], M.umtrieb[1], 'Umtriebszeit', 'm2') + mk(M.maxAge, M.maxAge, 'Höchstalter', 'm3');
}
function lifeFacts(id) {
  const L = LEBEN[id], h = HOELZER.find(x => x.id === id);
  const q = (k) => { const c = L.q[k]; return c === 'LIT' ? ' <em class="rw">Richtwert</em>' : ` <small class="qc">${c}</small>`; };
  return `<h3>${h.name}: vom Samen zum Baum</h3><dl>
    <dt>Samen & Reife</dt><dd>${L.samen}${q('samen')}</dd>
    <dt>Verbreitung</dt><dd>${L.verbreitung}</dd>
    <dt>Keimung</dt><dd>${L.keimung}${q('keimung')}</dd>
    <dt>Mannbarkeit</dt><dd>${L.mannText}${q('mann')}</dd>
    <dt>Umtriebszeit</dt><dd>${L.umtrieb[0]}–${L.umtrieb[1]} Jahre${q('umtrieb')}</dd>
    <dt>Endhöhe</dt><dd>${L.endHText}${q('endH')}</dd>
    <dt>Höchstalter</dt><dd>${L.maxAgeText}${q('maxAge')}</dd></dl>
    <p class="fn">Höhe und BHD im Zeitstrahl sind Modellkurven (Richtwerte für mittlere Standorte). Quellenkürzel siehe Quellenverzeichnis der Mappe.</p>`;
}
async function enterLife(i) {
  const h = HOELZER[i];
  app.lifeReturn = { mode: app.mode, page: app.page, i };
  $('#book').classList.remove('on'); hud('life'); realmTitle(null);
  const LF = $('#life'); LF.hidden = false; LF.dataset.phase = 'ready';
  $('#life .life-title').innerHTML = `<small>Lebenslauf</small><b>${h.name}</b>`;
  $('#life .life-facts').innerHTML = lifeFacts(h.id); $('#life .life-facts').hidden = true;
  const L = LEBEN[h.id];
  $('#life .life-seedtext').textContent = L.samen;
  lifeBand(h.id);
  flash(); veil(true, 'Die Zeit wird zurückgedreht …');
  const ui = {
    onPhase(p) { LF.dataset.phase = p; if (p === 'end') $('#life .life-endnote').hidden = false; if (p === 'ready') $('#life .life-endnote').hidden = true; },
    onPlay(on) { const b = $('#life-play'); b.textContent = on ? '❚❚ Pause' : '▶ Abspielen'; b.setAttribute('aria-pressed', on); },
    onAge(o) {
      $('#lr-age').textContent = fmtAge(o.age); $('#lr-stage').textContent = o.stage;
      $('#lr-h').textContent = o.stage === 'Totholz' || o.stage === 'Zerfall' ? '–' : fmtLen(o.h);
      $('#lr-d').textContent = o.d < 0.5 ? '–' : `${Math.round(o.d)} cm`;
      if (!app.lifeDrag) $('#life-range').value = Math.round(o.s * 1000);
      $('#life .life-endnote').textContent = o.nurseOnLog ? 'Der Kreis schließt sich: Auf dem morschen Stamm keimt die nächste Generation (Kadaververjüngung).' : 'Der Kreis schließt sich: Das Totholz wird zu Humus und Lebensraum, daneben keimt die nächste Generation.';
    },
  };
  const w = await setWorld(() => buildLife(h.id, app.engine, ui), $('#stage'));
  app.life = w; veil(false);
}
function exitLife() {
  $('#life').hidden = true; app.life = null;
  const R = app.lifeReturn || { mode: 'karte', i: 0 };
  if (R.mode === 'buch') {
    hud('buch'); $('#book').classList.add('on');
    const pg = $('#leaves .page'); if (pg) { const mount = $('.pg-canvas', pg); if (mount && !mount.querySelector('.pg-load')) { const l = document.createElement('div'); l.className = 'pg-load'; l.textContent = 'Die Welt entsteht …'; mount.appendChild(l); } prepare(app.page, pg); }
  } else { hud('karte'); enterRealm(R.i); }
}

// ---------- Prolog / Auswahl ----------
async function startProlog() {
  hud('prolog');
  veil(true, 'Die Holzmappe wird aufgeschlagen …');
  const w = await setWorld(() => buildProlog(app.engine, () => { flash(); setTimeout(showChooser, 450); }), $('#stage'));
  veil(false);
  const hint = $('#hint'); hint.textContent = 'Das Buch antippen, um die Reise zu beginnen'; hint.classList.add('on');
  w.onPick = (id) => { if (id === 'buch') { hint.classList.remove('on'); w.open(); } };
}
function showChooser() { hud('choose'); $('#chooser').classList.add('on'); }
async function choose(mode) {
  $('#chooser').classList.remove('on');
  if (mode === 'buch') await startBook(0); else if (mode === 'karte') await startMap(); else { await startMap(); openMappe(); }
}

// ---------- Start ----------
async function boot() {
  $('#hud .logo').innerHTML = logoSVG({ size: 44 });
  $('#chooser .ch-logo').innerHTML = logoSVG({ size: 120 });
  // Schriften für Canvas-Texturen abwarten (max. 2,5 s)
  try { await Promise.race([Promise.all(['400 40px "IM Fell English"', '400 40px "IM Fell English SC"', 'italic 40px "IM Fell English"'].map(f => document.fonts.load(f))), wait(2500)]); } catch (e) { /* weiter */ }
  window.__openMappe = () => { $('#nogl').classList.remove('on'); openMappe(); };
  $('#mappe').addEventListener('click', (e) => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'close-mappe') { closeMappe(); if (!app.engine || !app.engine.ok) $('#nogl').classList.add('on'); } if (a.dataset.act === 'print') window.print(); });
  app.engine = new Engine();
  if (!app.engine.ok) { $('#nogl').classList.add('on'); return; }
  // Ton-Knopf
  const snd = $('#snd');
  const setSnd = (on) => { snd.classList.toggle('on', on); snd.setAttribute('aria-pressed', on); snd.title = on ? 'Ton aus' : 'Ton an'; };
  setSnd(false);
  snd.addEventListener('click', () => { const on = app.audio.toggle(); setSnd(on); store.set('sound', on); });
  // Menü
  const menu = $('#menu');
  $('#menu-btn').addEventListener('click', () => menu.classList.toggle('on'));
  menu.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-go]'); if (!a) return; menu.classList.remove('on');
    const g = a.dataset.go;
    if (g === 'buch') startBook(0); else if (g === 'karte') startMap(); else if (g === 'mappe') openMappe(); else if (g === 'werkstatt') { if (app.mode === 'buch') goPage(app.pages.length - 1); else enterWerkstatt($('#stage')); }
  });
  // Auswahl
  $('#chooser').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) choose(b.dataset.mode); });
  // Detail-Overlay
  $('#detail').addEventListener('click', (e) => { if (e.target.id === 'detail' || e.target.closest('.d-close')) closeDetail(); });
  // Karten-Navigation
  $('#map-nav .compass').addEventListener('click', () => startMap());
  $('#map-nav .next').addEventListener('click', () => { if (app.current === 'werkstatt') openMappe(); else if (app.current === HOELZER.length - 1) enterWerkstatt($('#stage')); else enterRealm(app.current + 1); });
  $('#map-nav .prev').addEventListener('click', () => { if (app.current === 'werkstatt') enterRealm(HOELZER.length - 1); else if (app.current > 0) enterRealm(app.current - 1); });
  // Lebenslauf
  $('#life-go').addEventListener('click', () => app.life && app.life.start());
  $('#life-play').addEventListener('click', () => { if (!app.life) return; if ($('#life-play').getAttribute('aria-pressed') === 'true') app.life.pause(); else app.life.play(); });
  const rg = $('#life-range');
  rg.addEventListener('pointerdown', () => { app.lifeDrag = true; app.life && app.life.pause(); });
  addEventListener('pointerup', () => { app.lifeDrag = false; });
  rg.addEventListener('input', () => { if (app.life) { app.life.pause(); app.life.setS(rg.value / 1000); } });
  $('#life-back').addEventListener('click', exitLife);
  $('#life-info').addEventListener('click', () => { const f = $('#life .life-facts'); f.hidden = !f.hidden; });
  $('#life-again').addEventListener('click', () => app.life && app.life.restart());
  $('#map-nav .life-btn').addEventListener('click', () => { if (typeof app.current === 'number') enterLife(app.current); });
  // Buch-Navigation
  $('#book .bn-prev').addEventListener('click', () => goPage(app.page - 1));
  $('#book .bn-next').addEventListener('click', () => goPage(app.page + 1));
  let sx = null;
  $('#leaves').addEventListener('pointerdown', e => { sx = e.clientX; });
  $('#leaves').addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 70) goPage(app.page + (dx < 0 ? 1 : -1)); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { const w = app.engine && app.engine.world; if (w && w.isFocused && w.isFocused()) { w.overview(); return; } if ($('#detail').classList.contains('on')) closeDetail(); else if ($('#mappe').classList.contains('on')) closeMappe(); else $('#menu').classList.remove('on'); }
    if (app.mode === 'buch' && !$('#mappe').classList.contains('on')) { if (e.key === 'ArrowRight' || e.key === 'PageDown') goPage(app.page + 1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPage(app.page - 1); }
  });
  // Direkteinstieg (zum Testen und für Lesezeichen): ?start=buch|karte|mappe|realm&r=id&p=n
  const P = new URLSearchParams(location.search), st = P.get('start');
  if (st === 'buch') return startBook(+(P.get('p') || 0));
  if (st === 'karte') return startMap();
  if (st === 'werkstatt') { hud('karte'); app.mode = 'karte'; return enterWerkstatt($('#stage')); }
  if (st === 'mappe') { await startMap(); return openMappe(); }
  if (st === 'realm') { hud('karte'); app.mode = 'karte'; const i = Math.max(0, HOELZER.findIndex(h => h.id === P.get('r'))); await enterRealm(i); if (P.get('detail')) openDetail(i); return; }
  if (st === 'choose') { hud('choose'); return showChooser(); }
  if (st === 'life') { app.mode = 'karte'; const i = Math.max(0, HOELZER.findIndex(h => h.id === P.get('r'))); app.current = i; await enterLife(i); if (P.get('go')) app.life.start(); if (P.get('age')) app.life.debug('life', +P.get('age')); if (P.get('fall')) app.life.debug('fall', +P.get('fall')); if (P.get('rel')) app.life.debug('release', +P.get('rel')); return; }
  return startProlog();
}
boot();
