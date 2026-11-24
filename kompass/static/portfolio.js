// Kompass – Portfolios (mehrere hypothetische Depots je Konto) und Szenarien.
// Nutzt Hilfen aus app.js (api, esc, eur, pct, render, kopf …) und Rechnen/Charts.
"use strict";

const BENCH = "EUNL.DE";
const HEUTE = () => new Date().toISOString().slice(0, 10);
const LETZTE_WERTE = {}; // Portfolio-ID → aktueller Depotwert (für Szenarien)
let SZ_CACHE = null, KATALOG_CACHE = null;

async function szDaten() { return SZ_CACHE || (SZ_CACHE = await api("/api/szenarien")); }
async function katalog() { return KATALOG_CACHE || (KATALOG_CACHE = await api("/api/produkte")); }

const pctS = (v, d = 1) => (v == null || isNaN(v) ? "–" : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`);
const ppS = (v) => (v == null || isNaN(v) ? "–" : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Pp.`);
const tone = (v) => (v == null ? "" : v >= 0 ? "up" : "down");
const eur0 = (v) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }));
const datumKurz = (iso, lang) => new Date(iso + "T00:00:00").toLocaleDateString("de-DE", lang ? { day: "2-digit", month: "2-digit", year: "numeric" } : { month: "short", year: "2-digit" });

function planTabs(aktiv) {
  return `<div class="toolbar"><nav class="seg" aria-label="Pläne">
    <a class="${aktiv === "portfolios" ? "on" : ""}" href="#/plaene">Portfolios</a>
    <a class="${aktiv === "entscheidungen" ? "on" : ""}" href="#/plaene/entscheidungen">Entscheidungen</a>
  </nav></div>`;
}

async function kurseFuer(p) {
  const tickers = [...new Set(p.positionen.map((x) => x.ticker).concat(BENCH))];
  const d = await api(`/api/kurse?tickers=${encodeURIComponent(tickers.join(","))}&start=${p.startdatum}`);
  return d;
}

async function rechne(p) {
  const d = await kurseFuer(p);
  const r = Rechnen.rueckrechnung(p, d.kurse, BENCH, HEUTE());
  r.quelle = d.quelle;
  r.kurse = d.kurse;
  if (r.kennzahlen) LETZTE_WERTE[p.id] = r.kennzahlen.wert;
  return r;
}

// ---------- Übersicht ----------

async function viewPortfolios() {
  const d = await api("/api/portfolios");
  const ps = d.portfolios;
  render(`${kopf("Pläne", "#/", `<a class="btn primary" href="#/portfolios/neu">Neues Portfolio</a>`)}
    ${planTabs("portfolios")}
    <p class="muted">Hypothetische Depots: Was wäre, wenn du ab einem Datum so investiert hättest? Frei änderbar. Für eine ehrliche Prüfung später: als Entscheidung einfrieren.</p>
    ${ps.length ? `<div class="card"><h2 style="margin-top:0">Rendite im Vergleich</h2><p class="muted small">Zeitgewichtet seit Start des jeweiligen Portfolios. Darunter: MSCI World im selben Zeitraum.</p><div id="cmp"><p class="muted">Rechne …</p></div></div>` : ""}
    <div class="cards" id="pc">
      ${ps.map((p) => `<a class="pcard" href="#/portfolios/${p.id}" id="pc-${p.id}">
        <span class="pname">${esc(p.name)}</span>
        <span class="muted small">${p.positionen.length} Position${p.positionen.length === 1 ? "" : "en"} · seit ${datumKurz(p.startdatum, true)}</span>
        <span class="muted">Rechne …</span></a>`).join("")}
      <a class="pcard neu" href="#/portfolios/neu">+ Neues Portfolio</a>
    </div>`);
  const zeilen = [];
  await Promise.all(ps.map(async (p) => {
    const box = document.getElementById(`pc-${p.id}`);
    try {
      const r = await rechne(p);
      const k = r.kennzahlen;
      if (!k) throw new Error(r.fehlend[0] ? `Kurs fehlt: ${r.fehlend[0]}` : "Keine Kurse");
      const diff = k.renditeZeitgewichtet - k.benchZeitgewichtet;
      zeilen.push({ p, k, diff });
      if (!box) return;
      box.innerHTML = `<span class="pname">${esc(p.name)}</span>
        <span class="muted small">${p.positionen.length} Position${p.positionen.length === 1 ? "" : "en"} · seit ${datumKurz(p.startdatum, true)}</span>
        <div class="row2"><div><div class="big">${eur0(k.wert)}</div>
          <div class="${tone(k.gewinnProzent)}" style="font-weight:620">${pctS(k.gewinnProzent)} · ${eur0(k.gewinn)}</div>
          <div class="muted small">vs. MSCI World: <b class="${tone(diff)}">${ppS(diff)}</b></div></div>
          ${Charts.spark(r.punkte.map((x) => x.wert))}</div>`;
    } catch (e) {
      if (box) box.innerHTML = `<span class="pname">${esc(p.name)}</span><span class="err small">${esc(e.message)}</span>`;
    }
  }));
  const cmp = document.getElementById("cmp");
  if (cmp) {
    if (!zeilen.length) cmp.innerHTML = '<p class="muted">Keine Kurse verfügbar.</p>';
    else Charts.balken(cmp, ps.map((p) => zeilen.find((z) => z.p === p)).filter(Boolean).map((z) => ({
      name: z.p.name, wert: z.k.renditeZeitgewichtet, text: pctS(z.k.renditeZeitgewichtet),
      sub: `MSCI World: ${pctS(z.k.benchZeitgewichtet)} · ${ppS(z.diff)}`,
    })));
  }
}

