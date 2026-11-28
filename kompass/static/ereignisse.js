// Kompass – historische Extremereignisse im Glossar, Marktlage heute und Vergleich durch den Council.
"use strict";

let EREIGNISSE_CACHE = null;
async function ereignisDaten(neu = false) {
  if (!EREIGNISSE_CACHE || neu) EREIGNISSE_CACHE = await api("/api/ereignisse");
  return EREIGNISSE_CACHE;
}


const KENNZ_NAME = { cape: "Shiller-KGV (CAPE)", zins: "US-Zins 10 J.", inflation: "US-Inflation" };
const fmtKennz = (k, v) => (v == null ? "–" : k === "cape" ? num(v, 1) : `${num(v, 2)} %`);

function indikatorKacheln(ind) {
  const reihenfolge = ["fear_greed", "vix", "cape", "us_zins_10j", "us_leitzins", "us_inflation", "zinskurve", "hy_spread", "ezb_einlagenzins", "euro_inflation", "us_arbeitslos"];
  const fg = (v) => (v < 25 ? "Extreme Angst" : v < 45 ? "Angst" : v <= 55 ? "Neutral" : v <= 75 ? "Gier" : "Extreme Gier");
  return `<div class="kpis">${reihenfolge.filter((k) => ind[k]).map((k) => {
    const x = ind[k];
    const zusatz = k === "fear_greed" ? ` · ${fg(x.wert)}` : k === "zinskurve" && x.wert < 0 ? " · invers" : "";
    return `<div class="kpi" style="background:var(--card);border:1.5px solid var(--edge)"><div class="l">${esc(x.name)}</div>
      <div class="v">${num(x.wert, k === "fear_greed" || k === "vix" ? 0 : 2)}${x.einheit === "%" ? " %" : x.einheit === "Pp." ? " Pp." : ""}</div>
      <div class="sub">${esc(zusatz.replace(" · ", ""))}${zusatz ? " · " : ""}Stand ${esc(x.datum)}${x.live ? "" : ' <span class="est">nicht live</span>'}</div>
      <div class="sub"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.quelle)}</a></div></div>`;
  }).join("")}</div>`;
}

async function viewEreignisse() {
  const d = await ereignisDaten(true);
  const top = d.aehnlichkeit.slice(0, 3);
  render(`${kopf("Historische Extremereignisse", "#/recherche")}
    ${rechercheTabs("glossar")}${glossarTabs("ereignisse")}
    <div class="card"><h2 style="margin-top:0">Marktlage heute</h2>
      <p class="muted small">Live aus FRED, EZB, CNN und multpl.com. Fehlt eine Quelle, steht dort der letzte Stand der Kompass-Daten mit Hinweis „nicht live“.</p>
      ${indikatorKacheln(d.indikatoren)}
      ${top.length ? `<h3>Am ähnlichsten zu heute</h3><p class="muted small">Verglichen werden Shiller-KGV, 10-jähriger US-Zins und US-Inflation am Hoch vor dem jeweiligen Einbruch. Ähnlichkeit heißt nicht, dass es wieder so kommt.</p>
        <div class="cards">${top.map((a) => `<a class="pcard" href="#/ereignisse/${a.id}"><span class="pname">${esc(a.name)}</span><span class="muted small">${esc(a.zeitraum)}</span>
          <div class="big">${num(a.aehnlichkeit, 0)} % ähnlich</div>
          <div class="chips">${a.vergleich.map((v) => `<span class="chip ${v.nah ? "ok" : ""}">${esc(KENNZ_NAME[v.kennzahl])}: ${fmtKennz(v.kennzahl, v.damals)} → ${fmtKennz(v.kennzahl, v.heute)}</span>`).join("")}</div></a>`).join("")}</div>` : ""}
    </div>
    <h2>Chronik</h2>
    <div class="cards">${d.ereignisse.map((e) => {
      const k = e.kennzahlen;
      return `<article class="card flat ev-karte"><div class="row" style="justify-content:space-between;align-items:baseline"><span class="pill p-lav">${esc(e.kategorie)}</span><span class="muted small">${esc(e.zeitraum)}</span></div>
        <h3 style="margin:8px 0 4px">${esc(e.name)}</h3><p class="small">${esc(e.kurz)}</p>
        ${k ? `<div class="ev-zahlen"><span><b class="down">${pctS(k.verlust_real, 0)}</b> real</span><span><b>${k.monate_bis_tief}</b> Mon. bis Tief</span><span><b>${k.monate_bis_erholt_real ?? "–"}</b> Mon. bis real erholt</span></div>` : `<p class="muted small">${esc(e.daten_hinweis || "")}</p>`}
        <div class="actions" style="margin-top:6px"><a class="btn klein" href="#/ereignisse/${e.id}">Ursachen und Verlauf ›</a></div></article>`;
    }).join("")}</div>
    <p class="src">${esc(d.quelle)} · S&P 500 als Kursindex ohne Dividenden – mit Dividenden ging die Erholung deutlich schneller. Monatsdurchschnitte glätten Tagesextreme.</p>`);
}

