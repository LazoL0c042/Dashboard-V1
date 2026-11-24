// Kompass – Regler (Slider) und kleine UI-Bausteine.
// Ein Regler besteht aus einem sichtbaren <input type=range> (Index in einer Werteskala)
// und einem versteckten Feld mit dem echten Wert (name=…), damit Formulare normal funktionieren.
"use strict";

// Skala: Abschnitte [von, bis, gewicht] (nichtlinear: mehr Platz für kleine Beträge), Einheit (1er-Schritte),
// Rastpunkte (runde Zahlen, an denen der Regler kurz einrastet) und Marken unter der Leiste.
const SKALEN = {
  geld: { ab: [[0, 1000, 1], [1000, 10000, 1.5], [10000, 100000, 2], [100000, 1000000, 1.5], [1000000, 3000000, 0.7]], einheit: 1,
    rast: [0, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000, 3000000],
    marken: [0, 10000, 100000, 1000000], kurz: (v) => (v >= 1e6 ? `${v / 1e6} Mio` : v >= 1000 ? `${v / 1000} T` : `${v}`), fmt: (v) => eur0(v) },
  rate: { ab: [[0, 500, 1.5], [500, 2000, 1.2], [2000, 10000, 0.8]], einheit: 1,
    rast: [0, 50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 5000, 10000],
    marken: [0, 250, 1000, 5000], kurz: (v) => (v >= 1000 ? `${v / 1000} T` : `${v}`), fmt: (v) => `${eur0(v)} / Monat` },
  jahre: { ab: [[1, 60, 1]], einheit: 1, rast: [1, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60], marken: [1, 10, 20, 30, 40, 50, 60], fmt: (v) => `${v} Jahr${v === 1 ? "" : "e"}` },
  zurueck: { ab: [[0, 2, 1], [2, 30, 2]], einheit: 0.25, rast: [0, 0.5, 1, 2, 3, 5, 10, 15, 20, 25, 30], marken: [0, 2, 10, 20, 30], fmt: (v) => (v === 0 ? "ab heute" : `vor ${num(v, 2)} Jahren`) },
  prozent: { ab: [[0, 100, 1]], einheit: 1, rast: [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100], marken: [0, 25, 50, 75, 100], fmt: (v) => `${v} %` },
  ter: { ab: [[0, 2, 1]], einheit: 0.01, rast: [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 0.75, 1, 1.5, 2], marken: [0, 0.5, 1, 1.5, 2], fmt: (v) => `${num(v, 2)} %` },
  steigerung: { ab: [[0, 10, 1]], einheit: 0.1, rast: [0, 1, 2, 2.5, 3, 5, 7.5, 10], marken: [0, 2.5, 5, 7.5, 10], fmt: (v) => `${num(v, 1)} % pro Jahr` },
  zins: { ab: [[-5, 20, 1]], einheit: 0.05, rast: [-2, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 15, 20], marken: [-5, 0, 5, 10, 20], fmt: (v) => `${num(v, 2)} % p.a.` },
  alter: { ab: [[16, 90, 1]], einheit: 1, rast: [18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 63, 65, 67, 70, 75, 80, 85, 90], marken: [20, 40, 60, 80], fmt: (v) => `${v} Jahre` },
  einkommen: { ab: [[0, 3000, 1.2], [3000, 15000, 1], [15000, 50000, 0.5]], einheit: 1,
    rast: [0, 1000, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 25000, 50000],
    marken: [0, 3000, 15000], kurz: (v) => (v >= 1000 ? `${v / 1000} T` : `${v}`), fmt: (v) => `${eur0(v)} / Monat` },
  risiko: { ab: [[1, 5, 1]], einheit: 1, rast: [1, 2, 3, 4, 5], stufig: true, marken: [1, 2, 3, 4, 5],
    fmt: (v) => `${v} · ${["", "Sicherheit", "Konservativ", "Ausgewogen", "Wachstum", "Spekulativ"][v]}` },
};

const sMin = (sk) => sk.ab[0][0];
const sMax = (sk) => sk.ab[sk.ab.length - 1][1];
const runde = (sk, v) => {
  const r = Math.round(v / sk.einheit) * sk.einheit;
  return Math.max(sMin(sk), Math.min(sMax(sk), +r.toFixed(4)));
};

