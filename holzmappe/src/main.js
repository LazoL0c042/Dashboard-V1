import { Engine } from './engine.js';
import { buildRealm } from './realms.js';
import { buildProlog, buildMap, buildWerkstatt } from './special.js';
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
  if (!m.dataset.ready) { m.innerHTML = mappeHTML(); m.dataset.ready = '1'; }
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
  w.onPick = (id, ev) => { if (id === 'tafel') openDetail(i, ev); };
  markVisited(h.id); veil(false); realmTitle(i);
  $('#map-nav').classList.add('realm');
  $('#map-nav .prev').disabled = i === 0;
  $('#map-nav .next').textContent = i === HOELZER.length - 1 ? 'Zur Werkstatt →' : `${HOELZER[i + 1].name} →`;
  $('#map-nav .prev').textContent = i === 0 ? '←' : `← ${HOELZER[i - 1].name}`;
}
async function enterWerkstatt(mountEl) {
  app.current = 'werkstatt'; flash(); veil(true, 'Die Werkstatt …');
  await setWorld(() => buildWerkstatt(app.engine, () => openMappe()), mountEl);
  veil(false); realmTitle(null);
  if (app.mode === 'karte') { $('#map-nav').classList.add('realm'); $('#map-nav .next').textContent = 'Mappe öffnen'; $('#map-nav .prev').textContent = `← ${HOELZER[7].name}`; $('#map-nav .prev').disabled = false; }
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
  else if (p.type === 'scene') { const h = HOELZER[p.i]; front.innerHTML = `<header class="sc-head"><small>${chapterLabel(p.i)}</small><h2>${h.name}</h2><p><i>${h.bot}</i> · ${h.reich}</p></header><div class="pg-canvas"><div class="pg-load">Die Welt entsteht …</div></div><div class="sc-foot">Die Holztafel antippen oder umblättern für den Steckbrief →</div>${folio}`; }
  else if (p.type === 'detail') front.innerHTML = `<div class="pg-in detail-page">${detailHTML(HOELZER[p.i], p.i)}</div>${folio}`;
  else if (p.type === 'werkstatt') front.innerHTML = `<header class="sc-head"><small>Epilog</small><h2>Die Werkstatt</h2><p>Die Holzmappe liegt auf der Hobelbank.</p></header><div class="pg-canvas"></div><div class="sc-foot">Die Mappe antippen, um sie zu öffnen</div>${folio}`;
  el.append(front, back);
  if (p.type === 'toc') el.querySelectorAll('[data-ch]').forEach(li => li.addEventListener('click', () => { const c = li.dataset.ch; goPage(c === 'werkstatt' ? app.pages.length - 1 : 1 + (+c) * 2); }));
  return el;
}
async function prepare(idx, el) {
  const p = app.pages[idx];
  const mount = $('.pg-canvas', el);
  if (p.type === 'scene') {
    const h = HOELZER[p.i];
    const w = await setWorld(() => buildRealm(h.id, app.engine), mount);
    w.onPick = (id) => { if (id === 'tafel') goPage(idx + 1); };
    markVisited(h.id);
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
  // Buch-Navigation
  $('#book .bn-prev').addEventListener('click', () => goPage(app.page - 1));
  $('#book .bn-next').addEventListener('click', () => goPage(app.page + 1));
  let sx = null;
  $('#leaves').addEventListener('pointerdown', e => { sx = e.clientX; });
  $('#leaves').addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 70) goPage(app.page + (dx < 0 ? 1 : -1)); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ($('#detail').classList.contains('on')) closeDetail(); else if ($('#mappe').classList.contains('on')) closeMappe(); else $('#menu').classList.remove('on'); }
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
  return startProlog();
}
boot();
