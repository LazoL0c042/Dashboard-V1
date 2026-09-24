"use strict";

const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = (n, cur = "EUR") => new Intl.NumberFormat("de-DE", { style: "currency", currency: cur }).format(n ?? 0);
const pct = (n) => (n == null ? "–" : `${n > 0 ? "+" : ""}${n.toLocaleString("de-DE")} %`);
const todayIso = () => new Date().toLocaleDateString("sv-SE");
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const fmtDate = (iso) => new Date(iso + "T12:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });

// ---------------------------------------------------------------- API
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}`, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 || res.status === 503) {
    localStorage.removeItem("token");
    showLogin((await res.json().catch(() => ({}))).detail);
    throw new Error("auth");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Fehler ${res.status}`);
  }
  return res.json();
}
const post = (path, body = {}) => api(path, { method: "POST", body });

let toastTimer;
function toast(msg, undoId) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>` + (undoId ? `<button data-undo="${undoId}">Rückgängig</button>` : "");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), undoId ? 6000 : 2800);
}
$("#toast").addEventListener("click", async (e) => {
  const id = e.target.dataset.undo;
  if (!id) return;
  const r = await post(`/api/undo/${id}`);
  toast(r.reply);
  render();
});

// ---------------------------------------------------------------- Navigation
let current = location.hash.slice(1) || "today";
document.querySelectorAll(".tabs button[data-view]").forEach((b) =>
  b.addEventListener("click", () => { current = b.dataset.view; location.hash = current; render(); }));

async function render() {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === current));
  if (!localStorage.getItem("token")) return showLogin();
  try {
    await (VIEWS[current] || VIEWS.today)();
  } catch (e) {
    if (e.message !== "auth") view.innerHTML = `<p class="empty">${esc(e.message)}. Prüfe, ob der Server läuft.</p>`;
  }
}

function showLogin(reason) {
  view.innerHTML = $("#login").innerHTML + (reason ? `<p class="muted" style="text-align:center">${esc(reason)}</p>` : "");
  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    localStorage.setItem("token", $("#token").value.trim());
    render();
  });
}

// ---------------------------------------------------------------- Bausteine
const todoItem = (t) => {
  const late = t.due_date && t.due_date < todayIso() && !t.done;
  const meta = [t.project, t.due_date && fmtDate(t.due_date), t.priority === 1 && "hoch"].filter(Boolean);
  return `<li>
    <button class="check ${t.done ? "on" : ""}" data-todo="${t.id}" aria-label="${t.done ? "Wieder öffnen" : "Erledigen"}"></button>
    <div class="grow"><div class="${t.done ? "done-text" : ""}">${esc(t.title)}</div>
    ${meta.length ? `<div class="meta ${late ? "overdue" : ""}">${meta.map(esc).join(", ")}${late ? " (überfällig)" : ""}</div>` : ""}</div>
  </li>`;
};

function bindTodoChecks() {
  view.querySelectorAll("[data-todo]").forEach((b) => b.addEventListener("click", async () => {
    await post(`/api/todos/${b.dataset.todo}/toggle`);
    render();
  }));
}

const describe = (a) => ({
  "todo.create": `ToDo: ${a.title}`, "thought.save": `Gedanke: ${a.text}`, "todo.complete": `Erledigt: #${a.todo_id}`,
  "week.plan": `Woche ${a.date}: ${a.title}`, "checklist.log": `Abhaken: ${a.habit}`,
  "progress.log": `Fortschritt: ${a.goal}`, query: `Frage: ${a.question}`,
}[a.type] || a.type);

