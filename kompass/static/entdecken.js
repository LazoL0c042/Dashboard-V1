// Kompass – Glossar der Anlageklassen, Quellenliste, Portfolio-Entwurf (Warenkorb) und Portfolio-Council.
"use strict";

let GLOSSAR = null, ENTWURF_ANZAHL = null;
async function glossarDaten() { return GLOSSAR || (GLOSSAR = await api("/api/glossar")); }

const KL_FARBE = { mint: "var(--mint)", sky: "var(--sky)", sand: "var(--sand)", peach: "var(--peach)", lav: "var(--lav)", rose: "var(--rose)" };
const KL_TEXT = { mint: "var(--mint-d)", sky: "var(--sky-d)", sand: "var(--peach-d)", peach: "var(--peach-d)", lav: "var(--lav-d)", rose: "var(--rose-d)" };
function monogramm(a, g, gross = false) {
  const h = g.hauptklassen.find((x) => x.id === a.eltern) || { farbe: "lav" };
  const kurz = a.name.replace(/[^A-Za-zÄÖÜäöü0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return `<span class="mono${gross ? " gross" : ""}" style="background:${KL_FARBE[h.farbe]};color:${KL_TEXT[h.farbe]}" aria-hidden="true">${esc(kurz)}</span>`;
}


// ---------- Glossar ----------

let WIRKUNG = null;
async function wirkungDaten() { return WIRKUNG || (WIRKUNG = await api("/api/wirkung")); }

const KNOTEN_FUER_KLASSE = { aktien_welt: "aktien", aktien_usa: "aktien", aktien_tech: "tech", aktien_em: "em", anleihen: "anleihen", gold: "gold", goldminen: "gold",
  rohstoffe_oel: "oel", immobilien: "immobilien", krypto: "krypto", geldmarkt: "tagesgeld" };
const knotenFuerAsset = (a) => [...new Set(Object.keys(a.klassen || {}).map((k) => KNOTEN_FUER_KLASSE[k]).filter(Boolean))];

function glossarTabs(aktiv) {
  return `<div class="toolbar"><nav class="seg" aria-label="Glossar">
    <a class="${aktiv === "assets" ? "on" : ""}" href="#/glossar">Anlageklassen</a>
    <a class="${aktiv === "wirkung" ? "on" : ""}" href="#/wirkung">Wirkungsgefüge</a>
    <a class="${aktiv === "ereignisse" ? "on" : ""}" href="#/ereignisse">Historische Ereignisse</a></nav></div>`;
}

// Wirkungen als lesbare Karten: „Wenn X steigt → Y fällt“
function wirkungKarten(w, knoten, nurAusgehend = false) {
  const name = (id) => w.knoten.find((k) => k.id === id)?.name || id;
  const kanten = w.kanten.filter((k) => knoten.includes(k.nach) || (!nurAusgehend && knoten.includes(k.von)) || (nurAusgehend && knoten.includes(k.von)));
  if (!kanten.length) return '<p class="muted">Keine typischen Zusammenhänge hinterlegt.</p>';
  const rein = kanten.filter((k) => knoten.includes(k.nach)), raus = kanten.filter((k) => knoten.includes(k.von) && !knoten.includes(k.nach));
  const karte = (k) => `<div class="wk ${k.richtung > 0 ? "plus" : "minus"}">
    <div class="wk-kopf"><span class="wk-von">${esc(name(k.von))} ↑</span><span class="wk-pfeil" aria-hidden="true">→</span>
      <span class="wk-nach">${esc(name(k.nach))} ${k.richtung > 0 ? "↑ steigt" : "↓ fällt"}</span>${pips(k.staerke, 3)}</div>
    <p>${esc(k.warum)}</p><p class="muted small">Beispiel: ${esc(k.beispiel)}</p></div>`;
  return `${rein.length ? `<h3>Was hierauf wirkt</h3><div class="wk-grid">${rein.map(karte).join("")}</div>` : ""}
    ${raus.length ? `<h3>Worauf das wirkt</h3><div class="wk-grid">${raus.map(karte).join("")}</div>` : ""}
    <p class="muted small">Typische Zusammenhänge, keine Naturgesetze – sie können sich zeitweise umkehren. Punkte = Stärke (1–3).</p>`;
}

// Rangliste der Produkte einer oder mehrerer Anlagen, mit Knöpfen
async function produktListe(box, assetIds, opts = {}) {
  box.innerHTML = '<div class="progress"><span class="dot"></span>Bewerte Produkte …</div>';
  const listen = await Promise.all(assetIds.map((id) => api(`/api/produkte/ranking/${id}`)));
  let alle = listen.flat().sort((a, b) => b.score - a.score);
  if (opts.max) alle = alle.slice(0, opts.max);
  if (!alle.length) { box.innerHTML = '<p class="muted">Für diese Anlage gibt es kein börsengehandeltes Produkt im Katalog. Über „Produkt per ISIN aufnehmen“ kannst du eins ergänzen.</p>'; return; }
  box.innerHTML = `<div class="toolbar"><span class="muted small" style="flex:1">${alle.length} Produkte, sortiert nach Kosten, Größe, Domizil und Prüfstatus (Punkte 0–100).</span>
      <button class="ghost klein" id="pl-live">Live-Kennzahlen laden</button></div>
    <div class="rang">${alle.map((p, i) => `<article class="rang-karte" data-id="${esc(p.id)}">
      <div class="rang-nr">${i + 1}</div>
      <div class="rang-inhalt"><div class="row" style="justify-content:space-between;align-items:baseline"><b>${esc(p.name)}</b>
        <span class="pill ${p.score >= 75 ? "p-mint" : p.score >= 50 ? "p-sky" : "p-sand"}">${p.score} Punkte</span></div>
        <div class="muted small">${esc(p.isin || "")} ${p.ticker ? "· " + esc(p.ticker) : ""} · ${esc(p.anbieter || "")}${p.index ? " · Index: " + esc(p.index) : ""}</div>
        ${p.besonderheit ? `<p class="small" style="margin:6px 0">${esc(p.besonderheit)}</p>` : ""}
        <div class="pk-bew">${p.kriterien.map((k) => `<span class="pk-k ${k.punkte >= k.max ? "gut" : k.punkte === 0 ? "schwach" : k.text === "unbekannt" ? "offen" : "mittel"}"><b>${esc(k.kriterium)}</b> ${esc(k.text)}</span>`).join("")}
          ${p.ertrag ? `<span class="pk-k"><b>Ertrag</b> ${esc(p.ertrag)}</span>` : ""}${p.replikation ? `<span class="pk-k"><b>Replikation</b> ${esc(p.replikation)}</span>` : ""}</div>
        <div class="pk-live small muted"></div>
        <div class="actions" style="margin-top:8px"><button class="primary klein" data-zu="${i}">Zu Strategie hinzufügen</button>
          <button class="klein" data-neu="${i}">Neue Strategie damit</button><a class="btn klein" href="#/produkte/${esc(p.id)}">Details</a>
          ${(p.links || []).filter((l) => l.titel === "justETF").map((l) => `<a class="btn klein" href="${esc(l.url)}" target="_blank" rel="noopener">justETF ↗</a>`).join("")}</div>
      </div></article>`).join("")}</div>`;
  const quelle = (p) => ({ id: p.id, isin: p.isin, ticker: p.ticker, name: p.name, asset_id: p.asset, anteil: 10 });
  box.querySelectorAll("[data-zu]").forEach((b) => (b.onclick = () => zuStrategie(quelle(alle[+b.dataset.zu]))));
  box.querySelectorAll("[data-neu]").forEach((b) => (b.onclick = async () => { const e = await neueStrategie(quelle(alle[+b.dataset.neu])); location.hash = `#/entwurf/${e.id}`; }));
  box.querySelector("#pl-live").onclick = async (ev) => {
    ev.target.disabled = true;
    for (const p of alle) {
      const el = box.querySelector(`.rang-karte[data-id="${CSS.escape(p.id)}"] .pk-live`);
      if (!el) continue;
      el.textContent = "Lade Kurse …";
      try {
        const d = await api(`/api/produkte/${encodeURIComponent(p.id)}`);
        const l = d.live || {};
        el.textContent = l.kurs ? `Rendite 1 J. ${pct(l.rendite_1j)} · 5 J. p.a. ${pct(l.rendite_5j)} · Schwankung ${pct(l.volatilitaet)} · max. Verlust ${pct(l.max_verlust)} (${d.live_quelle}, ${l.stand})` : "Kein Kurs abrufbar.";
      } catch { el.textContent = "Kein Kurs abrufbar."; }
    }
  };
}

function importFormular(assetId) {
  return `<details class="import"><summary>Produkt per ISIN aufnehmen</summary><form class="row import-form" data-asset="${esc(assetId)}" style="margin-top:10px;align-items:flex-end">
    <div style="flex:2 1 220px"><label>ISIN</label><input name="isin" placeholder="z. B. IE00B4L5Y983" maxlength="12" autocapitalize="characters"></div>
    <div style="flex:0 0 auto"><button>Prüfen und aufnehmen</button></div></form>
    <p class="muted small">Kompass prüft die ISIN bei Yahoo Finance und justETF. Nur bestätigte Produkte kommen in den Katalog.</p><div class="import-out"></div></details>`;
}
function verdrahteImport(root, nachher) {
  root.querySelectorAll(".import-form").forEach((f) => (f.onsubmit = async (ev) => {
    ev.preventDefault();
    const out = f.parentElement.querySelector(".import-out");
    out.innerHTML = '<div class="progress"><span class="dot"></span>Prüfe …</div>';
    try { const p = await api("/api/produkte/import", { body: { isin: f.isin.value, asset: f.dataset.asset } }); out.innerHTML = `<p class="up">Aufgenommen: ${esc(p.name)}</p>`; KATALOG_CACHE = null; nachher && nachher(); }
    catch (e) { out.innerHTML = errBox(e); }
  }));
}

async function viewGlossar() {
  const g = await glossarDaten();
  render(`${kopf("Glossar", "#/")}
    ${glossarTabs("assets")}
    <p class="muted" style="max-width:75ch">Erst verstehen, dann entscheiden: Jede Anlageklasse mit Erklärung, Eigenschaften, Wirkung auf andere Märkte und bewerteten Produkten.</p>
    <div class="klassen-grid">${g.hauptklassen.map((h) => `<a class="klasse-karte" href="#/glossar/klasse/${h.id}" style="background:${KL_FARBE[h.farbe]}">
      <span class="kk-name">${esc(h.name)}</span><span class="kk-text">${esc(h.kurz)}</span>
      <span class="kk-meta">${g.assets.filter((a) => a.eltern === h.id).length} Unterklassen · ${(h.begriffe || []).length} Begriffe ›</span></a>`).join("")}</div>
    <div class="toolbar" style="margin-top:28px"><h2 style="margin:0;flex:1">Alle Anlagen</h2>
      <div style="flex:0 1 360px">${slider({ id: "g-risiko", label: "Zeige bis Risiko", skala: "risiko", wert: 5 })}</div></div>
    <div class="g-grid">${g.assets.map((a) => `<article class="g-karte" data-risiko="${a.risiko}">
      <div class="g-link">${monogramm(a, g)}<span class="g-name">${esc(a.name)}</span></div>
      <p class="g-kurz">${esc(a.kurz)}</p>
      <div class="g-stats"><span>Risiko ${pips(a.risiko, 5, a.risiko >= 5 ? "rot" : "")}</span><span>${a.produkte.length} Produkte</span></div>
      <div class="g-aktion"><a class="btn klein" href="#/glossar/${a.id}">Erklärung & Produkte ›</a></div></article>`).join("")}</div>`);
  initSlider(document, (_, v) => document.querySelectorAll(".g-karte").forEach((k) => (k.hidden = +k.dataset.risiko > v)));
}

async function viewKlasse(kid) {
  const [g, w] = await Promise.all([glossarDaten(), wirkungDaten()]);
  const h = g.hauptklassen.find((x) => x.id === kid);
  if (!h) throw new Error("Unbekannte Anlageklasse");
  const assets = g.assets.filter((a) => a.eltern === kid);
  // Anleihen: die Rendite (Zins/Realzins) ist selbst der Treiber für Gold, Tech und Aktien – darum mitzeigen
  const ZUSATZ = { anleihen: ["realzins", "leitzins"] };
  const knoten = [...w.knoten.filter((k) => k.klasse === kid).map((k) => k.id), ...(ZUSATZ[kid] || [])];
  render(`<a class="crumb" href="#/glossar">‹ Glossar</a>
    <div class="klasse-hero" style="background:${KL_FARBE[h.farbe]}"><h1>${esc(h.name)}</h1><p class="item-text" style="margin:8px 0 0">${esc(h.kurz)}</p></div>
    <nav class="sprung" aria-label="Abschnitte"><a class="chip" href="#k-erkl">1 · Erklärung</a><a class="chip" href="#k-merk">2 · Merkmale</a><a class="chip" href="#k-wirk">3 · Wirkungsgefüge</a><a class="chip" href="#k-unter">Unterklassen</a><a class="chip" href="#k-prod">4 · Produkte</a><a class="chip" href="#k-begr">Begriffe</a></nav>
    <section class="card abschnitt" id="k-erkl"><h2>1 · Was sind ${esc(h.name)}?</h2>${(h.erklaerung || []).map((p) => `<p class="lesen">${esc(p)}</p>`).join("")}</section>
    <section class="card abschnitt" id="k-merk"><h2>2 · Merkmale und Eigenschaften</h2>
      <div class="drei"><div><h3>So funktioniert's</h3><ul>${(h.funktionsweise || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3 class="up">Gut für</h3><ul>${(h.gut_fuer || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3 class="down">Schlecht für</h3><ul>${(h.schlecht_fuer || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div></section>
    <section class="card abschnitt" id="k-wirk"><h2>3 · Wirkungsgefüge</h2><p class="muted">Wie ${esc(h.name)} mit Zinsen, Inflation, Dollar und anderen Anlagen zusammenhängen.</p>
      ${knoten.length ? wirkungKarten(w, knoten) : '<p class="muted">Für diese Klasse sind keine typischen Zusammenhänge hinterlegt.</p>'}
      <div class="actions"><a class="btn" href="#/wirkung">Gesamtes Wirkungsgefüge ansehen</a></div></section>
    <section class="abschnitt" id="k-unter"><h2>Unterklassen</h2><div class="g-grid">${assets.map((a) => `<article class="g-karte"><div class="g-link">${monogramm(a, g)}<span class="g-name">${esc(a.name)}</span></div>
      <p class="g-kurz">${esc(a.kurz)}</p><div class="g-stats"><span>Risiko ${pips(a.risiko, 5, a.risiko >= 5 ? "rot" : "")}</span><span>${a.produkte.length} Produkte</span></div>
      <div class="g-aktion"><a class="btn klein" href="#/glossar/${a.id}">Erklärung & Produkte ›</a></div></article>`).join("")}</div></section>
    <section class="card abschnitt" id="k-prod"><div class="toolbar"><h2 style="margin:0;flex:1">4 · Beste Produkte in ${esc(h.name)}</h2>
      <button id="k-council">Council: passende Kombination empfehlen</button></div><div id="k-liste"></div></section>
    ${(h.begriffe || []).length ? `<section class="card abschnitt" id="k-begr"><h2>Begriffe</h2><dl class="lexikon">${h.begriffe.map(([b, t]) => `<div><dt>${esc(b)}</dt><dd>${esc(t)}</dd></div>`).join("")}</dl></section>` : ""}`);
  document.querySelectorAll(".sprung a").forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); document.querySelector(a.getAttribute("href")).scrollIntoView({ behavior: "smooth", block: "start" }); }));
  document.getElementById("k-council").onclick = () => assistentOeffnen(`Welche Kombination von Produkten aus „${h.name}“ passt zu meinen Zielen und meiner Strategie?`);
  produktListe(document.getElementById("k-liste"), assets.map((a) => a.id), { max: 15 });
}