// Position (0–1) → Wert und zurück, über die gewichteten Abschnitte.
function wertAus(sk, pos) {
  pos = Math.max(0, Math.min(1, pos));
  const summe = sk.ab.reduce((a, x) => a + x[2], 0);
  let acc = 0;
  for (const [von, bis, gew] of sk.ab) {
    const anteil = gew / summe;
    if (pos <= acc + anteil + 1e-12) return von + ((pos - acc) / anteil) * (bis - von);
    acc += anteil;
  }
  return sMax(sk);
}
function posAus(sk, v) {
  const summe = sk.ab.reduce((a, x) => a + x[2], 0);
  let acc = 0;
  for (const [von, bis, gew] of sk.ab) {
    const anteil = gew / summe;
    if (v <= bis) return acc + (Math.max(0, v - von) / (bis - von)) * anteil;
    acc += anteil;
  }
  return 1;
}

/**
 * Regler-HTML. opt: {id, name, label, skala, wert, hinweis, klein, gruppe}
 * Der echte Wert steckt im versteckten Feld (id = opt.id).
 */
function slider(opt) {
  const sk = SKALEN[opt.skala];
  const v = runde(sk, opt.wert == null || opt.wert === "" || isNaN(+opt.wert) ? sMin(sk) : +opt.wert);
  const p = posAus(sk, v) * 100;
  const kurz = sk.kurz || ((x) => num(x, 2));
  return `<div class="sl${opt.klein ? " klein" : ""}">
    <div class="sl-kopf"><label id="${opt.id}-l">${esc(opt.label)}</label><output id="${opt.id}-o">${esc(sk.fmt(v))}</output></div>
    <div class="sl-zeile">
      <button type="button" class="sl-btn" data-ziel="${opt.id}" data-d="-1" aria-label="${esc(opt.label)} verringern">−</button>
      <div class="sl-track" id="${opt.id}-r" role="slider" tabindex="0" aria-labelledby="${opt.id}-l"
        aria-valuemin="${sMin(sk)}" aria-valuemax="${sMax(sk)}" aria-valuenow="${v}" aria-valuetext="${esc(sk.fmt(v))}"
        data-skala="${opt.skala}" data-ziel="${opt.id}" ${opt.gruppe ? `data-gruppe="${opt.gruppe}"` : ""} style="--p:${p}%">
        <div class="sl-bar"><div class="sl-fill"></div></div>
        ${sk.marken.map((m) => `<span class="sl-marke" style="left:${posAus(sk, m) * 100}%"><i></i>${opt.klein ? "" : `<em>${esc(kurz(m))}</em>`}</span>`).join("")}
        <div class="sl-thumb"></div>
      </div>
      <button type="button" class="sl-btn" data-ziel="${opt.id}" data-d="1" aria-label="${esc(opt.label)} erhöhen">+</button>
    </div>
    <input type="hidden" id="${opt.id}" ${opt.name ? `name="${opt.name}"` : ""} value="${v}">
    ${opt.hinweis ? `<div class="sl-hinweis" id="${opt.id}-h">${esc(opt.hinweis)}</div>` : ""}
  </div>`;
}

const RAST_PX = 6; // so nah (in Pixeln) muss man an einen Rastpunkt, damit er kurz einrastet

