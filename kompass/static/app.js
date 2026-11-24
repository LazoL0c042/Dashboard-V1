// Kompass – Web-App. Vanilla JS, Hash-Routing, kein Build-Schritt.
"use strict";

const $app = document.getElementById("app");
let ME = null;
let pollTimer = null;

// ---------- Hilfen ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (v) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("de-DE", { style: "currency", currency: "EUR" }));
const pct = (v, d = 2) => (v == null || isNaN(v) ? "–" : `${Number(v).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`);
const num = (v, d = 2) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("de-DE", { maximumFractionDigits: d }));
const datum = (s) => (s ? new Date(s.replace(" ", "T")).toLocaleDateString("de-DE") : "");
const est = (status) => (status === "geschaetzt" ? '<span class="est">geschätzt</span>' : "");
const src = (q, d) => `<span class="src">Quelle: ${esc(q)}${d ? ", " + esc(datum(d) || d) : ""}</span>`;

async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  if (r.status === 401 && !path.startsWith("/api/login")) {
    ME = null;
    if (!location.hash.startsWith("#/login")) location.hash = "#/login";
    throw new Error("Bitte anmelden");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = data.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(", ") : `Fehler ${r.status}`);
  }
  return data;
}

function toast(text) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

const ZURUECK = { "#/": "Start", "#/council": "Council", "#/plaene": "Pläne", "#/plaene/entscheidungen": "Entscheidungen",
  "#/recherche": "Recherche", "#/produkte": "Produkte", "#/rechner": "Rechner", "#/berater/neu": "Portfolio-Council", "#/entwurf": "Entwurf", "#/glossar": "Glossar" };

function kopf(title, back = "#/", aktionen = "") {
  const name = ZURUECK[back] || (back && back.startsWith("#/portfolios") ? "Portfolio" : back && back.startsWith("#/council/") ? "Council-Sitzung" : back && back.startsWith("#/plaene/") ? "Entscheidung" : "Zurück");
  return `${back ? `<a class="crumb" href="${back}">‹ ${esc(name)}</a>` : ""}
    <div class="pagehead"><h1>${esc(title)}</h1>${aktionen ? `<div class="actions">${aktionen}</div>` : ""}</div>`;
}

// ---------- Navigation ----------

const ICONS = {
  plaene: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>',
  council: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>',
  recherche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  rechner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>',
};
const BEREICHE = [
  ["plaene", "Pläne", "#/plaene", ["#/plaene", "#/portfolios", "#/szenario", "#/entwurf", "#/berater", "#/bauen"]],
  ["council", "Council", "#/council", ["#/council"]],
  ["recherche", "Recherche", "#/recherche", ["#/recherche", "#/produkte", "#/glossar", "#/quellen"]],
  ["rechner", "Rechner", "#/rechner", ["#/rechner"]],
];

function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  if (!ME) { nav.hidden = true; return; }
  nav.hidden = false;
  const h = location.hash || "#/";
  nav.innerHTML = `<div class="nav-in"><a class="brand" href="#/">Kompass</a>
    <div class="nav-links">${BEREICHE.map(([k, name, href, pre]) => {
      const on = pre.some((x) => h === x || h.startsWith(x + "/") || h.startsWith(x + "?"));
      return `<a class="nav-link n-${k}${on ? " on" : ""}" href="${href}"${on ? ' aria-current="page"' : ""}>${ICONS[k]}<span>${name}</span></a>`;
    }).join("")}</div>
    <a class="nav-me nav-entwurf" id="nav-entwurf" href="#/entwurf" ${ENTWURF_ANZAHL ? "" : "hidden"}>Entwurf <b>${ENTWURF_ANZAHL || 0}</b></a>
    ${ME.is_admin ? '<a class="nav-me nav-admin" href="#/admin">Einstellungen</a>' : ""}<a class="nav-me" href="#/profil">${esc(ME.name)}</a></div>`;
}

function render(html) {
  $app.innerHTML = html;
  window.scrollTo(0, 0);
}

function errBox(e) {
  return `<div class="err">${esc(e.message || e)}</div>`;
}

function poll(fn, ms = 3000) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(fn, ms);
}