// ---------- Bearbeiten ----------

async function viewPortfolioForm(id) {
  const [kat, sz] = await Promise.all([katalog(), szDaten()]);
  const p = id ? await api(`/api/portfolios/${id}`) : {
    name: "", beschreibung: "", einmalbetrag: 10000, sparrate: 300,
    startdatum: new Date(Date.now() - 5 * 365.25 * 864e5).toISOString().slice(0, 10),
    positionen: [{ ticker: "EUNL.DE", isin: "IE00B4L5Y983", anteil: 80 }, { ticker: "4GLD.DE", isin: "DE000A0S9GB0", anteil: 20 }],
  };
  const optionen = (sel) => kat.produkte.map((x) => `<option value="${esc(x.id)}" ${sel === x.id ? "selected" : ""}>${esc(x.name)} (${esc(x.ticker)})</option>`).join("");
  const klOpt = (sel) => Object.entries(sz.klassen).map(([k, v]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${esc(v)}</option>`).join("");
  const findeKat = (x) => kat.produkte.find((k) => (x.isin && k.isin === x.isin && k.ticker === x.ticker) || k.ticker === x.ticker && k.id !== "GOLD-PHYSISCH");
  const zeile = (x = {}) => {
    const k = x.ticker ? findeKat(x) : kat.produkte[0];
    const eigen = x.ticker && !k;
    return `<div class="card flat prow" style="margin:8px 0">
      <div class="row">
        <div style="flex:3 1 260px"><label>Produkt</label><select class="psel">${optionen(k ? k.id : "")}<option value="eigen" ${eigen ? "selected" : ""}>Eigener Ticker (Aktie, ETF …)</option></select></div>
        <div style="flex:1 1 110px"><label>Anteil (%)</label><input class="pant" type="number" step="any" min="0" value="${esc(x.anteil ?? 10)}"></div>
        <div style="flex:0 0 auto;align-self:flex-end"><button type="button" class="ghost pdel" aria-label="Position entfernen">Entfernen</button></div>
      </div>
      <div class="row peigen" ${eigen ? "" : "hidden"}>
        <div><label>Ticker (Yahoo Finance)</label><input class="ptick" placeholder="z. B. SAP.DE, NVDA, BTC-EUR" value="${eigen ? esc(x.ticker) : ""}"></div>
        <div><label>Name</label><input class="pname" value="${eigen ? esc(x.name) : ""}"></div>
        <div><label>Anlageklasse (für Szenarien)</label><select class="pkl">${klOpt(eigen ? Object.keys(x.klassen || {})[0] : "aktien_welt")}</select></div>
      </div></div>`;
  };
  render(`${kopf(id ? "Portfolio bearbeiten" : "Neues Portfolio", id ? `#/portfolios/${id}` : "#/plaene")}
    <form id="f" class="cols">
      <div class="card">
        <label for="pf-name">Name</label><input id="pf-name" name="name" value="${esc(p.name)}" required placeholder="z. B. Welt + 20 % Gold">
        <label for="pf-b">Beschreibung / Idee</label><textarea id="pf-b" name="beschreibung" placeholder="Warum dieses Portfolio?">${esc(p.beschreibung)}</textarea>
        <h2>Positionen</h2>
        <div id="rows">${p.positionen.map(zeile).join("")}</div>
        <div class="actions"><button type="button" id="add">+ Position</button><span class="muted" id="summe"></span></div>
      </div>
      <div class="card">
        <label for="pf-s">Start (ab wann investiert?)</label><input id="pf-s" name="startdatum" type="date" value="${esc(p.startdatum)}" required>
        <label for="pf-e">Einmalbetrag zum Start (€)</label><input id="pf-e" name="einmalbetrag" type="number" step="any" min="0" value="${esc(p.einmalbetrag)}">
        <label for="pf-r">Sparrate pro Monat (€)</label><input id="pf-r" name="sparrate" type="number" step="any" min="0" value="${esc(p.sparrate)}">
        <p class="muted small">Gerechnet wird mit echten Kursen: Kauf zum Zielanteil bei jeder Einzahlung, ohne Kosten und Steuern. Vergleich: MSCI World mit denselben Einzahlungen.</p>
        <div id="e"></div>
        <div class="actions"><button class="primary">${id ? "Speichern" : "Anlegen"}</button></div>
      </div>
    </form>`);
  const rows = document.getElementById("rows");
  const summe = () => {
    const s = [...rows.querySelectorAll(".pant")].reduce((a, i) => a + (Number(i.value) || 0), 0);
    document.getElementById("summe").textContent = `Summe: ${num(s, 1)} %${Math.abs(s - 100) > 0.01 ? " – wird auf 100 % umgerechnet" : ""}`;
  };
  const verdrahte = () => {
    rows.querySelectorAll(".prow").forEach((r) => {
      r.querySelector(".psel").onchange = (ev) => { r.querySelector(".peigen").hidden = ev.target.value !== "eigen"; };
      r.querySelector(".pdel").onclick = () => { r.remove(); summe(); };
      r.querySelector(".pant").oninput = summe;
    });
    summe();
  };
  verdrahte();
  document.getElementById("add").onclick = () => { rows.insertAdjacentHTML("beforeend", zeile({ anteil: 10 })); verdrahte(); };
  document.getElementById("f").onsubmit = async (ev) => {
    ev.preventDefault();
    const d = formData(ev.target);
    const positionen = [...rows.querySelectorAll(".prow")].map((r) => {
      const v = r.querySelector(".psel").value, anteil = Number(r.querySelector(".pant").value) || 0;
      if (v === "eigen") {
        const t = r.querySelector(".ptick").value.trim();
        return { ticker: t, name: r.querySelector(".pname").value.trim() || t, anteil, klassen: { [r.querySelector(".pkl").value]: 1 } };
      }
      const k = kat.produkte.find((x) => x.id === v);
      return { ticker: k.ticker, isin: k.isin, id: k.id, name: k.name, anteil, klassen: k.klassen };
    });
    const body = { ...d, einmalbetrag: Number(d.einmalbetrag) || 0, sparrate: Number(d.sparrate) || 0, positionen };
    try {
      if (id) { await api(`/api/portfolios/${id}`, { method: "PUT", body }); location.hash = `#/portfolios/${id}`; }
      else { const r = await api("/api/portfolios", { body }); location.hash = `#/portfolios/${r.id}`; }
    } catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
}

// ---------- Detail ----------

async function viewPortfolio(id) {
  const p = await api(`/api/portfolios/${id}`);
  const h0 = location.hash;
  render(`${kopf(p.name, "#/plaene")}<div class="card progress"><span class="dot"></span>Lade Kurse und rechne …</div>`);
  const r = await rechne(p);
  if (location.hash !== h0) return; // inzwischen weiter navigiert
  const k = r.kennzahlen;
  const aktionen = `<a class="btn primary" href="#/szenario?quelle=portfolio&id=${id}">Szenario anwenden</a>
    <a class="btn" href="#/portfolios/${id}/bearbeiten">Bearbeiten</a>
    <a class="btn" href="#/plaene/neu?portfolio=${id}">Als Entscheidung einfrieren</a>
    <button class="ghost" id="del">Löschen</button>`;
  if (!k) {
    render(`${kopf(p.name, "#/plaene", aktionen)}${errBox("Für dieses Portfolio gibt es noch keine Kurse.")}
      ${r.fehlend.length ? `<p class="muted">Fehlend: ${esc(r.fehlend.join(", "))}</p>` : ""}
      <p class="muted">Prüfe die Ticker oder wähle ein späteres Startdatum.</p>`);
    verdrahteLoeschen(id);
    return;
  }
  const diffPa = k.renditePa != null && k.benchPa != null ? k.renditePa - k.benchPa : null;
  render(`${kopf(p.name, "#/plaene", aktionen)}
    ${p.beschreibung ? `<p class="muted" style="max-width:70ch">${esc(p.beschreibung)}</p>` : ""}
    <div id="confirm"></div>
    <div class="kpis">
      <div class="kpi" style="background:var(--lav)"><div class="l">Depotwert</div><div class="v">${eur(k.wert)}</div><div class="sub">eingezahlt ${eur(k.eingezahlt)}</div></div>
      <div class="kpi" style="background:var(--mint)"><div class="l">Gewinn</div><div class="v ${tone(k.gewinn)}">${eur(k.gewinn)}</div><div class="sub">${pctS(k.gewinnProzent, 2)}</div></div>
      <div class="kpi" style="background:var(--sky)"><div class="l">Rendite p.a. (zeitgewichtet)</div><div class="v">${pctS(k.renditePa, 2)}</div><div class="sub">MSCI World ${pctS(k.benchPa, 2)}${diffPa != null ? ` · ${ppS(diffPa)}` : ""}</div></div>
      <div class="kpi" style="background:var(--peach)"><div class="l">Max. Verlust</div><div class="v">${pctS(k.maxVerlust)}</div><div class="sub">MSCI World ${pctS(k.benchMaxVerlust)}</div></div>
      <div class="kpi" style="background:var(--sand)"><div class="l">Schwankung p.a.</div><div class="v">${pctS(k.volatilitaet).replace("+", "")}</div><div class="sub">MSCI World ${pctS(k.benchVolatilitaet).replace("+", "")}</div></div>
    </div>
    ${k.jahre < 1 ? '<p class="muted small">Weniger als 1 Jahr: Renditen p.a. werden erst ab einem Jahr gezeigt.</p>' : ""}
    <div class="card" style="margin-top:18px">
      <div class="toolbar">
        <h2 style="margin:0;flex:1 1 auto">Wertentwicklung</h2>
        <div class="seg" id="range">${["1J", "3J", "5J", "Max"].map((f) => `<button type="button" data-f="${f}" class="${f === "Max" ? "on" : ""}">${f}</button>`).join("")}</div>
        <div class="seg" id="mode"><button type="button" data-m="eur" class="on">€</button><button type="button" data-m="pct">%</button></div>
      </div>
      <div id="chart"></div>
      <p class="src">Quelle: ${esc(r.quelle)} · Stand ${datumKurz(r.punkte.at(-1).tag, true)} · ohne Kosten und Steuern</p>
      <details><summary>Werte als Tabelle</summary><div class="table-wrap" id="tab"></div></details>
    </div>
    <div class="cols" style="margin-top:4px">
      <div class="card"><h2 style="margin-top:0">Positionen</h2><p class="muted small">Zeile antippen für die Kursentwicklung.</p>
        <div class="table-wrap"><table>
          <tr><th>Position</th><th class="num">Ziel</th><th class="num">Aktuell</th><th class="num">Wert</th><th class="num">Rendite</th><th>Verlauf</th></tr>
          ${r.positionen.map((x, i) => `<tr class="click" data-i="${i}" tabindex="0"><td>${esc(x.name)}<br><span class="muted small">${esc(x.isin || "")} ${esc(x.ticker)}</span></td>
            <td class="num">${num(x.gewicht * 100, 1)} %</td><td class="num">${x.anteilAktuell == null ? "–" : num(x.anteilAktuell * 100, 1) + " %"}</td>
            <td class="num">${eur(x.wert)}</td><td class="num ${tone(x.rendite)}">${pctS(x.rendite)}</td>
            <td>${Charts.spark((r.kurse[x.ticker] || []).slice(-52).map((q) => q[1]))}</td></tr>`).join("")}
        </table></div>
        <div id="kurs" style="margin-top:16px"></div>
      </div>
      <div class="card"><h2 style="margin-top:0">Aufteilung heute</h2><div id="auft"></div>
        <h3>Nach Anlageklasse (Ziel)</h3><div id="klassen"></div></div>
    </div>`);
  verdrahteLoeschen(id);

  let f = "Max", modus = "eur", posIdx = null;
  const zeichne = () => {
    const pts = Rechnen.fenster(r.punkte, f);
    const fmtX = (t, lang) => datumKurz(t, lang);
    if (modus === "eur") {
      Charts.linie(document.getElementById("chart"), {
        titel: "Wertentwicklung in Euro", yFormat: (v, lang) => (lang ? eur(v) : eur0(v)), xFormat: fmtX, hoehe: 340,
        serien: [
          { name: p.name.length > 22 ? "Portfolio" : p.name, farbe: "var(--series-1)", punkte: pts.map((x) => [x.tag, x.wert]) },
          { name: "MSCI World", farbe: "var(--series-2)", punkte: pts.map((x) => [x.tag, x.bench]) },
          { name: "Eingezahlt", farbe: "var(--ref)", strich: "dash", punkte: pts.map((x) => [x.tag, x.eingezahlt]) },
        ],
      });
    } else {
      const a = pts[0];
      Charts.linie(document.getElementById("chart"), {
        titel: "Wertentwicklung in Prozent", yFormat: (v) => pctS(v, 1), xFormat: fmtX, hoehe: 340, nullLinie: true,
        serien: [
          { name: p.name.length > 22 ? "Portfolio" : p.name, farbe: "var(--series-1)", punkte: pts.map((x) => [x.tag, x.index / a.index - 1]) },
          { name: "MSCI World", farbe: "var(--series-2)", punkte: pts.map((x) => [x.tag, x.benchIndex / a.benchIndex - 1]) },
        ],
      });
    }
    // Tabelle: Monatswerte
    const monat = [];
    for (const x of pts) if (!monat.length || monat.at(-1).tag.slice(0, 7) !== x.tag.slice(0, 7)) monat.push(x); else monat[monat.length - 1] = x;
    document.getElementById("tab").innerHTML = `<table><tr><th>Monat</th><th class="num">Wert</th><th class="num">MSCI World</th><th class="num">Eingezahlt</th></tr>
      ${monat.reverse().map((x) => `<tr><td>${datumKurz(x.tag)}</td><td class="num">${eur(x.wert)}</td><td class="num">${eur(x.bench)}</td><td class="num">${eur(x.eingezahlt)}</td></tr>`).join("")}</table>`;
    if (posIdx != null) zeichneKurs();
  };
  const zeichneKurs = () => {
    const x = r.positionen[posIdx];
    const reihe = r.kurse[x.ticker] || [];
    const grenze = Rechnen.fenster(reihe.map((q) => ({ tag: q[0] })), f)[0]?.tag || "";
    const pts = reihe.filter((q) => q[0] >= grenze);
    const box = document.getElementById("kurs");
    if (pts.length < 2) { box.innerHTML = errBox(`Keine Kurse für ${x.ticker}`); return; }
    box.innerHTML = `<h3 style="margin:0 0 4px">${esc(x.name)} – Kursentwicklung</h3>
      <p class="muted small">${f}: ${pctS(pts.at(-1)[1] / pts[0][1] - 1)} · letzter Kurs ${num(pts.at(-1)[1], 4)}</p><div id="kc"></div>`;
    Charts.linie(document.getElementById("kc"), {
      titel: `Kurs ${x.name}`, yFormat: (v) => num(v, 2), xFormat: (t, l) => datumKurz(t, l), hoehe: 240,
      serien: [{ name: x.ticker, farbe: "var(--series-1)", punkte: pts }],
    });
  };
  document.querySelectorAll("#range button").forEach((b) => (b.onclick = () => {
    f = b.dataset.f; document.querySelectorAll("#range button").forEach((x) => x.classList.toggle("on", x === b)); zeichne();
  }));
  document.querySelectorAll("#mode button").forEach((b) => (b.onclick = () => {
    modus = b.dataset.m; document.querySelectorAll("#mode button").forEach((x) => x.classList.toggle("on", x === b)); zeichne();
  }));
  document.querySelectorAll("tr.click").forEach((tr) => {
    const go = () => { posIdx = +tr.dataset.i; zeichneKurs(); document.getElementById("kurs").scrollIntoView({ behavior: "smooth", block: "nearest" }); };
    tr.onclick = go;
    tr.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } };
  });
  zeichne();
  Charts.balken(document.getElementById("auft"), r.positionen.map((x) => ({
    name: x.name, wert: x.anteilAktuell || 0, text: x.anteilAktuell == null ? "–" : `${num(x.anteilAktuell * 100, 1)} %`,
    sub: `Ziel ${num(x.gewicht * 100, 1)} % · ${eur(x.wert)}`,
  })), { max: 1 });
  const sz = await szDaten();
  const kl = Rechnen.klassenAnteile(p.positionen);
  Charts.balken(document.getElementById("klassen"), Object.entries(kl).sort((a, b) => b[1] - a[1]).map(([k2, v]) => ({
    name: sz.klassen[k2] || k2, wert: v, text: `${num(v * 100, 1)} %`,
  })), { max: 1 });
}