// Regler im Bereich `root` verdrahten. onChange(id, wert) wird bei jeder Änderung aufgerufen.
function initSlider(root = document, onChange) {
  root.querySelectorAll(".sl-track").forEach((t) => {
    if (t._sl) return;
    const sk = SKALEN[t.dataset.skala];
    const ziel = document.getElementById(t.dataset.ziel);
    const ausgabe = document.getElementById(`${t.dataset.ziel}-o`);
    const st = { wert: +ziel.value, roh: posAus(sk, +ziel.value) };
    let rastWert = null;

    const zeige = () => {
      const p = posAus(sk, st.wert) * 100;
      t.style.setProperty("--p", `${p}%`);
      ziel.value = st.wert;
      const text = sk.fmt(st.wert);
      ausgabe.textContent = text;
      t.setAttribute("aria-valuenow", st.wert);
      t.setAttribute("aria-valuetext", text);
    };
    // Wert setzen (mit 100-%-Grenze der Gruppe). Gibt den tatsächlich gesetzten Wert zurück.
    const setze = (v, { frei = false, still = false } = {}) => {
      v = runde(sk, v);
      if (t.dataset.gruppe && !frei) {
        const erlaubt = Math.max(0, 100 - gruppenSumme(t.dataset.gruppe, t));
        if (v > erlaubt + 1e-9) {
          v = Math.floor(erlaubt / sk.einheit + 1e-9) * sk.einheit;
          t.classList.add("anschlag");
          setTimeout(() => t.classList.remove("anschlag"), 450);
        }
      }
      if (v === st.wert) return v;
      st.wert = v;
      zeige();
      if (t.dataset.gruppe) gruppenAnzeige(t.dataset.gruppe);
      if (!still && t._cb) t._cb(t.dataset.ziel, v);
      return v;
    };
    // Rohposition → Wert, mit kurzem Einrasten an runden Zahlen
    let faktorJetzt = 1;
    const ausPosition = (pos) => {
      const breite = t.getBoundingClientRect().width || 300;
      let v = wertAus(sk, pos);
      if (sk.stufig) v = Math.round(v);
      let treffer = null;
      // Beim Feinziehen rastet der Regler kaum noch (Fenster schrumpft mit dem Faktor)
      const fenster = sk.stufig ? Infinity : RAST_PX * (faktorJetzt < 1 ? faktorJetzt * 0.5 : 1);
      for (const r of sk.rast) if (Math.abs(posAus(sk, r) - pos) * breite <= fenster) { treffer = r; break; }
      if (treffer != null) {
        v = treffer;
        if (rastWert !== treffer) { t.classList.add("rastet"); setTimeout(() => t.classList.remove("rastet"), 220); if (navigator.vibrate) navigator.vibrate(4); }
      }
      rastWert = treffer;
      setze(v);
    };

    // Ziehen: relativ zur Startposition. Finger nach unten/oben wegziehen = feiner (wie Scrubbing).
    let zug = null;
    t.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0) return;
      ev.preventDefault();
      t.focus({ preventScroll: true });
      t.setPointerCapture(ev.pointerId);
      const rect = t.getBoundingClientRect();
      const amDaumen = ev.target.classList.contains("sl-thumb");
      if (!amDaumen) { st.roh = (ev.clientX - rect.left) / rect.width; ausPosition(st.roh); }
      else st.roh = posAus(sk, st.wert);
      zug = { x: ev.clientX, y: ev.clientY, breite: rect.width };
      t.classList.add("zieht");
    });
    t.addEventListener("pointermove", (ev) => {
      if (!zug) return;
      const dy = Math.abs(ev.clientY - zug.y);
      const faktor = dy < 40 ? 1 : dy < 100 ? 0.3 : dy < 170 ? 0.1 : 0.03;
      faktorJetzt = faktor;
      t.dataset.fein = faktor < 1 ? `Fein ×${num(faktor, 2)}` : "Feiner: Finger nach unten ziehen";
      st.roh = Math.max(0, Math.min(1, st.roh + ((ev.clientX - zug.x) / zug.breite) * faktor));
      zug.x = ev.clientX;
      ausPosition(st.roh);
    });
    const ende = () => { zug = null; rastWert = null; faktorJetzt = 1; t.classList.remove("zieht"); t.dataset.fein = ""; };
    t.addEventListener("pointerup", ende);
    t.addEventListener("pointercancel", ende);

    // Tastatur: Pfeile = 1 Einheit, Umschalt+Pfeil = 10 Einheiten, Bild auf/ab = zum nächsten Rastpunkt
    t.addEventListener("keydown", (ev) => {
      const naechsterRast = (richtung) => (richtung > 0 ? sk.rast.find((r) => r > st.wert + 1e-9) : [...sk.rast].reverse().find((r) => r < st.wert - 1e-9)) ?? st.wert;
      const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[ev.key];
      if (k) setze(st.wert + k * sk.einheit * (ev.shiftKey ? 10 : 1));
      else if (ev.key === "PageUp") setze(naechsterRast(1));
      else if (ev.key === "PageDown") setze(naechsterRast(-1));
      else if (ev.key === "Home") setze(sMin(sk));
      else if (ev.key === "End") setze(sMax(sk));
      else return;
      ev.preventDefault();
      st.roh = posAus(sk, st.wert);
    });
    t._sl = { setze: (v, o) => { const r = setze(v, o); st.roh = posAus(sk, st.wert); return r; }, get wert() { return st.wert; } };
    t._cb = onChange;
    if (t.dataset.gruppe) gruppenAnzeige(t.dataset.gruppe);
  });

  // − / + : 1 Einheit pro Tipp; gedrückt halten wird schneller (×10, dann ×100)
  root.querySelectorAll(".sl-btn").forEach((btn) => {
    if (btn._ok) return;
    btn._ok = true;
    let timer = null, start = 0;
    const schritt = () => {
      const t = document.getElementById(`${btn.dataset.ziel}-r`);
      if (!t || !t._sl) return;
      const sk = SKALEN[t.dataset.skala], dauer = Date.now() - start;
      const mal = dauer > 3000 ? 100 : dauer > 1400 ? 10 : 1;
      t._sl.setze(t._sl.wert + +btn.dataset.d * sk.einheit * mal);
    };
    const stop = () => { clearTimeout(timer); timer = null; };
    btn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      start = Date.now();
      schritt();
      const wiederhole = () => { timer = setTimeout(() => { schritt(); wiederhole(); }, Date.now() - start > 1400 ? 60 : 110); };
      timer = setTimeout(wiederhole, 420);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((e) => btn.addEventListener(e, stop));
    btn.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); start = Date.now(); schritt(); } });
  });
}

