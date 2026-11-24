// Kompass – Regler (Slider) und kleine UI-Bausteine.
// Ein Regler besteht aus einem sichtbaren <input type=range> (Index in einer Werteskala)
// und einem versteckten Feld mit dem echten Wert (name=…), damit Formulare normal funktionieren.
"use strict";

function stufen(...bereiche) {
  const out = [];
  for (const [von, bis, schritt] of bereiche) for (let v = von; v <= bis + 1e-9; v += schritt) if (!out.length || Math.abs(out[out.length - 1] - v) > 1e-9) out.push(+v.toFixed(4));
  return out;
}

const SKALEN = {
  geld: { werte: stufen([0, 1000, 50], [1000, 10000, 250], [10000, 100000, 1000], [100000, 1000000, 10000], [1000000, 3000000, 50000]), fmt: (v) => eur0(v) },
  rate: { werte: stufen([0, 500, 10], [500, 2000, 25], [2000, 10000, 100]), fmt: (v) => `${eur0(v)} / Monat` },
  jahre: { werte: stufen([1, 60, 1]), fmt: (v) => `${v} Jahr${v === 1 ? "" : "e"}` },
  zurueck: { werte: stufen([0, 2, 0.25], [2, 30, 0.5]), fmt: (v) => (v === 0 ? "ab heute" : `vor ${num(v, 2)} Jahren`) },
  prozent: { werte: stufen([0, 100, 1]), fmt: (v) => `${v} %` },
  ter: { werte: stufen([0, 2, 0.05]), fmt: (v) => `${num(v, 2)} %` },
  steigerung: { werte: stufen([0, 10, 0.5]), fmt: (v) => `${num(v, 1)} % pro Jahr` },
  zins: { werte: stufen([-5, 20, 0.25]), fmt: (v) => `${num(v, 2)} % p.a.` },
  alter: { werte: stufen([16, 90, 1]), fmt: (v) => `${v} Jahre` },
  einkommen: { werte: stufen([0, 3000, 50], [3000, 15000, 250], [15000, 50000, 1000]), fmt: (v) => `${eur0(v)} / Monat` },
  risiko: { werte: [1, 2, 3, 4, 5], fmt: (v) => `${v} · ${["", "Sicherheit", "Konservativ", "Ausgewogen", "Wachstum", "Spekulativ"][v]}` },
};

function naechsterIndex(werte, v) {
  let best = 0;
  for (let i = 1; i < werte.length; i++) if (Math.abs(werte[i] - v) < Math.abs(werte[best] - v)) best = i;
  return best;
}

/**
 * Regler-HTML. opt: {id, name, label, skala, wert, hinweis, klein}
 * Der echte Wert steckt im versteckten Feld (id = opt.id).
 */
function slider(opt) {
  const sk = SKALEN[opt.skala];
  const v = opt.wert == null || opt.wert === "" || isNaN(+opt.wert) ? sk.werte[0] : +opt.wert;
  const idx = naechsterIndex(sk.werte, v);
  const rid = `${opt.id}-r`;
  return `<div class="sl${opt.klein ? " klein" : ""}">
    <div class="sl-kopf"><label for="${rid}">${esc(opt.label)}</label><output for="${rid}" id="${opt.id}-o">${esc(sk.fmt(sk.werte[idx]))}</output></div>
    <input type="range" id="${rid}" class="sl-r" data-skala="${opt.skala}" data-ziel="${opt.id}" min="0" max="${sk.werte.length - 1}" step="1" value="${idx}"
      aria-valuetext="${esc(sk.fmt(sk.werte[idx]))}">
    <input type="hidden" id="${opt.id}" ${opt.name ? `name="${opt.name}"` : ""} value="${sk.werte[idx]}">
    ${opt.hinweis ? `<div class="sl-hinweis" id="${opt.id}-h">${esc(opt.hinweis)}</div>` : ""}
  </div>`;
}

// Regler im Bereich `root` verdrahten. onChange(id, wert) wird bei jeder Bewegung aufgerufen.
function initSlider(root = document, onChange) {
  root.querySelectorAll("input.sl-r").forEach((r) => {
    if (r.dataset.ok) return;
    r.dataset.ok = "1";
    const sk = SKALEN[r.dataset.skala];
    const male = () => {
      const pct = (r.value / r.max) * 100;
      r.style.setProperty("--p", `${pct}%`);
    };
    male();
    r.addEventListener("input", () => {
      const v = sk.werte[+r.value];
      const ziel = document.getElementById(r.dataset.ziel);
      ziel.value = v;
      const t = sk.fmt(v);
      document.getElementById(`${r.dataset.ziel}-o`).textContent = t;
      r.setAttribute("aria-valuetext", t);
      male();
      if (onChange) onChange(r.dataset.ziel, v);
    });
  });
}

const slWert = (id) => Number(document.getElementById(id)?.value || 0);

function setzeSlider(id, v) {
  const r = document.getElementById(`${id}-r`);
  if (!r) return;
  r.value = naechsterIndex(SKALEN[r.dataset.skala].werte, v);
  r.dispatchEvent(new Event("input"));
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
