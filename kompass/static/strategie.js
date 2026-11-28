// Kompass – Strategie-Entwürfe (mehrere), Auswahl-Dialog „Zu Strategie hinzufügen“ und Sicherheitscheck.
"use strict";

// ---------- Kleiner Dialog ----------

function dialog(titel, inhalt) {
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titel)}">
    <div class="sheet-kopf"><h2>${esc(titel)}</h2><button type="button" class="ghost sheet-zu" aria-label="Schließen">Schließen</button></div>
    <div class="sheet-inhalt">${inhalt}</div></div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("offen"));
  const zu = () => { ov.classList.remove("offen"); setTimeout(() => ov.remove(), 220); };
  ov.querySelector(".sheet-zu").onclick = zu;
  ov.addEventListener("click", (ev) => { if (ev.target === ov) zu(); });
  ov.addEventListener("keydown", (ev) => { if (ev.key === "Escape") zu(); });
  setTimeout(() => ov.querySelector("button, a, input")?.focus(), 50);
  return { el: ov, zu };
}

// ---------- Entwürfe ----------

async function aktualisiereEntwurfZaehler() {
  try {
    const l = await api("/api/entwuerfe");
    ENTWURF_ANZAHL = l.length;
    const el = document.getElementById("nav-entwurf");
    if (el) { el.hidden = !ENTWURF_ANZAHL; el.querySelector("b").textContent = ENTWURF_ANZAHL; }
  } catch { /* nicht angemeldet */ }
}

// Produkt oder Anlage zu einer Strategie hinzufügen: Auswahl aus vorhandenen Entwürfen oder neue Strategie.
async function zuStrategie(quelle, titel = "Zu welcher Strategie?") {
  const liste = await api("/api/entwuerfe");
  const d = dialog(titel, `
    ${slider({ id: "zs-anteil", label: "Anteil in der Strategie", skala: "prozent", wert: quelle.anteil ?? 10 })}
    <div class="list" style="margin-top:8px">${liste.map((e) => `<a class="item" href="#" data-eid="${e.id}"><span class="t">${esc(e.name)}<br>
      <span class="muted small">${e.positionen.length} Positionen · zuletzt ${datum(e.updated_at)}</span></span></a>`).join("") || '<p class="muted">Noch keine Entwürfe.</p>'}</div>
    <div class="actions"><button class="primary" id="zs-neu">+ Neue Strategie damit starten</button></div>`);
  initSlider(d.el);
  d.el.querySelectorAll("[data-eid]").forEach((a) => (a.onclick = async (ev) => {
    ev.preventDefault();
    try {
      await api(`/api/entwuerfe/${a.dataset.eid}/position`, { body: { ...quelle, anteil: slWert("zs-anteil") } });
      d.zu(); aktualisiereEntwurfZaehler();
      toast("Zur Strategie hinzugefügt");
    } catch (e) { toast(e.message); }
  }));
  d.el.querySelector("#zs-neu").onclick = async () => {
    const e = await api("/api/entwuerfe", { body: { name: quelle.name ? `Strategie mit ${quelle.name}` : "", quelle: { ...quelle, anteil: slWert("zs-anteil") } } });
    d.zu(); aktualisiereEntwurfZaehler();
    location.hash = `#/entwurf/${e.id}`;
  };
}

async function neueStrategie(quelle) {
  const e = await api("/api/entwuerfe", { body: { name: quelle?.name ? `Strategie mit ${quelle.name}` : "", quelle: quelle ? { ...quelle, anteil: 100 } : null } });
  aktualisiereEntwurfZaehler();
  return e;
}