// ---------------------------------------------------------------- Ansichten
const VIEWS = {
  async today() {
    const d = await api("/api/today");
    const heading = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    view.innerHTML = `
      <h1>${esc(heading)}</h1>
      <form class="capture" id="capture">
        <textarea id="capture-text" placeholder="Was geht dir durch den Kopf?" aria-label="Neuer Eintrag"></textarea>
        <div class="chalkline" id="chalkline"></div>
        <div class="capture-row">
          <span class="muted">Tipp: Mikrofon der Tastatur zum Diktieren</span>
          <button class="primary">Ablegen</button>
        </div>
      </form>

      ${d.inbox.length ? `<h2>Inbox</h2>${d.inbox.map((e) => `
        <div class="inbox-item">
          <p>${esc(e.raw_text)}</p>
          ${e.suggestion.length ? `<div class="meta">Vorschlag: ${e.suggestion.map((a) => esc(describe(a))).join("; ")}</div>` : ""}
          <div class="actions">
            ${e.suggestion.length ? `<button class="ghost" data-inbox="accept" data-id="${e.id}">Vorschlag übernehmen</button>` : ""}
            <button class="ghost" data-inbox="todo" data-id="${e.id}">Als ToDo</button>
            <button class="ghost" data-inbox="thought" data-id="${e.id}">Als Gedanke</button>
            <button class="link" data-inbox="dismiss" data-id="${e.id}">Verwerfen</button>
          </div>
        </div>`).join("")}` : ""}

      <div class="split">
        <section>
          <h2>Als Nächstes</h2>
          ${d.plan.length ? `<ul class="list">${d.plan.map((p) => `<li><div class="grow">${esc(p.title)}</div><span class="meta">Plan</span></li>`).join("")}</ul>` : ""}
          ${d.todos.length ? `<ul class="list">${d.todos.map(todoItem).join("")}</ul>` : `<p class="empty">Keine offenen Aufgaben. Sprich eine ein.</p>`}
        </section>
        <section>
          <h2>Checkliste heute</h2>
          <ul class="list">${d.habits.map((h) => `
            <li>
              <button class="check ${h.today_done ? "on" : ""}" data-habit="${h.id}" aria-label="${esc(h.name)} abhaken"></button>
              <div class="grow">${esc(h.name)}
                <div class="tally" title="${h.week_count} von ${h.target_per_week} diese Woche">
                  ${Array.from({ length: Math.max(h.target_per_week, h.week_count) }, (_, i) => `<i class="${i < h.week_count ? "on" : ""}"></i>`).join("")}
                </div>
              </div>
              <span class="meta">${esc(h.category)}</span>
            </li>`).join("")}</ul>
          ${d.recent.length ? `<h2>Zuletzt abgelegt</h2><ul class="list">${d.recent.map((r) => `
            <li><div class="grow">${esc(r.summary)}<div class="meta">${esc(r.created_at.slice(11, 16))} Uhr</div></div>
            <button class="link" data-undo-row="${r.id}">Rückgängig</button></li>`).join("")}</ul>` : ""}
        </section>
      </div>`;

    const ta = $("#capture-text");
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("#capture").requestSubmit(); });
    $("#capture").addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return ta.focus();
      const line = $("#chalkline");
      line.classList.remove("snap"); void line.offsetWidth; line.classList.add("snap");
      const r = await post("/api/capture", { text, source: "text" });
      ta.value = "";
      toast(r.reply);
      render();
    });
    view.querySelectorAll("[data-inbox]").forEach((b) => b.addEventListener("click", async () => {
      const { inbox, id } = b.dataset;
      try {
        if (inbox === "accept") await post(`/api/inbox/${id}/accept`);
        else if (inbox === "dismiss") await post(`/api/inbox/${id}/dismiss`);
        else await post(`/api/inbox/${id}/as`, { type: inbox });
        render();
      } catch (e) { toast(e.message); }
    }));
    view.querySelectorAll("[data-habit]").forEach((b) => b.addEventListener("click", async () => {
      await post(`/api/habits/${b.dataset.habit}/toggle`);
      render();
    }));
    view.querySelectorAll("[data-undo-row]").forEach((b) => b.addEventListener("click", async () => {
      const r = await post(`/api/undo/${b.dataset.undoRow}`);
      toast(r.reply);
      render();
    }));
    bindTodoChecks();
  },

  async todos() {
    const [open, done] = await Promise.all([api("/api/todos?done=0"), api("/api/todos?done=1")]);
    const byProject = {};
    open.forEach((t) => (byProject[t.project || "Ohne Projekt"] ||= []).push(t));
    view.innerHTML = `
      <h1>Aufgaben</h1>
      <p class="sub">${open.length} offen</p>
      <form class="form" id="todo-form">
        <input name="title" placeholder="Neue Aufgabe" required>
        <div class="two">
          <input name="project" placeholder="Projekt">
          <input name="due_date" type="date" aria-label="Fällig am">
        </div>
        <div class="two">
          <select name="priority" aria-label="Priorität"><option value="2">Normal</option><option value="1">Hoch</option><option value="3">Niedrig</option></select>
          <button class="primary">Hinzufügen</button>
        </div>
      </form>
      ${Object.entries(byProject).map(([p, ts]) => `<h2>${esc(p)}</h2><ul class="list">${ts.map(todoItem).join("")}</ul>`).join("") || `<p class="empty">Alles erledigt.</p>`}
      ${done.length ? `<details><summary>Erledigt (${done.length})</summary><ul class="list">${done.slice(0, 50).map(todoItem).join("")}</ul></details>` : ""}`;
    $("#todo-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      await post("/api/todos", { ...f, priority: +f.priority, due_date: f.due_date || null, project: f.project || null });
      render();
    });
    bindTodoChecks();
  },

  async week() {
    const start = sessionStorage.getItem("weekStart") || todayIso();
    const [w, goals] = await Promise.all([api(`/api/week?start=${start}`), api("/api/goals")]);
    const t = todayIso();
    const shift = (days) => {
      const d = new Date(w.days[0] + "T12:00"); d.setDate(d.getDate() + days);
      sessionStorage.setItem("weekStart", d.toLocaleDateString("sv-SE")); render();
    };
    view.innerHTML = `
      <h1>Woche ab ${esc(fmtDate(w.days[0]))}</h1>
      <div class="capture-row" style="justify-content:flex-start">
        <button class="ghost" id="prev">Vorherige</button>
        <button class="ghost" id="now">Diese Woche</button>
        <button class="ghost" id="next">Nächste</button>
      </div>
      <div class="split">
        <section>
          <h2>Checklisten</h2>
          <table class="grid">
            <thead><tr><th></th>${w.days.map((d, i) => `<th class="${d === t ? "today" : ""}">${WD[i]}</th>`).join("")}</tr></thead>
            <tbody>${w.habits.map((h) => `<tr>
              <td>${esc(h.name)}<div class="meta">${h.count}/${h.target_per_week}</div></td>
              ${h.days.map((on, i) => `<td><button class="cell ${on ? "on" : ""}" data-habit="${h.id}" data-day="${w.days[i]}" aria-label="${esc(h.name)} ${WD[i]}"></button></td>`).join("")}
            </tr>`).join("")}</tbody>
          </table>
          <details><summary>Neue Gewohnheit</summary>
            <form class="form" id="habit-form">
              <input name="name" placeholder="Name, z. B. Laufen" required>
              <div class="two"><input name="category" placeholder="Kategorie: Sport, Lernen, Arbeit" required>
              <input name="target_per_week" type="number" min="1" max="7" value="3" aria-label="Ziel pro Woche"></div>
              <button class="primary">Anlegen</button>
            </form>
          </details>
          <h2>Ziele</h2>
          ${goals.length ? `<div class="bars">${goals.map((g) => {
            const p = g.target ? Math.min(100, (g.current / g.target) * 100) : 0;
            return `<div class="bar-row"><span>${esc(g.title)}</span><span class="muted">${g.current}${g.target ? ` / ${g.target}` : ""} ${esc(g.unit || "")}</span><div class="bar"><span style="width:${p}%"></span></div></div>`;
          }).join("")}</div>` : `<p class="empty">Noch keine Ziele. Lege eins an, dann kannst du Fortschritt einsprechen.</p>`}
          <details><summary>Neues Ziel</summary>
            <form class="form" id="goal-form">
              <input name="title" placeholder="z. B. Gesellenprüfung Theorie" required>
              <div class="two"><input name="target" type="number" step="any" placeholder="Zielwert"><input name="unit" placeholder="Einheit"></div>
              <input name="deadline" type="date" aria-label="Frist">
              <button class="primary">Anlegen</button>
            </form>
          </details>
        </section>
        <section>
          <h2>Plan</h2>
          ${w.days.map((d) => {
            const items = w.plan.filter((p) => p.date === d);
            const due = w.due.filter((x) => x.due_date === d);
            return `<div class="day ${d === t ? "is-today" : ""}"><strong>${esc(fmtDate(d))}</strong>
              ${items.length || due.length ? `<ul>${items.map((p) => `<li>${esc(p.title)} <button class="link" data-del-plan="${p.id}" aria-label="Entfernen">entfernen</button></li>`).join("")}
              ${due.map((x) => `<li class="${x.done ? "done-text" : ""}">Fällig: ${esc(x.title)}</li>`).join("")}</ul>` : ""}</div>`;
          }).join("")}
          <form class="form" id="plan-form">
            <div class="two"><input name="date" type="date" value="${t}" required aria-label="Tag"><input name="title" placeholder="Vorhaben" required></div>
            <button class="primary">Eintragen</button>
          </form>
        </section>
      </div>`;
    $("#prev").onclick = () => shift(-7);
    $("#next").onclick = () => shift(7);
    $("#now").onclick = () => { sessionStorage.removeItem("weekStart"); render(); };
    view.querySelectorAll(".cell").forEach((b) => b.addEventListener("click", async () => {
      await post(`/api/habits/${b.dataset.habit}/toggle?day=${b.dataset.day}`);
      render();
    }));
    view.querySelectorAll("[data-del-plan]").forEach((b) => b.addEventListener("click", async () => {
      await api(`/api/week/${b.dataset.delPlan}`, { method: "DELETE" });
      render();
    }));
    const formPost = (id, path, map = (x) => x) => $(id).addEventListener("submit", async (e) => {
      e.preventDefault();
      await post(path, map(Object.fromEntries(new FormData(e.target))));
      render();
    });
    formPost("#habit-form", "/api/habits", (f) => ({ ...f, target_per_week: +f.target_per_week }));
    formPost("#goal-form", "/api/goals", (f) => ({ ...f, target: f.target ? +f.target : null, deadline: f.deadline || null }));
    formPost("#plan-form", "/api/week");
  },

  async thoughts() {
    const q = sessionStorage.getItem("q") || "";
    const list = await api(`/api/thoughts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    view.innerHTML = `
      <h1>Gedanken</h1>
      <form class="form inline" id="search">
        <input name="q" type="search" placeholder="Durchsuchen" value="${esc(q)}">
        <button class="ghost">Suchen</button>
      </form>
      ${list.length ? `<ul class="list">${list.map((t) => `
        <li><div class="grow">
          <div style="font-family:var(--serif);font-size:17px">${esc(t.text)}</div>
          <div class="meta">${[t.created_at.slice(0, 10), t.project, t.category, t.tags].filter(Boolean).map(esc).join(", ")}</div>
        </div></li>`).join("")}</ul>` : `<p class="empty">${q ? "Nichts gefunden." : "Noch keine Gedanken. Beginne einen Eintrag mit „Gedanke:“ oder sprich einfach drauflos."}</p>`}`;
    $("#search").addEventListener("submit", (e) => {
      e.preventDefault();
      sessionStorage.setItem("q", new FormData(e.target).get("q").trim());
      render();
    });
  },

  async money(force = false) {
    view.innerHTML = `<h1>Vermögen</h1><p class="empty">Kurse werden geladen …</p>`;
    const d = await api(`/api/portfolio${force ? "?refresh=1" : ""}`);
    const dim = sessionStorage.getItem("dim") || "portfolio";
    const dims = { portfolio: "Portfolios", asset_class: "Anlageklasse", region: "Region", currency: "Währung", position: "Titel" };
    const groups = {};
    d.positions.forEach((p) => (groups[p.portfolio] ||= []).push(p));
    const cls = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");
    view.innerHTML = `
      <h1>Vermögen</h1>
      <div class="worth">
        <div class="big">${eur(d.total, d.base_currency)}</div>
        <p class="sub"><span class="${cls(d.pnl)}">${d.pnl >= 0 ? "+" : ""}${eur(d.pnl, d.base_currency)} (${pct(d.pnl_pct)})</span>
        auf ${eur(d.invested, d.base_currency)} investiert</p>
        <p class="muted">${d.prices_as_of ? `Kurse von ${esc(d.prices_as_of.replace("T", " ").slice(0, 16))} Uhr` : "Noch keine Kurse geladen"}
        <button class="link" id="refresh">Jetzt aktualisieren</button></p>
      </div>
      ${d.positions.length ? `
      <div class="split">
        <section>
          <h2>Verteilung</h2>
          <div class="seg">${Object.entries(dims).map(([k, v]) => `<button data-dim="${k}" class="${k === dim ? "on" : ""}">${v}</button>`).join("")}</div>
          <div class="bars">${d.allocation[dim].map((a) => `
            <div class="bar-row"><span>${esc(a.name)}</span><span class="muted">${a.pct.toLocaleString("de-DE")} %</span>
            <div class="bar"><span style="width:${a.pct}%"></span></div></div>`).join("")}</div>
        </section>
        <section>
          <h2>Positionen</h2>
          ${Object.entries(groups).map(([name, ps]) => `<div class="pos-group"><h3>${esc(name)}</h3><ul class="list">${ps.map((p) => `
            <li><div class="grow">${esc(p.name)}<div class="meta">${p.quantity.toLocaleString("de-DE")} × ${eur(p.price, p.currency)}, Einstieg ${eur(p.entry_price, p.currency)}</div></div>
            <div class="num">${eur(p.value, d.base_currency)}<div class="meta ${cls(p.pnl)}">${pct(p.pnl_pct)}</div></div></li>`).join("")}</ul></div>`).join("")}
        </section>
      </div>` : `<p class="empty">Noch keine Positionen. Lege unten die erste an oder importiere eine CSV.</p>`}
      <details><summary>Position hinzufügen</summary>
        <form class="form" id="pos-form">
          <div class="two"><input name="portfolio" placeholder="Portfolio, z. B. IBKR" required><input name="name" placeholder="Name" required></div>
          <div class="two"><input name="ticker" placeholder="Symbol, z. B. SAP.DE"><input name="isin" placeholder="ISIN"></div>
          <div class="two"><input name="quantity" type="number" step="any" placeholder="Stückzahl" required><input name="entry_price" type="number" step="any" placeholder="Einstiegskurs" required></div>
          <div class="two"><input name="currency" value="EUR" aria-label="Währung"><input name="asset_class" placeholder="Anlageklasse"></div>
          <div class="two"><input name="region" placeholder="Region"><input name="manual_price" type="number" step="any" placeholder="Fester Wert (ohne Symbol)"></div>
          <button class="primary">Speichern</button>
        </form>
      </details>
      <details><summary>CSV importieren</summary>
        <p class="muted">Spalten: portfolio;name;ticker;isin;quantity;entry_price;currency;asset_class;region;bought_at</p>
        <form class="form" id="csv-form"><textarea name="csv" placeholder="CSV hier einfügen"></textarea><button class="primary">Importieren</button></form>
      </details>`;
    $("#refresh").onclick = () => VIEWS.money(true);
    view.querySelectorAll("[data-dim]").forEach((b) => b.addEventListener("click", () => { sessionStorage.setItem("dim", b.dataset.dim); render(); }));
    $("#pos-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      for (const k of ["quantity", "entry_price", "manual_price"]) f[k] = f[k] === "" ? null : +f[k];
      for (const k of ["ticker", "isin", "asset_class", "region"]) f[k] = f[k] || null;
      await post("/api/positions", f);
      render();
    });
    $("#csv-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const r = await post("/api/portfolio/import", { csv: new FormData(e.target).get("csv") });
        toast(`${r.imported} Positionen importiert`);
        render();
      } catch (err) { toast(err.message); }
    });
  },

  async settings() {
    const [u, h] = await Promise.all([api("/api/usage"), api("/api/health")]);
    view.innerHTML = `
      <h1>Einstellungen</h1>
      <h2>Sortierung</h2>
      <p>${h.llm ? `Aktiv mit ${esc(u.model)}` : "Kein Anthropic-API-Key gesetzt. Einträge landen in der Inbox, außer sie beginnen mit „ToDo:“ oder „Gedanke:“."}</p>
      <h2>Kosten diesen Monat</h2>
      <p>${u.calls} Aufrufe, ${u.input_tokens.toLocaleString("de-DE")} Eingabe- und ${u.output_tokens.toLocaleString("de-DE")} Ausgabe-Tokens,
      ungefähr ${u.cost_usd.toLocaleString("de-DE", { style: "currency", currency: "USD" })}</p>
      <h2>Gerät</h2>
      <button class="ghost" id="logout">Token von diesem Gerät entfernen</button>`;
    $("#logout").onclick = () => { localStorage.removeItem("token"); render(); };
  },
};

window.addEventListener("hashchange", () => { current = location.hash.slice(1) || "today"; render(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && current === "money") render(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
render();
