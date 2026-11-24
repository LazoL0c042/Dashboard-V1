// Kompass – reine Rechenfunktionen für Portfolios und Szenarien.
// Läuft im Browser (window.Rechnen) und in Node (module.exports) für Tests.
(function (root) {
  "use strict";

  // Letzter Kurs an oder vor `tag` (höchstens 7 Tage zurück). reihe: [[tag, kurs], ...] aufsteigend.
  function kursAm(reihe, tag) {
    let lo = 0, hi = reihe.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (reihe[mid][0] <= tag) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 0) return null;
    const diff = (Date.parse(tag) - Date.parse(reihe[best][0])) / 864e5;
    return diff <= 7 ? reihe[best][1] : null;
  }

  // Einzahlungstermine: Start, dann monatlich am gleichen Tag (max. 28.) bis heute.
  function termine(start, heute) {
    const s = new Date(start + "T00:00:00Z"), out = [];
    for (let m = 0; ; m++) {
      const d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + m, m ? Math.min(s.getUTCDate(), 28) : s.getUTCDate()));
      const iso = d.toISOString().slice(0, 10);
      if (iso > heute) return out;
      out.push(iso);
    }
  }

  function addTage(tag, n) {
    return new Date(Date.parse(tag + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  }

  /**
   * Rückrechnung eines Portfolios mit festen Zielanteilen beim Kauf (kein Rebalancing).
   * p: {startdatum, einmalbetrag, sparrate, positionen:[{ticker, name, anteil}]}
   * kurse: {ticker: [[tag, kurs]]}, benchTicker: Vergleichsticker in `kurse`.
   * Ergebnis: Wochenpunkte mit Wert, Einzahlung, Vergleich und zeitgewichteten Indizes.
   */
  function rueckrechnung(p, kurse, benchTicker, heute) {
    const summe = p.positionen.reduce((a, x) => a + (+x.anteil || 0), 0) || 1;
    const pos = p.positionen.map((x) => ({ ...x, gewicht: (+x.anteil || 0) / summe, stueck: 0, investiert: 0 }));
    const zahl = termine(p.startdatum, heute).map((t, i) => [t, (i === 0 ? +p.einmalbetrag || 0 : 0) + (i > 0 || !+p.einmalbetrag ? +p.sparrate || 0 : 0)]).filter((z) => z[1] > 0);
    const fehlend = [];
    const punkte = [];
    let ein = 0, benchStueck = 0, anteile = 0, benchAnteile = 0, zi = 0;
    for (let tag = p.startdatum; tag <= heute; tag = tag === heute ? addTage(heute, 1) : (addTage(tag, 7) > heute ? heute : addTage(tag, 7))) {
      // Einzahlungen bis einschließlich `tag` ausführen
      while (zi < zahl.length && zahl[zi][0] <= tag) {
        const [zt, betrag] = zahl[zi++];
        let wertVorher = 0, ok = true;
        for (const x of pos) { const k = kursAm(kurse[x.ticker] || [], zt); if (k == null) { ok = false; fehlend.push(`${x.ticker} am ${zt}`); } else wertVorher += x.stueck * k; }
        const bk = kursAm(kurse[benchTicker] || [], zt);
        if (!ok || bk == null) { if (bk == null) fehlend.push(`${benchTicker} am ${zt}`); continue; }
        // Anteilswert vor der Einzahlung (für zeitgewichtete Rendite)
        const idx = anteile ? wertVorher / anteile : 100;
        const bidx = benchAnteile ? (benchStueck * bk) / benchAnteile : 100;
        for (const x of pos) { const k = kursAm(kurse[x.ticker], zt); x.stueck += (betrag * x.gewicht) / k; x.investiert += betrag * x.gewicht; }
        benchStueck += betrag / bk;
        anteile += betrag / idx;
        benchAnteile += betrag / bidx;
        ein += betrag;
      }
      if (!anteile) continue;
      let wert = 0, ok = true;
      for (const x of pos) { const k = kursAm(kurse[x.ticker] || [], tag); if (k == null) { ok = false; break; } wert += x.stueck * k; }
      const bk = kursAm(kurse[benchTicker] || [], tag);
      if (!ok || bk == null) continue;
      punkte.push({ tag, wert, eingezahlt: ein, bench: benchStueck * bk, index: wert / anteile, benchIndex: (benchStueck * bk) / benchAnteile });
    }
    const letzter = punkte[punkte.length - 1];
    const positionen = pos.map((x) => {
      const k = letzter ? kursAm(kurse[x.ticker] || [], letzter.tag) : null;
      const wert = k == null ? null : x.stueck * k;
      return { ...x, kurs: k, wert, rendite: wert == null || !x.investiert ? null : wert / x.investiert - 1,
        anteilAktuell: wert == null || !letzter ? null : wert / letzter.wert };
    });
    return { punkte, positionen, kennzahlen: kennzahlen(punkte), fehlend: [...new Set(fehlend)].slice(0, 10) };
  }

  function kennzahlen(punkte) {
    if (punkte.length < 2) return null;
    const a = punkte[0], e = punkte[punkte.length - 1];
    const jahre = (Date.parse(e.tag) - Date.parse(a.tag)) / (365.25 * 864e5);
    const pa = (i0, i1) => (jahre >= 1 ? Math.pow(i1 / i0, 1 / jahre) - 1 : null);
    const vol = (key) => {
      const r = [];
      for (let i = 1; i < punkte.length; i++) r.push(Math.log(punkte[i][key] / punkte[i - 1][key]));
      if (r.length < 8) return null;
      const m = r.reduce((s, x) => s + x, 0) / r.length;
      return Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(52);
    };
    const mdd = (key) => { let peak = 0, dd = 0; for (const p of punkte) { peak = Math.max(peak, p[key]); dd = Math.min(dd, p[key] / peak - 1); } return dd; };
    return {
      wert: e.wert, eingezahlt: e.eingezahlt, gewinn: e.wert - e.eingezahlt, gewinnProzent: e.wert / e.eingezahlt - 1,
      benchWert: e.bench, jahre,
      renditeZeitgewichtet: e.index / a.index - 1, benchZeitgewichtet: e.benchIndex / a.benchIndex - 1,
      renditePa: pa(a.index, e.index), benchPa: pa(a.benchIndex, e.benchIndex),
      volatilitaet: vol("index"), benchVolatilitaet: vol("benchIndex"), maxVerlust: mdd("index"), benchMaxVerlust: mdd("benchIndex"),
    };
  }

  // Punkte ab einem Zeitfenster ("1J", "3J", "5J", "Max").
  function fenster(punkte, f) {
    if (f === "Max" || !punkte.length) return punkte;
    const jahre = { "1J": 1, "3J": 3, "5J": 5 }[f] || 100;
    const grenze = addTage(punkte[punkte.length - 1].tag, -Math.round(365.25 * jahre));
    return punkte.filter((p) => p.tag >= grenze);
  }

  // ---------- Szenarien ----------

  function glatt(t) { return t * t * (3 - 2 * t); }

  // Wert (in % Veränderung) einer Klasse im Monat m: 0 → Tief (Monat tm) → Ende (Monat h).
  function pfadWert(tief, ende, m, tm, h) {
    if (m <= 0) return 0;
    if (m <= tm) return tief * glatt(m / tm);
    return tief + (ende - tief) * glatt((m - tm) / Math.max(1, h - tm));
  }

  /**
   * Szenario auf Positionen anwenden.
   * positionen: [{name, anteil, klassen: {klasse: gewicht}}], def: Szenario aus szenarien.json.
   * Rückgabe: worst/realistisch/best (realistisch = mittlerer Verlauf, worst/best = schwerer/milder
   * Verlauf je nachdem, welcher für DIESES Depot schlechter ist) mit Monats-Pfad und Beiträgen.
   */
  function szenario(positionen, def, depotwert) {
    const summe = positionen.reduce((a, x) => a + (+x.anteil || 0), 0) || 1;
    const h = def.horizont_monate, tm = def.tief_monat;
    const variante = (name) => {
      const st = def.stoesse[name];
      const klasseWert = (k, m) => (st[k] ? pfadWert(st[k][0], st[k][1], m, tm, h) / 100 : 0);
      const posWert = (x, m) => {
        const kl = x.klassen || {};
        const g = Object.values(kl).reduce((a, b) => a + b, 0) || 1;
        return Object.entries(kl).reduce((a, [k, w]) => a + (w / g) * klasseWert(k, m), 0);
      };
      const pfad = [];
      for (let m = 0; m <= h; m++) {
        const r = positionen.reduce((a, x) => a + ((+x.anteil || 0) / summe) * posWert(x, m), 0);
        pfad.push({ monat: m, veraenderung: r, wert: depotwert * (1 + r) });
      }
      const tief = pfad.reduce((a, p) => (p.veraenderung < a.veraenderung ? p : a), pfad[0]);
      const ende = pfad[pfad.length - 1];
      const beitraege = positionen.map((x) => {
        const g = (+x.anteil || 0) / summe;
        const r = posWert(x, h);
        return { name: x.name, anteil: g, veraenderung: r, beitrag: g * r * depotwert };
      });
      return { variante: name, pfad, tief, ende, beitraege };
    };
    const s = variante("schwer"), m = variante("mittel"), l = variante("mild");
    const [worst, best] = s.ende.veraenderung <= l.ende.veraenderung ? [s, l] : [l, s];
    return { worst, realistisch: m, best, horizont: h };
  }

  // Klassen eines Portfolios aufsummiert (für Aufteilung nach Anlageklasse).
  function klassenAnteile(positionen) {
    const summe = positionen.reduce((a, x) => a + (+x.anteil || 0), 0) || 1, out = {};
    for (const x of positionen) {
      const kl = x.klassen || {}, g = Object.values(kl).reduce((a, b) => a + b, 0) || 1;
      for (const [k, w] of Object.entries(kl)) out[k] = (out[k] || 0) + ((+x.anteil || 0) / summe) * (w / g);
    }
    return out;
  }

  const api = { kursAm, termine, rueckrechnung, kennzahlen, fenster, szenario, pfadWert, klassenAnteile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Rechnen = api;
})(typeof window !== "undefined" ? window : globalThis);