function entwurfKarte(e) {
  const summe = e.positionen.reduce((a, p) => a + (+p.anteil || 0), 0) || 1;
  const farben = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--lav-d)", "var(--peach-d)", "var(--sky-d)"];
  return `<a class="pcard" href="#/entwurf/${e.id}"><span class="pname">${esc(e.name)}</span>
    <span class="muted small">${e.positionen.length} Positionen · Risiko ${e.risiko}/5 · ${eur0(e.einmalbetrag)} + ${eur0(e.sparrate)}/Monat</span>
    <span class="mixbar" aria-hidden="true">${e.positionen.slice(0, 6).map((p, i) => `<i style="width:${(100 * (+p.anteil || 0)) / summe}%;background:${farben[i % farben.length]}"></i>`).join("")}</span>
    <span class="muted small">${e.positionen.slice(0, 4).map((p) => `${esc(p.name)} ${num(p.anteil, 0)} %`).join(" · ")}${e.positionen.length > 4 ? " …" : ""}</span>
    <span class="muted small">zuletzt bearbeitet ${datum(e.updated_at)}${e.schritt ? ` · Baukasten Schritt ${e.schritt}` : ""}</span></a>`;
}

async function viewEntwuerfe() {
  const l = await api("/api/entwuerfe");
  render(`${kopf("Pläne", "#/", `<a class="btn primary" href="#/bauen">Schritt für Schritt bauen</a><button id="neu-leer">Leere Strategie</button>`)}
    ${planTabs("entwuerfe")}
    <p class="muted">Strategien in Arbeit. Erst nach dem Sicherheitscheck werden sie zum Portfolio.</p>
    <div class="cards">${l.map(entwurfKarte).join("")}<a class="pcard neu" href="#/bauen">+ Neue Strategie bauen</a></div>`);
  document.getElementById("neu-leer").onclick = async () => { const e = await neueStrategie(null); location.hash = `#/entwurf/${e.id}`; };
}

// ---------- Sicherheitscheck ----------

const CHECK_TEXT = {
  bestaetigt: ["Bestätigt", "p-mint", "✓"], widerlegt: ["Widerlegt", "p-rose", "✕"], verfrueht: ["Verfrüht", "p-sand", "!"],
  veraltet: ["Veraltet", "p-sand", "!"], nicht_pruefbar: ["Nicht prüfbar", "p-sky", "?"], meinung: ["Meinung/Prognose", "p-lav", "~"],
};
const AMPEL = { gruen: ["Grün – Grundlagen stimmen mit aktuellen Daten überein", "p-mint"], gelb: ["Gelb – einiges ist unbestätigt oder nicht prüfbar", "p-sand"], rot: ["Rot – mindestens eine Grundlage stimmt nicht", "p-rose"] };

