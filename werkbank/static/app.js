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
const dayDiff = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 86400000);
const fmtSec = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const cls = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");
const token = () => localStorage.getItem("token") || "";

// ---------------------------------------------------------------- API
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(opts.headers || {}) },
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
  if (Voice.state === "rec") Voice.cancel();
  view.onclick = null;
  view.classList.toggle("wide", current === "today" || !VIEWS[current]);
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

// ---------------------------------------------------------------- Ton & Effekte
const SOUNDS = {
  start: [[523, .07], [784, .1, .07]],
  stop: [[784, .07], [523, .1, .07]],
  coin: [[988, .07], [1319, .22, .07]],
  clear: [[523, .08], [659, .08, .08], [784, .08, .16], [1047, .25, .24]],
  blip: [[880, .05]],
  error: [[196, .18], [147, .3, .16]],
  levelup: [[523, .1], [659, .1, .1], [784, .1, .2], [1047, .1, .3], [784, .1, .4], [1047, .4, .5]],
};
const Sfx = {
  on: (() => { try { return localStorage.getItem("sfx") !== "0"; } catch { return true; } })(),
  ctx: null,
  play(name) {
    if (!this.on || !SOUNDS[name]) return;
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      const t0 = this.ctx.currentTime + 0.01;
      for (const [freq, dur, at = 0] of SOUNDS[name]) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = "square"; o.frequency.value = freq;
        g.gain.setValueAtTime(0.05, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
      }
    } catch { /* ohne Ton weiter */ }
  },
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem("sfx", this.on ? "1" : "0"); } catch { /* egal */ }
  },
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function burst(el, color = "var(--lime)") {
  if (reducedMotion() || !el) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 10; i++) {
    const p = document.createElement("i");
    const a = (Math.PI * 2 * i) / 10, d = 28 + Math.random() * 30;
    p.className = "px";
    p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${color};` +
      `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

function lootPop(text, delay = 0) {
  setTimeout(() => {
    const layer = $("#loot");
    if (!layer) return;
    const el = document.createElement("div");
    el.className = "loot"; el.textContent = text;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }, delay);
}

function floatXp(amount) {
  const panel = $("#p-score");
  if (!panel) return;
  const el = document.createElement("div");
  el.className = "xp-float"; el.textContent = `+${amount} XP`;
  panel.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

function levelUp(level) {
  Sfx.play("levelup");
  const el = document.createElement("div");
  el.className = "levelup"; el.setAttribute("role", "status"); el.textContent = `LEVEL ${level}!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function lootFor(r) {
  if (r.status === "inbox") return ["? RÄTSEL IN DER INBOX"];
  return (r.results || []).map((x) => {
    if (typeof x !== "string") return `${x.summary}`;
    if (x.startsWith("ToDo:")) return "+1 QUEST";
    if (x.startsWith("Gedanke:")) return "+1 IDEE";
    if (x.startsWith("Erledigt:")) return "QUEST CLEAR!";
    if (x.startsWith("Woche")) return "+1 PLAN";
    if (x.startsWith("Abgehakt:")) return "+1 COMBO";
    if (x.startsWith("Fortschritt:")) return "+1 FORTSCHRITT";
    return "+1";
  });
}

// ---------------------------------------------------------------- Spracheingabe (lokales Whisper)
const MIC_SVG = `<svg viewBox="0 0 16 18" shape-rendering="crispEdges" aria-hidden="true">
  <g fill="#120d24"><rect x="6" y="1" width="4" height="1"/><rect x="5" y="2" width="6" height="8"/>
  <rect x="6" y="10" width="4" height="1"/><rect x="3" y="7" width="1" height="3"/><rect x="12" y="7" width="1" height="3"/>
  <rect x="4" y="10" width="1" height="1"/><rect x="11" y="10" width="1" height="1"/><rect x="5" y="11" width="6" height="1"/>
  <rect x="7" y="12" width="2" height="3"/><rect x="4" y="15" width="8" height="2"/></g>
  <g fill="#ff9ade"><rect x="6" y="4" width="4" height="1"/><rect x="6" y="6" width="4" height="1"/><rect x="6" y="8" width="4" height="1"/></g>
</svg>`;
const MAX_REC_SEC = 120;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];

const Voice = {
  state: "idle", stream: null, rec: null, chunks: [], blob: null, cancelled: false,
  t0: 0, tick: null, raf: null, audioCtx: null,

  set(state, status, transcriptHtml) {
    this.state = state;
    const panel = $("#voice");
    if (!panel) return;
    panel.dataset.state = state;
    if (status !== undefined) $("#vstatus").textContent = status;
    if (transcriptHtml !== undefined) $("#transcript").innerHTML = transcriptHtml;
    const mic = $("#mic");
    mic.disabled = state === "busy";
    mic.setAttribute("aria-pressed", String(state === "rec"));
    mic.setAttribute("aria-label", state === "rec" ? "Aufnahme beenden und senden" : "Aufnahme starten");
    if (state !== "rec") $("#rec-timer").textContent = `00:00 / ${fmtSec(MAX_REC_SEC)}`;
    $("#vactions").innerHTML =
      state === "rec" ? `<button class="ghost" data-voice="cancel">Abbrechen</button>`
      : state === "error" && this.blob ? `<button class="primary" data-voice="retry">Nochmal senden</button>
          <button class="ghost" data-voice="discard">Verwerfen</button>` : "";
  },

  toggle() {
    if (this.state === "rec") this.stop();
    else if (this.state !== "busy") this.start();
  },

  async start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return this.fail("Das Mikrofon braucht HTTPS (tailscale serve) oder localhost.");
    }
    if (!window.MediaRecorder) return this.fail("Dieser Browser kann nicht aufnehmen.");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(
        { audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (e) {
      return this.fail(e.name === "NotAllowedError"
        ? "Mikrofon-Zugriff verweigert. In den Browser-Einstellungen erlauben." : "Kein Mikrofon gefunden.");
    }
    const mime = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = []; this.cancelled = false; this.blob = null;
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.onstop = () => {
      this.release();
      if (this.cancelled) return this.set("idle", "Abgebrochen", "");
      this.blob = new Blob(this.chunks, { type: this.rec.mimeType || mime || "audio/webm" });
      this.send();
    };
    this.rec.start();
    this.t0 = Date.now();
    this.set("rec", "Ich höre zu", "");
    Sfx.play("start");
    this.meter();
    this.tick = setInterval(() => {
      const s = Math.floor((Date.now() - this.t0) / 1000);
      const t = $("#rec-timer");
      if (t) t.textContent = `${fmtSec(s)} / ${fmtSec(MAX_REC_SEC)}`;
      if (s >= MAX_REC_SEC) this.stop();
    }, 250);
  },

  stop() {
    if (this.rec?.state !== "recording") return;
    Sfx.play("stop");
    this.rec.stop();
  },

  cancel() {
    if (this.rec?.state !== "recording") return;
    this.cancelled = true;
    this.rec.stop();
  },

  release() {
    clearInterval(this.tick);
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    document.querySelectorAll("#meter i").forEach((i) => { i.style.height = ""; });
  },

  meter() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const an = this.audioCtx.createAnalyser();
      an.fftSize = 64;
      this.audioCtx.createMediaStreamSource(this.stream).connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const bars = [...document.querySelectorAll("#meter i")];
      const loop = () => {
        an.getByteFrequencyData(data);
        bars.forEach((b, i) => { b.style.height = `${3 + (data[i + 1] / 255) * 31}px`; });
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { /* Pegel ist nur Deko */ }
  },

  async send() {
    this.set("busy", "Whisper hört nach …");
    try {
      const res = await fetch("/api/voice", {
        method: "POST", body: this.blob,
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": this.blob.type || "audio/webm" },
      });
      if (res.status === 401) return logout("Token ungültig");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return this.fail(data.detail || `Fehler ${res.status}`);
      this.blob = null;
      Hud.handleResult(data);
    } catch {
      this.fail("Server nicht erreichbar. Die Aufnahme ist noch da.");
    }
  },

  fail(msg) {
    Sfx.play("error");
    this.set("error", "Fehler", esc(msg));
    const p = $("#voice");
    if (!p) return;
    p.classList.remove("shake"); void p.offsetWidth; p.classList.add("shake");
  },
};

// ---------------------------------------------------------------- HUD-Kacheln
const inboxItem = (e) => `
  <div class="inbox-item">
    <p>${esc(e.raw_text)}</p>
    ${e.suggestion.length ? `<div class="meta">Vorschlag: ${e.suggestion.map((a) => esc(describe(a))).join("; ")}</div>` : ""}
    <div class="actions">
      ${e.suggestion.length ? `<button class="ghost" data-inbox="accept" data-id="${e.id}">Vorschlag übernehmen</button>` : ""}
      <button class="ghost" data-inbox="todo" data-id="${e.id}">Als Quest</button>
      <button class="ghost" data-inbox="thought" data-id="${e.id}">Als Idee</button>
      <button class="link" data-inbox="dismiss" data-id="${e.id}">Verwerfen</button>
    </div>
  </div>`;

const questItem = (t) => {
  const late = t.due_date && t.due_date < todayIso();
  const meta = [t.project, t.due_date && fmtDate(t.due_date)].filter(Boolean).map(esc);
  return `<li>
    <button class="check" data-done="${t.id}" aria-label="Quest erledigen: ${esc(t.title)}"></button>
    <div class="grow">${t.priority === 1 ? `<span class="prio" title="hohe Priorität">!! </span>` : ""}${esc(t.title)}
      ${meta.length ? `<div class="meta ${late ? "overdue" : ""}">${meta.join(" · ")}${late ? " · überfällig" : ""}</div>` : ""}</div>
  </li>`;
};

const segBar = (points, max, color, n = 10) => {
  const on = max ? Math.round((points / max) * n) : 0;
  return `<div class="seg-bar" style="--accent-fill:${color}">${
    Array.from({ length: n }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</div>`;
};

const Hud = {
  lastXp: null,

  async refresh() {
    const [today, week, open, goals, sc] = await Promise.all([
      api("/api/today"), api("/api/week"), api("/api/todos?done=0"), api("/api/goals"), api("/api/score")]);
    if (current !== "today" || !$("#p-quests")) return;
    this.player(sc);
    this.score(sc);
    this.quests(today, week);
    this.bosses(open, goals);
    this.habits(today.habits);
    this.riddles(today);
  },

  handleResult(r) {
    if (r.status === "empty") {
      Sfx.play("error");
      return Voice.set("idle", "Nichts verstanden", "Nochmal, etwas näher am Mikro?");
    }
    const hits = (r.results || []).find((x) => typeof x === "object")?.hits || [];
    Voice.set("done", r.reply || (r.status === "processed" ? "Gespeichert" : "In der Inbox"),
      (r.transcript ? `„${esc(r.transcript)}“` : "") +
      hits.slice(0, 3).map((h) => `<br><b>${esc(h.text)}</b>`).join(""));
    Sfx.play(r.status === "processed" ? "coin" : "blip");
    lootFor(r).forEach((t, i) => lootPop(t, i * 380));
    this.refresh().catch(showError);
  },

  player(sc) {
    const x = sc.xp;
    const pctLevel = ((x.total - x.level_start) / (x.next_level - x.level_start)) * 100;
    $("#player").innerHTML = `
      <span class="lv">LV ${x.level}</span>
      <div class="xpbar">
        <div class="track" role="progressbar" aria-label="Erfahrung bis Level ${x.level + 1}"
          aria-valuemin="${x.level_start}" aria-valuemax="${x.next_level}" aria-valuenow="${x.total}">
          <div class="fill" style="width:${pctLevel}%"></div></div>
        <small>${x.total.toLocaleString("de-DE")} XP · noch ${(x.next_level - x.total).toLocaleString("de-DE")} bis LV ${x.level + 1}</small>
      </div>
      <span class="streak-chip" title="Wochen in Folge mit mindestens ${sc.streak_min} Punkten">🔥 ${sc.streak} ${sc.streak === 1 ? "Woche" : "Wochen"}</span>
      <button class="icon-btn" id="sfx" aria-pressed="${Sfx.on}">${Sfx.on ? "🔊 Ton an" : "🔇 Ton aus"}</button>`;
    $("#sfx").onclick = () => { Sfx.toggle(); Sfx.play("blip"); this.player(sc); };

    if (this.lastXp !== null && x.total > this.lastXp) floatXp(x.total - this.lastXp);
    this.lastXp = x.total;
    let seen = 0;
    try { seen = +localStorage.getItem("level") || 0; localStorage.setItem("level", x.level); } catch { /* egal */ }
    if (seen && x.level > seen) levelUp(x.level);
  },

  score(sc) {
    const w = sc.week, s = w.score, P = w.parts;
    const rank = s >= 90 ? "S" : s >= 75 ? "A" : s >= 60 ? "B" : s >= 40 ? "C" : "D";
    $("#p-score .body").innerHTML = `
      <div class="score-main">
        <div class="rank ${rank}" aria-label="Rang ${rank}">${rank}</div>
        <div class="score-num">${s}<small>/100</small></div>
      </div>
      <div class="parts">
        <div class="part"><span>Checklisten ${P.habits.done}/${P.habits.target}</span><span>${P.habits.points}/${P.habits.max}</span>
          ${segBar(P.habits.points, P.habits.max, "var(--lime)")}</div>
        <div class="part"><span>Quests ${P.todos.done}/${P.todos.total}</span><span>${P.todos.points}/${P.todos.max}</span>
          ${segBar(P.todos.points, P.todos.max, "var(--cyan)")}</div>
        <div class="part"><span>Deadlines ${P.deadlines.missed ? `${P.deadlines.missed} verpasst` : "sauber"}</span>
          <span>${P.deadlines.points}/${P.deadlines.max}</span>${segBar(P.deadlines.points, P.deadlines.max, "var(--pink)")}</div>
      </div>
      <p class="streak-line">${s >= sc.streak_min ? "★ Streak-Woche gesichert" : `Noch ${sc.streak_min - s} Punkte bis zur Streak-Woche`}</p>`;
  },

  quests(today, week) {
    const t = todayIso();
    const plan = week.days.filter((d) => d >= t)
      .map((d) => ({ d, items: week.plan.filter((p) => p.date === d) }))
      .filter((x) => x.items.length);
    $("#p-quests .body").innerHTML = `
      ${today.todos.length ? `<ul class="qlist">${today.todos.map(questItem).join("")}</ul>`
        : `<p class="empty">Keine offenen Quests. Sprich eine ein.</p>`}
      <h3 class="sub-h">Wochenplan</h3>
      ${plan.length ? plan.map(({ d, items }) => `
        <div class="plan-day ${d === t ? "today" : ""}"><b>${WD[(new Date(d + "T12:00").getDay() + 6) % 7]}</b>
          <div>${items.map((p) => esc(p.title)).join("<br>")}</div></div>`).join("")
        : `<p class="empty">Rest der Woche frei. „Freitag Baustelle Müller“ einsprechen.</p>`}`;
  },

  bosses(open, goals) {
    const t = todayIso();
    const list = [
      ...open.filter((x) => x.due_date).map((x) => ({ id: x.id, name: x.title, due: x.due_date })),
      ...goals.filter((g) => g.deadline).map((g) => ({
        name: g.title, due: g.deadline, prog: g.target ? Math.min(100, (g.current / g.target) * 100) : null })),
    ].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
    $("#p-boss .body").innerHTML = list.length ? `<ul class="bosses">${list.map((b) => {
      const days = dayDiff(t, b.due);
      const label = days < 0 ? `${-days} T ÜBERFÄLLIG` : days === 0 ? "HEUTE" : days === 1 ? "MORGEN" : `IN ${days} T`;
      const state = days < 0 ? "slain" : days <= 1 ? "urgent" : "";
      const hp = days < 0 ? 100 : Math.max(6, Math.min(100, (days / 14) * 100));
      return `<li class="${state}">
        <div class="boss-row">
          ${b.id ? `<button class="check" data-done="${b.id}" aria-label="Deadline erledigt: ${esc(b.name)}"></button>` : ""}
          <div class="grow">${esc(b.name)}${b.prog != null ? `<div class="meta">Fortschritt ${Math.round(b.prog)} %</div>` : ""}</div>
          <span class="bcount">${label}</span>
        </div>
        <div class="hp" aria-hidden="true"><span style="width:${hp}%"></span></div>
      </li>`;
    }).join("")}</ul><p class="hp-label">Balken = verbleibende Zeit (voll = 2+ Wochen)</p>`
      : `<p class="empty">Keine Deadlines in Sicht. Fälligkeiten legst du bei Quests oder Zielen fest.</p>`;
  },

  habits(list) {
    $("#p-habits .body").innerHTML = list.length ? list.map((h) => `
      <div class="habit">
        <button class="hbtn ${h.today_done ? "on" : ""}" data-habit="${h.id}" aria-pressed="${!!h.today_done}"
          aria-label="${esc(h.name)} heute ${h.today_done ? "zurücknehmen" : "abhaken"}"></button>
        <div class="grow"><b>${esc(h.name)}</b> <span class="meta">${esc(h.category)}</span>
          <div class="pips" title="${h.week_count} von ${h.target_per_week} diese Woche">${
            Array.from({ length: Math.max(h.target_per_week, h.week_count) }, (_, i) =>
              `<i class="${i >= h.target_per_week ? "bonus" : i < h.week_count ? "on" : ""}"></i>`).join("")}</div>
        </div>
        <span class="meta">${h.week_count}/${h.target_per_week}</span>
      </div>`).join("")
      : `<p class="empty">Keine Gewohnheiten. Lege sie unter „Woche“ an.</p>`;
  },

  riddles(d) {
    $("#riddles").innerHTML = d.inbox.length
      ? `<h3 class="sub-h">! ${d.inbox.length} Rätsel in der Inbox</h3>${d.inbox.map(inboxItem).join("")}` : "";
    $("#log").innerHTML = d.recent.length ? `<h3 class="sub-h" style="text-align:left">Log</h3><ul class="list log">${
      d.recent.map((r) => `<li><div class="grow">${esc(r.summary)}<div class="meta">${esc(r.created_at.slice(11, 16))} Uhr</div></div>
        <button class="link" data-undo-row="${r.id}">Rückgängig</button></li>`).join("")}</ul>` : "";
  },

  async money(force = false) {
    const box = $("#p-money .body");
    let d;
    try {
      d = await api(`/api/portfolio${force ? "?refresh=1" : ""}`);
    } catch (e) {
      if (e.message !== "auth" && box) box.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
      return;
    }
    if (current !== "today" || !$("#p-money")) return;
    const open = sessionStorage.getItem("vault") === "open";
    $("#p-money [data-money=toggle]").textContent = open ? "verbergen" : "aufdecken";
    if (!d.positions.length) {
      $("#p-money .body").innerHTML = `<p class="empty">Leere Truhe. Positionen unter „Schatz“ anlegen.</p>`;
      return;
    }
    $("#p-money .body").innerHTML = `
      <div class="vault ${open ? "" : "veiled"}">
        <div class="treasure secret">${eur(d.total, d.base_currency)}</div>
        <div class="chips secret"><span class="${cls(d.pnl)}">${d.pnl >= 0 ? "▲" : "▼"} ${eur(d.pnl, d.base_currency)}</span>
          <span class="${cls(d.pnl)}">${pct(d.pnl_pct)}</span></div>
        <h3 class="sub-h">Verteilung</h3>
        <div class="bars">${d.allocation.asset_class.slice(0, 4).map((a) => `
          <div class="bar-row"><span>${esc(a.name)}</span><span class="muted">${a.pct.toLocaleString("de-DE")} %</span>
          <div class="bar"><span style="width:${a.pct}%"></span></div></div>`).join("")}</div>
        <p class="muted">${d.prices_as_of ? `Kurse von ${esc(d.prices_as_of.slice(11, 16))} Uhr` : "Keine Live-Kurse"} ·
          <button class="link" data-money="refresh">aktualisieren</button></p>
      </div>`;
  },

  async click(e) {
    const b = e.target.closest("button");
    if (!b) return;
    const { voice, done, habit, inbox, id, undoRow, money } = b.dataset;
    try {
      if (b.id === "mic") return Voice.toggle();
      if (voice === "cancel") return Voice.cancel();
      if (voice === "retry") return Voice.send();
      if (voice === "discard") { Voice.blob = null; return Voice.set("idle", "Tippen und sprechen", ""); }
      if (done) {
        await post(`/api/todos/${done}/toggle`);
        burst(b, "var(--cyan)"); Sfx.play("clear");
        lootPop(b.closest(".bosses") ? "BOSS BESIEGT!" : "QUEST CLEAR!");
        return await this.refresh();
      }
      if (habit) {
        const r = await post(`/api/habits/${habit}/toggle`);
        if (r.done) { burst(b); Sfx.play("coin"); } else Sfx.play("blip");
        return await this.refresh();
      }
      if (inbox) {
        if (inbox === "accept") await post(`/api/inbox/${id}/accept`);
        else if (inbox === "dismiss") await post(`/api/inbox/${id}/dismiss`);
        else await post(`/api/inbox/${id}/as`, { type: inbox });
        Sfx.play(inbox === "dismiss" ? "blip" : "coin");
        return await this.refresh();
      }
      if (undoRow) {
        const r = await post(`/api/undo/${undoRow}`);
        toast(r.reply); Sfx.play("blip");
        return await this.refresh();
      }
      if (money === "toggle") {
        const open = sessionStorage.getItem("vault") !== "open";
        sessionStorage.setItem("vault", open ? "open" : "closed");
        $("#p-money .vault")?.classList.toggle("veiled", !open);
        b.textContent = open ? "verbergen" : "aufdecken";
        return Sfx.play("blip");
      }
      if (money === "refresh") return await this.money(true);
    } catch (err) {
      if (err.message !== "auth") { toast(err.message); Sfx.play("error"); }
    }
  },
};

function showError(e) {
  if (e.message !== "auth") toast(`${e.message}. Läuft der Server?`);
}

function logout(reason) {
  localStorage.removeItem("token");
  showLogin(reason);
}

// ---------------------------------------------------------------- Ansichten
const VIEWS = {
  async today() {
    view.innerHTML = `
      <div class="playerbar" id="player"><span class="lv">LV –</span></div>
      <div class="hud">
        <section class="panel p-voice" id="voice" data-state="idle" aria-label="Spracheingabe">
          <header class="ptitle"><span>▶ Spracheingabe</span><span class="keyhint"><kbd>Leertaste</kbd></span></header>
          <div class="mic-wrap"><div class="ring"></div>
            <button class="mic" id="mic" aria-label="Aufnahme starten" aria-pressed="false">${MIC_SVG}</button></div>
          <div class="meter" id="meter" aria-hidden="true">${"<i></i>".repeat(16)}</div>
          <div class="timer" id="rec-timer">00:00 / ${fmtSec(MAX_REC_SEC)}</div>
          <p class="vstatus" id="vstatus" aria-live="polite">Tippen und sprechen</p>
          <p class="transcript" id="transcript"></p>
          <div class="vactions" id="vactions"></div>
          <form class="console" id="capture">
            <span aria-hidden="true">&gt;</span>
            <input id="capture-text" placeholder="oder tippen …" aria-label="Eingabe tippen" autocomplete="off" enterkeyhint="send">
            <button class="primary">OK</button>
          </form>
          <div class="riddles" id="riddles"></div>
          <div id="log"></div>
          <div class="loot-layer" id="loot" aria-hidden="true"></div>
        </section>
        <section class="panel p-score" id="p-score"><header class="ptitle"><span>★ Wochenscore</span></header>
          <div class="body"><p class="empty">Lade …</p></div></section>
        <section class="panel p-quests" id="p-quests"><header class="ptitle"><span>⚔ Quests &amp; Wochenplan</span><a href="#todos">alle</a></header>
          <div class="body"><p class="empty">Lade …</p></div></section>
        <section class="panel p-boss" id="p-boss"><header class="ptitle"><span>☠ Deadlines</span><a href="#week">Woche</a></header>
          <div class="body"><p class="empty">Lade …</p></div></section>
        <section class="panel p-habits" id="p-habits"><header class="ptitle"><span>✚ Checkliste</span><a href="#week">Raster</a></header>
          <div class="body"><p class="empty">Lade …</p></div></section>
        <section class="panel p-money" id="p-money"><header class="ptitle"><span>◆ Finanzen</span>
          <button data-money="toggle">aufdecken</button></header>
          <div class="body"><p class="empty">Kurse werden geladen …</p></div></section>
      </div>`;
    Voice.state = "idle";
    view.onclick = (e) => Hud.click(e);
    $("#capture").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("#capture-text");
      const text = input.value.trim();
      if (!text) return input.focus();
      input.value = "";
      Voice.set("busy", "Sortiere …", `„${esc(text)}“`);
      try {
        Hud.handleResult({ ...(await post("/api/capture", { text, source: "text" })), transcript: text });
      } catch (err) {
        input.value = text;
        if (err.message !== "auth") Voice.fail(err.message);
      }
    });
    await Hud.refresh();
    Hud.money();
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
      <h2>Spracheingabe</h2>
      <p>Aufnahme im Browser, Transkription lokal mit Whisper auf deinem Server. Das Audio verlässt ihn nicht und wird nicht gespeichert.</p>
      <h2>Gerät</h2>
      <div class="capture-row" style="justify-content:flex-start">
        <button class="ghost" id="sfx-toggle">${Sfx.on ? "🔊 Ton an" : "🔇 Ton aus"}</button>
        <button class="ghost" id="logout">Token von diesem Gerät entfernen</button>
      </div>`;
    $("#sfx-toggle").onclick = () => { Sfx.toggle(); Sfx.play("blip"); render(); };
    $("#logout").onclick = () => { localStorage.removeItem("token"); render(); };
  },
};

// Leertaste = Aufnahme starten/stoppen, Escape = abbrechen (nur auf dem HUD, nicht beim Tippen)
document.addEventListener("keydown", (e) => {
  if (current !== "today" || !$("#mic") || e.target.closest("input, textarea, select, button, [contenteditable]")) return;
  if (e.code === "Space") { e.preventDefault(); Voice.toggle(); }
  if (e.key === "Escape") Voice.cancel();
});
window.addEventListener("hashchange", () => { current = location.hash.slice(1) || "today"; render(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && current === "money") render(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
render();