function gruppenSumme(gruppe, ausser = null) {
  let s = 0;
  document.querySelectorAll(`.sl-track[data-gruppe="${gruppe}"]`).forEach((x) => {
    if (x !== ausser) s += Number(document.getElementById(x.dataset.ziel).value) || 0;
  });
  return s;
}

// Zeigt "Noch frei: X %" in einem Element mit id="rest-<gruppe>" (falls vorhanden).
function gruppenAnzeige(gruppe) {
  const el = document.getElementById(`rest-${gruppe}`);
  if (!el) return;
  const s = Math.round(gruppenSumme(gruppe) * 10) / 10;
  el.className = `rest ${s >= 99.95 ? "voll" : ""}`;
  el.textContent = s >= 99.95 ? "100 % verteilt" : `Noch frei: ${num(100 - s, 1)} %`;
}

const slWert = (id) => Number(document.getElementById(id)?.value || 0);

function setzeSlider(id, v, ohneGrenze = false) {
  const t = document.getElementById(`${id}-r`);
  if (t && t._sl) t._sl.setze(v, { frei: ohneGrenze });
}

// Prozentwerte so runden, dass die Summe genau 100 ergibt (größter Rest bekommt die Differenz).
function auf100(werte) {
  const s = werte.reduce((a, b) => a + b, 0);
  if (!s) return werte.map(() => 0);
  const roh = werte.map((v) => (v / s) * 100), ganz = roh.map(Math.floor);
  let rest = 100 - ganz.reduce((a, b) => a + b, 0);
  roh.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { ganz[i]++; rest--; } });
  return ganz;
}

function rechercheTabs(aktiv) {
  const t = [["recherche", "Recherche", "#/recherche"], ["glossar", "Glossar", "#/glossar"], ["quellen", "Quellen", "#/quellen"], ["produkte", "Produkte", "#/produkte"]];
  return `<div class="toolbar"><nav class="seg" aria-label="Recherche">${t.map(([k, n, h]) => `<a class="${k === aktiv ? "on" : ""}" href="${h}">${n}</a>`).join("")}</nav></div>`;
}

// Risiko als 5 Punkte
function pips(n, max = 5, cls = "") {
  return `<span class="pips ${cls}" role="img" aria-label="${n} von ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
}

const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
