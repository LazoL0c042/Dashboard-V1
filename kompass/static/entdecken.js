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

async function aktualisiereEntwurfZaehler() {
  try {
    const e = await api("/api/entwurf");
    ENTWURF_ANZAHL = e.positionen.length;
    const el = document.getElementById("nav-entwurf");
    if (el) { el.hidden = !ENTWURF_ANZAHL; el.querySelector("b").textContent = ENTWURF_ANZAHL; }
  } catch { /* nicht angemeldet */ }
}

async function inEntwurf(quelle, knopf) {
  try {
    await api("/api/entwurf/position", { body: quelle });
    toast("Im Entwurf gespeichert");
    if (knopf) { knopf.textContent = "✓ Im Entwurf"; knopf.disabled = true; }
    aktualisiereEntwurfZaehler();
  } catch (e) { toast(e.message); }
}

// ---------- Glossar ----------

async function viewGlossar() {
  const [g, e] = await Promise.all([glossarDaten(), api("/api/entwurf")]);
  const imEntwurf = new Set(e.positionen.map((p) => p.asset_id));
  render(`${kopf("Glossar der Anlageklassen", "#/recherche", `<a class="btn" href="#/entwurf">Entwurf ansehen</a>`)}
    ${rechercheTabs("glossar")}
    <div class="cols"><p class="muted" style="margin:0">Jede Anlage als Karte: kurze Beschreibung, Risiko, langfristige Annahmen, Gründe dafür und dagegen. Mit „+“ landet sie in deinem Portfolio-Entwurf.</p>
      <div>${slider({ id: "g-risiko", label: "Zeige Anlagen bis Risiko", skala: "risiko", wert: 5, hinweis: "Stufe 5 zeigt auch spekulative Werte wie Memecoins und Hebelprodukte." })}</div></div>
    <div id="g-liste">${g.hauptklassen.map((h) => {
      const items = g.assets.filter((a) => a.eltern === h.id);
      return `<section class="g-klasse" data-klasse="${h.id}"><div class="g-kopf"><h2>${esc(h.name)}</h2><p class="muted">${esc(h.kurz)}</p></div>
        <div class="g-grid">${items.map((a) => `<article class="g-karte" data-risiko="${a.risiko}">
          <div class="g-link">${monogramm(a, g)}<span class="g-name">${esc(a.name)}</span></div>
          <p class="g-kurz">${esc(a.kurz)}</p>
          <div class="g-stats"><span>Risiko ${pips(a.risiko, 5, a.risiko >= 5 ? "rot" : "")}</span><span>≈ ${num(a.erwartung.rendite, 1)} % p.a.<span class="est">Annahme</span></span></div>
          <div class="g-aktion"><a class="btn klein" href="#/glossar/${a.id}">Details</a>
            <button class="klein" data-add="${a.id}" ${imEntwurf.has(a.id) ? "disabled" : ""}>${imEntwurf.has(a.id) ? "✓ Im Entwurf" : "+ Entwurf"}</button></div>
        </article>`).join("")}</div></section>`;
    }).join("")}</div>`);
  const filter = (max) => {
    document.querySelectorAll(".g-karte").forEach((k) => (k.hidden = +k.dataset.risiko > max));
    document.querySelectorAll(".g-klasse").forEach((s) => (s.hidden = ![...s.querySelectorAll(".g-karte")].some((k) => !k.hidden)));
  };
  initSlider(document, (_, v) => filter(v));
  document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => inEntwurf({ asset_id: b.dataset.add, anteil: 10 }, b)));
}