async function viewEreignis(eid) {
  const [d, g] = await Promise.all([ereignisDaten(), glossarDaten()]);
  const e = d.ereignisse.find((x) => x.id === eid);
  if (!e) throw new Error("Unbekanntes Ereignis");
  const k = e.kennzahlen, ind = d.indikatoren;
  const klassen = (await szDaten()).klassen;
  const heute = { cape: ind.cape, zins: ind.us_zins_10j, inflation: ind.us_inflation };
  render(`<a class="crumb" href="#/ereignisse">‹ Historische Ereignisse</a>
    <div class="pagehead"><div><span class="pill p-lav">${esc(e.kategorie)}</span><h1 style="margin-top:6px">${esc(e.name)}</h1><p class="muted" style="margin:4px 0 0">${esc(e.zeitraum)}</p></div>
      <div class="actions"><button class="primary" id="ev-ki">Council: mit heute vergleichen</button>
        <a class="btn" href="#/council?idee=${encodeURIComponent(`Ähnelt die heutige Lage ${e.name} (${e.zeitraum})? Was bedeutet das für mein Depot?`)}">Im Council diskutieren</a></div></div>
    <p class="item-text">${esc(e.kurz)}</p>
    ${k ? `<div class="kpis">
      <div class="kpi k-worst"><div class="l">Verlust US-Aktien (real)</div><div class="v">${pctS(k.verlust_real, 1)}</div><div class="sub">nominal ${pctS(k.verlust_nominal, 1)} · ${esc(k.hoch)} → ${esc(k.tief)}</div></div>
      <div class="kpi" style="background:var(--sand)"><div class="l">Dauer bis zum Tief</div><div class="v">${k.monate_bis_tief} Monate</div></div>
      <div class="kpi" style="background:var(--sky)"><div class="l">Bis zum alten Hoch</div><div class="v">${k.monate_bis_erholt ?? "–"} Monate</div><div class="sub">real (nach Inflation): ${k.monate_bis_erholt_real ?? "noch nicht"} Monate · Kursindex ohne Dividenden</div></div>
      ${k.gold_veraenderung != null ? `<div class="kpi" style="background:var(--peach)"><div class="l">Gold im Zeitraum</div><div class="v">${pctS(k.gold_veraenderung, 0)}</div></div>` : ""}
    </div>
    <div class="card" style="margin-top:14px"><h2 style="margin-top:0">Verlauf (Hoch = 100)</h2><div id="ev-chart"></div>
      <p class="src">${esc(d.quelle)} · S&P 500 real (inflationsbereinigt), Monatsdurchschnitte – Tagesextreme waren größer.</p></div>` : `<div class="notice small">${esc(e.daten_hinweis || "")}</div>`}
    <div class="cols">
      <div class="card"><h2 style="margin-top:0">Ursachen</h2><ul>${e.ursachen.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <h2>Verlauf</h2><div class="timeline">${e.verlauf.map((p) => `<div class="ph"><b>${esc(p.zeitraum)}</b><span>${esc(p.was)}</span></div>`).join("")}</div>
        <h2>Was es für Anlageklassen bedeutete</h2>${Object.entries(e.auswirkungen).map(([kl, t]) => `<p><b>${esc(klassen[kl] || kl)}:</b> ${esc(t)}</p>`).join("")}
      </div>
      <div class="card"><h2 style="margin-top:0">Damals und heute</h2>
        ${k ? `<table><tr><th>Kennzahl</th><th class="num">Damals (am Hoch)</th><th class="num">Heute</th></tr>
          ${[["cape", k.cape_hoch], ["zins", k.zins_hoch], ["inflation", k.inflation_hoch != null ? k.inflation_hoch * 100 : null]].map(([key, v]) => `<tr><td>${KENNZ_NAME[key]}</td><td class="num">${fmtKennz(key, v)}</td>
            <td class="num">${heute[key] ? `${fmtKennz(key, heute[key].wert)}${heute[key].live ? "" : ' <span class="est">nicht live</span>'}` : "–"}</td></tr>`).join("")}
          </table><p class="src">Damals: Shiller-Daten (Monat ${esc(k.hoch)}). Heute: siehe Marktlage.</p>` : ""}
        <h3>Darauf heute achten</h3><ul>${e.heute_achten.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <h3>Lehren</h3><ul>${e.lehren.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <div id="ev-out"></div>
      </div>
    </div>`);
  if (k) Charts.linie(document.getElementById("ev-chart"), {
    titel: `Verlauf ${e.name}`, hoehe: 280, xFormat: (t, l) => datumKurz(`${t}-01`, l), yFormat: (v) => num(v, 0),
    serien: [{ name: "US-Aktien real", farbe: "var(--series-1)", punkte: k.reihe }].concat(k.gold_reihe ? [{ name: "Gold", farbe: "var(--series-3)", punkte: k.gold_reihe }] : []),
  });
  document.getElementById("ev-ki").onclick = async (ev) => {
    ev.target.disabled = true;
    const out = document.getElementById("ev-out");
    out.innerHTML = '<div class="progress" style="margin-top:12px"><span class="dot"></span>Der Geschichts-Experte vergleicht …</div>';
    try {
      const r = await api(`/api/ereignisse/${eid}/vergleich`, { body: {} });
      let v;
      for (let i = 0; i < 90; i++) { v = await api(`/api/ereignisse/vergleich/${r.id}`); if (v.status !== "laeuft") break; await new Promise((x) => setTimeout(x, 2000)); }
      if (v.status !== "fertig") throw new Error(v.ergebnis?.fehler || "Kein Ergebnis");
      const x = v.ergebnis;
      out.innerHTML = `<h2>Vergleich mit heute</h2><p>${esc(x.kurzfazit)}</p>
        <div class="procon"><div><h3 class="up">Gemeinsamkeiten</h3><ul>${(x.gemeinsamkeiten || []).map((y) => `<li>${esc(y)}</li>`).join("")}</ul></div>
          <div><h3 class="down">Unterschiede</h3><ul>${(x.unterschiede || []).map((y) => `<li>${esc(y)}</li>`).join("")}</ul></div></div>
        ${(x.kennzahlen || []).length ? `<table><tr><th>Kennzahl</th><th>Damals</th><th>Heute</th><th>Einordnung</th></tr>${x.kennzahlen.map((y) => `<tr><td>${esc(y.kennzahl)}</td><td>${esc(y.damals)}</td><td>${esc(y.heute)}</td><td>${esc(y.einordnung)}</td></tr>`).join("")}</table>` : ""}
        ${x.wahrscheinlichkeit_aehnlicher_verlauf ? `<p><b>Ähnlicher Verlauf?</b> ${esc(x.wahrscheinlichkeit_aehnlicher_verlauf)}</p>` : ""}
        ${(x.folgen_fuer_anlageklassen || []).length ? `<h3>Folgen für Anlageklassen</h3>${x.folgen_fuer_anlageklassen.map((y) => `<p><b>${esc(y.klasse)}:</b> ${esc(y.folge)}</p>`).join("")}` : ""}
        ${(x.fruehwarnsignale || []).length ? `<h3>Frühwarnsignale</h3><ul>${x.fruehwarnsignale.map((y) => `<li>${esc(y)}</li>`).join("")}</ul>` : ""}
        <p class="src">Modell: ${esc(v.provider || "")}/${esc(v.model || "")}</p>`;
    } catch (ex) { out.innerHTML = errBox(ex); }
    ev.target.disabled = false;
  };
}

// Für die Glossar-Detailseite: Ereignisse, in denen diese Anlage eine Rolle spielte.
async function ereignisseFuerAsset(a) {
  const d = await ereignisDaten();
  const kl = new Set(Object.keys(a.klassen || {}));
  return d.ereignisse.filter((e) => Object.keys(e.auswirkungen).some((k) => kl.has(k))).map((e) => {
    const k = Object.keys(e.auswirkungen).find((x) => kl.has(x));
    return { id: e.id, name: e.name, zeitraum: e.zeitraum, text: e.auswirkungen[k] };
  });
}