function checkHtml(r) {
  const e = r.ergebnis;
  const zeile = (titel, st, text, extra = "") => `<div class="norm"><span class="pill ${CHECK_TEXT[st][1]}">${CHECK_TEXT[st][2]}</span><div><b>${esc(titel)}</b> <span class="pill ${CHECK_TEXT[st][1]}">${CHECK_TEXT[st][0]}</span><br><span>${esc(text)}</span>${extra}</div></div>`;
  return `<div class="ampel ${e.ampel}"><span class="pill ${AMPEL[e.ampel][1]}">${AMPEL[e.ampel][0]}</span><span class="muted small">geprüft ${esc(e.zeitpunkt.replace("T", " ").slice(0, 16))}</span></div>
    ${e.hinweise.map((h) => `<div class="notice small" style="margin:8px 0">${esc(h)}</div>`).join("")}
    ${e.behauptungen.length ? `<h3>Behauptungen</h3>${e.behauptungen.map((b) => zeile(b.aussage, b.status, [b.begruendung, b.regel].filter(Boolean).join(" · "),
      b.treffer?.length ? `<div class="chips" style="margin-top:6px">${b.treffer.slice(0, 4).map((t) => `<a class="chip" href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.quelle)} · ${esc(t.datum)}</a>`).join("")}</div>` : "")).join("")}` : ""}
    <h3>Feste Prüfungen</h3>${e.feste.map((f) => zeile(f.pruefung, f.status, f.text)).join("") || '<p class="muted">Keine Positionen.</p>'}
    <details><summary>Verwendete Live-Daten</summary><table>${Object.values(e.indikatoren).map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${num(i.wert, 2)}</td><td>${esc(i.datum)}${i.live ? "" : ' <span class="est">nicht live</span>'}</td></tr>`).join("")}</table></details>`;
}

/**
 * Sicherheitscheck vor dem Speichern. Zeigt im Container einen Ablauf: starten → Ergebnis → speichern.
 * quelle: {art, id?, session_id?, positionen?, text?}; speichern(check_id, trotzdem) führt das Speichern aus.
 */
function sicherheitscheck(box, quelle, speichern, knopfText = "Speichern") {
  box.innerHTML = `<div class="check-box"><h3 style="margin-top:0">Sicherheitscheck</h3>
    <p class="muted small">Bevor gespeichert wird, gleicht Kompass die Grundlagen mit Echtzeit-Daten ab: aktuelle Kurse, Live-Kennzahlen und Meldungen aus 25 vertrauenswürdigen Quellen. Unbestätigtes oder Verfrühtes wird nicht als Fakt gewertet.</p>
    <div class="actions"><button class="primary" type="button" id="chk-go">Sicherheitscheck starten</button></div><div id="chk-out"></div></div>`;
  box.querySelector("#chk-go").onclick = async (ev) => {
    ev.target.disabled = true;
    const out = box.querySelector("#chk-out");
    out.innerHTML = '<div class="progress" style="margin-top:12px"><span class="dot"></span>Prüfe gegen Echtzeit-Daten und Quellen …</div>';
    try {
      const { id } = await api("/api/faktencheck", { body: quelle });
      let r;
      for (let i = 0; i < 120; i++) { r = await api(`/api/faktencheck/${id}`); if (r.status !== "laeuft") break; await new Promise((x) => setTimeout(x, 2000)); }
      const rot = r.ergebnis.ampel === "rot";
      out.innerHTML = `${checkHtml(r)}
        ${rot ? '<label class="check-row"><input type="checkbox" id="chk-trotzdem"> Ich habe die Warnungen gelesen und will trotzdem speichern.</label>' : ""}
        <div id="chk-err"></div><div class="actions"><button class="primary" type="button" id="chk-save" ${rot ? "disabled" : ""}>${esc(knopfText)}</button>
        <button class="ghost" type="button" id="chk-neu">Erneut prüfen</button></div>`;
      const t = out.querySelector("#chk-trotzdem");
      if (t) t.onchange = () => (out.querySelector("#chk-save").disabled = !t.checked);
      out.querySelector("#chk-neu").onclick = () => sicherheitscheck(box, quelle, speichern, knopfText);
      out.querySelector("#chk-save").onclick = async (e2) => {
        e2.target.disabled = true;
        try { await speichern(id, !!(t && t.checked)); } catch (ex) { out.querySelector("#chk-err").innerHTML = errBox(ex); e2.target.disabled = false; }
      };
    } catch (ex) { out.innerHTML = errBox(ex); ev.target.disabled = false; }
  };
}

// ---------- Einzelner Entwurf ----------

async function viewEntwurfId(eid) {
  const [e, g] = await Promise.all([api(`/api/entwuerfe/${eid}`), glossarDaten()]);
  const stufe = (n) => g.risikostufen.find((s) => s.stufe === n);
  render(`${kopf(e.name || "Unbenannter Entwurf", "#/plaene/entwuerfe", `<a class="btn" href="#/glossar">+ Aus dem Glossar</a><button id="e-council">Council: Kombination empfehlen</button><a class="btn" href="#/bauen/${eid}/1">Im Baukasten öffnen</a>`)}
    <div id="e-err"></div>
    <div class="cols">
      <div>
        <div class="card"><label for="e-name">Name</label><input id="e-name" value="${esc(e.name)}" placeholder="z. B. Wachstum mit Goldpuffer">
          <h2>Positionen</h2>
          <div id="e-pos">${e.positionen.length ? "" : '<p class="muted">Noch leer. Füge Produkte aus dem Glossar hinzu oder lass dir vom Council eine Kombination empfehlen.</p>'}</div>
          <div class="actions"><span id="rest-entwurf" class="rest"></span><button class="ghost" id="e-norm">Auf 100 % hochrechnen</button><button class="ghost" id="e-del">Entwurf löschen</button></div>
        </div>
        <div class="card"><h2 style="margin-top:0">Erwartung über ${e.horizont_jahre} Jahre <span class="est">Annahmen</span></h2><div id="e-erw"></div></div>
      </div>
      <div>
        <div class="card"><h2 style="margin-top:0">Rahmen</h2>
          ${slider({ id: "e-risiko", label: "Risikobereitschaft", skala: "risiko", wert: e.risiko, hinweis: stufe(e.risiko).text })}
          ${slider({ id: "e-einmal", label: "Einmalbetrag", skala: "geld", wert: e.einmalbetrag })}
          ${slider({ id: "e-spar", label: "Sparrate", skala: "rate", wert: e.sparrate })}
          ${slider({ id: "e-horizont", label: "Anlagezeitraum", skala: "jahre", wert: e.horizont_jahre })}
          ${slider({ id: "e-zurueck", label: "Rückrechnung mit echten Kursen", skala: "zurueck", wert: e.rueckrechnung_jahre })}
          <div id="e-warn"></div>
          <div class="actions"><a class="btn" href="#/szenario?quelle=entwurf&id=${eid}">Szenario anwenden</a></div>
        </div>
        <div class="card" id="e-check"></div>
      </div>
    </div>`);
  const posBox = document.getElementById("e-pos");
  const speichere = debounce(async () => { try { await api(`/api/entwuerfe/${eid}`, { method: "PUT", body: e }); } catch (ex) { toast(ex.message); } }, 500);
  const zeichnePositionen = () => {
    if (!e.positionen.length) return;
    posBox.innerHTML = e.positionen.map((p, i) => {
      const a = g.assets.find((x) => x.id === p.asset_id);
      return `<div class="e-row" data-i="${i}">
        <div class="e-name">${a ? monogramm(a, g) : '<span class="mono" aria-hidden="true">?</span>'}<div><b>${esc(p.name)}</b><br>
          <span class="muted small">${a ? `${esc(a.name)} · Risiko ${a.risiko}/5` : esc(p.ticker)}${(+p.hebel || 1) > 1 ? ` · Hebel ${p.hebel}×` : ""}${p.isin ? ` · ${esc(p.isin)}` : ""}</span>
          ${p.ticker || p.isin ? "" : `<input class="e-tick" data-i="${i}" placeholder="Ticker für die Rückrechnung, z. B. XEON.DE">`}
          ${p.warum ? `<div class="muted small">Council: ${esc(p.warum)}</div>` : ""}</div></div>
        <div class="e-sl">${slider({ id: `e-a${i}`, label: "Anteil", skala: "prozent", wert: p.anteil, klein: true, gruppe: "entwurf" })}</div>
        <button class="ghost" data-del="${i}" aria-label="${esc(p.name)} entfernen">Entfernen</button></div>`;
    }).join("");
    initSlider(posBox, (id, v) => { e.positionen[+id.slice(3)].anteil = v; aktualisiere(); });
    posBox.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { e.positionen.splice(+b.dataset.del, 1); posBox.innerHTML = ""; zeichnePositionen(); aktualisiere(); }));
    posBox.querySelectorAll(".e-tick").forEach((t) => (t.oninput = () => { e.positionen[+t.dataset.i].ticker = t.value.trim(); speichere(); }));
  };
  const aktualisiere = () => {
    const pos = e.positionen.map((p) => ({ ...p, risiko: g.assets.find((x) => x.id === p.asset_id)?.risiko }));
    const erg = pos.length ? Rechnen.erwartung(pos, e, g.klassen_erwartung, 1500) : null;
    const box = document.getElementById("e-erw");
    if (!erg) box.innerHTML = '<p class="muted">Sobald Positionen drin sind, siehst du hier die Spanne.</p>';
    else {
      const E = erg.ende;
      box.innerHTML = `<div class="kpis">
        <div class="kpi" style="background:var(--sky)"><div class="l">Erwartete Rendite</div><div class="v">≈ ${num(erg.mu * 100, 1)} % p.a.</div><div class="sub">Schwankung ≈ ${num(erg.sig * 100, 0)} %</div></div>
        <div class="kpi k-worst"><div class="l">Schlecht (5 %)</div><div class="v">${eur0(E.p5)}</div></div>
        <div class="kpi k-real"><div class="l">Mitte</div><div class="v">${eur0(E.p50)}</div></div>
        <div class="kpi k-best"><div class="l">Gut (95 %)</div><div class="v">${eur0(E.p95)}</div></div></div>
        <p class="muted small">Eingezahlt ${eur0(E.eingezahlt)} · nominal, vor Kosten und Steuern · Risiko ≈ ${num(erg.risiko, 1)}/5</p><div id="e-chart"></div>`;
      Charts.linie(document.getElementById("e-chart"), { titel: "Spanne", x: "zahl", hoehe: 240, xFormat: (t, l) => (l ? `Jahr ${t}` : `J ${t}`), yFormat: (v) => eur0(v),
        serien: [{ name: "Mitte", farbe: "var(--series-1)", punkte: erg.jahre.map((j) => [j.jahr, j.p50]) }, { name: "Schlecht", farbe: "var(--series-2)", punkte: erg.jahre.map((j) => [j.jahr, j.p5]) },
          { name: "Gut", farbe: "var(--series-3)", punkte: erg.jahre.map((j) => [j.jahr, j.p95]) }, { name: "Eingezahlt", farbe: "var(--ref)", strich: "dash", punkte: erg.jahre.map((j) => [j.jahr, j.eingezahlt]) }] });
    }
    const w = Rechnen.warnungen(pos, e.risiko, erg);
    document.getElementById("e-warn").innerHTML = w.map((x) => `<div class="notice small" style="margin:8px 0">${esc(x)}</div>`).join("");
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
    const neu = auf100(e.positionen.map((p) => +p.anteil || 0));
    e.positionen.forEach((p, i) => { p.anteil = neu[i]; setzeSlider(`e-a${i}`, neu[i], true); });
    aktualisiere();
  };
  document.getElementById("e-del").onclick = async () => {
    const d = dialog("Entwurf löschen?", `<p>„${esc(e.name || "Unbenannter Entwurf")}“ wird gelöscht. Das lässt sich nicht rückgängig machen.</p><div class="actions"><button class="primary" id="d-ok">Ja, löschen</button></div>`);
    d.el.querySelector("#d-ok").onclick = async () => { await api(`/api/entwuerfe/${eid}`, { method: "DELETE" }); d.zu(); aktualisiereEntwurfZaehler(); location.hash = "#/plaene/entwuerfe"; };
  };
  document.getElementById("e-council").onclick = () => assistentOeffnen("Empfiehl mir eine gute Kombination von Produkten, die die Ziele dieser Strategie ergänzt.", eid);
  sicherheitscheck(document.getElementById("e-check"), { art: "entwurf", id: +eid }, async (checkId, trotzdem) => {
    await api(`/api/entwuerfe/${eid}`, { method: "PUT", body: e });
    const r = await api(`/api/entwuerfe/${eid}/speichern`, { body: { check_id: checkId, trotzdem } });
    aktualisiereEntwurfZaehler();
    location.hash = `#/portfolios/${r.id}`;
  }, "Als Portfolio speichern");
  aktualisiere();
}