async function viewWirkung() {
  const w = await wirkungDaten();
  render(`${kopf("Wirkungsgefüge", "#/glossar")}${glossarTabs("wirkung")}
    <p class="muted" style="max-width:75ch">Wie Zinsen, Inflation, Dollar, Konjunktur und Angst die Anlageklassen bewegen. Tippe einen Knoten an, um seine Zusammenhänge zu sehen.</p>
    <div class="cols"><div class="card"><div id="w-netz"></div>
      <p class="muted small"><span class="key-sw" style="border-color:var(--series-3)"></span>steigt mit · <span class="key-sw" style="border-color:var(--series-2)"></span>fällt dagegen · dicker = stärker</p></div>
      <div class="card" id="w-detail"><p class="muted">Wähle links einen Faktor oder eine Anlage.</p></div></div>`);
  const netz = document.getElementById("w-netz");
  const W = 520, H = 520, cx = W / 2, cy = H / 2;
  const treiber = w.knoten.filter((k) => k.art === "treiber"), anlagen = w.knoten.filter((k) => k.art === "anlage");
  const pos = {};
  treiber.forEach((k, i) => { const a = (i / treiber.length) * 2 * Math.PI - Math.PI / 2; pos[k.id] = [cx + 110 * Math.cos(a), cy + 110 * Math.sin(a)]; });
  anlagen.forEach((k, i) => { const a = (i / anlagen.length) * 2 * Math.PI - Math.PI / 2 + 0.2; pos[k.id] = [cx + 225 * Math.cos(a), cy + 225 * Math.sin(a)]; });
  const linie = (k) => { const [x1, y1] = pos[k.von], [x2, y2] = pos[k.nach]; return `<line class="w-kante" data-von="${k.von}" data-nach="${k.nach}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${k.richtung > 0 ? "var(--series-3)" : "var(--series-2)"}" stroke-width="${k.staerke}" opacity="0.45"/>`; };
  netz.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Wirkungsgefüge" style="width:100%;height:auto">${w.kanten.map(linie).join("")}
    ${w.knoten.map((k) => { const [x, y] = pos[k.id]; return `<g class="w-knoten" data-id="${k.id}" tabindex="0" role="button" aria-label="${esc(k.name)}">
      <circle cx="${x}" cy="${y}" r="${k.art === "treiber" ? 30 : 34}" fill="${k.art === "treiber" ? "var(--sand)" : "var(--sky)"}" stroke="var(--edge)" stroke-width="1.5"/>
      <text x="${x}" y="${y + 4}" text-anchor="middle" class="w-text">${esc(k.name.split(" ")[0].replace("/", ""))}</text></g>`; }).join("")}</svg>`;
  const waehle = (id) => {
    netz.querySelectorAll(".w-kante").forEach((l) => l.setAttribute("opacity", l.dataset.von === id || l.dataset.nach === id ? "0.95" : "0.08"));
    netz.querySelectorAll(".w-knoten").forEach((g2) => g2.classList.toggle("on", g2.dataset.id === id));
    const k = w.knoten.find((x) => x.id === id);
    document.getElementById("w-detail").innerHTML = `<h2 style="margin-top:0">${esc(k.name)}</h2>${wirkungKarten(w, [id])}
      ${k.klasse ? `<div class="actions"><a class="btn" href="#/glossar/klasse/${k.klasse}">Zur Anlageklasse ›</a></div>` : ""}`;
  };
  netz.querySelectorAll(".w-knoten").forEach((g2) => { g2.onclick = () => waehle(g2.dataset.id); g2.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); waehle(g2.dataset.id); } }; });
  waehle("leitzins");
}

async function viewAsset(aid) {
  const [g, w] = await Promise.all([glossarDaten(), wirkungDaten()]);
  const a = g.assets.find((x) => x.id === aid);
  if (!a) throw new Error("Unbekannte Anlage");
  const h = g.hauptklassen.find((x) => x.id === a.eltern);
  const geschwister = g.assets.filter((x) => x.eltern === a.eltern && x.id !== a.id);
  const lf = a.langfrist;
  render(`<a class="crumb" href="#/glossar/klasse/${h.id}">‹ ${esc(h.name)}</a>
    <div class="klasse-hero" style="background:${KL_FARBE[h.farbe]}"><div class="row" style="align-items:center;gap:18px">${monogramm(a, g, true)}
      <div style="flex:1 1 240px"><span class="pill p-lav">${esc(h.name)}</span><h1 style="margin:6px 0 0">${esc(a.name)}</h1></div>
      <div class="actions" style="margin:0"><button class="primary" id="a-zu">Zu Strategie hinzufügen</button><button id="a-council">Council fragen</button></div></div></div>
    <nav class="sprung" aria-label="Abschnitte"><a class="chip" href="#a-erkl">1 · Erklärung</a><a class="chip" href="#a-merk">2 · Merkmale</a><a class="chip" href="#a-wirk">3 · Wirkungsgefüge</a><a class="chip" href="#a-prod">4 · Produkte</a><a class="chip" href="#a-hist">Kurs & Geschichte</a></nav>
    <section class="card abschnitt" id="a-erkl"><h2>1 · Erklärung</h2><p class="item-text">${esc(a.kurz)}</p>
      <details><summary>Was sind ${esc(h.name)} überhaupt?</summary>${(h.erklaerung || []).map((p) => `<p class="lesen">${esc(p)}</p>`).join("")}</details></section>
    <section class="card abschnitt" id="a-merk"><h2>2 · Merkmale und Eigenschaften</h2>
      <div class="stat-grid">
        <div><span class="l">Risiko</span>${pips(a.risiko, 5, a.risiko >= 5 ? "rot" : "")}</div><div><span class="l">Verfügbarkeit</span>${pips(a.liquiditaet)}</div>
        <div><span class="l">Komplexität</span>${pips(a.komplexitaet)}</div>
        <div><span class="l">Erwartete Rendite</span><b>≈ ${num(a.erwartung.rendite, 1)} % p.a.</b> <span class="est">Annahme</span></div>
        <div><span class="l">Typische Schwankung</span><b>≈ ${num(a.erwartung.schwankung, 0)} % p.a.</b></div>
        ${(+a.hebel || 1) > 1 ? `<div><span class="l">Hebel</span><b>${a.hebel}×</b></div>` : ""}${a.mindestkapital ? `<div><span class="l">Mindestkapital</span><b>${esc(a.mindestkapital)}</b></div>` : ""}</div>
      <h3>Besonderheiten</h3><ul class="besonders">${a.besonderheiten.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="procon"><div><h3 class="up">Dafür</h3><ul>${a.pro.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h3 class="down">Dagegen</h3><ul>${a.contra.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      <h3>Steuern (Deutschland)</h3><p>${esc(a.steuer)}</p><p class="muted small">Vereinfachte Darstellung, Stand 2026 – im Einzelfall prüfen.</p>
      ${a.risiko >= 5 ? '<div class="notice small">Spekulativ: Totalverlust oder ein Einbruch von mehr als 70 % ist realistisch. Nur mit Geld, das du verlieren kannst.</div>' : ""}</section>
    <section class="card abschnitt" id="a-wirk"><h2>3 · Wirkungsgefüge</h2>${wirkungKarten(w, knotenFuerAsset(a))}</section>
    <section class="card abschnitt" id="a-prod"><div class="toolbar"><h2 style="margin:0;flex:1">4 · Produkte im Vergleich</h2>
      <button id="a-komb">Council: passende Kombination empfehlen</button></div><div id="a-liste"></div>${importFormular(a.id)}</section>
    <div class="cols abschnitt" id="a-hist">
      <div class="card"><div class="toolbar"><h2 style="margin:0;flex:1">Kursverlauf</h2>${a.ticker ? `<div class="seg" id="a-range">${["1J", "5J", "Max"].map((f) => `<button type="button" data-f="${f}" class="${f === "5J" ? "on" : ""}">${f}</button>`).join("")}</div>` : ""}</div>
        <div id="a-kurs">${a.ticker ? '<div class="progress"><span class="dot"></span>Lade Kurse …</div>' : '<p class="muted">Kein börsengehandelter Referenzkurs.</p>'}</div>${a.ticker_hinweis ? `<p class="src">${esc(a.ticker_hinweis)}</p>` : ""}</div>
      <div class="card"><h2 style="margin-top:0">Langfristig und in Krisen</h2>
        ${lf ? `<div class="kpis"><div class="kpi" style="background:var(--mint)"><div class="l">Ø pro Jahr</div><div class="v">${pctS(lf.rendite_pa)}</div><div class="sub">real ${pctS(lf.rendite_pa_real)}</div></div>
          <div class="kpi" style="background:var(--rose)"><div class="l">Schlechtestes Jahr</div><div class="v">${pctS(lf.schlechtestes.wert)}</div><div class="sub">${lf.schlechtestes.jahr}</div></div>
          <div class="kpi" style="background:var(--sky)"><div class="l">Bestes Jahr</div><div class="v">${pctS(lf.bestes.wert)}</div><div class="sub">${lf.bestes.jahr}</div></div></div>
          <p class="src">${esc(lf.quelle)} · ${lf.zeitraum[0]}–${lf.zeitraum[1]}</p>` : ""}
        <div id="a-krisen"><p class="muted">Lade historische Ereignisse …</p></div>
        ${geschwister.length ? `<h3>Ähnlich</h3><div class="chips">${geschwister.map((x) => `<a class="chip" href="#/glossar/${x.id}">${esc(x.name)}</a>`).join("")}</div>` : ""}</div></div>`);
  document.querySelectorAll(".sprung a").forEach((x) => (x.onclick = (ev) => { ev.preventDefault(); document.querySelector(x.getAttribute("href")).scrollIntoView({ behavior: "smooth", block: "start" }); }));
  document.getElementById("a-zu").onclick = () => zuStrategie({ asset_id: a.id, name: a.name, anteil: a.risiko >= 5 ? 5 : 10 });
  document.getElementById("a-council").onclick = () => assistentOeffnen(`Passt ${a.name} zu mir und meiner Strategie, und wie viel Anteil wäre sinnvoll?`);
  document.getElementById("a-komb").onclick = () => assistentOeffnen(`Welche Kombination aus ${a.name} und anderen Produkten ergänzt die Ziele meiner Strategie am besten?`);
  verdrahteImport(document, () => produktListe(document.getElementById("a-liste"), [a.id]));
  produktListe(document.getElementById("a-liste"), [a.id]);
  ereignisseFuerAsset(a).then((l) => {
    const box = document.getElementById("a-krisen");
    if (box) box.innerHTML = l.length ? `<h3>In historischen Krisen</h3>${l.map((x) => `<p><a href="#/ereignisse/${x.id}">${esc(x.name)}</a> <span class="muted small">${esc(x.zeitraum)}</span><br>${esc(x.text)}</p>`).join("")}` : "";
  }).catch(() => {});
  if (a.ticker) {
    const h0 = location.hash;
    try {
      const d = await api(`/api/kurse?tickers=${encodeURIComponent(a.ticker)}&start=${new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10)}`);
      if (location.hash !== h0) return;
      const reihe = d.kurse[a.ticker] || [];
      const zeichne = (f) => {
        const grenze = Rechnen.fenster(reihe.map((q) => ({ tag: q[0] })), f)[0]?.tag || "";
        const pts = reihe.filter((q) => q[0] >= grenze);
        const box = document.getElementById("a-kurs");
        if (pts.length < 2) { box.innerHTML = '<p class="muted">Kurs nicht abrufbar.</p>'; return; }
        box.innerHTML = `<div class="kpis"><div class="kpi" style="background:var(--lav)"><div class="l">Aktueller Kurs</div><div class="v">${num(pts.at(-1)[1], 2)}</div><div class="sub">${datumKurz(pts.at(-1)[0], true)}</div></div>
          <div class="kpi" style="background:var(--mint)"><div class="l">Veränderung ${f}</div><div class="v ${tone(pts.at(-1)[1] / pts[0][1] - 1)}">${pctS(pts.at(-1)[1] / pts[0][1] - 1)}</div></div></div>
          <div id="a-kc" style="margin-top:12px"></div><p class="src">Quelle: ${esc(d.quelle)} · Ticker ${esc(a.ticker)}</p>`;
        Charts.linie(document.getElementById("a-kc"), { titel: `Kurs ${a.name}`, hoehe: 220, xFormat: (t, l) => datumKurz(t, l), yFormat: (v) => num(v, 2), serien: [{ name: a.ticker, farbe: "var(--series-1)", punkte: pts }] });
      };
      zeichne("5J");
      document.querySelectorAll("#a-range button").forEach((b) => (b.onclick = () => { document.querySelectorAll("#a-range button").forEach((x) => x.classList.toggle("on", x === b)); zeichne(b.dataset.f); }));
    } catch (e) { document.getElementById("a-kurs").innerHTML = errBox(e); }
  }
}


// ---------- Quellen ----------

async function viewQuellen() {
  const d = await api("/api/medien");
  const kats = [...new Set(d.quellen.map((q) => q.kategorie))];
  const zug = { frei: "p-mint", "teilweise frei": "p-sky", "frei über Portale": "p-mint", Bezahlschranke: "p-sand" };
  render(`${kopf("Vertrauenswürdige Quellen", "#/recherche")}
    ${rechercheTabs("quellen")}
    <p class="muted" style="max-width:80ch">25 Quellen für Märkte, Unternehmen, Start-ups, Zinsen und Stimmung. Ausgewählt nach Unabhängigkeit, Nähe zur Primärquelle und Fachtiefe. Die Nachrichtensuche in Recherche und Council nutzt nur diese Seiten.</p>
    ${kats.map((k) => `<h2>${esc(k)}</h2><div class="cards">${d.quellen.filter((q) => q.kategorie === k).map((q) => `<article class="card flat q-karte">
      <div class="row" style="justify-content:space-between;align-items:baseline"><span class="q-name">${esc(q.name)}</span><span class="pill ${zug[q.zugang] || "p-sky"}">${esc(q.zugang)}</span></div>
      <p class="muted small">${esc(q.fokus)}</p><p>${esc(q.warum)}</p><p class="small"><b>Achtung:</b> ${esc(q.achtung)}</p>
      <div class="actions" style="margin-top:4px"><a class="btn klein" href="${esc(q.url)}" target="_blank" rel="noopener">Website öffnen ↗</a></div></article>`).join("")}</div>`).join("")}`);
}


// ---------- Portfolio-Council (Gespräch) ----------

const SCHNELL = ["Ist mehr Risiko für mich sinnvoll?", "Was bringt Gold gehebelt?", "Lohnt sich ein Branchen-ETF, z. B. Halbleiter?",
  "Bewerte meine Gewichtungen", "Such aktuelle Nachrichten zu meinen Positionen", "Zeig mir spekulativere Bausteine"];

async function viewBeraterNeu(query) {
  const q = new URLSearchParams(query || "");
  const liste = await api("/api/berater");
  render(`${kopf("Portfolio mit dem Council bauen", "#/plaene")}
    <div class="cols">
      <div class="card"><p class="muted" style="margin-top:0">Beschreibe, was du vorhast. Der Portfolio-Berater fragt nach, schlägt Produkte und Gewichtungen vor, der Kritiker bewertet sie. Vorschläge übernimmst du mit einem Tipp in deinen Entwurf.</p>
        <form id="f"><label for="b-text">Worum geht es?</label><textarea id="b-text" name="text" required placeholder="z. B. Ich bin 34, will 20 Jahre lang 500 € im Monat anlegen und darf ruhig etwas mehr Risiko nehmen.">${esc(q.get("frage") || "")}</textarea>
        <div id="e"></div><div class="actions"><button class="primary">Gespräch starten</button></div></form></div>
      <div class="card"><h2 style="margin-top:0">Bisherige Gespräche</h2><div class="list">${liste.map((c) => `<a class="item" href="#/berater/${c.id}"><span class="t">${esc(c.titel)}</span><span class="muted small">${datum(c.created_at)}</span></a>`).join("") || '<p class="muted">Noch keine.</p>'}</div></div>
    </div>`);
  document.getElementById("f").onsubmit = async (ev) => {
    ev.preventDefault();
    try { const r = await api("/api/berater", { body: formData(ev.target) }); location.hash = `#/berater/${r.id}`; }
    catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
}

function beraterNachricht(m, cid) {
  const d = m.data || {};
  if (m.rolle === "nutzer") return `<div class="msg user"><div class="who">Du</div>${esc(m.inhalt)}</div>`;
  if (m.rolle === "system") return `<div class="msg sys"><div class="who">Recherche</div>${esc(m.inhalt)}${d.research_id ? ` · <a href="#/recherche/${d.research_id}">Quellen ansehen</a>` : ""}</div>`;
  if (m.rolle === "kritiker") return `<div class="msg krit"><div class="who">Kritiker · ${esc(m.provider)}/${esc(m.model)}</div><p>${esc(d.kommentar)}</p>
    ${(d.gewichtungen || []).length ? `<div class="chips">${d.gewichtungen.map((x) => `<span class="chip ${x.urteil === "passend" ? "ok" : "warn"}" title="${esc(x.warum)}"><b>${esc(x.name)}</b>: ${esc(x.urteil)}</span>`).join("")}</div>` : ""}
    ${d.risiko_passt ? `<p class="small"><b>Risiko passt:</b> ${esc(d.risiko_passt)}</p>` : ""}
    ${(d.klumpen || []).length ? `<p class="small"><b>Klumpen:</b> ${esc(d.klumpen.join("; "))}</p>` : ""}</div>`;
  const v = d.vorschlag;
  return `<div class="msg mod"><div class="who">Portfolio-Berater · ${esc(m.provider)}/${esc(m.model)}</div><p>${esc(d.antwort)}</p>
    ${(d.fragen || []).length ? `<ul>${d.fragen.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    ${v && (v.aufgeloest || []).length ? `<div class="card flat vorschlag"><h3 style="margin-top:0">Vorschlag: ${esc(v.name || "")}</h3>
      <table>${v.aufgeloest.map((p, i) => `<tr><td>${esc(p.name)}${(v.positionen[i] || {}).warum ? `<br><span class="muted small">${esc(v.positionen[i].warum)}</span>` : ""}</td><td class="num">${num(p.anteil, 0)} %</td></tr>`).join("")}</table>
      ${v.erwartung_kommentar ? `<p class="small">${esc(v.erwartung_kommentar)}</p>` : ""}
      <div class="actions"><button class="primary" data-ueb="${m.id}">In den Entwurf übernehmen</button></div></div>` : ""}</div>`;
}

async function viewBerater(cid) {
  const d = await api(`/api/berater/${cid}`);
  const c = d.chat, e = d.entwurf;
  const denkt = c.status === "denkt";
  render(`${kopf(c.titel, "#/berater/neu", e.id ? `<a class="btn" href="#/entwurf/${e.id}">Entwurf öffnen</a>` : "")}
    <div class="cols">
      <div>
        ${d.nachrichten.map((m) => beraterNachricht(m, cid)).join("")}
        ${denkt ? '<div class="card progress"><span class="dot"></span>Der Council denkt nach …</div>' : ""}
        ${c.error ? errBox(c.error) : ""}
        ${d.profil_offen.length ? `<div class="card flat"><h3>Für dein Profil übernehmen?</h3>${d.profil_offen.map((f) => `<div class="row" style="padding:6px 0"><div><b>${esc(f.label)}:</b> ${esc(f.value)} ${est(f.status)}</div>
          <div style="flex:0 0 auto"><button data-ok="${f.id}">Übernehmen</button> <button class="ghost" data-no="${f.id}">Nein</button></div></div>`).join("")}</div>` : ""}
        <div class="card"><div class="chips" style="margin-bottom:10px">${SCHNELL.map((s) => `<button type="button" class="chip" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
          <form id="f"><label for="b-msg">Deine Nachricht</label><textarea id="b-msg" name="text" required ${denkt ? "disabled" : ""}></textarea>
          <div class="actions"><button class="primary" ${denkt ? "disabled" : ""}>Senden</button></div></form></div>
      </div>
      <div class="card"><h2 style="margin-top:0">Dein Entwurf</h2>
        <p class="muted small">Risiko ${e.risiko}/5 · ${eur0(e.einmalbetrag)} + ${eur0(e.sparrate)}/Monat · ${e.horizont_jahre} Jahre</p>
        <div id="b-ent"></div><div class="actions">${e.id ? `<a class="btn" href="#/entwurf/${e.id}">Gewichten und Rahmen einstellen</a>` : ""}</div></div>
    </div>`);
  const ent = document.getElementById("b-ent");
  if (e.positionen.length) Charts.balken(ent, e.positionen.map((p) => ({ name: p.name, wert: +p.anteil || 0, text: `${num(p.anteil, 0)} %` })), { max: 100 });
  else ent.innerHTML = '<p class="muted">Noch leer.</p>';
  document.querySelectorAll("[data-ueb]").forEach((b) => (b.onclick = async () => {
    await api(`/api/berater/${cid}/uebernehmen/${b.dataset.ueb}`, { body: {} });
    toast("Vorschlag im Entwurf"); aktualisiereEntwurfZaehler(); viewBerater(cid);
  }));
  document.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { const t = document.getElementById("b-msg"); t.value = b.dataset.q; t.focus(); }));
  document.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => { await api(`/api/profil/${b.dataset.ok}/bestaetigen`, { body: {} }); viewBerater(cid); }));
  document.querySelectorAll("[data-no]").forEach((b) => (b.onclick = async () => { await api(`/api/profil/${b.dataset.no}/ablehnen`, { body: {} }); viewBerater(cid); }));
  document.getElementById("f").onsubmit = async (ev) => {
    ev.preventDefault();
    try { await api(`/api/berater/${cid}`, { body: formData(ev.target) }); viewBerater(cid); } catch (ex) { toast(ex.message); }
  };
  if (denkt) poll(() => { if (location.hash === `#/berater/${cid}`) viewBerater(cid).catch(() => {}); }, 2500);
  else window.scrollTo(0, document.body.scrollHeight);
}