function verdrahteLoeschen(id) {
  const b = document.getElementById("del");
  if (!b) return;
  b.onclick = () => {
    document.getElementById("confirm").innerHTML = `<div class="notice" style="margin:12px 0">Portfolio wirklich löschen? Das lässt sich nicht rückgängig machen.
      <div class="actions"><button class="primary" id="del-ok">Ja, löschen</button><button class="ghost" id="del-no">Abbrechen</button></div></div>`;
    document.getElementById("del-no").onclick = () => (document.getElementById("confirm").innerHTML = "");
    document.getElementById("del-ok").onclick = async () => { await api(`/api/portfolios/${id}`, { method: "DELETE" }); location.hash = "#/plaene"; };
  };
}

// ---------- Szenarien ----------

async function strategieAusQuelle(quelle, id) {
  const kat = await katalog();
  const klassenVon = (x) => (kat.produkte.find((k) => (x.isin && k.isin === x.isin) || (x.ticker && k.ticker === x.ticker)) || {}).klassen;
  if (quelle === "portfolio") {
    const p = await api(`/api/portfolios/${id}`);
    const wert = LETZTE_WERTE[id] ?? Rechnen.termine(p.startdatum, HEUTE()).reduce((a, _, i) => a + (i === 0 ? p.einmalbetrag : p.sparrate), 0);
    return { titel: p.name, zurueck: `#/portfolios/${id}`, depotwert: Math.round(wert), positionen: p.positionen.map((x) => ({ name: x.name, anteil: x.anteil, klassen: x.klassen })) };
  }
  if (quelle === "plan") {
    const p = await api(`/api/plaene/${id}`);
    const e = p.frozen.entscheidung;
    return { titel: p.title, zurueck: `#/plaene/${id}`, planId: id, depotwert: Math.round(e.einmalbetrag || e.sparrate * 12 || 10000),
      positionen: e.produkte.map((x) => ({ name: x.name || x.ticker, anteil: x.anteil * 100, klassen: klassenVon(x) || { aktien_welt: 1 }, geschaetzt: !klassenVon(x) })) };
  }
  if (quelle === "council") {
    const c = await api(`/api/council/${id}`);
    const prod = (c.session.result?.pruefung?.produkt?.produkte || []).filter((x) => x.verifiziert);
    const pos = prod.map((x) => ({ name: x.name, anteil: 100 / prod.length, klassen: klassenVon(x) || { aktien_welt: 1 } }));
    return { titel: c.session.result?.synthese?.richtung || "Council-Strategie", zurueck: `#/council/${id}`, depotwert: 10000,
      positionen: pos.length ? pos : [{ name: "Aktien Welt", anteil: 100, klassen: { aktien_welt: 1 }, geschaetzt: true }] };
  }
  return { titel: "Eigene Strategie", zurueck: "#/plaene", depotwert: 10000, positionen: [{ name: "Aktien Welt", anteil: 100, klassen: { aktien_welt: 1 } }] };
}

