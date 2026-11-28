// Kompass – der Council als zuschaltbarer Assistent (Seitenleiste) mit Tippen, Sprechen und Links.
"use strict";

const ASS = { offen: false, chatId: null, poll: null, hoert: false, erkennung: null, rekorder: null };
try { ASS.chatId = +localStorage.getItem("kompass-chat") || null; } catch { /* privat */ }
const merkeChat = (id) => { ASS.chatId = id; try { id ? localStorage.setItem("kompass-chat", id) : localStorage.removeItem("kompass-chat"); } catch { /* egal */ } };

function seitenKontext() {
  const h = location.hash || "#/";
  const titel = document.querySelector("main h1")?.textContent?.trim() || "Start";
  const m = h.match(/^#\/(?:entwurf|bauen)\/(\d+)/);
  return { seite: `${titel} (${h})`.slice(0, 300), entwurf_id: m ? +m[1] : null };
}

function assistentChips() {
  const h = location.hash || "#/";
  const basis = ["Erklär mir das einfacher", "Ist mehr Risiko für mich sinnvoll?", "Such aktuelle Nachrichten dazu"];
  if (/^#\/(entwurf|bauen)/.test(h)) return ["Empfiehl mir eine Kombination, die meine Strategie ergänzt", "Bewerte meine Gewichtungen", ...basis];
  if (/^#\/glossar\/klasse/.test(h)) return ["Welche Produkte dieser Klasse passen zu mir?", "Wie hängt diese Klasse mit Zinsen zusammen?", ...basis];
  if (/^#\/glossar\//.test(h)) return ["Passt das zu meiner Strategie?", "Welche Alternative wäre günstiger oder sicherer?", ...basis];
  if (/^#\/ereignisse/.test(h)) return ["Ähnelt die heutige Lage diesem Ereignis?", ...basis];
  if (/^#\/portfolios/.test(h)) return ["Wie robust ist dieses Portfolio in einer Krise?", ...basis];
  return ["Ich habe eine Idee …", "Hilf mir, ein Portfolio zu bauen", ...basis];
}

function assistentHtml() {
  return `<aside class="assistent" id="assistent" aria-label="Council-Assistent" hidden>
    <div class="as-kopf"><div><b>Dein Council</b><div class="muted small" id="as-kontext"></div></div>
      <div class="actions" style="margin:0"><button class="ghost klein" id="as-neu">Neues Gespräch</button><button class="ghost klein" id="as-zu" aria-label="Council schließen">Schließen</button></div></div>
    <div class="as-verlauf" id="as-verlauf" aria-live="polite"></div>
    <div class="as-fuss">
      <div class="chips as-chips" id="as-chips"></div>
      <div class="as-eingabe">
        <textarea id="as-text" rows="2" placeholder="Idee tippen, sprechen oder einen Link zu einem Artikel/Video einfügen …"></textarea>
        <div class="as-knoepfe"><button class="as-mic" id="as-mic" type="button" aria-label="Sprechen" title="Sprechen">🎙</button>
          <button class="primary" id="as-senden" type="button">Senden</button></div>
      </div>
      <div class="as-unten"><button class="ghost klein" id="as-runde">Ganze Council-Runde einberufen</button><a class="btn klein" href="#/berater/neu">Alle Gespräche</a></div>
    </div></aside>
    <button class="as-fab" id="as-fab" type="button" aria-label="Council öffnen"><span aria-hidden="true">💬</span><span>Council</span></button>`;
}

function assistentInit() {
  if (document.getElementById("assistent")) return;
  document.body.insertAdjacentHTML("beforeend", assistentHtml());
  document.getElementById("as-fab").onclick = () => (ASS.offen ? assistentZu() : assistentOeffnen());
  document.getElementById("as-zu").onclick = assistentZu;
  document.getElementById("as-neu").onclick = () => { merkeChat(null); zeichneVerlauf(null); };
  document.getElementById("as-senden").onclick = () => senden();
  document.getElementById("as-text").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) senden(); });
  document.getElementById("as-mic").onclick = mikrofon;
  document.getElementById("as-runde").onclick = async () => {
    const t = document.getElementById("as-text").value.trim() || document.querySelector("#as-verlauf .msg.user:last-of-type")?.textContent?.replace(/^Du/, "").trim();
    if (!t) { toast("Schreib zuerst deine Idee."); return; }
    try { const r = await api("/api/council", { body: { idea: t } }); assistentZu(); location.hash = `#/council/${r.id}`; } catch (e) { toast(e.message); }
  };
  window.addEventListener("hashchange", () => { if (ASS.offen) kontextZeigen(); });
}

// Jeder Knopf mit data-assistent="Frage" öffnet den Council mit dieser Frage.
document.addEventListener("click", (ev) => {
  const k = ev.target.closest("[data-assistent]");
  if (!k) return;
  ev.preventDefault();
  const m = (location.hash || "").match(/^#\/(?:entwurf|bauen)\/(\d+)/);
  assistentOeffnen(k.dataset.assistent || null, m ? +m[1] : null);
});

function kontextZeigen() {
  const k = seitenKontext();
  document.getElementById("as-kontext").textContent = `sieht mit: ${k.seite.replace(/ \(#.*\)$/, "")}`;
  document.getElementById("as-chips").innerHTML = assistentChips().map((c) => `<button type="button" class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  document.querySelectorAll("#as-chips [data-c]").forEach((b) => (b.onclick = () => { document.getElementById("as-text").value = b.dataset.c; senden(); }));
}

async function assistentOeffnen(text, entwurfId) {
  assistentInit();
  const el = document.getElementById("assistent");
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("offen"));
  document.body.classList.add("mit-assistent");
  ASS.offen = true;
  kontextZeigen();
  await zeichneVerlauf(ASS.chatId);
  if (text) { document.getElementById("as-text").value = text; senden(entwurfId); }
  else document.getElementById("as-text").focus();
}

function assistentZu() {
  const el = document.getElementById("assistent");
  if (!el) return;
  el.classList.remove("offen");
  document.body.classList.remove("mit-assistent");
  ASS.offen = false;
  clearTimeout(ASS.poll);
  setTimeout(() => { if (!ASS.offen) el.hidden = true; }, 250);
}

async function zeichneVerlauf(cid) {
  const box = document.getElementById("as-verlauf");
  if (!cid) {
    box.innerHTML = `<div class="as-willkommen"><p><b>Hallo! Hier sitzt dein Experten-Team:</b> Berater, Kritiker und auf Wunsch die ganze Runde aus Geopolitik, Finanzen, Geschichte, Kritik und Rendite.</p>
      <p class="muted small">Sie sehen mit, auf welcher Seite du bist. Du kannst tippen, mit 🎙 sprechen oder einen Link zu einem Artikel oder YouTube-Video einfügen – dann lesen sie ihn und verstehen den Ursprung deiner Idee.</p></div>`;
    return;
  }
  try {
    const d = await api(`/api/berater/${cid}`);
    box.innerHTML = d.nachrichten.map((m) => beraterNachricht(m, cid)).join("") + (d.chat.status === "denkt" ? '<div class="progress as-denkt"><span class="dot"></span>Das Team denkt nach …</div>' : "") + (d.chat.error ? errBox(d.chat.error) : "");
    box.querySelectorAll("[data-ueb]").forEach((b) => (b.onclick = async () => {
      const e = await api(`/api/berater/${cid}/uebernehmen/${b.dataset.ueb}`, { body: {} });
      toast("Vorschlag in die Strategie übernommen"); aktualisiereEntwurfZaehler();
      if (e && e.id && !location.hash.startsWith(`#/entwurf/${e.id}`)) location.hash = `#/entwurf/${e.id}`; else route();
    }));
    box.scrollTop = box.scrollHeight;
    clearTimeout(ASS.poll);
    if (d.chat.status === "denkt") ASS.poll = setTimeout(() => ASS.offen && zeichneVerlauf(cid), 2500);
  } catch { merkeChat(null); zeichneVerlauf(null); }
}

async function senden(entwurfId) {
  const feld = document.getElementById("as-text");
  const text = feld.value.trim();
  if (!text) return;
  const k = seitenKontext();
  const body = { text, seite: k.seite, entwurf_id: entwurfId || k.entwurf_id };
  feld.value = "";
  try {
    if (ASS.chatId) await api(`/api/berater/${ASS.chatId}`, { body });
    else merkeChat((await api("/api/berater", { body })).id);
    zeichneVerlauf(ASS.chatId);
  } catch (e) {
    if (/antwortet noch/.test(e.message)) { feld.value = text; toast("Das Team antwortet noch – gleich nochmal."); }
    else if (/nicht gefunden/.test(e.message)) { merkeChat(null); feld.value = text; senden(entwurfId); }
    else toast(e.message);
  }
}

// ---------- Sprechen: Spracherkennung des Browsers, sonst Aufnahme → eigener Server ----------

function mikrofon() {
  const knopf = document.getElementById("as-mic"), feld = document.getElementById("as-text");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (ASS.hoert) { ASS.erkennung?.stop(); ASS.rekorder?.stop(); return; }
  const an = () => { ASS.hoert = true; knopf.classList.add("hoert"); knopf.setAttribute("aria-label", "Aufnahme beenden"); };
  const aus = () => { ASS.hoert = false; knopf.classList.remove("hoert"); knopf.setAttribute("aria-label", "Sprechen"); };
  if (SR) {
    const r = new SR();
    r.lang = "de-DE"; r.interimResults = true; r.continuous = true;
    const vorher = feld.value ? feld.value + " " : "";
    r.onresult = (ev) => { feld.value = vorher + Array.from(ev.results).map((x) => x[0].transcript).join(" "); };
    r.onerror = (ev) => { aus(); if (ev.error === "not-allowed") toast("Mikrofon nicht erlaubt – in den Browser-Einstellungen freigeben."); };
    r.onend = aus;
    ASS.erkennung = r; an(); r.start();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast("Sprechen geht hier nicht – nutze die Diktier-Taste 🎙 der Tastatur."); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then((strom) => {
    const teile = [], rek = new MediaRecorder(strom);
    rek.ondataavailable = (ev) => teile.push(ev.data);
    rek.onstop = async () => {
      aus(); strom.getTracks().forEach((t) => t.stop());
      const fd = new FormData(); fd.append("audio", new Blob(teile, { type: rek.mimeType }), "aufnahme.webm");
      try {
        const r = await fetch("/api/sprache", { method: "POST", body: fd, credentials: "same-origin" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || "Spracherkennung nicht verfügbar");
        feld.value = (feld.value ? feld.value + " " : "") + d.text;
      } catch (e) { toast(`${e.message} – nutze sonst die Diktier-Taste der Tastatur.`); }
    };
    ASS.rekorder = rek; an(); rek.start();
  }).catch(() => toast("Mikrofon nicht erlaubt."));
}