async function viewAsset(aid) {
  const g = await glossarDaten();
  const a = g.assets.find((x) => x.id === aid);
  if (!a) throw new Error("Unbekannte Anlage");
  const h = g.hauptklassen.find((x) => x.id === a.eltern);
  const geschwister = g.assets.filter((x) => x.eltern === a.eltern && x.id !== a.id);
  const lf = a.langfrist;
  render(`<a class="crumb" href="#/glossar">‹ Glossar</a>
    <div class="cols">
      <div class="card asset-hero">
        <div class="row" style="align-items:center;gap:18px">${monogramm(a, g, true)}<div style="flex:1 1 220px"><span class="pill p-lav">${esc(h.name)}</span><h1 style="margin:6px 0 0">${esc(a.name)}</h1></div></div>
        <p class="item-text">${esc(a.kurz)}</p>
        <div class="stat-grid">
          <div><span class="l">Risiko</span>${pips(a.risiko, 5, a.risiko >= 5 ? "rot" : "")}</div>
          <div><span class="l">Verfügbarkeit</span>${pips(a.liquiditaet)}</div>
          <div><span class="l">Komplexität</span>${pips(a.komplexitaet)}</div>
          <div><span class="l">Erwartete Rendite</span><b>≈ ${num(a.erwartung.rendite, 1)} % p.a.</b> <span class="est">Annahme</span></div>
          <div><span class="l">Typische Schwankung</span><b>≈ ${num(a.erwartung.schwankung, 0)} % p.a.</b></div>
          ${(+a.hebel || 1) > 1 ? `<div><span class="l">Hebel</span><b>${a.hebel}×</b></div>` : ""}
        </div>
        ${a.mindestkapital ? `<p class="muted small">Mindestkapital: ${esc(a.mindestkapital)}</p>` : ""}
      </div>
      <div class="card">
        <h2 style="margin-top:0">In den Entwurf</h2>
        ${slider({ id: "a-anteil", label: "Anteil im Portfolio", skala: "prozent", wert: a.risiko >= 5 ? 5 : 10 })}
        ${a.katalog.length > 1 ? `<label for="a-prod">Produkt</label><select id="a-prod">${a.katalog.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.isin || p.ticker)})</option>`).join("")}</select>` : ""}
        <div class="actions"><button class="primary" id="a-add">+ In den Entwurf</button>
          <a class="btn" href="#/berater/neu?frage=${encodeURIComponent(`Passt ${a.name} zu mir, und wie viel Anteil wäre sinnvoll?`)}">Council fragen</a></div>
        ${a.risiko >= 5 ? '<div class="notice small" style="margin-top:12px">Spekulativ: Hier ist ein Totalverlust oder ein Einbruch von mehr als 70 % realistisch. Nur mit Geld, das du verlieren kannst.</div>' : ""}
      </div>
    </div>
    <div class="cols">
      <div class="card"><div class="toolbar"><h2 style="margin:0;flex:1">Kursverlauf</h2>
        ${a.ticker ? `<div class="seg" id="a-range">${["1J", "5J", "Max"].map((f) => `<button type="button" data-f="${f}" class="${f === "5J" ? "on" : ""}">${f}</button>`).join("")}</div>` : ""}</div>
        <div id="a-kurs">${a.ticker ? '<div class="progress"><span class="dot"></span>Lade Kurse …</div>' : '<p class="muted">Für diese Anlage gibt es keinen börsengehandelten Referenzkurs.</p>'}</div>
        ${a.ticker_hinweis ? `<p class="src">${esc(a.ticker_hinweis)}</p>` : ""}
      </div>
      <div class="card"><h2 style="margin-top:0">Langfristig</h2>
        ${lf ? `<div class="kpis">
          <div class="kpi" style="background:var(--mint)"><div class="l">Ø pro Jahr</div><div class="v">${pctS(lf.rendite_pa)}</div><div class="sub">real ${pctS(lf.rendite_pa_real)}</div></div>
          <div class="kpi" style="background:var(--rose)"><div class="l">Schlechtestes Jahr</div><div class="v">${pctS(lf.schlechtestes.wert)}</div><div class="sub">${lf.schlechtestes.jahr}</div></div>
          <div class="kpi" style="background:var(--sky)"><div class="l">Bestes Jahr</div><div class="v">${pctS(lf.bestes.wert)}</div><div class="sub">${lf.bestes.jahr}</div></div>
          <div class="kpi" style="background:var(--sand)"><div class="l">Verlustjahre</div><div class="v">${num(lf.anteil_verlustjahre * 100, 0)} %</div><div class="sub">${lf.jahre} Jahre</div></div>
        </div><div id="a-lf" style="margin-top:12px"></div><p class="src">${esc(lf.quelle)} · ${lf.zeitraum[0]}–${lf.zeitraum[1]}, nominal in USD-Logik</p>`
        : '<p class="muted">Keine lange, frei verfügbare Datenreihe. Die erwartete Rendite oben ist eine Annahme als Größenordnung.</p>'}
      </div>
    </div>
    <div class="cols">
      <div class="card"><div class="procon"><div><h3 class="up">Dafür</h3><ul>${a.pro.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3 class="down">Dagegen</h3><ul>${a.contra.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
        <h3>Besonderheiten</h3><ul class="besonders">${a.besonderheiten.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="card"><h3 style="margin-top:0">Steuern (Deutschland)</h3><p>${esc(a.steuer)}</p><p class="muted small">Vereinfachte Darstellung, Stand 2026 – im Einzelfall prüfen.</p>
        ${a.katalog.length ? `<h3>Produkte im Katalog</h3>${a.katalog.map((p) => `<p><a href="#/produkte/${esc(p.id)}">${esc(p.name)}</a><br><span class="muted small">${esc(p.isin)} · ${esc(p.ticker)}</span></p>`).join("")}` : ""}
        ${geschwister.length ? `<h3>Ähnlich in „${esc(h.name)}“</h3><div class="chips">${geschwister.map((x) => `<a class="chip" href="#/glossar/${x.id}">${esc(x.name)}</a>`).join("")}</div>` : ""}
      </div>
    </div>`);
  initSlider();
  document.getElementById("a-add").onclick = (ev) => {
    const sel = document.getElementById("a-prod");
    inEntwurf({ asset_id: a.id, id: sel ? sel.value : null, anteil: slWert("a-anteil") }, ev.target);
  };
  if (lf) {
    let w = 1;
    const pts = [[lf.zeitraum[0] - 1, 1]].concat(lf.verlauf.map(([y, r]) => [y, (w *= 1 + r)]));
    Charts.linie(document.getElementById("a-lf"), { titel: "Wachstum von 1 Dollar", x: "zahl", hoehe: 200, xFormat: (y) => String(y), yFormat: (v) => num(v, v < 10 ? 2 : 0),
      serien: [{ name: "1 $ angelegt", farbe: "var(--series-1)", punkte: pts }] });
  }
  if (a.ticker) {
    const start = new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10);
    const h0 = location.hash;
    try {
      const d = await api(`/api/kurse?tickers=${encodeURIComponent(a.ticker)}&start=${start}`);
      if (location.hash !== h0) return;
      const reihe = d.kurse[a.ticker] || [];
      const zeichne = (f) => {
        const grenze = Rechnen.fenster(reihe.map((q) => ({ tag: q[0] })), f)[0]?.tag || "";
        const pts = reihe.filter((q) => q[0] >= grenze);
        const box = document.getElementById("a-kurs");
        if (pts.length < 2) { box.innerHTML = '<p class="muted">Kurs nicht abrufbar.</p>'; return; }
        box.innerHTML = `<div class="kpis"><div class="kpi" style="background:var(--lav)"><div class="l">Aktueller Kurs</div><div class="v">${num(pts.at(-1)[1], 2)}</div><div class="sub">${datumKurz(pts.at(-1)[0], true)}</div></div>
          <div class="kpi" style="background:var(--mint)"><div class="l">Veränderung ${f}</div><div class="v ${tone(pts.at(-1)[1] / pts[0][1] - 1)}">${pctS(pts.at(-1)[1] / pts[0][1] - 1)}</div><div class="sub">seit ${datumKurz(pts[0][0], true)}</div></div></div><div id="a-kc" style="margin-top:12px"></div>
          <p class="src">Quelle: ${esc(d.quelle)} · Ticker ${esc(a.ticker)}</p>`;
        Charts.linie(document.getElementById("a-kc"), { titel: `Kurs ${a.name}`, hoehe: 240, xFormat: (t, l) => datumKurz(t, l), yFormat: (v) => num(v, 2),
          serien: [{ name: a.ticker, farbe: "var(--series-1)", punkte: pts }] });
      };
      zeichne("5J");
      document.querySelectorAll("#a-range button").forEach((b) => (b.onclick = () => {
        document.querySelectorAll("#a-range button").forEach((x) => x.classList.toggle("on", x === b)); zeichne(b.dataset.f);
      }));
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

// ---------- Entwurf (Warenkorb) ----------

async function viewEntwurf() {
  const [e, g] = await Promise.all([api("/api/entwurf"), glossarDaten()]);
  const stufe = (n) => g.risikostufen.find((s) => s.stufe === n);
  render(`${kopf(e.name || "Portfolio-Entwurf", "#/plaene", `<a class="btn" href="#/glossar">+ Aus dem Glossar</a><a class="btn" href="#/berater/neu">Mit dem Council besprechen</a><a class="btn" href="#/szenario?quelle=entwurf">Szenario anwenden</a><button class="primary" id="e-save">Als Portfolio speichern</button>`)}
    <p class="muted">Dein Warenkorb: Positionen sammeln, gewichten, Erwartung prüfen. Gespeichert wird automatisch – erst „Als Portfolio speichern“ macht daraus ein Portfolio.</p>
    <div id="e-err"></div>
    <div class="cols">
      <div>
        <div class="card"><label for="e-name">Name</label><input id="e-name" value="${esc(e.name)}" placeholder="z. B. Wachstum mit Goldpuffer">
          <h2>Positionen</h2>
          <div id="e-pos">${e.positionen.length ? "" : '<p class="muted">Noch leer. Füge Anlagen aus dem Glossar hinzu oder lass dir vom Council einen Vorschlag machen.</p>'}</div>
          <div class="actions"><span id="rest-entwurf" class="rest"></span><span class="muted" id="e-summe" hidden></span><button class="ghost" id="e-norm">Gleichmäßig auf 100 % hochrechnen</button><button class="ghost" id="e-leeren">Entwurf leeren</button></div>
        </div>
        <div class="card"><h2 style="margin-top:0">Erwartung über ${e.horizont_jahre} Jahre <span class="est">Annahmen</span></h2><div id="e-erw"></div></div>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Rahmen</h2>
        ${slider({ id: "e-risiko", label: "Risikobereitschaft", skala: "risiko", wert: e.risiko, hinweis: stufe(e.risiko).text })}
        ${slider({ id: "e-einmal", label: "Einmalbetrag", skala: "geld", wert: e.einmalbetrag })}
        ${slider({ id: "e-spar", label: "Sparrate", skala: "rate", wert: e.sparrate })}
        ${slider({ id: "e-horizont", label: "Anlagezeitraum", skala: "jahre", wert: e.horizont_jahre })}
        ${slider({ id: "e-zurueck", label: "Rückrechnung mit echten Kursen", skala: "zurueck", wert: e.rueckrechnung_jahre, hinweis: "Beim Speichern als Portfolio: so tun, als hättest du damals angefangen." })}
        <div id="e-warn"></div>
      </div>
    </div>`);
  const posBox = document.getElementById("e-pos");
  const zeichnePositionen = () => {
    if (!e.positionen.length) return;
    posBox.innerHTML = e.positionen.map((p, i) => {
      const a = g.assets.find((x) => x.id === p.asset_id);
      return `<div class="e-row" data-i="${i}">
        <div class="e-name">${a ? monogramm(a, g) : '<span class="mono" aria-hidden="true">?</span>'}<div><b>${esc(p.name)}</b><br>
          <span class="muted small">${a ? `${esc(a.name)} · Risiko ${a.risiko}/5` : esc(p.ticker)}${(+p.hebel || 1) > 1 ? ` · Hebel ${p.hebel}×` : ""}</span>
          ${p.ticker ? "" : `<input class="e-tick" data-i="${i}" placeholder="Ticker für die Rückrechnung, z. B. ein Tagesgeld-ETF wie XEON.DE">`}
          ${p.warum ? `<div class="muted small">Council: ${esc(p.warum)}</div>` : ""}</div></div>
        <div class="e-sl">${slider({ id: `e-a${i}`, label: "Anteil", skala: "prozent", wert: p.anteil, klein: true, gruppe: "entwurf" })}</div>
        <button class="ghost" data-del="${i}" aria-label="${esc(p.name)} entfernen">Entfernen</button></div>`;
    }).join("");
    initSlider(posBox, (id, v) => { e.positionen[+id.slice(3)].anteil = v; aktualisiere(); });
    posBox.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { e.positionen.splice(+b.dataset.del, 1); zeichnePositionen(); aktualisiere(); if (!e.positionen.length) viewEntwurf(); }));
    posBox.querySelectorAll(".e-tick").forEach((t) => (t.oninput = () => { e.positionen[+t.dataset.i].ticker = t.value.trim(); speichere(); }));
  };
  const speichere = debounce(async () => { await api("/api/entwurf", { method: "PUT", body: e }); aktualisiereEntwurfZaehler(); }, 500);
  const aktualisiere = () => {
    const summe = e.positionen.reduce((a, p) => a + (+p.anteil || 0), 0);
    document.getElementById("e-summe").textContent = e.positionen.length ? `Summe ${num(summe, 0)} %${Math.abs(summe - 100) > 0.5 ? " – wird beim Rechnen auf 100 % umgelegt" : ""}` : "";
    const pos = e.positionen.map((p) => ({ ...p, risiko: g.assets.find((x) => x.id === p.asset_id)?.risiko }));
    const erg = pos.length ? Rechnen.erwartung(pos, e, g.klassen_erwartung, 1500) : null;
    const box = document.getElementById("e-erw");
    if (!erg) { box.innerHTML = '<p class="muted">Sobald Positionen drin sind, siehst du hier die Spanne.</p>'; }
    else {
      const E = erg.ende;
      box.innerHTML = `<div class="kpis">
        <div class="kpi" style="background:var(--sky)"><div class="l">Erwartete Rendite</div><div class="v">≈ ${num(erg.mu * 100, 1)} % p.a.</div><div class="sub">Schwankung ≈ ${num(erg.sig * 100, 0)} %</div></div>
        <div class="kpi k-worst"><div class="l">Schlecht (5 %)</div><div class="v">${eur0(E.p5)}</div></div>
        <div class="kpi k-real"><div class="l">Mitte (Median)</div><div class="v">${eur0(E.p50)}</div></div>
        <div class="kpi k-best"><div class="l">Gut (95 %)</div><div class="v">${eur0(E.p95)}</div></div>
      </div><p class="muted small">Eingezahlt nach ${e.horizont_jahre} Jahren: ${eur0(E.eingezahlt)} · nominal, vor Kosten, Steuern und Inflation · Risiko des Portfolios ≈ ${num(erg.risiko, 1)}/5</p>
      <div id="e-chart"></div>
      <details><summary>Annahmen je Position</summary><table>${erg.positionen.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${num(x.w * 100, 1)} %</td><td class="num">≈ ${num(x.mu * 100, 1)} % p.a.</td><td class="num">± ${num(x.sig * 100, 0)} %</td></tr>`).join("")}</table>
        <p class="muted small">Langfristige Annahmen als Größenordnung aus dem Glossar, keine Prognose. Simulation mit 1.500 zufälligen Verläufen.</p></details>`;
      Charts.linie(document.getElementById("e-chart"), { titel: "Spanne der Entwicklung", x: "zahl", hoehe: 260, xFormat: (t, l) => (l ? `Jahr ${t}` : `J ${t}`), yFormat: (v) => eur0(v),
        serien: [
          { name: "Mitte", farbe: "var(--series-1)", punkte: erg.jahre.map((j) => [j.jahr, j.p50]) },
          { name: "Schlecht", farbe: "var(--series-2)", punkte: erg.jahre.map((j) => [j.jahr, j.p5]) },
          { name: "Gut", farbe: "var(--series-3)", punkte: erg.jahre.map((j) => [j.jahr, j.p95]) },
          { name: "Eingezahlt", farbe: "var(--ref)", strich: "dash", punkte: erg.jahre.map((j) => [j.jahr, j.eingezahlt]) },
        ] });
    }
    const w = Rechnen.warnungen(pos, e.risiko, erg);
    document.getElementById("e-warn").innerHTML = w.length ? `<h3>Hinweise</h3>${w.map((x) => `<div class="notice small" style="margin:8px 0">${esc(x)}</div>`).join("")}` : (erg ? '<p class="up small" style="margin-top:12px">Keine Klumpen- oder Risiko-Auffälligkeiten.</p>' : "");
    speichere();
  };
  zeichnePositionen();
  initSlider(document, (id, v) => {
    const map = { "e-risiko": "risiko", "e-einmal": "einmalbetrag", "e-spar": "sparrate", "e-horizont": "horizont_jahre", "e-zurueck": "rueckrechnung_jahre" };
    if (!map[id]) return;
    e[map[id]] = v;
    if (id === "e-risiko") document.getElementById("e-risiko-h").textContent = stufe(v).text;
    aktualisiere();
  });
  document.getElementById("e-name").oninput = (ev) => { e.name = ev.target.value; speichere(); };
  document.getElementById("e-norm").onclick = () => {
    const s = e.positionen.reduce((a, p) => a + (+p.anteil || 0), 0);
    if (!s) return;
    const neu = auf100(e.positionen.map((p) => +p.anteil || 0));
    e.positionen.forEach((p, i) => { p.anteil = neu[i]; setzeSlider(`e-a${i}`, p.anteil, true); });
    aktualisiere();
  };
  document.getElementById("e-leeren").onclick = async () => { await api("/api/entwurf", { method: "DELETE" }); aktualisiereEntwurfZaehler(); viewEntwurf(); };
  document.getElementById("e-save").onclick = async () => {
    try {
      await api("/api/entwurf", { method: "PUT", body: e });
      const r = await api("/api/entwurf/speichern", { body: {} });
      aktualisiereEntwurfZaehler();
      location.hash = `#/portfolios/${r.id}`;
    } catch (ex) { document.getElementById("e-err").innerHTML = errBox(ex); }
  };
  aktualisiere();
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
  render(`${kopf(c.titel, "#/berater/neu", `<a class="btn" href="#/entwurf">Entwurf öffnen</a>`)}
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
        <div id="b-ent"></div><div class="actions"><a class="btn" href="#/entwurf">Gewichten und Rahmen einstellen</a></div></div>
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
