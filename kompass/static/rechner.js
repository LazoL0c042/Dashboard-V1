// Kompass – Rechner mit beliebig vielen Anlagen aus dem Glossar.
// Zwei Rechnungen: (1) alle Anlagen mit langfristigen Annahmen (Monte-Carlo), (2) historischer Test
// mit echten Jahresrenditen für die Anlagen, die eine historische Reihe als Stellvertreter haben.
"use strict";

const RECHNER_START = [["msci_world", 55], ["em", 10], ["staatsanleihen", 15], ["gold", 10], ["tagesgeld", 5], ["bitcoin", 5]];
const INFLATION_ANNAHME = 0.02;

async function viewRechner() {
  const [g, info, prof] = await Promise.all([glossarDaten(), api("/api/rechner/info"), api("/api/profil")]);
  const pv = (k, d) => (prof.aktuell[k] ? Number(prof.aktuell[k].value) || d : d);
  let mischung = RECHNER_START.map(([id, a]) => ({ asset: g.assets.find((x) => x.id === id), anteil: a }));
  let ansicht = "annahmen", lauf = 0;

  render(`${kopf("Rechner")}
    <div class="cols">
      <div>
        <div class="card">
          <h2 style="margin-top:0">Einzahlungen</h2>
          <div class="slgrid">
            ${slider({ id: "r-start", label: "Startkapital", skala: "geld", wert: pv("kapital", 10000) })}
            ${slider({ id: "r-monat", label: "Monatlich", skala: "rate", wert: pv("sparrate", 300) })}
            ${slider({ id: "r-jahre", label: "Anlagezeitraum", skala: "jahre", wert: pv("horizont_jahre", 20) })}
            ${slider({ id: "r-steig", label: "Sparrate steigt jährlich um", skala: "steigerung", wert: 0 })}
          </div>
        </div>
        <div class="card">
          <div class="toolbar"><h2 style="margin:0;flex:1">Deine Mischung</h2><span id="rest-rech" class="rest"></span></div>
          <p class="muted small">Beliebig viele Anlagen. Zusammen höchstens 100 % – der Regler stoppt, wenn nichts mehr frei ist.</p>
          <div id="r-mix"></div>
          <div class="actions"><button type="button" id="r-add">+ Anlage hinzufügen</button><button type="button" class="ghost" id="r-norm">Auf 100 % hochrechnen</button></div>
          <div id="r-picker" hidden class="card flat" style="margin-top:12px"></div>
        </div>
        <div class="card">
          <h2 style="margin-top:0">Weitere Annahmen</h2>
          <div class="slgrid">
            ${slider({ id: "r-ter", label: "Laufende Kosten (Ø)", skala: "ter", wert: 0.2 })}
            ${slider({ id: "r-zins", label: "Zins für Tagesgeld/Geldmarkt", skala: "zins", wert: 2 })}
          </div>
          <label class="check-row"><input type="checkbox" id="r-steuer"> Nach deutschen Steuern (je Anlage passende Regel)</label>
          <div id="st" hidden class="row">
            <div><label for="r-kist">Kirchensteuer</label><select id="r-kist"><option value="">keine</option><option value="0.08">8 % (BY, BW)</option><option value="0.09">9 %</option></select></div>
            <div><label for="r-verh">Verheiratet</label><select id="r-verh"><option value="">nein</option><option value="1">ja (2.000 € Pauschbetrag)</option></select></div>
          </div>
        </div>
      </div>
      <div>
        <div class="toolbar"><div class="seg" id="r-ans"><button type="button" data-a="annahmen" class="on">Alle Anlagen (Annahmen)</button><button type="button" data-a="historie">Historischer Test</button></div></div>
        <div id="r"><div class="card progress"><span class="dot"></span>Rechne …</div></div>
      </div>
    </div>`);

  const zeichneMix = () => {
    const box = document.getElementById("r-mix");
    box.innerHTML = mischung.length ? mischung.map((m, i) => `<div class="e-row">
      <div class="e-name">${monogramm(m.asset, g)}<div><b>${esc(m.asset.name)}</b><br><span class="muted small">Risiko ${m.asset.risiko}/5 · ≈ ${num(m.asset.erwartung.rendite, 1)} % p.a.${m.asset.hist_proxy ? "" : " · keine historische Reihe"}</span></div></div>
      <div class="e-sl">${slider({ id: `rm${i}`, label: "Anteil", skala: "prozent", wert: m.anteil, klein: true, gruppe: "rech" })}</div>
      <button type="button" class="ghost" data-del="${i}" aria-label="${esc(m.asset.name)} entfernen">Entfernen</button></div>`).join("")
      : '<p class="muted">Noch keine Anlage. Füge mindestens eine hinzu.</p>';
    initSlider(box, (id, v) => { mischung[+id.slice(2)].anteil = v; rechne(); });
    box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { mischung.splice(+b.dataset.del, 1); zeichneMix(); rechne(); }));
    gruppenAnzeige("rech");
  };

  const zeichnePicker = (klasse) => {
    const box = document.getElementById("r-picker");
    const drin = new Set(mischung.map((m) => m.asset.id));
    klasse = klasse || g.hauptklassen[0].id;
    box.innerHTML = `<div class="toolbar"><h3 style="margin:0;flex:1">Anlage wählen</h3><button type="button" class="ghost" id="r-pick-zu">Schließen</button></div>
      <div class="chips" style="margin-bottom:12px">${g.hauptklassen.map((h) => `<button type="button" class="chip${h.id === klasse ? " ok" : ""}" data-kl="${h.id}">${esc(h.name)}</button>`).join("")}</div>
      <div class="szgrid">${g.assets.filter((a) => a.eltern === klasse).map((a) => `<button type="button" class="szbtn" data-asset="${a.id}" ${drin.has(a.id) ? "disabled" : ""}>
        <b>${esc(a.name)}</b><span>Risiko ${a.risiko}/5 · ≈ ${num(a.erwartung.rendite, 1)} % p.a.${drin.has(a.id) ? " · schon drin" : ""}</span></button>`).join("")}</div>`;
    box.querySelectorAll("[data-kl]").forEach((b) => (b.onclick = () => zeichnePicker(b.dataset.kl)));
    box.querySelectorAll("[data-asset]").forEach((b) => (b.onclick = () => {
      const frei = Math.max(0, 100 - mischung.reduce((s, m) => s + m.anteil, 0));
      mischung.push({ asset: g.assets.find((x) => x.id === b.dataset.asset), anteil: Math.min(10, frei) });
      zeichneMix(); zeichnePicker(klasse); rechne();
      if (!frei) toast("100 % sind schon verteilt – reduziere eine andere Anlage, dann den Regler der neuen hochziehen.");
    }));
    document.getElementById("r-pick-zu").onclick = () => (box.hidden = true);
  };
  document.getElementById("r-add").onclick = () => { const b = document.getElementById("r-picker"); b.hidden = false; zeichnePicker(); };
  document.getElementById("r-norm").onclick = () => {
    const neu = auf100(mischung.map((m) => m.anteil));
    mischung.forEach((m, i) => { m.anteil = neu[i]; setzeSlider(`rm${i}`, neu[i], true); });
    rechne();
  };
  const steuer = document.getElementById("r-steuer");
  steuer.onchange = () => { document.getElementById("st").hidden = !steuer.checked; rechne(); };
  ["r-kist", "r-verh"].forEach((id) => (document.getElementById(id).onchange = () => rechne()));
  document.querySelectorAll("#r-ans button").forEach((b) => (b.onclick = () => {
    ansicht = b.dataset.a; document.querySelectorAll("#r-ans button").forEach((x) => x.classList.toggle("on", x === b)); rechne();
  }));

  const steuerAnteile = (liste) => {
    const out = {};
    for (const m of liste) out[m.asset.steuerklasse] = (out[m.asset.steuerklasse] || 0) + m.anteil;
    return out;
  };
  const steuerOpt = () => ({ verheiratet: !!document.getElementById("r-verh").value,
    kirchensteuer: document.getElementById("r-kist").value ? Number(document.getElementById("r-kist").value) : null });

  const rechne = debounce(async () => {
    const meinLauf = ++lauf;
    const out = document.getElementById("r");
    const aktiv = mischung.filter((m) => m.anteil > 0);
    const summe = aktiv.reduce((s, m) => s + m.anteil, 0);
    if (!aktiv.length) { out.innerHTML = errBox("Mindestens eine Anlage über 0 % stellen."); return; }
    const rahmen = { einmalbetrag: slWert("r-start"), sparrate: slWert("r-monat"), horizont_jahre: slWert("r-jahre") };
    const hinweisRest = summe < 99.95 ? `<div class="notice small" style="margin-bottom:12px">Erst ${num(summe, 0)} % verteilt – gerechnet wird mit den Anteilen hochgerechnet auf 100 %.</div>` : "";
    try {
      if (ansicht === "annahmen") {
        const ter = slWert("r-ter") / 100, zins = slWert("r-zins");
        const pos = aktiv.map((m) => {
          const e = ["tagesgeld", "geldmarkt_etf"].includes(m.asset.id) ? { rendite: zins, schwankung: 0.5 } : m.asset.erwartung;
          return { name: m.asset.name, anteil: m.anteil, klassen: m.asset.klassen, risiko: m.asset.risiko, hebel: m.asset.hebel,
            erwartung: { rendite: e.rendite - ter * 100, schwankung: e.schwankung } };
        });
        const erg = Rechnen.erwartung(pos, rahmen, g.klassen_erwartung, 2000);
        const T = rahmen.horizont_jahre, defl = Math.pow(1 + INFLATION_ANNAHME, T);
        const faelle = ["p5", "p50", "p95"].map((k) => {
          const end = erg.ende[k], r = Rechnen.impliziterZins(rahmen.einmalbetrag, rahmen.sparrate, T, end);
          return { end_nominal: end, eingezahlt: erg.ende.eingezahlt, verlauf: Rechnen.verlaufAusZins(rahmen.einmalbetrag, rahmen.sparrate, T, r) };
        });
        let steuern = null;
        if (steuer.checked) steuern = await api("/api/steuern/mix", { body: { jahre: T, faelle, anteile: steuerAnteile(aktiv), ...steuerOpt() } });
        if (meinLauf !== lauf) return;
        const karte = (i, cls, titel) => {
          const f = faelle[i], netto = steuern ? steuern[i].netto : f.end_nominal;
          return `<div class="kpi ${cls}"><div class="l">${titel}${steuern ? " · nach Steuern" : ""}</div><div class="v">${eur0(netto / defl)}</div>
            <div class="sub">in heutiger Kaufkraft (2 % Inflation angenommen)</div><div class="sub">nominal ${eur0(netto)}${steuern ? ` · Steuer ${eur0(steuern[i].steuer)}` : ""}</div></div>`;
        };
        out.innerHTML = `${hinweisRest}<div class="grid3">${karte(0, "k-worst", "Schlecht (5 %)")}${karte(1, "k-real", "Realistisch (Mitte)")}${karte(2, "k-best", "Gut (95 %)")}</div>
          <div class="card" style="margin-top:14px"><div class="kpis">
            <div class="kpi" style="background:var(--sky)"><div class="l">Erwartete Rendite</div><div class="v">≈ ${num(erg.mu * 100, 1)} % p.a.</div><div class="sub">nach Kosten, nominal</div></div>
            <div class="kpi" style="background:var(--sand)"><div class="l">Schwankung</div><div class="v">≈ ${num(erg.sig * 100, 0)} %</div><div class="sub">pro Jahr</div></div>
            <div class="kpi" style="background:var(--lav)"><div class="l">Eingezahlt</div><div class="v">${eur0(erg.ende.eingezahlt)}</div><div class="sub">nach ${T} Jahren</div></div>
          </div><div id="r-chart" style="margin-top:12px"></div>
          <details><summary>Annahmen und Grenzen</summary><div class="card flat">
            <p class="small">Langfristige Annahmen je Anlage aus dem Glossar (Größenordnung, keine Prognose), 2.000 zufällige Verläufe. Schlecht/Gut = 5 % bzw. 95 % der Verläufe.</p>
            ${steuern ? steuern[1].hinweise.map((h) => `<p class="small">${esc(h)}</p>`).join("") : ""}
            <table>${erg.positionen.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${num(x.w * 100, 1)} %</td><td class="num">≈ ${num(x.mu * 100, 1)} % p.a.</td><td class="num">± ${num(x.sig * 100, 0)} %</td></tr>`).join("")}</table>
          </div></details></div>`;
        Charts.linie(document.getElementById("r-chart"), { titel: "Spanne der Entwicklung", x: "zahl", hoehe: 280, xFormat: (t, l) => (l ? `Jahr ${t}` : `J ${t}`), yFormat: (v) => eur0(v),
          serien: [
            { name: "Mitte", farbe: "var(--series-1)", punkte: erg.jahre.map((j) => [j.jahr, j.p50]) },
            { name: "Schlecht", farbe: "var(--series-2)", punkte: erg.jahre.map((j) => [j.jahr, j.p5]) },
            { name: "Gut", farbe: "var(--series-3)", punkte: erg.jahre.map((j) => [j.jahr, j.p95]) },
            { name: "Eingezahlt", farbe: "var(--ref)", strich: "dash", punkte: erg.jahre.map((j) => [j.jahr, j.eingezahlt]) },
          ] });
      } else {
        const mitReihe = aktiv.filter((m) => m.asset.hist_proxy), ohne = aktiv.filter((m) => !m.asset.hist_proxy);
        if (!mitReihe.length) { out.innerHTML = errBox("Keine der gewählten Anlagen hat eine lange historische Reihe. Nutze „Alle Anlagen (Annahmen)“."); return; }
        const mix = {};
        for (const m of mitReihe) { const k = m.asset.hist_proxy === "zins" ? "eigene" : m.asset.hist_proxy; mix[k] = (mix[k] || 0) + m.anteil; }
        const body = { start: rahmen.einmalbetrag, monthly: rahmen.sparrate, years: rahmen.horizont_jahre, mix, ter: slWert("r-ter"), increase: slWert("r-steig"),
          custom_rate: mix.eigene ? slWert("r-zins") : null, steuern: { aktiv: steuer.checked, ...steuerOpt() }, steuer_anteile: steuerAnteile(mitReihe) };
        const r = await api("/api/rechner", { body });
        if (meinLauf !== lauf) return;
        const abdeckung = mitReihe.reduce((s, m) => s + m.anteil, 0) / summe;
        out.innerHTML = `${hinweisRest}${ohne.length ? `<div class="notice small" style="margin-bottom:12px">Historischer Test für ${num(abdeckung * 100, 0)} % des Depots. Ohne lange Datenreihe und deshalb nicht enthalten: <b>${ohne.map((m) => esc(m.asset.name)).join(", ")}</b>.</div>` : ""}
          ${rechnerErgebnis(r, body)}
          <p class="muted small">Stellvertreter: Aktien-Anlagen → US-Aktien seit 1872, Anleihen → US-Staatsanleihen, Gold → Goldpreis ab 1972, Tagesgeld → fester Zins aus dem Regler.</p>`;
      }
    } catch (e) { out.innerHTML = errBox(e); }
  }, 250);

  initSlider(document, (id) => { if (!id.startsWith("rm")) rechne(); });
  zeichneMix();
  rechne();
}

function rechnerErgebnis(r, body) {
  const farben = { worst: "k-worst", realistisch: "k-real", best: "k-best" };
  const namen = { worst: "Worst Case", realistisch: "Realistisch", best: "Best Case" };
  const s = r.szenarien;
  return `<div class="grid3">${["worst", "realistisch", "best"].map((k) => {
    const x = s[k];
    const netto = body.steuern.aktiv ? x.end_real_netto : x.end_real;
    return `<div class="kpi ${farben[k]}"><div class="l">${namen[k]}${body.steuern.aktiv ? " · nach Steuern" : ""}</div>
      <div class="v">${eur0(netto)}</div><div class="sub">in heutiger Kaufkraft</div>
      <div class="sub">nominal ${eur0(body.steuern.aktiv ? x.steuer.netto : x.end_nominal)}${body.steuern.aktiv ? ` · Steuer ${eur0(x.steuer.steuer)}` : ""}</div>
      <div class="sub">${pct(x.rendite_pa_real * 100)} p.a. real · wie ${x.startjahr}–${x.endjahr}</div></div>`;
  }).join("")}</div>
  <p class="muted small">Eingezahlt: ${eur(s.realistisch.eingezahlt)} · ${r.fenster} historische Zeiträume aus ${r.zeitraum[0]}–${r.zeitraum[1]} · Worst = schlechteste 5 %, Best = beste 5 %</p>
  <details><summary>Annahmen und Grenzen</summary><div class="card flat">
    ${r.hinweise.map((h) => `<p class="small">${esc(h)}</p>`).join("")}
    ${body.steuern.aktiv ? s.realistisch.steuer.hinweise.map((h) => `<p class="small">${esc(h)}</p>`).join("") : ""}
    <p class="small">${src("Shiller (Yale), Weltbank, US BLS via datahub.io – siehe data/history/QUELLEN.md")}</p>
  </div></details>`;
}
