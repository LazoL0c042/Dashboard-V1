// Kompass – Portfolio Schritt für Schritt bauen:
// 1. Gewichtung der Anlageklassen  2. Anlagen innerhalb der Klassen  3. Risiko  4. Produkte  5. Bewertung
// Der Zwischenstand liegt im Entwurf (entwurf.bau) und wird automatisch gespeichert.
"use strict";

const SCHRITTE = ["Gewichtung", "Anlageklassen", "Risiko", "Produkte", "Bewertung"];
const VORLAGEN = {
  Vorsichtig: { anleihen: 45, liquiditaet: 20, aktien: 25, edelmetalle: 10 },
  Ausgewogen: { aktien: 60, anleihen: 25, edelmetalle: 10, liquiditaet: 5 },
  Wachstum: { aktien: 80, edelmetalle: 10, anleihen: 5, krypto: 5 },
  Spekulativ: { aktien: 70, krypto: 15, edelmetalle: 10, hebel: 5 },
};
const PRODUKT_CACHE = {};

function bauPositionen(e, g, kat) {
  const b = e.bau, out = [];
  for (const [hk, w] of Object.entries(b.gewichte)) {
    if (!w) continue;
    for (const x of b.auswahl[hk] || []) {
      const a = g.assets.find((y) => y.id === x.asset_id);
      if (!a || !x.anteil) continue;
      const pid = b.produkte[a.id];
      const p = pid ? kat.produkte.find((y) => y.id === pid) : null;
      out.push({ asset_id: a.id, id: p?.id || null, name: p?.name || a.name, ticker: p?.ticker || a.ticker || "", isin: p?.isin || "",
        anteil: Math.round(((w * x.anteil) / 100) * 10) / 10, klassen: a.klassen, hebel: a.hebel || 1, erwartung: a.erwartung, risiko: a.risiko, eltern: a.eltern });
    }
  }
  // Rundung so korrigieren, dass die Summe genau stimmt
  const ziel = Object.values(b.gewichte).reduce((s, v) => s + v, 0);
  const diff = Math.round((ziel - out.reduce((s, p) => s + p.anteil, 0)) * 10) / 10;
  if (out.length && diff) out.sort((x, y) => y.anteil - x.anteil)[0].anteil += diff;
  return out;
}

function domizil(isin) {
  return { IE: "Irland", LU: "Luxemburg", DE: "Deutschland", FR: "Frankreich" }[(isin || "").slice(0, 2)] || null;
}

// Bewertung eines Produkts nach allgemeinen Kriterien (Kosten, Größe, Schwankung, Domizil, Risiko-Passung).
function produktBewertung(d, asset, stufe) {
  const out = (d?.bewertung || []).map((b) => ({ name: b.name, note: b.note, text: `${num(b.wert, 2)} ${b.einheit}`, regel: b.regel }));
  const dom = domizil(d?.isin);
  if (dom) {
    const usLastig = Object.keys(asset.klassen).some((k) => ["aktien_welt", "aktien_usa", "aktien_tech"].includes(k));
    out.push({ name: "Fondsdomizil", note: dom === "Irland" || !usLastig ? "gut" : "mittel", text: dom,
      regel: "Bei US-lastigen Aktien-ETFs gilt Irland als steuerlich günstig (Quellensteuer-Abkommen)" });
  }
  out.push({ name: "Passt zu deinem Risiko", note: asset.risiko <= stufe ? "gut" : asset.risiko === stufe + 1 ? "mittel" : "schwach",
    text: `Risiko ${asset.risiko}/5 bei Stufe ${stufe}`, regel: "Risiko der Anlage höchstens deine Stufe" });
  if (!(d?.bewertung || []).some((b) => b.kpi === "ter")) out.push({ name: "Laufende Kosten (TER)", note: "offen", text: "nicht hinterlegt", regel: "auf justETF oder beim Anbieter prüfen" });
  return out;
}

async function produktDetail(id) {
  if (!PRODUKT_CACHE[id]) PRODUKT_CACHE[id] = api(`/api/produkte/${encodeURIComponent(id)}`).catch(() => null);
  return PRODUKT_CACHE[id];
}