// Minimales Markdown für Recherche-Antworten: Überschriften, fett, Listen, [n]-Verweise.
function md(text, quellen = []) {
  const lines = esc(text).split("\n");
  let out = "", inList = false;
  for (let l of lines) {
    l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[(\d+)\]/g, (m, n) => {
      const q = quellen[n - 1];
      return q && q.url ? `<a class="src" href="${esc(q.url)}" target="_blank" rel="noopener">[${n}]</a>` : m;
    });
    if (/^\s*[-*•]\s+/.test(l)) {
      if (!inList) { out += "<ul>"; inList = true; }
      out += `<li>${l.replace(/^\s*[-*•]\s+/, "")}</li>`;
      continue;
    }
    if (inList) { out += "</ul>"; inList = false; }
    if (/^#{1,4}\s/.test(l)) out += `<h3>${l.replace(/^#+\s/, "")}</h3>`;
    else if (l.trim()) out += `<p>${l}</p>`;
  }
  return `<div class="md">${out}${inList ? "</ul>" : ""}</div>`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// ---------- Router ----------

const routes = [
  [/^#\/login$/, viewLogin],
  [/^#\/?$/, viewHome],
  [/^#\/council$/, viewCouncilList],
  [/^#\/council\/(\d+)$/, viewCouncil],
  [/^#\/plaene$/, viewPortfolios],
  [/^#\/plaene\/entscheidungen$/, viewPlaene],
  [/^#\/plaene\/neu(?:\?(.*))?$/, viewPlanNeu],
  [/^#\/portfolios\/neu$/, () => viewPortfolioForm(null)],
  [/^#\/portfolios\/(\d+)$/, viewPortfolio],
  [/^#\/portfolios\/(\d+)\/bearbeiten$/, viewPortfolioForm],
  [/^#\/szenario(?:\?(.*))?$/, viewSzenario],
  [/^#\/glossar$/, viewGlossar],
  [/^#\/glossar\/([\w-]+)$/, viewAsset],
  [/^#\/quellen$/, viewQuellen],
  [/^#\/entwurf$/, viewEntwurf],
  [/^#\/bauen$/, () => viewBauen(null)],
  [/^#\/bauen\/([1-5])$/, viewBauen],
  [/^#\/berater\/neu(?:\?(.*))?$/, viewBeraterNeu],
  [/^#\/berater\/(\d+)$/, viewBerater],
  [/^#\/plaene\/(\d+)$/, viewPlan],
  [/^#\/recherche$/, viewRechercheList],
  [/^#\/recherche\/(\d+)$/, viewRecherche],
  [/^#\/produkte$/, viewProdukte],
  [/^#\/produkte\/([\w.\-]+)$/, viewProdukt],
  [/^#\/rechner$/, viewRechner],
  [/^#\/profil$/, viewProfil],
  [/^#\/admin$/, viewAdmin],
];

async function route() {
  clearTimeout(pollTimer);
  const h = location.hash || "#/";
  if (!ME && h !== "#/login") {
    try { ME = await api("/api/me"); } catch { return; }
  }
  renderNav();
  if (ME && ENTWURF_ANZAHL === null) aktualisiereEntwurfZaehler();
  if (ME && !ME.hinweis_bestaetigt && h !== "#/login") return viewHinweis();
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) {
      try { await fn(...m.slice(1)); } catch (e) { if (e.message !== "Bitte anmelden") render(kopf("Fehler") + errBox(e)); }
      return;
    }
  }
  location.hash = "#/";
}
window.addEventListener("hashchange", route);

// ---------- Zugang ----------

async function viewLogin() {
  const st = await api("/api/status");
  const mode = st.setup_noetig ? "setup" : "login";
  render(`<div class="login">
    <h1 class="center">Kompass</h1>
    ${st.setup_noetig ? '<p class="muted center">Erster Start: Lege dein Admin-Konto an.</p>' : ""}
    <div class="card">
      <form id="f">
        <label>Name</label><input name="name" autocomplete="username" required>
        <label>Passwort (mind. 8 Zeichen)</label><input name="pw" type="password" autocomplete="current-password" required>
        <div id="inv" hidden><label>Einladungscode</label><input name="invite"></div>
        <div id="e"></div>
        <div class="actions"><button class="primary" style="flex:1">${mode === "setup" ? "Konto anlegen" : "Anmelden"}</button></div>
      </form>
      ${mode === "login" ? '<p class="center"><button class="ghost" id="reg">Ich habe einen Einladungscode</button></p>' : ""}
    </div></div>`);
  let register = false;
  const reg = document.getElementById("reg");
  if (reg) reg.onclick = () => { register = true; document.getElementById("inv").hidden = false; reg.remove(); };
  document.getElementById("f").onsubmit = async (ev) => {
    ev.preventDefault();
    const d = formData(ev.target);
    try {
      if (mode === "setup") await api("/api/setup", { body: { name: d.name, pw: d.pw } });
      else if (register) await api("/api/register", { body: d });
      else await api("/api/login", { body: { name: d.name, pw: d.pw } });
      ME = await api("/api/me");
      location.hash = "#/";
      route();
    } catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
}

function viewHinweis() {
  render(`${kopf("Bevor es losgeht", null)}
    <div class="notice">
      <p><b>Kompass ist keine Anlageberatung.</b> Alle Einschätzungen stammen von KI-Modellen und können falsch sein. Du entscheidest selbst und auf eigene Gefahr.</p>
      <p>Der Council und die Recherche laufen über <b>kostenlose Modell-Zugänge</b> (z. B. Google, Groq, Mistral, OpenRouter, Cerebras). Deine Eingaben – auch Zahlen zu Vermögen und Zielen – werden dorthin geschickt. Diese Anbieter dürfen Eingaben aus Gratis-Zugängen teilweise <b>zum Training nutzen</b>.</p>
      <p>Jede Zahl im Tool trägt eine Quelle oder den Hinweis <span class="est">geschätzt</span>.</p>
    </div>
    <div class="actions"><button class="primary" id="ok">Verstanden, weiter</button></div>`);
  document.getElementById("ok").onclick = async () => {
    await api("/api/hinweis", { body: {} });
    ME.hinweis_bestaetigt = true;
    route();
  };
}

// ---------- Start ----------

async function viewHome() {
  const [pl, co, pf] = await Promise.all([api("/api/plaene"), api("/api/council"), api("/api/portfolios")]);
  const offen = co.filter((s) => s.status === "klaeren" || s.status === "laeuft").length;
  const letzte = co[0];
  render(`<div class="pagehead"><h1>Hallo ${esc(ME.name)}</h1></div>
    <div class="tiles">
      <a class="tile t-mint" href="#/plaene"><span class="name">Pläne</span>
        <span><span class="big-num">${pf.portfolios.length}</span> <span class="num">Portfolios · ${pl.plaene.length} Entscheidungen</span></span></a>
      <a class="tile t-lav" href="#/council"><span class="name">Council</span>
        <span>${offen ? `<span class="big-num">${offen}</span> <span class="num">offene Sitzung${offen > 1 ? "en" : ""}</span>` : '<span class="num">Neue Idee besprechen</span>'}</span></a>
      <a class="tile t-sky" href="#/recherche"><span class="name">Recherche</span><span class="num">Nachrichten · Gesetze · Produkte</span></a>
      <a class="tile t-peach" href="#/rechner"><span class="name">Rechner</span><span class="num">Worst · Realistisch · Best</span></a>
    </div>
    ${pf.portfolios.length ? `<div class="pagehead" style="margin-top:32px"><h2 style="margin:0">Deine Portfolios</h2><a class="btn" href="#/plaene">Alle ansehen</a></div>
      <div class="cards" id="home-pf">${pf.portfolios.slice(0, 6).map((p) => `<a class="pcard" href="#/portfolios/${p.id}" id="hp-${p.id}"><span class="pname">${esc(p.name)}</span><span class="muted">Rechne …</span></a>`).join("")}</div>` : ""}
    ${letzte ? `<h2>Zuletzt im Council</h2><div class="card list"><a class="item" href="#/council/${letzte.id}"><span class="t">${esc(letzte.idea.slice(0, 140))}</span>${statusPill(letzte.status)}</a></div>` : ""}`);
  for (const p of pf.portfolios.slice(0, 6)) {
    rechne(p).then((r) => {
      const box = document.getElementById(`hp-${p.id}`);
      const k = r.kennzahlen;
      if (!box || !k) { if (box) box.innerHTML = `<span class="pname">${esc(p.name)}</span><span class="muted">Keine Kurse</span>`; return; }
      box.innerHTML = `<span class="pname">${esc(p.name)}</span><div class="row2"><div><div class="big">${eur0(k.wert)}</div>
        <div class="${tone(k.gewinnProzent)}" style="font-weight:620">${pctS(k.gewinnProzent)}</div></div>${Charts.spark(r.punkte.map((x) => x.wert))}</div>`;
    }).catch(() => {});
  }
}

// ---------- Council ----------

const STATUS = {
  klaeren: ["Klärung", "p-sky"], laeuft: ["Diskussion läuft", "p-lav"], fertig: ["Konsens", "p-mint"],
  dissens: ["Kein Konsens", "p-sand"], fehler: ["Fehler", "p-rose"],
};
const statusPill = (s) => `<span class="pill ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

async function viewCouncilList() {
  const [liste, re] = await Promise.all([api("/api/council"), api("/api/recherche")]);
  const fertigeRe = re.liste.filter((r) => r.status === "fertig").slice(0, 8);
  render(`${kopf("Council")}
    <div class="card">
      <form id="f">
        <label>Deine Idee oder Frage</label>
        <textarea name="idea" placeholder="z. B. Ich überlege, 20 % meines Depots in Gold umzuschichten, weil …" required></textarea>
        ${fertigeRe.length ? `<label>Recherche anhängen (gibt dem Council aktuelles Material)</label>
          ${fertigeRe.map((r) => `<div><label style="display:flex;gap:8px;align-items:center;color:var(--text);font-size:15px">
            <input type="checkbox" name="r" value="${r.id}"> ${esc(r.query)} <span class="muted">${datum(r.created_at)}</span></label></div>`).join("")}` : ""}
        <div id="e"></div>
        <div class="actions"><button class="primary">Council einberufen</button></div>
      </form>
    </div>
    <h2>Bisherige Sitzungen</h2>
    <div class="card list">${liste.map((s) => `<a class="item" href="#/council/${s.id}"><span class="t">${esc(s.idea.slice(0, 90))}</span>${statusPill(s.status)}</a>`).join("") || '<p class="muted">Noch keine.</p>'}</div>`);
  document.getElementById("f").onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      const r = await api("/api/council", { body: { idea: fd.get("idea"), research_ids: fd.getAll("r").map(Number) } });
      location.hash = `#/council/${r.id}`;
    } catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
}

function memberCard(m) {
  const d = m.data || {};
  return `<div class="member"><div class="muted small">${esc(m.titel)}</div>
    <div class="p">${d.wahrscheinlichkeit ?? "–"} %</div><div class="bar"><i style="width:${d.wahrscheinlichkeit || 0}%"></i></div>
    <details><summary>Begründung</summary>
      <p>${esc(d.position)}</p>
      ${(d.argumente || []).length ? `<ul>${d.argumente.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
      <p><b>Stärkster Einwand:</b> ${esc(d.staerkster_einwand)}</p>
      ${m.role === "kritiker" ? `<p><b>Einwand widerlegt:</b> ${d.einwand_widerlegt === true ? "ja" : "nein"}</p>` : ""}
      ${d.aenderung ? `<p><b>Geändert:</b> ${esc(d.aenderung)}</p>` : ""}
      ${(d.offene_fragen || []).length ? `<p><b>Offene Fragen:</b> ${esc(d.offene_fragen.join("; "))}</p>` : ""}
      <p class="src">Modell: ${esc(m.provider)}/${esc(m.model)}</p>
    </details></div>`;
}

function ergebnisHtml(res, sid) {
  const s = res.synthese;
  const bewCls = { gut: "p-mint", mittel: "p-sand", schlecht: "p-rose" }[s.bewertung] || "p-sky";
  const p = res.pruefung || {};
  return `<h2>Ergebnis</h2>
  <div class="card">
    <div class="row"><div><span class="pill ${bewCls}">${esc(s.bewertung)}</span> ${s.konsens ? '<span class="pill p-mint">Konsens</span>' : '<span class="pill p-sand">Kein Konsens</span>'}</div></div>
    <div class="grid3" style="margin-top:12px">
      <div class="kpi" style="background:var(--lav)"><div class="l">Wahrscheinlichkeit (Median)</div><div class="big">${s.wahrscheinlichkeit} %</div><div class="sub">Spanne ${num(s.spanne, 0)} Punkte, ${s.runden} Runde(n)</div></div>
      ${p.statistiker ? `<div class="kpi" style="background:var(--sky)"><div class="l">Statistiker korrigiert</div><div class="big">${esc(p.statistiker.korrigierte_wahrscheinlichkeit)} %</div><div class="sub">Stärke: ${esc(p.statistiker.staerke)}</div></div>` : ""}
      <div class="kpi" style="background:var(--mint)"><div class="l">Richtung</div><div style="font-weight:620">${esc(s.richtung)}</div><div class="sub">${esc(s.kategorie)}</div></div>
    </div>
    <p style="margin-top:14px">${esc(s.zusammenfassung)}</p>
    ${s.dissens ? `<p><b>Dissens:</b> ${esc(s.dissens)}</p>` : ""}
    <p class="muted small">„Erfolg“ = im Plus, Ziel erreicht und MSCI World geschlagen.</p>
  </div>
  ${(s.optionen || []).length ? `<h3>Sinnvolle Optionen</h3><div class="card flat">${s.optionen.map((o) => `<p><b>${esc(o.name)}</b> – ${esc(o.begruendung)}</p>`).join("")}</div>` : ""}
  ${(s.langfristplan || []).length ? `<h3>Langfristplan</h3><div class="card flat" style="overflow-x:auto"><table>
    <tr><th>Alter</th><th>Anlageklasse</th><th>Anteil</th><th>Vorteile</th><th>Nachteile</th></tr>
    ${s.langfristplan.map((l) => `<tr><td>${esc(l.von_alter)}–${esc(l.bis_alter)}</td><td>${esc(l.anlageklasse)}</td><td>${esc(l.anteil)}</td><td>${esc(l.vorteile)}</td><td>${esc(l.nachteile)}</td></tr>`).join("")}
  </table></div>` : ""}
  ${(s.massnahmen || []).length ? `<h3>Was du tun kannst</h3><ul>${s.massnahmen.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
  ${(s.risiken || []).length ? `<h3>Risiken</h3><ul>${s.risiken.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
  ${p.statistiker ? `<h2>Prüfrunde</h2><div class="card flat"><h3>Statistiker</h3><p><b>Basisrate:</b> ${esc(p.statistiker.basisrate)}</p><p>${esc(p.statistiker.begruendung)}</p></div>` : ""}
  ${p.premortem ? `<div class="card flat"><h3>Pre-Mortem: So scheitert es</h3><ul>${(p.premortem.scheitern || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <p><b>Letzte Schwachstellen</b></p><ul>${(p.premortem.schwachstellen || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <p><b>Frühwarnsignale</b></p><ul>${(p.premortem.fruehwarnsignale || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
  ${p.produkt ? `<div class="card flat"><h3>Beste Produkte – du wählst selbst</h3>
    ${(p.produkt.produkte || []).map((x) => `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
      <b>${x.verifiziert ? `<a href="#/produkte/${esc(x.isin)}">${esc(x.name)}</a>` : esc(x.name)}</b>
      ${x.verifiziert ? '<span class="pill p-mint">im Katalog</span>' : '<span class="pill p-sand">nicht verifiziert</span>'}
      <div class="muted small">${esc(x.isin)} · ${esc(x.kategorie)}</div><p>${esc(x.warum)}</p><p class="src">${esc(x.kennzahlen)}</p></div>`).join("")}
    ${p.produkt.hinweis ? `<p class="muted small">${esc(p.produkt.hinweis)}</p>` : ""}</div>` : ""}
  <div class="actions"><a class="btn primary" href="#/plaene/neu?session=${sid}">Als Entscheidung einfrieren</a><a class="btn" href="#/szenario?quelle=council&id=${sid}">Szenario anwenden</a></div>`;
}

async function viewCouncil(sid) {
  const d = await api(`/api/council/${sid}`);
  const s = d.session;
  const klaer = d.messages.filter((m) => m.phase === "klaeren");
  const fach = d.messages.filter((m) => m.phase === "fach");
  const runden = [...new Set(fach.map((m) => m.round))];
  const arbeitet = !!s.progress && s.status !== "fertig" && s.status !== "dissens";

  let html = `${kopf("Council", "#/council")}
    <div class="row"><div>${statusPill(s.status)} <span class="muted small">${datum(s.created_at)}</span></div></div>
    <div class="msg user"><div class="who">Deine Idee</div>${esc(s.idea)}</div>
    ${d.warnung ? `<div class="err">${esc(d.warnung)}</div>` : ""}`;

  for (const m of klaer) {
    if (m.role === "recherche") { html += `<div class="msg sys"><div class="who">Recherche</div>${esc(m.content)}${m.data?.research_id ? ` · <a href="#/recherche/${m.data.research_id}">Antwort und Quellen</a>` : ""}
      ${(m.data?.quellen || []).length ? `<ul class="small">${m.data.quellen.slice(0, 5).map((q) => `<li><a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.titel)}</a> <span class="muted">${esc(q.quelle)}, ${esc(q.datum)}</span></li>`).join("")}</ul>` : ""}</div>`; continue; }
    if (m.role === "nutzer") html += `<div class="msg user"><div class="who">Du</div>${esc(m.content)}</div>`;
    else html += `<div class="msg mod"><div class="who">Moderator · ${esc(m.provider)}/${esc(m.model)}</div>
      <p>${esc(m.data?.verstaendnis)}</p>${(m.data?.fragen || []).length ? `<ul>${m.data.fragen.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}</div>`;
  }

  if (d.profil_offen.length) {
    html += `<div class="card flat"><h3>Für dein Profil übernehmen?</h3>
      ${d.profil_offen.map((f) => `<div class="row" style="padding:6px 0"><div><b>${esc(f.label)}:</b> ${esc(f.value)} ${est(f.status)}</div>
        <div style="flex:0 0 auto"><button data-ok="${f.id}">Übernehmen</button> <button class="ghost" data-no="${f.id}">Nein</button></div></div>`).join("")}</div>`;
  }

  if (s.status === "klaeren" && !arbeitet) {
    const bereit = klaer.length && klaer[klaer.length - 1].data?.bereit;
    html += `<div class="card"><form id="f"><label>Deine Antwort</label><textarea name="text" required></textarea>
      <div class="actions"><button>Antworten</button></div></form>
      <div class="actions"><button class="primary" id="start">${bereit ? "Diskussion starten" : "Trotzdem Diskussion starten"}</button></div>
      <form id="such" class="row" style="margin-top:16px;align-items:flex-end"><div style="flex:3 1 240px"><label for="such-q">Aktuelle Quellen suchen</label>
        <input id="such-q" name="query" value="${esc(s.idea.slice(0, 80))}" placeholder="Suchbegriff"></div>
        <div style="flex:0 0 auto"><button>Suchen und anhängen</button></div></form>
      <p class="muted small">Du kannst auch einfach schreiben „Such aktuelle Nachrichten zu …“ – der Moderator sucht dann selbst.</p>
      ${bereit ? "" : '<p class="muted small">Der Moderator hat noch offene Fragen. Je mehr er weiß, desto besser die Diskussion.</p>'}</div>`;
  }
  if (arbeitet) html += `<div class="card progress"><span class="dot"></span>${esc(s.progress)} …</div>`;
  if (s.error) html += errBox(s.error);
  if (s.status === "fehler") html += `<div class="actions"><button class="primary" id="start">Erneut versuchen</button></div>`;

  for (const r of runden) {
    const ms = fach.filter((m) => m.round === r && m.role !== "moderator");
    const mod = fach.find((m) => m.round === r && m.role === "moderator");
    html += `<h2>Runde ${r}</h2><div class="members">${ms.map(memberCard).join("")}</div>${mod ? `<p class="muted small">${esc(mod.content)}</p>` : ""}`;
  }
  if (s.result) html += ergebnisHtml(s.result, sid);
  render(html);

  document.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => { await api(`/api/profil/${b.dataset.ok}/bestaetigen`, { body: {} }); route(); }));
  document.querySelectorAll("[data-no]").forEach((b) => (b.onclick = async () => { await api(`/api/profil/${b.dataset.no}/ablehnen`, { body: {} }); route(); }));
  const f = document.getElementById("f");
  if (f) f.onsubmit = async (ev) => { ev.preventDefault(); await api(`/api/council/${sid}/antwort`, { body: formData(ev.target) }); route(); };
  const such = document.getElementById("such");
  if (such) such.onsubmit = async (ev) => { ev.preventDefault(); try { await api(`/api/council/${sid}/recherche`, { body: formData(ev.target) }); route(); } catch (e) { toast(e.message); } };
  const st = document.getElementById("start");
  if (st) st.onclick = async () => { st.disabled = true; await api(`/api/council/${sid}/start`, { body: {} }); route(); };
  if (arbeitet || s.status === "laeuft") poll(() => { if (location.hash === `#/council/${sid}`) viewCouncil(sid).catch(() => {}); });
}

// ---------- Pläne ----------

const ja = (v) => (v == null ? '<span class="pill p-sky">offen</span>' : v ? '<span class="pill p-mint">ja</span>' : '<span class="pill p-rose">nein</span>');

async function viewPlaene() {
  const d = await api("/api/plaene");
  const q = d.trefferquote;
  const quote = (x) => (x.von ? `${x.ja} / ${x.von}` : "–");
  render(`${kopf("Pläne")}${planTabs("entscheidungen")}
    <p class="muted">Eingefrorene Entscheidungen mit Council-Protokoll. Auswertung gegen den MSCI World.</p>
    <div class="grid3">
      <div class="kpi" style="background:var(--mint)"><div class="l">Markt geschlagen</div><div class="big">${quote(q.markt_geschlagen)}</div></div>
      <div class="kpi" style="background:var(--lav)"><div class="l">Ziel erreicht / auf Kurs</div><div class="big">${quote(q.ziel)}</div></div>
      <div class="kpi" style="background:var(--peach)"><div class="l">Im Plus</div><div class="big">${quote(q.im_plus)}</div></div>
    </div>
    <p class="muted small">Jeweils letzte Auswertung. Vergleich: iShares Core MSCI World (IE00B4L5Y983) mit denselben Einzahlungen.</p>
    <div class="actions"><a class="btn" href="#/plaene/neu">Entscheidung ohne Council anlegen</a></div>
    <div class="card list">${d.plaene.map((p) => `<a class="item" href="#/plaene/${p.id}"><span class="t">${esc(p.title)}<br><span class="muted small">${datum(p.created_at)} · ${num(p.horizont_jahre)} Jahre</span></span>
      <span>${p.letzte_auswertung ? (p.letzte_auswertung.markt_geschlagen ? '<span class="pill p-mint">schlägt Markt</span>' : p.letzte_auswertung.markt_geschlagen === false ? '<span class="pill p-rose">unter Markt</span>' : '<span class="pill p-sky">Kurs fehlt</span>') : '<span class="pill p-sky">nicht ausgewertet</span>'}</span></a>`).join("") || '<p class="muted">Noch keine Pläne. Speichere ein Council-Ergebnis als Plan.</p>'}</div>`);
}

async function viewPlanNeu(query) {
  const qp = new URLSearchParams(query || "");
  const sessionId = qp.get("session"), portfolioId = qp.get("portfolio");
  const [kat, prof] = await Promise.all([api("/api/produkte"), api("/api/profil")]);
  let vorschlag = {}, produkteVorschlag = [];
  if (portfolioId) {
    const pf = await api(`/api/portfolios/${portfolioId}`);
    vorschlag = { titel: pf.name, was: "Portfolio", warum: pf.beschreibung, einmalbetrag: pf.einmalbetrag, sparrate: pf.sparrate, startdatum: pf.startdatum };
    produkteVorschlag = pf.positionen;
  }
  if (sessionId) {
    const c = await api(`/api/council/${sessionId}`);
    const r = c.session.result;
    if (r) {
      vorschlag = { titel: r.synthese.richtung, was: r.synthese.kategorie, warum: r.synthese.zusammenfassung };
      produkteVorschlag = ((r.pruefung || {}).produkt || {}).produkte?.filter((p) => p.verifiziert) || [];
    }
  }
  const pv = (k) => prof.aktuell[k]?.value || "";
  const optionen = kat.produkte.map((p) => `<option value="${esc(p.ticker)}|${esc(p.isin)}|${esc(p.name)}">${esc(p.name)} (${esc(p.ticker)})</option>`).join("");
  let zn = 0;
  const zeile = (sel = "", anteil = 0, eigen = null) => `<div class="row prod"><select name="p" aria-label="Produkt" style="flex:3 1 240px">${optionen.replace(`value="${sel}`, `selected value="${sel}`)}<option value="eigen" ${eigen ? "selected" : ""}>Eigener Ticker …</option></select>
    <input class="ptick" placeholder="Ticker, z. B. SAP.DE" value="${esc(eigen || "")}" ${eigen ? "" : "hidden"} style="flex:1 1 140px">
    <div style="flex:2 1 220px">${slider({ id: `pl-a${zn++}`, label: "Anteil", skala: "prozent", wert: anteil, klein: true, gruppe: "pl" })}</div></div>`;
  const gleich = auf100(produkteVorschlag.map((p) => (p.anteil == null ? 1 : +p.anteil)));
  produkteVorschlag = produkteVorschlag.map((p, i) => ({ ...p, anteil: gleich[i] }));
  const start = produkteVorschlag.length
    ? produkteVorschlag.map((p) => { const k = kat.produkte.find((x) => (p.isin && x.isin === p.isin) || x.ticker === p.ticker); return k ? zeile(`${k.ticker}|${k.isin}`, p.anteil ?? 100) : zeile("", p.anteil ?? 100, p.ticker); }).join("")
    : zeile("", 100);
  render(`${kopf("Entscheidung einfrieren", sessionId ? `#/council/${sessionId}` : portfolioId ? `#/portfolios/${portfolioId}` : "#/plaene/entscheidungen")}
    <p class="muted">Der Plan wird eingefroren: später nicht mehr änderbar, nur Notizen und Auswertungen kommen dazu. So kannst du ehrlich prüfen, was funktioniert hat.</p>
    <form id="f" class="card">
      <label>Titel</label><input name="titel" value="${esc(vorschlag.titel)}" required>
      <label>Was (Kategorie, Idee)</label><input name="was" value="${esc(vorschlag.was)}">
      <label>Wofür (Ziel)</label><input name="wofuer" value="${esc(pv("ziel"))}">
      <label>Warum (These)</label><textarea name="warum">${esc(vorschlag.warum)}</textarea>
      <label>Woran erkenne ich, ob die These stimmt? (Prüfkriterien)</label><textarea name="kriterien" placeholder="z. B. Goldpreis > 3.000 $ bei Rezession; Realzins sinkt …"></textarea>
      <div class="slgrid">
        ${slider({ id: "pl-einmal", name: "einmalbetrag", label: "Einmalbetrag", skala: "geld", wert: vorschlag.einmalbetrag ?? (pv("kapital") || 0) })}
        ${slider({ id: "pl-spar", name: "sparrate", label: "Sparrate", skala: "rate", wert: vorschlag.sparrate ?? (pv("sparrate") || 0) })}
        ${slider({ id: "pl-horizont", name: "horizont_jahre", label: "Wie lange", skala: "jahre", wert: pv("horizont_jahre") || 10 })}
        ${slider({ id: "pl-ziel", name: "zielbetrag", label: "Zielbetrag", skala: "geld", wert: pv("zielbetrag") || 0, hinweis: "0 = kein Ziel" })}
      </div>
      <label for="pl-start">Startdatum</label><input id="pl-start" name="startdatum" type="date" value="${vorschlag.startdatum || new Date().toISOString().slice(0, 10)}">
      <label>Produkte und Anteil (%)</label><div id="prods">${start}</div>
      <div class="actions"><button type="button" id="add">+ Produkt</button><span id="rest-pl" class="rest"></span></div>
      <div id="e"></div>
      <div class="actions"><button class="primary">Einfrieren und speichern</button></div>
    </form>`);
  const prods = document.getElementById("prods");
  prods.addEventListener("change", (ev) => { if (ev.target.name === "p") ev.target.parentElement.querySelector(".ptick").hidden = ev.target.value !== "eigen"; });
  document.getElementById("add").onclick = () => { prods.insertAdjacentHTML("beforeend", zeile("", 10)); initSlider(prods); };
  initSlider();
  document.getElementById("f").onsubmit = async (ev) => {
    ev.preventDefault();
    const d = formData(ev.target);
    const produkte = [];
    for (const row of document.querySelectorAll(".prod")) {
      let v = row.querySelector("select").value;
      if (v === "eigen") {
        const t = row.querySelector(".ptick").value.trim();
        if (!t) continue;
        v = `${t}||${t}`;
      }
      const [ticker, isin, name] = v.split("|");
      produkte.push({ ticker, isin, name, anteil: Number(row.querySelector('input[type="hidden"]').value) || 0 });
    }
    const body = {
      ...d, session_id: sessionId ? Number(sessionId) : null, produkte,
      horizont_jahre: Number(d.horizont_jahre) || 0, einmalbetrag: Number(d.einmalbetrag) || 0,
      sparrate: Number(d.sparrate) || 0, zielbetrag: Number(d.zielbetrag) > 0 ? Number(d.zielbetrag) : null,
    };
    try {
      const r = await api("/api/plaene", { body });
      location.hash = `#/plaene/${r.id}`;
    } catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
}

function auswertungHtml(a) {
  const ziel = a.ziel ? a.ziel.status : null;
  const zielPill = ziel == null ? '<span class="pill p-sky">kein Ziel</span>'
    : ["erreicht", "auf Kurs"].includes(ziel) ? `<span class="pill p-mint">${esc(ziel)}</span>` : `<span class="pill p-rose">${esc(ziel)}</span>`;
  return `<div class="grid3">
      <div class="kpi" style="background:var(--mint)"><div class="l">Markt geschlagen?</div><div class="check">${ja(a.markt_geschlagen)}</div>
        <div class="sub">Plan ${pct(a.rendite == null ? null : a.rendite * 100)} · MSCI World ${pct(a.benchmark_rendite == null ? null : a.benchmark_rendite * 100)}</div></div>
      <div class="kpi" style="background:var(--lav)"><div class="l">Ziel</div><div class="check">${zielPill}</div>
        <div class="sub">${a.ziel?.soll_heute ? "Soll heute " + eur(a.ziel.soll_heute) : ""}</div></div>
      <div class="kpi" style="background:var(--peach)"><div class="l">Im Plus?</div><div class="check">${ja(a.im_plus)}</div>
        <div class="sub">${eur(a.wert)} bei ${eur(a.eingezahlt)} eingezahlt</div></div>
    </div>
    <p class="muted small">Stichtag ${esc(a.stichtag)} · MSCI World mit gleichen Zahlungen: ${eur(a.benchmark_wert)} · ${src(a.quelle)}
    ${a.ziel?.hinweis ? "<br>" + esc(a.ziel.hinweis) : ""}</p>
    ${a.fehlende_kurse?.length ? `<div class="err">Kurs fehlt: ${esc(a.fehlende_kurse.slice(0, 3).join(", "))}</div>` : ""}`;
}

async function viewPlan(pid) {
  const p = await api(`/api/plaene/${pid}`);
  const f = p.frozen, e = f.entscheidung;
  const auswertungen = p.nachtraege.filter((n) => n.kind === "auswertung");
  const letzte = auswertungen[auswertungen.length - 1];
  const nachb = p.nachtraege.filter((n) => n.kind === "nachbesprechung");
  const szen = p.nachtraege.filter((n) => n.kind === "szenario");
  const notizen = p.nachtraege.filter((n) => n.kind === "notiz");
  const kurse = f.kurse_am_entscheidungstag || {};
  render(`${kopf(p.title, "#/plaene")}
    <p class="muted">Eingefroren am ${datum(p.created_at)}${f.ergebnis ? ` · Council: ${esc(f.ergebnis.synthese.bewertung)}, ${f.ergebnis.synthese.wahrscheinlichkeit} %` : ""}</p>
    <div class="actions"><button class="primary" id="ausw">Jetzt auswerten</button><button id="nach">Nachbesprechung mit Council</button><a class="btn" href="#/szenario?quelle=plan&id=${pid}">Szenario anwenden</a></div>
    <div id="a">${letzte ? auswertungHtml(letzte.content) : '<p class="muted">Noch nicht ausgewertet.</p>'}</div>
    ${nachb.map((n) => `<div class="card flat"><h3>Nachbesprechung ${datum(n.created_at)}</h3>${n.content.fehler ? errBox(n.content.fehler) : `
      <p><b>Richtig:</b></p><ul>${(n.content.richtig || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p><b>Falsch:</b></p><ul>${(n.content.falsch || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p><b>Glück oder Können:</b> ${esc(n.content.glueck_oder_koennen)}</p>
      <p><b>Lehren:</b></p><ul>${(n.content.lehren || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p><b>Weiter halten:</b> ${esc(n.content.weiter_halten)}</p><p class="src">${esc(n.content.modell)}</p>`}</div>`).join("")}
    <h2>Entscheidung</h2>
    <div class="card flat">
      <p><b>Was:</b> ${esc(e.was)}</p><p><b>Wofür:</b> ${esc(e.wofuer)}</p><p><b>Warum:</b> ${esc(e.warum)}</p>
      <p><b>Prüfkriterien:</b> ${esc(e.kriterien) || "–"}</p>
      <p><b>Wie lange:</b> ${num(e.horizont_jahre)} Jahre ab ${esc(e.startdatum)} · <b>Einmal:</b> ${eur(e.einmalbetrag)} · <b>Monatlich:</b> ${eur(e.sparrate)} · <b>Ziel:</b> ${eur(e.zielbetrag)}</p>
      <table><tr><th>Produkt</th><th>Anteil</th><th>Kurs am Entscheidungstag</th></tr>
      ${e.produkte.map((x) => `<tr><td>${esc(x.name || x.ticker)}<br><span class="muted small">${esc(x.isin)} ${esc(x.ticker)}</span></td><td>${pct(x.anteil * 100, 1)}</td>
        <td>${kurse[x.ticker] ? `${num(kurse[x.ticker].kurs, 4)}<br>${src(kurse[x.ticker].quelle, kurse[x.ticker].datum)}` : "–"}</td></tr>`).join("")}
      <tr><td>MSCI World (Vergleich)<br><span class="muted small">${esc(f.benchmark.isin)}</span></td><td></td>
        <td>${kurse[f.benchmark.ticker] ? `${num(kurse[f.benchmark.ticker].kurs, 4)}<br>${src("Yahoo Finance", kurse[f.benchmark.ticker].datum)}` : "–"}</td></tr></table>
    </div>
    ${szen.length ? `<h2>Szenarien</h2><div class="card flat"><table><tr><th>Szenario</th><th class="num">Worst</th><th class="num">Realistisch</th><th class="num">Best</th><th>Datum</th></tr>
      ${szen.map((n) => `<tr><td>${esc(n.content.szenario)}${n.content.ki ? ' <span class="pill p-lav">mit KI-Begründung</span>' : ""}</td><td class="num">${pct(n.content.worst * 100, 1)}</td><td class="num">${pct(n.content.realistisch * 100, 1)}</td><td class="num">${pct(n.content.best * 100, 1)}</td><td>${datum(n.created_at)}</td></tr>`).join("")}</table></div>` : ""}
    <h2>Notizen</h2>
    ${notizen.map((n) => `<div class="card flat"><p class="muted small">${datum(n.created_at)}</p><p>${esc(n.content.text)}</p></div>`).join("")}
    <form id="nf" class="card flat"><textarea name="text" placeholder="Was ist seitdem passiert?" required></textarea><div class="actions"><button>Notiz hinzufügen</button></div></form>
    ${f.ergebnis ? `<h2>Council-Ergebnis von damals</h2>${ergebnisHtml(f.ergebnis, p.session_id).replace(/<div class="actions">.*?<\/div>\s*$/s, "")}` : ""}
    ${f.protokoll?.length ? `<details><summary>Vollständiges Protokoll (${f.protokoll.length} Beiträge)</summary>
      ${f.protokoll.map((m) => `<div class="card flat"><p class="muted small">${esc(m.titel)} · ${esc(m.phase)} ${m.round ? "Runde " + m.round : ""} · ${esc(m.provider || "")}/${esc(m.model || "")}</p><p>${esc(m.content)}</p></div>`).join("")}</details>` : ""}
    ${Object.keys(f.profil || {}).length ? `<details><summary>Profil am Entscheidungstag</summary><div class="card flat">${Object.values(f.profil).map((v) => `<p>${esc(v.label)}: ${esc(v.value)} ${est(v.status)}</p>`).join("")}</div></details>` : ""}`);
  document.getElementById("ausw").onclick = async (ev) => {
    ev.target.disabled = true;
    ev.target.textContent = "Lade Kurse …";
    try { await api(`/api/plaene/${pid}/auswerten`, { body: {} }); viewPlan(pid); } catch (e) { document.getElementById("a").innerHTML = errBox(e); }
  };
  document.getElementById("nach").onclick = async (ev) => {
    ev.target.disabled = true;
    ev.target.textContent = "Council denkt nach …";
    await api(`/api/plaene/${pid}/nachbesprechung`, { body: {} });
    const vorher = nachb.length;
    const warte = async (n) => {
      if (location.hash !== `#/plaene/${pid}` || n > 40) return;
      const q = await api(`/api/plaene/${pid}`);
      if (q.nachtraege.filter((x) => x.kind === "nachbesprechung").length > vorher) viewPlan(pid);
      else poll(() => warte(n + 1));
    };
    poll(() => warte(0));
  };
  document.getElementById("nf").onsubmit = async (ev) => { ev.preventDefault(); await api(`/api/plaene/${pid}/notiz`, { body: formData(ev.target) }); viewPlan(pid); };
}

// ---------- Recherche ----------

async function viewRechercheList() {
  const d = await api("/api/recherche");
  render(`${kopf("Recherche")}${rechercheTabs("recherche")}
    <div class="card"><form id="f">
      <div class="row">
        <div><label>Art</label><select name="kind"><option value="frage">Frage</option><option value="briefing">Briefing</option><option value="analyse">Analyse</option></select></div>
        <div><label>Bereich</label><select name="bereich">${Object.entries(d.bereiche).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></div>
      </div>
      <label>Frage oder Thema</label><textarea name="query" placeholder="z. B. Welche Gesetzesänderungen betreffen gerade Anleger in Deutschland?" required></textarea>
      <div id="e"></div>
      <div class="actions"><button class="primary">Recherchieren</button></div>
      <p class="muted small">Quellen: ${d.quellen.feeds.map((f) => esc(f.name)).join(", ")}, EZB-Datenportal, Bundestag DIP. Das Modell antwortet nur aus diesem Material.</p>
    </form></div>
    <h2>Bisherige</h2>
    <div class="card list">${d.liste.map((r) => `<a class="item" href="#/recherche/${r.id}"><span class="t">${esc(r.query)}<br><span class="muted small">${esc(r.kind)} · ${datum(r.created_at)}</span></span>
      <span class="pill ${r.status === "fertig" ? "p-mint" : r.status === "fehler" ? "p-rose" : "p-lav"}">${esc(r.status)}</span></a>`).join("") || '<p class="muted">Noch keine.</p>'}</div>`);
  document.getElementById("f").onsubmit = async (ev) => {
    ev.preventDefault();
    try { const r = await api("/api/recherche", { body: formData(ev.target) }); location.hash = `#/recherche/${r.id}`; }
    catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
}

async function viewRecherche(rid) {
  const r = await api(`/api/recherche/${rid}`);
  render(`${kopf(r.query, "#/recherche")}
    <p class="muted">${esc(r.kind)} · ${datum(r.created_at)}${r.model ? ` · ${esc(r.provider)}/${esc(r.model)}` : ""}</p>
    ${r.status === "laeuft" ? '<div class="card progress"><span class="dot"></span>Sammle Quellen und werte aus …</div>' : `<div class="card">${md(r.answer || "", r.quellen)}</div>`}
    ${r.quellen.length ? `<h2>Quellen</h2><div class="card flat"><ol>${r.quellen.map((q) => `<li><a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.titel)}</a><br>
      <span class="src">${esc(q.quelle)}, ${esc(q.datum)} · abgerufen ${esc(q.abgerufen)}</span></li>`).join("")}</ol></div>` : ""}
    ${r.status === "fertig" ? `<div class="actions"><a class="btn" href="#/council">Mit dem Council besprechen</a></div>` : ""}`);
  if (r.status === "laeuft") poll(() => { if (location.hash === `#/recherche/${rid}`) viewRecherche(rid).catch(() => {}); });
}

// ---------- Produkte ----------

async function viewProdukte() {
  const d = await api("/api/produkte");
  render(`${kopf("Produkte", "#/recherche")}${rechercheTabs("produkte")}
    <p class="muted">Startkatalog. Kurse und Renditen live, Stammdaten (TER, Top-10) mit Quelle. Immer selbst auf den Anbieterseiten gegenprüfen.</p>
    ${d.kategorien.map((k) => `<h2>${esc(k)}</h2><div class="card list">
      ${d.produkte.filter((p) => p.kategorie === k).map((p) => `<a class="item" href="#/produkte/${esc(p.id)}">
        <span class="t">${esc(p.name)}<br><span class="muted small">${esc(p.isin)} ${esc(p.ticker)}</span></span>
        <span class="muted small">${p.fakten.ter ? "TER " + esc(p.fakten.ter.wert) + " %" : ""}</span></a>`).join("")}</div>`).join("")}
    <h2>Bewertungsregeln</h2><div class="card flat"><table>${d.regeln.map((r) => `<tr><td>${esc(r.name)}</td><td>gut ${r.hoeher_besser ? "ab" : "bis"} ${r.gut} ${esc(r.einheit)}, mittel ${r.hoeher_besser ? "ab" : "bis"} ${r.mittel} ${esc(r.einheit)}</td></tr>`).join("")}</table></div>`);
}

async function viewProdukt(kennung) {
  render(`${kopf("Produkt", "#/produkte")}<div class="card progress"><span class="dot"></span>Lade Kurse …</div>`);
  const h0 = location.hash;
  const p = await api(`/api/produkte/${encodeURIComponent(kennung)}`);
  if (location.hash !== h0) return;
  const l = p.live;
  const noteCls = { gut: "p-mint", mittel: "p-sand", schwach: "p-rose" };
  const top10 = p.fakten.top10 ? JSON.parse(p.fakten.top10.wert) : null;
  render(`${kopf(p.name, "#/produkte")}
    <p class="muted">${esc(p.isin)} · ${esc(p.ticker)} · ${esc(p.anbieter)} · ${esc(p.kategorie)}</p>
    ${p.hinweis ? `<div class="notice">${esc(p.hinweis)}</div>` : ""}
    ${l.kurs ? `<div class="grid3">
      <div class="kpi" style="background:var(--sky)"><div class="l">Rendite 1 J.</div><div class="big">${pct(l.rendite_1j)}</div></div>
      <div class="kpi" style="background:var(--mint)"><div class="l">Rendite 5 J. p.a.</div><div class="big">${pct(l.rendite_5j)}</div></div>
      <div class="kpi" style="background:var(--peach)"><div class="l">Max. Verlust 5 J.</div><div class="big">${pct(l.max_verlust)}</div></div>
    </div><p>${src(p.live_quelle, l.stand)} · Kurs ${num(l.kurs, 4)} · 3 J. p.a. ${pct(l.rendite_3j)} · Schwankung ${pct(l.volatilitaet)}</p>`
    : '<div class="err">Kurs nicht abrufbar (Ticker prüfen).</div>'}
    <h2>Bewertung</h2>
    <div class="card flat">${p.bewertung.map((b) => `<div class="row" style="padding:6px 0"><div>${esc(b.name)}<br><span class="src">${esc(b.regel)}</span></div>
      <div style="flex:0 0 auto">${num(b.wert)} ${esc(b.einheit)} <span class="pill ${noteCls[b.note]}">${esc(b.note)}</span></div></div>`).join("") || '<p class="muted">Keine Kennzahlen.</p>'}</div>
    <h2>Stammdaten</h2>
    <div class="card flat">${Object.entries(p.fakten).filter(([k]) => k !== "top10").map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v.wert)} ${src(v.quelle, v.datum)}</p>`).join("") || '<p class="muted">Noch keine Stammdaten mit Quelle hinterlegt.</p>'}
      ${top10 ? `<h3>Top-10-Positionen</h3><table>${top10.map((t) => `<tr><td>${esc(t.name)}</td><td>${pct(t.anteil)}</td></tr>`).join("")}</table>${src(p.fakten.top10.quelle, p.fakten.top10.datum)}` : ""}</div>
    <h2>Selbst prüfen</h2><div class="card flat">${p.links.map((x) => `<p><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titel)}</a></p>`).join("")}</div>
    ${ME.is_admin && p.isin ? `<h2>Stammdaten pflegen</h2><div class="card flat">
      <button id="yahoo">Von Yahoo Finance laden</button>
      <form id="ff"><div class="row"><div><label>Kennzahl</label><select name="key"><option value="ter">TER (%)</option><option value="volumen_mio">Volumen (Mio. €)</option><option value="top10_anteil">Top-10-Anteil (%)</option><option value="replikation">Replikation</option><option value="ertrag">Ertragsverwendung</option><option value="domizil">Domizil</option></select></div>
      <div><label>Wert</label><input name="value" required></div></div><label>Quelle (Pflicht)</label><input name="quelle" placeholder="z. B. Factsheet iShares, 31.10.2026" required>
      <div class="actions"><button>Speichern</button></div></form></div>` : ""}`);
  const y = document.getElementById("yahoo");
  if (y) y.onclick = async () => { const r = await api(`/api/admin/produkt/${p.isin}/yahoo`, { body: {} }); toast(r.geladen.length ? "Geladen: " + r.geladen.join(", ") : "Yahoo hat keine Daten"); viewProdukt(kennung); };
  const ff = document.getElementById("ff");
  if (ff) ff.onsubmit = async (ev) => { ev.preventDefault(); await api(`/api/admin/produkt/${p.isin}/fakt`, { body: formData(ev.target) }); viewProdukt(kennung); };
}

// ---------- Profil ----------

const num0 = (f, d) => (f && !isNaN(parseFloat(f.value)) ? parseFloat(f.value) : d);

async function viewProfil() {
  const p = await api("/api/profil");
  const keys = Object.keys(p.labels);
  render(`${kopf("Profil")}
    <p class="muted">Entsteht aus deinen Gesprächen mit dem Council. Nur bestätigte Angaben werden genutzt.</p>
    <div class="card flat">${Object.entries(p.aktuell).map(([k, v]) => `<div class="row" style="padding:6px 0"><div><b>${esc(v.label)}</b></div><div>${esc(v.value)} ${est(v.status)}</div></div>`).join("") || '<p class="muted">Noch leer.</p>'}</div>
    ${p.offen.length ? `<h2>Vorschläge</h2><div class="card flat">${p.offen.map((f) => `<div class="row" style="padding:6px 0"><div><b>${esc(f.label)}:</b> ${esc(f.value)} ${est(f.status)}</div>
      <div style="flex:0 0 auto"><button data-ok="${f.id}">Übernehmen</button> <button class="ghost" data-no="${f.id}">Nein</button></div></div>`).join("")}</div>` : ""}
    <h2>Schnell einstellen</h2>
    <div class="card"><div class="slgrid">
      ${slider({ id: "p-alter", label: "Alter", skala: "alter", wert: num0(p.aktuell.alter, 34) })}
      ${slider({ id: "p-zielalter", label: "Zielalter", skala: "alter", wert: num0(p.aktuell.zielalter, 60) })}
      ${slider({ id: "p-horizont_jahre", label: "Anlagehorizont", skala: "jahre", wert: num0(p.aktuell.horizont_jahre, 20) })}
      ${slider({ id: "p-risiko", label: "Risikobereitschaft", skala: "risiko", wert: num0(p.aktuell.risiko, 3) })}
      ${slider({ id: "p-kapital", label: "Verfügbares Kapital", skala: "geld", wert: num0(p.aktuell.kapital, 10000) })}
      ${slider({ id: "p-sparrate", label: "Sparrate", skala: "rate", wert: num0(p.aktuell.sparrate, 300) })}
      ${slider({ id: "p-zielbetrag", label: "Zielbetrag", skala: "geld", wert: num0(p.aktuell.zielbetrag, 300000) })}
      ${slider({ id: "p-ruecklage", label: "Notgroschen", skala: "geld", wert: num0(p.aktuell.ruecklage, 10000) })}
      ${slider({ id: "p-einkommen", label: "Nettoeinkommen", skala: "einkommen", wert: num0(p.aktuell.einkommen, 3000) })}
    </div><div class="actions"><button class="primary" id="p-save" disabled>Änderungen speichern</button><span class="muted small" id="p-info">Regler bewegen, dann speichern.</span></div></div>
    <h2>Andere Angabe</h2>
    <form id="f" class="card flat"><div class="row">
      <div><label>Was</label><select name="key">${keys.map((k) => `<option value="${k}">${esc(p.labels[k])}</option>`).join("")}</select></div>
      <div><label>Wert</label><input name="value" required></div>
      <div><label>Status</label><select name="status"><option value="angegeben">sicher</option><option value="geschaetzt">geschätzt</option></select></div>
    </div><div class="actions"><button>Speichern</button></div></form>
    <h2>Konto</h2>
    <form id="pw" class="card flat"><div class="row"><div><label>Altes Passwort</label><input name="alt" type="password" required></div><div><label>Neues Passwort</label><input name="neu" type="password" minlength="8" required></div></div>
      <div id="e"></div><div class="actions"><button>Passwort ändern</button></div></form>
    <div class="actions">${ME.is_admin ? '<a class="btn" href="#/admin">Einstellungen</a>' : ""}<button class="ghost" id="out">Abmelden</button></div>`);
  document.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = async () => { await api(`/api/profil/${b.dataset.ok}/bestaetigen`, { body: {} }); viewProfil(); }));
  document.querySelectorAll("[data-no]").forEach((b) => (b.onclick = async () => { await api(`/api/profil/${b.dataset.no}/ablehnen`, { body: {} }); viewProfil(); }));
  document.getElementById("f").onsubmit = async (ev) => { ev.preventDefault(); await api("/api/profil", { body: formData(ev.target) }); viewProfil(); };
  const geaendert = new Set();
  initSlider(document, (id) => { geaendert.add(id); document.getElementById("p-save").disabled = false; document.getElementById("p-info").textContent = `${geaendert.size} geändert`; });
  document.getElementById("p-save").onclick = async () => {
    for (const id of geaendert) await api("/api/profil", { body: { key: id.slice(2), value: String(slWert(id)), status: "angegeben" } });
    toast("Profil gespeichert"); viewProfil();
  };
  document.getElementById("pw").onsubmit = async (ev) => {
    ev.preventDefault();
    try { await api("/api/passwort", { body: formData(ev.target) }); toast("Passwort geändert"); ev.target.reset(); }
    catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
  document.getElementById("out").onclick = async () => { await api("/api/logout", { body: {} }); ME = null; location.hash = "#/login"; };
}

// ---------- Admin ----------

async function viewAdmin() {
  const d = await api("/api/admin/modelle");
  const z = d.zuordnung;
  render(`${kopf("Einstellungen")}
    <h2>Freunde einladen</h2>
    <div class="card flat"><p class="muted small">Freunde brauchen zusätzlich Zugriff auf den Server über Tailscale (Gerät teilen).</p>
      <button id="inv">Einladungscode erzeugen</button><p id="code" class="big"></p></div>
    <h2>Nutzer</h2><div class="card flat">${d.nutzer.map((n) => `<p>${esc(n.name)} ${n.is_admin ? '<span class="pill p-lav">Admin</span>' : ""} <span class="muted small">seit ${datum(n.created_at)}</span></p>`).join("")}</div>
    <h2>Modell-Zugänge</h2>
    <div class="card flat">${Object.entries(z.anbieter).map(([k, v]) => `<p>${esc(v.name)} ${d.verfuegbar[k] ? '<span class="pill p-mint">Schlüssel da</span>' : '<span class="pill p-rose">fehlt in .env</span>'}</p>`).join("")}
      <p class="muted small">Heute: ${d.verbrauch_heute.map((v) => `${esc(v.provider)} ${v.calls} Aufrufe (${v.errors} Fehler)`).join(" · ") || "noch keine Aufrufe"}</p></div>
    <h2>Rollen → Modelle</h2>
    <p class="muted small">Je Rolle eine Kette aus [Anbieter, Modell, Familie]. Fällt der erste aus (Limit, Fehler), springt sie zum nächsten. Kritiker und Rendite-Optimierer sollten verschiedene Familien haben.</p>
    <form id="mf" class="card flat"><textarea name="j" style="min-height:360px;font-family:ui-monospace,monospace;font-size:13px">${esc(JSON.stringify(z.rollen, null, 1))}</textarea>
      <div id="e"></div><div class="actions"><button>Speichern</button></div></form>`);
  document.getElementById("inv").onclick = async () => { const r = await api("/api/admin/einladung", { body: {} }); document.getElementById("code").textContent = r.code; };
  document.getElementById("mf").onsubmit = async (ev) => {
    ev.preventDefault();
    try { await api("/api/admin/modelle", { method: "PUT", body: { rollen: JSON.parse(ev.target.j.value) } }); toast("Gespeichert"); }
    catch (e) { document.getElementById("e").innerHTML = errBox(e); }
  };
}

// ---------- Start ----------

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
route();