async function viewSzenario(query) {
  const q = new URLSearchParams(query || "");
  const [sz, st] = await Promise.all([szDaten(), strategieAusQuelle(q.get("quelle"), q.get("id"))]);
  const klOpt = (sel) => Object.entries(sz.klassen).map(([k, v]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${esc(v)}</option>`).join("");
  let gewaehlt = null, kiDef = null;
  render(`${kopf("Szenario anwenden", st.zurueck)}
    <p class="muted" style="max-width:75ch">Was passiert mit <b>${esc(st.titel)}</b>, wenn …? Gerechnet wird mit festen Annahmen je Anlageklasse, angelehnt an historische Vorbilder. Es geht um die Richtung und die Begründung, nicht um Kommastellen.</p>
    <div class="cols">
      <div>
        <div class="szgrid" id="szs">
          ${sz.szenarien.map((s) => `<button type="button" class="szbtn" data-id="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.kurz)}</span></button>`).join("")}
          <button type="button" class="szbtn" data-id="eigenes"><b>Eigenes Szenario</b><span>Beschreibe es, die KI schätzt die Auswirkungen.</span></button>
        </div>
        <div id="frei" hidden class="card" style="margin-top:14px"><label for="frei-t">Dein Szenario</label>
          <textarea id="frei-t" placeholder="z. B. China blockiert Taiwan für 6 Monate"></textarea>
          <div class="actions"><button class="primary" id="frei-go">Auswirkungen schätzen lassen</button></div><div id="frei-e"></div></div>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Strategie</h2>
        <label for="dw">Depotwert heute (€)</label><input id="dw" type="number" min="0" step="any" value="${esc(st.depotwert)}">
        <div id="pos">${st.positionen.map((x, i) => `<div class="row" style="margin-top:8px" data-i="${i}">
          <div style="flex:2 1 150px"><label>${esc(x.name)}${x.geschaetzt ? ' <span class="est">Klasse geschätzt</span>' : ""}</label>
            <select class="skl">${klOpt(Object.keys(x.klassen || { aktien_welt: 1 }).sort((a, b) => (x.klassen[b] || 0) - (x.klassen[a] || 0))[0])}</select></div>
          <div style="flex:1 1 80px"><label>Anteil %</label><input class="sant" type="number" step="any" min="0" value="${esc(num(x.anteil, 1).replace(",", "."))}"></div></div>`).join("")}</div>
        <p class="muted small">Gemischte Produkte (z. B. All-World) werden mit ihrer genauen Klassen-Mischung gerechnet, solange du die Klasse nicht änderst.</p>
      </div>
    </div>
    <div id="erg"></div>`);
  const positionen = () => [...document.querySelectorAll("#pos [data-i]")].map((row) => {
    const x = st.positionen[+row.dataset.i];
    const kl = row.querySelector(".skl").value;
    const orig = Object.keys(x.klassen || {}).sort((a, b) => x.klassen[b] - x.klassen[a])[0];
    return { name: x.name, anteil: Number(row.querySelector(".sant").value) || 0, klassen: kl === orig ? x.klassen : { [kl]: 1 } };
  });
  const rechneNeu = () => { if (gewaehlt) zeigeErgebnis(gewaehlt === "eigenes" ? kiDef : sz.szenarien.find((s) => s.id === gewaehlt)); };
  document.querySelectorAll("#pos input, #pos select, #dw").forEach((i) => (i.oninput = i.onchange = rechneNeu));
  document.querySelectorAll(".szbtn").forEach((b) => (b.onclick = () => {
    document.querySelectorAll(".szbtn").forEach((x) => x.classList.toggle("on", x === b));
    gewaehlt = b.dataset.id;
    document.getElementById("frei").hidden = gewaehlt !== "eigenes";
    if (gewaehlt === "eigenes") { if (kiDef) rechneNeu(); else document.getElementById("erg").innerHTML = ""; return; }
    rechneNeu();
    document.getElementById("erg").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  document.getElementById("frei-go").onclick = async (ev) => {
    const text = document.getElementById("frei-t").value.trim();
    if (!text) return;
    ev.target.disabled = true;
    document.getElementById("frei-e").innerHTML = '<div class="progress" style="margin-top:10px"><span class="dot"></span>Die KI übersetzt dein Szenario in Annahmen …</div>';
    try {
      const r = await api("/api/szenario/ki", { body: { freitext: text, titel: st.titel, depotwert: Number(document.getElementById("dw").value) || 0, positionen: positionen() } });
      const d = await warteKI(r.id);
      if (d.status !== "fertig") throw new Error(d.ergebnis?.fehler || "Fehler");
      kiDef = d.ergebnis;
      document.getElementById("frei-e").innerHTML = "";
      zeigeErgebnis(kiDef);
    } catch (e) { document.getElementById("frei-e").innerHTML = errBox(e); }
    ev.target.disabled = false;
  };

  function zeigeErgebnis(def) {
    const dw = Number(document.getElementById("dw").value) || 0;
    const pos = positionen();
    const r = Rechnen.szenario(pos, def, dw);
    const varName = { schwer: "schwerer Verlauf", mittel: "mittlerer Verlauf", mild: "milder Verlauf" };
    const karte = (k, cls, titel) => {
      const v = r[k];
      return `<div class="kpi ${cls}"><div class="l">${titel} · ${varName[v.variante]}</div>
        <div class="v">${eur0(v.ende.wert)}</div><div class="sub"><b class="${tone(v.ende.veraenderung)}">${pctS(v.ende.veraenderung)}</b> nach ${r.horizont} Monaten</div>
        <div class="sub">Tiefpunkt ${pctS(v.tief.veraenderung)} in Monat ${v.tief.monat}</div></div>`;
    };
    const imDepot = new Set(pos.flatMap((x) => Object.keys(x.klassen)));
    const begr = Object.entries(def.begruendung || {}).sort((a, b) => (imDepot.has(b[0]) ? 1 : 0) - (imDepot.has(a[0]) ? 1 : 0));
    document.getElementById("erg").innerHTML = `<h2>${esc(def.name)} ${def.geschaetzt_von_ki ? '<span class="est">Annahmen von der KI geschätzt</span>' : ""}</h2>
      <p class="muted" style="max-width:75ch">${esc(def.kurz || "")}</p>
      <div class="grid3">${karte("worst", "k-worst", "Worst Case")}${karte("realistisch", "k-real", "Realistisch")}${karte("best", "k-best", "Best Case")}</div>
      <div class="cols" style="margin-top:16px">
        <div class="card"><h3 style="margin-top:0">Entwicklung über ${r.horizont} Monate</h3><div id="szc"></div>
          <p class="src">Modellrechnung mit Annahmen (Größenordnung), keine Prognose.</p>
          <details><summary>Werte als Tabelle</summary><div class="table-wrap"><table><tr><th>Monat</th><th class="num">Worst</th><th class="num">Realistisch</th><th class="num">Best</th></tr>
          ${r.realistisch.pfad.filter((x) => x.monat % 3 === 0 || x.monat === r.horizont).map((x) => `<tr><td>${x.monat}</td><td class="num">${eur0(r.worst.pfad[x.monat].wert)}</td><td class="num">${eur0(x.wert)}</td><td class="num">${eur0(r.best.pfad[x.monat].wert)}</td></tr>`).join("")}</table></div></details></div>
        <div class="card"><h3 style="margin-top:0">Was jede Position beiträgt (realistisch)</h3><div id="szb"></div></div>
      </div>
      <div class="cols">
        <div class="card">
          <h3 style="margin-top:0">Auslöser</h3><p>${esc(def.ausloeser)}</p>
          <h3>Verlauf</h3><div class="timeline">${(def.phasen || []).map((ph) => `<div class="ph"><b>${esc(ph.zeitraum)}</b><span>${esc(ph.was)}</span></div>`).join("")}</div>
          <h3>Begründung je Anlageklasse</h3>
          ${begr.map(([k, t]) => `<p>${imDepot.has(k) ? "<b>" : '<span class="muted">'}${esc(sz.klassen[k] || k)}:${imDepot.has(k) ? "</b>" : "</span>"} ${esc(t)}</p>`).join("")}
        </div>
        <div class="card">
          <h3 style="margin-top:0">Treiber</h3><ul>${(def.treiber || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <h3>Historisches Vorbild</h3><p>${esc(def.vorbild)}</p>
          <div class="actions"><button class="primary" id="ki">KI-Begründung für meine Strategie</button>
            ${st.planId ? '<button id="save">Im Plan speichern</button>' : ""}</div>
          <div id="kiout"></div>
        </div>
      </div>`;
    Charts.linie(document.getElementById("szc"), {
      titel: "Szenario-Verlauf", x: "zahl", hoehe: 300, xFormat: (m, l) => (l ? `Monat ${m}` : `M ${m}`), yFormat: (v) => eur0(v),
      serien: [
        { name: "Realistisch", farbe: "var(--series-1)", punkte: r.realistisch.pfad.map((x) => [x.monat, x.wert]) },
        { name: "Worst", farbe: "var(--series-2)", punkte: r.worst.pfad.map((x) => [x.monat, x.wert]) },
        { name: "Best", farbe: "var(--series-3)", punkte: r.best.pfad.map((x) => [x.monat, x.wert]) },
        { name: "Heute", farbe: "var(--ref)", strich: "dash", punkte: r.realistisch.pfad.map((x) => [x.monat, dw]) },
      ],
    });
    Charts.balken(document.getElementById("szb"), r.realistisch.beitraege.map((b) => ({
      name: b.name, wert: b.beitrag, text: eur0(b.beitrag), sub: `${num(b.anteil * 100, 1)} % Anteil · ${pctS(b.veraenderung)}`,
      farbe: b.beitrag >= 0 ? "var(--series-3)" : "var(--series-2)",
    })));
    let kiErg = null;
    document.getElementById("ki").onclick = async (ev) => {
      ev.target.disabled = true;
      const out = document.getElementById("kiout");
      out.innerHTML = '<div class="progress" style="margin-top:10px"><span class="dot"></span>Der Szenario-Analyst denkt nach …</div>';
      try {
        const kurz = { worst: r.worst.ende.veraenderung, realistisch: r.realistisch.ende.veraenderung, best: r.best.ende.veraenderung, tief_realistisch: r.realistisch.tief.veraenderung };
        const body = def.id === "eigenes"
          ? { freitext: def.kurz || def.name, titel: st.titel, depotwert: dw, positionen: pos, ergebnis_kurz: kurz }
          : { szenario: def.id, titel: st.titel, depotwert: dw, positionen: pos, ergebnis_kurz: kurz };
        const k = await api("/api/szenario/ki", { body });
        const d = await warteKI(k.id);
        if (d.status !== "fertig") throw new Error(d.ergebnis?.fehler || "Fehler");
        kiErg = d.ergebnis;
        out.innerHTML = kiHtml(kiErg, d);
      } catch (e) { out.innerHTML = errBox(e); }
      ev.target.disabled = false;
    };
    const save = document.getElementById("save");
    if (save) save.onclick = async () => {
      await api(`/api/plaene/${st.planId}/szenario`, { body: { inhalt: {
        szenario: def.name, depotwert: dw, horizont: r.horizont,
        worst: r.worst.ende.veraenderung, realistisch: r.realistisch.ende.veraenderung, best: r.best.ende.veraenderung,
        tief: r.realistisch.tief.veraenderung, ki: kiErg } } });
      toast("Im Plan gespeichert");
    };
  }
}

async function warteKI(id) {
  for (let i = 0; i < 90; i++) {
    const d = await api(`/api/szenario/ki/${id}`);
    if (d.status !== "laeuft") return d;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Zeitüberschreitung – bitte später erneut versuchen.");
}

function kiHtml(k, d) {
  if (!k.einordnung) return "";
  return `<div style="margin-top:14px"><h3>Einschätzung für deine Strategie</h3><p>${esc(k.einordnung)}</p>
    ${(k.verlauf || []).length ? `<div class="timeline">${k.verlauf.map((v) => `<div class="ph"><b>${esc(v.zeitraum)}</b><span>${esc(v.entwicklung)}</span></div>`).join("")}</div>` : ""}
    ${(k.begruendung || []).length ? `<h3>Position für Position</h3>${k.begruendung.map((b) => `<p><b>${esc(b.position)}</b> <span class="pill p-lav">${esc(b.richtung)}</span><br>${esc(b.warum)}</p>`).join("")}` : ""}
    ${k.annahmen_kritik ? `<h3>Wo das Modell danebenliegen könnte</h3><p>${esc(k.annahmen_kritik)}</p>` : ""}
    ${k.wahrscheinlichkeit_szenario ? `<p><b>Wie wahrscheinlich ist das Szenario?</b> ${esc(k.wahrscheinlichkeit_szenario)}</p>` : ""}
    ${(k.gegenmassnahmen || []).length ? `<h3>Was du tun kannst</h3><ul>${k.gegenmassnahmen.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
    <p class="src">Modell: ${esc(d.provider || "")}/${esc(d.model || "")}</p></div>`;
}