async function viewBauen(schrittParam) {
  const [g, kat, e0, prof] = await Promise.all([glossarDaten(), katalog(), api("/api/entwurf"), api("/api/profil")]);
  const e = e0;
  if (!e.bau) {
    // Aus vorhandenen Entwurfs-Positionen übernehmen, sonst leer starten
    const gew = {}, ausw = {}, prod = {};
    for (const p of e.positionen) {
      const a = g.assets.find((x) => x.id === p.asset_id);
      if (!a) continue;
      gew[a.eltern] = (gew[a.eltern] || 0) + (+p.anteil || 0);
      (ausw[a.eltern] = ausw[a.eltern] || []).push({ asset_id: a.id, anteil: +p.anteil || 0 });
      if (p.isin || p.id) prod[a.id] = p.id || p.isin;
    }
    for (const [hk, l] of Object.entries(ausw)) { const s = auf100(l.map((x) => x.anteil)); l.forEach((x, i) => (x.anteil = s[i])); }
    e.bau = { schritt: 1, gewichte: gew, auswahl: ausw, produkte: prod };
  }
  const b = e.bau;
  let schritt = Math.max(1, Math.min(5, +schrittParam || b.schritt || 1));
  const profilZahl = (k) => (prof.aktuell[k] && !isNaN(parseFloat(prof.aktuell[k].value)) ? parseFloat(prof.aktuell[k].value) : null);

  const speichereSofort = async () => {
    e.positionen = bauPositionen(e, g, kat);
    try { await api("/api/entwurf", { method: "PUT", body: e }); aktualisiereEntwurfZaehler(); } catch (ex) { toast(ex.message); }
  };
  const speichere = debounce(speichereSofort, 500);

  const gueltig = (n) => {
    const summeHK = Object.values(b.gewichte).reduce((s, v) => s + v, 0);
    if (n >= 2 && Math.abs(summeHK - 100) > 0.05) return "Verteile in Schritt 1 genau 100 % auf die Anlageklassen.";
    if (n >= 3) for (const [hk, w] of Object.entries(b.gewichte)) {
      if (!w) continue;
      const l = b.auswahl[hk] || [], s = l.reduce((x, y) => x + y.anteil, 0);
      const name = g.hauptklassen.find((h) => h.id === hk).name;
      if (!l.length) return `Wähle in Schritt 2 mindestens eine Anlage für „${name}“.`;
      if (Math.abs(s - 100) > 0.05) return `Verteile in Schritt 2 genau 100 % innerhalb von „${name}“.`;
    }
    return null;
  };

  const kopfzeile = () => `<a class="crumb" href="#/plaene">‹ Pläne</a>
    <div class="pagehead"><h1>Portfolio bauen</h1><div class="actions"><a class="btn" href="#/berater/neu">Council fragen</a><a class="btn" href="#/entwurf">Entwurf ansehen</a></div></div>
    <nav class="stepper" aria-label="Schritte">${SCHRITTE.map((n, i) => {
      const nr = i + 1, sperre = nr > schritt && gueltig(nr);
      return `<button type="button" class="step${nr === schritt ? " on" : ""}${nr < schritt ? " fertig" : ""}" data-s="${nr}" ${sperre ? "disabled" : ""} ${nr === schritt ? 'aria-current="step"' : ""}>
        <span class="nr">${nr < schritt ? "✓" : nr}</span><span>${n}</span></button>`;
    }).join("")}</nav>`;
  const fuss = (weiterText = "Weiter") => `<div class="step-fuss">${schritt > 1 ? '<button type="button" id="zurueck">‹ Zurück</button>' : "<span></span>"}
    <span class="muted small" id="sperre"></span>
    ${schritt < 5 ? `<button type="button" class="primary" id="weiter">${weiterText} ›</button>` : ""}</div>`;
  const geheZu = async (n) => { b.schritt = n; await speichereSofort(); location.hash = `#/bauen/${n}`; };
  const verdrahteFuss = () => {
    document.querySelectorAll(".step[data-s]").forEach((x) => (x.onclick = () => geheZu(+x.dataset.s)));
    const z = document.getElementById("zurueck");
    if (z) z.onclick = () => geheZu(schritt - 1);
    const w = document.getElementById("weiter");
    const pruefe = () => { if (!w) return; const f = gueltig(schritt + 1); w.disabled = !!f; document.getElementById("sperre").textContent = f || ""; };
    if (w) w.onclick = () => geheZu(schritt + 1);
    pruefe();
    return pruefe;
  };

  // ---------- Schritt 1: Gewichtung ----------
  if (schritt === 1) {
    render(`${kopfzeile()}
      <div class="cols">
        <div class="card"><h2 style="margin-top:0">1. Wie viel in welche Anlageklasse?</h2>
          <p class="muted">Lege fest, welcher Anteil deines Geldes in welche große Klasse geht. Zusammen genau 100 %.</p>
          <div class="chips" style="margin:8px 0 4px">${Object.keys(VORLAGEN).map((v) => `<button type="button" class="chip" data-vorlage="${v}">Vorlage: ${v}</button>`).join("")}</div>
          <p class="muted small">Vorlagen sind nur ein Startpunkt und frei änderbar.</p>
          <div class="toolbar" style="justify-content:flex-end"><span id="rest-hk" class="rest"></span></div>
          <div class="slgrid">${g.hauptklassen.map((h) => slider({ id: `hk-${h.id}`, label: h.name, skala: "prozent", wert: b.gewichte[h.id] || 0, gruppe: "hk" })).join("")}</div>
        </div>
        <div class="card"><h2 style="margin-top:0">Rahmen</h2>
          ${slider({ id: "b-einmal", label: "Einmalbetrag", skala: "geld", wert: e.einmalbetrag })}
          ${slider({ id: "b-spar", label: "Sparrate", skala: "rate", wert: e.sparrate })}
          ${slider({ id: "b-horizont", label: "Anlagezeitraum", skala: "jahre", wert: e.horizont_jahre })}
          <div id="b-klassen" style="margin-top:14px"></div>
        </div>
      </div>${fuss()}`);
    const pruefe = verdrahteFuss();
    const zeige = () => {
      const zeilen = g.hauptklassen.filter((h) => b.gewichte[h.id] > 0);
      const box = document.getElementById("b-klassen");
      if (zeilen.length) Charts.balken(box, zeilen.map((h) => ({ name: h.name, wert: b.gewichte[h.id], text: `${num(b.gewichte[h.id], 0)} %`, sub: h.kurz.split(".")[0] })), { max: 100 });
      else box.innerHTML = '<p class="muted">Noch nichts verteilt.</p>';
    };
    initSlider(document, (id, v) => {
      if (id.startsWith("hk-")) b.gewichte[id.slice(3)] = v;
      if (id === "b-einmal") e.einmalbetrag = v;
      if (id === "b-spar") e.sparrate = v;
      if (id === "b-horizont") e.horizont_jahre = v;
      zeige(); pruefe(); speichere();
    });
    document.querySelectorAll("[data-vorlage]").forEach((x) => (x.onclick = () => {
      const v = VORLAGEN[x.dataset.vorlage];
      g.hauptklassen.forEach((h) => setzeSlider(`hk-${h.id}`, 0, true));
      g.hauptklassen.forEach((h) => { b.gewichte[h.id] = v[h.id] || 0; setzeSlider(`hk-${h.id}`, v[h.id] || 0, true); });
      zeige(); pruefe(); speichere();
    }));
    zeige();
    return;
  }

  // ---------- Schritt 2: Anlagen innerhalb der Klassen ----------
  if (schritt === 2) {
    const aktiveHK = g.hauptklassen.filter((h) => b.gewichte[h.id] > 0);
    render(`${kopfzeile()}
      <p class="muted">2. Wähle innerhalb jeder Klasse die konkreten Anlagearten und verteile den Anteil der Klasse auf sie (je Klasse genau 100 %). Mehrere ETFs oder Anlagen pro Klasse sind ausdrücklich erwünscht.</p>
      ${aktiveHK.map((h) => `<div class="card" data-hk="${h.id}">
        <div class="toolbar"><h2 style="margin:0;flex:1">${esc(h.name)} <span class="pill p-lav">${num(b.gewichte[h.id], 0)} % vom Depot</span></h2><span id="rest-in-${h.id}" class="rest"></span></div>
        <div class="szgrid">${g.assets.filter((a) => a.eltern === h.id).map((a) => {
          const sel = (b.auswahl[h.id] || []).some((x) => x.asset_id === a.id);
          return `<button type="button" class="szbtn${sel ? " on" : ""}" data-toggle="${a.id}" data-hk="${h.id}" aria-pressed="${sel}">
            <b>${sel ? "✓ " : "+ "}${esc(a.name)}</b><span>Risiko ${a.risiko}/5 · ≈ ${num(a.erwartung.rendite, 1)} % p.a.</span></button>`;
        }).join("")}</div>
        <div class="in-klasse">${(b.auswahl[h.id] || []).map((x) => {
          const a = g.assets.find((y) => y.id === x.asset_id);
          return `<div class="e-row"><div class="e-name">${monogramm(a, g)}<div><b>${esc(a.name)}</b><br><span class="muted small" id="ges-${a.id}"></span></div></div>
            <div class="e-sl">${slider({ id: `in-${h.id}--${a.id}`, label: "Anteil in der Klasse", skala: "prozent", wert: x.anteil, klein: true, gruppe: `in-${h.id}` })}</div>
            <a class="btn klein" href="#/glossar/${a.id}">Info</a></div>`;
        }).join("")}</div>
        ${(b.auswahl[h.id] || []).length > 1 ? `<div class="actions"><button type="button" class="ghost" data-gleich="${h.id}">Gleichmäßig aufteilen</button></div>` : ""}
      </div>`).join("")}
      ${fuss()}`);
    const pruefe = verdrahteFuss();
    const gesamt = () => {
      for (const h of aktiveHK) for (const x of b.auswahl[h.id] || []) {
        const el = document.getElementById(`ges-${x.asset_id}`);
        if (el) el.textContent = `= ${num((b.gewichte[h.id] * x.anteil) / 100, 1)} % vom Depot`;
      }
    };
    initSlider(document, (id, v) => {
      const [hk, aid] = id.slice(3).split("--");
      const x = (b.auswahl[hk] || []).find((y) => y.asset_id === aid);
      if (x) x.anteil = v;
      gesamt(); pruefe(); speichere();
    });
    document.querySelectorAll("[data-toggle]").forEach((x) => (x.onclick = () => {
      const hk = x.dataset.hk, aid = x.dataset.toggle, l = (b.auswahl[hk] = b.auswahl[hk] || []);
      const i = l.findIndex((y) => y.asset_id === aid);
      if (i >= 0) l.splice(i, 1);
      else l.push({ asset_id: aid, anteil: Math.max(0, 100 - l.reduce((s, y) => s + y.anteil, 0)) });
      speichereSofort().then(() => viewBauen(2));
    }));
    document.querySelectorAll("[data-gleich]").forEach((x) => (x.onclick = () => {
      const l = b.auswahl[x.dataset.gleich], neu = auf100(l.map(() => 1));
      l.forEach((y, i) => (y.anteil = neu[i]));
      speichereSofort().then(() => viewBauen(2));
    }));
    gesamt();
    return;
  }

  const positionen = () => bauPositionen(e, g, kat);

  // ---------- Schritt 3: Risiko ----------
  if (schritt === 3) {
    const stufe = (n) => g.risikostufen.find((s) => s.stufe === n);
    render(`${kopfzeile()}
      <div class="cols">
        <div>
          <div class="card"><h2 style="margin-top:0">3. Wie viel Risiko willst du tragen?</h2>
            ${slider({ id: "b-risiko", label: "Risikobereitschaft", skala: "risiko", wert: e.risiko, hinweis: stufe(e.risiko).text })}
            <div id="b-risk"></div></div>
          <div class="card"><h2 style="margin-top:0">Erwartung über ${e.horizont_jahre} Jahre <span class="est">Annahmen</span></h2><div id="b-erw"></div></div>
        </div>
        <div class="card"><h2 style="margin-top:0">Anpassen</h2><div id="b-tausch"></div>
          <div class="actions"><a class="btn" href="#/berater/neu?frage=${encodeURIComponent("Ist mehr Risiko für mich sinnvoll? Zum Beispiel Gold gehebelt oder ein Branchen-ETF?")}">Council fragen: Ist mehr Risiko sinnvoll?</a></div></div>
      </div>${fuss()}`);
    verdrahteFuss();
    const zeichne = () => {
      const pos = positionen();
      const erg = Rechnen.erwartung(pos, e, g.klassen_erwartung, 1500);
      document.getElementById("b-risk").innerHTML = `<table><tr><th>Anlage</th><th class="num">Anteil</th><th>Risiko</th></tr>
        ${pos.map((p) => `<tr><td>${esc(g.assets.find((a) => a.id === p.asset_id).name)}</td><td class="num">${num(p.anteil, 1)} %</td><td>${pips(p.risiko, 5, p.risiko > e.risiko ? "rot" : "")}${p.risiko > e.risiko ? ' <span class="pill p-rose">über deiner Stufe</span>' : ""}</td></tr>`).join("")}</table>
        <p><b>Risiko des Portfolios ≈ ${num(erg.risiko, 1)}/5</b> bei deiner Stufe ${e.risiko}.</p>`;
      const E = erg.ende;
      document.getElementById("b-erw").innerHTML = `<div class="kpis">
        <div class="kpi" style="background:var(--sky)"><div class="l">Erwartete Rendite</div><div class="v">≈ ${num(erg.mu * 100, 1)} % p.a.</div><div class="sub">Schwankung ≈ ${num(erg.sig * 100, 0)} %</div></div>
        <div class="kpi k-worst"><div class="l">Schlecht (5 %)</div><div class="v">${eur0(E.p5)}</div></div>
        <div class="kpi k-real"><div class="l">Mitte</div><div class="v">${eur0(E.p50)}</div></div>
        <div class="kpi k-best"><div class="l">Gut (95 %)</div><div class="v">${eur0(E.p95)}</div></div></div>
        <p class="muted small">Eingezahlt ${eur0(E.eingezahlt)} · nominal, vor Kosten und Steuern · mehr Risiko = höhere Erwartung, aber breitere Spanne.</p>`;
      // Tauschvorschläge: zu riskant → sicherere Geschwister; Stufe 4–5 → spekulativere zeigen
      const tausch = [];
      for (const p of pos) {
        const a = g.assets.find((x) => x.id === p.asset_id);
        const geschw = g.assets.filter((x) => x.eltern === a.eltern && x.id !== a.id);
        if (a.risiko > e.risiko) for (const s of geschw.filter((x) => x.risiko <= e.risiko).slice(0, 2)) tausch.push({ von: a, nach: s, grund: "sicherer" });
        if (e.risiko >= 4) for (const s of geschw.filter((x) => x.risiko > a.risiko && x.risiko <= e.risiko + (e.risiko === 5 ? 0 : 1)).slice(0, 2)) tausch.push({ von: a, nach: s, grund: "spekulativer" });
      }
      document.getElementById("b-tausch").innerHTML = tausch.length ? tausch.map((t, i) => `<div class="e-row"><div><b>${esc(t.von.name)} → ${esc(t.nach.name)}</b><br>
        <span class="muted small">${t.grund === "sicherer" ? "Passt besser zu deiner Stufe" : "Mehr Chance, mehr Risiko"} · Risiko ${t.nach.risiko}/5 · ≈ ${num(t.nach.erwartung.rendite, 1)} % p.a.</span></div>
        <span class="pill ${t.grund === "sicherer" ? "p-mint" : "p-rose"}">${t.grund}</span><button type="button" data-t="${i}">Tauschen</button></div>`).join("")
        : `<p class="muted">${e.risiko >= 4 ? "Keine passenden spekulativeren Alternativen in deinen Klassen – in Schritt 1 eine Klasse wie Krypto oder Hebel ergänzen." : "Alles passt zu deiner Stufe. Ab Stufe 4 zeige ich hier auch spekulativere Bausteine."}</p>`;
      document.querySelectorAll("[data-t]").forEach((x) => (x.onclick = () => {
        const t = tausch[+x.dataset.t], l = b.auswahl[t.von.eltern], y = l.find((z) => z.asset_id === t.von.id);
        if (l.some((z) => z.asset_id === t.nach.id)) { l.find((z) => z.asset_id === t.nach.id).anteil += y.anteil; l.splice(l.indexOf(y), 1); }
        else y.asset_id = t.nach.id;
        delete b.produkte[t.von.id];
        speichere(); zeichne(); toast(`${t.von.name} getauscht gegen ${t.nach.name}`);
      }));
    };
    initSlider(document, (id, v) => { if (id === "b-risiko") { e.risiko = v; document.getElementById("b-risiko-h").textContent = stufe(v).text; speichere(); zeichne(); } });
    zeichne();
    return;
  }

  // ---------- Schritt 4: Produkte ----------
  if (schritt === 4) {
    const pos = positionen();
    render(`${kopfzeile()}
      <p class="muted">4. Wähle für jede Anlage ein konkretes Produkt. Bewertet nach allgemeinen Kriterien: Kosten, Größe, Schwankung, Fondsdomizil und Passung zu deinem Risiko.</p>
      ${pos.map((p) => {
        const a = g.assets.find((x) => x.id === p.asset_id);
        const produkte = kat.produkte.filter((x) => x.asset === a.id);
        return `<div class="card"><div class="toolbar"><h2 style="margin:0;flex:1">${esc(a.name)} <span class="pill p-lav">${num(p.anteil, 1)} %</span></h2><a class="btn klein" href="#/glossar/${a.id}">Info</a></div>
          ${produkte.length ? `<div class="prod-grid">${produkte.map((x) => `<button type="button" class="prod-karte${b.produkte[a.id] === x.id ? " on" : ""}" data-asset="${a.id}" data-prod="${esc(x.id)}" aria-pressed="${b.produkte[a.id] === x.id}">
            <span class="pk-kopf"><b>${b.produkte[a.id] === x.id ? "✓ " : ""}${esc(x.name)}</b><span class="muted small">${esc(x.isin || "")} · ${esc(x.ticker)} · ${esc(x.anbieter)}</span></span>
            <span class="pk-bew" id="bew-${esc(x.id.replace(/[^\w-]/g, "_"))}"><span class="muted small">Lade Kennzahlen …</span></span></button>`).join("")}</div>`
          : `<p class="muted">Für diese Anlage gibt es kein börsengehandeltes Produkt im Katalog (z. B. Tagesgeld bei einer Bank, Einzelaktien, Start-up-Beteiligungen). Für die Rückrechnung kannst du im Entwurf einen Ticker eintragen.</p>`}
        </div>`;
      }).join("")}
      ${fuss()}`);
    verdrahteFuss();
    document.querySelectorAll("[data-prod]").forEach((x) => (x.onclick = async () => { b.produkte[x.dataset.asset] = x.dataset.prod; await speichereSofort(); viewBauen(4); }));
    for (const p of pos) {
      const a = g.assets.find((x) => x.id === p.asset_id);
      for (const x of kat.produkte.filter((y) => y.asset === a.id)) {
        produktDetail(x.id).then((d) => {
          const el = document.getElementById(`bew-${x.id.replace(/[^\w-]/g, "_")}`);
          if (!el) return;
          const bew = produktBewertung(d || { isin: x.isin }, a, e.risiko);
          const punkte = bew.filter((y) => y.note === "gut").length - bew.filter((y) => y.note === "schwach").length;
          el.innerHTML = `<span class="pk-score">${punkte >= 2 ? "Stark" : punkte >= 0 ? "Solide" : "Schwach"}</span>
            ${bew.map((y) => `<span class="pk-k ${y.note}" title="${esc(y.regel)}"><b>${esc(y.name)}</b> ${esc(y.text)}</span>`).join("")}`;
        });
      }
    }
    return;
  }

  // ---------- Schritt 5: Bewertung ----------
  const pos = positionen();
  const n = Rechnen.normen(pos.map((p) => ({ ...p, ter: null })), { risiko: e.risiko, horizont_jahre: e.horizont_jahre, alter: profilZahl("alter"), ruecklage: profilZahl("ruecklage"), einkommen: profilZahl("einkommen") });
  // TER aus Produktdaten ergänzen, sobald geladen
  const icon = { ok: "✓", warn: "!", fail: "✕", offen: "?" }, cls = { ok: "p-mint", warn: "p-sand", fail: "p-rose", offen: "p-sky" };
  const ohneProdukt = pos.filter((p) => !p.isin && kat.produkte.some((x) => x.asset === p.asset_id));
  render(`${kopfzeile()}
    <div class="cols">
      <div class="card"><h2 style="margin-top:0">5. Bewertung nach allgemeinen Faustregeln</h2>
        <div id="b-normen">${n.map((x) => `<div class="norm"><span class="pill ${cls[x.status]}">${icon[x.status]}</span><div><b>${esc(x.norm)}</b><br><span>${esc(x.text)}</span><br><span class="src">${esc(x.quelle)}</span></div></div>`).join("")}</div>
        <p class="muted small">Faustregeln sind Orientierung, keine Vorschrift. Wo „?“ steht, fehlen Angaben im Profil oder Produktdaten.</p>
      </div>
      <div>
        <div class="card"><h2 style="margin-top:0">Dein Portfolio</h2>
          <table><tr><th>Position</th><th class="num">Anteil</th></tr>${pos.map((p) => `<tr><td>${esc(p.name)}<br><span class="muted small">${esc(p.isin || p.ticker || "ohne Produkt")}</span></td><td class="num">${num(p.anteil, 1)} %</td></tr>`).join("")}</table>
          ${ohneProdukt.length ? `<div class="notice small" style="margin-top:10px">Noch kein Produkt gewählt für: ${ohneProdukt.map((p) => esc(p.name)).join(", ")}.</div>` : ""}
          <label for="b-name" style="margin-top:14px">Name</label><input id="b-name" value="${esc(e.name)}" placeholder="z. B. Mein Wachstumsdepot">
          <div id="b-err"></div>
          <div class="actions"><button class="primary" id="b-save">Als Portfolio speichern</button><a class="btn" href="#/szenario?quelle=entwurf">Szenario anwenden</a>
            <a class="btn" href="#/berater/neu?frage=${encodeURIComponent("Bewerte mein gebautes Portfolio und die Gewichtungen.")}">Council bewerten lassen</a></div>
        </div>
      </div>
    </div>${fuss()}`);
  verdrahteFuss();
  // TER nachladen und Kostennorm aktualisieren
  Promise.all(pos.map((p) => (p.id ? produktDetail(p.id) : null))).then((ds) => {
    const mitTer = pos.map((p, i) => ({ ...p, ter: ds[i]?.fakten?.ter ? parseFloat(ds[i].fakten.ter.wert) : null }));
    const n2 = Rechnen.normen(mitTer, { risiko: e.risiko, horizont_jahre: e.horizont_jahre, alter: profilZahl("alter"), ruecklage: profilZahl("ruecklage"), einkommen: profilZahl("einkommen") });
    const box = document.getElementById("b-normen");
    if (box) box.innerHTML = n2.map((x) => `<div class="norm"><span class="pill ${cls[x.status]}">${icon[x.status]}</span><div><b>${esc(x.norm)}</b><br><span>${esc(x.text)}</span><br><span class="src">${esc(x.quelle)}</span></div></div>`).join("");
  });
  document.getElementById("b-name").oninput = (ev) => { e.name = ev.target.value; speichere(); };
  document.getElementById("b-save").onclick = async () => {
    try {
      e.positionen = positionen();
      await api("/api/entwurf", { method: "PUT", body: e });
      const r = await api("/api/entwurf/speichern", { body: {} });
      aktualisiereEntwurfZaehler();
      location.hash = `#/portfolios/${r.id}`;
    } catch (ex) { document.getElementById("b-err").innerHTML = errBox(ex); }
  };
}
