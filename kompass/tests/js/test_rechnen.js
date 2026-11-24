// Tests für static/rechnen.js. Aufruf: node tests/js/test_rechnen.js (läuft auch über pytest).
const assert = require("assert");
const R = require("../../static/rechnen.js");
const sz = require("../../data/szenarien.json");

function reihe(start, tage, f) {
  const out = [];
  for (let i = 0; i <= tage; i++) out.push([new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10), f(i)]);
  return out;
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// Rückrechnung: Kurs verdoppelt sich linear, Vergleich bleibt konstant
{
  const kurse = { A: reihe("2024-01-01", 730, (i) => 100 + (100 * i) / 730), B: reihe("2024-01-01", 730, () => 50) };
  const r = R.rueckrechnung({ startdatum: "2024-01-01", einmalbetrag: 1000, sparrate: 100, positionen: [{ ticker: "A", anteil: 100 }] }, kurse, "B", "2025-12-31");
  const k = r.kennzahlen;
  near(k.eingezahlt, 1000 + 100 * 23);
  assert.ok(k.wert > k.eingezahlt, "im Plus");
  near(k.benchWert, k.eingezahlt, 1e-6);
  near(k.benchZeitgewichtet, 0, 1e-9);
  assert.ok(Math.abs(k.renditeZeitgewichtet - (r.punkte.at(-1).index / 100 - 1)) < 1e-9);
  near(k.renditeZeitgewichtet, 1.0, 1e-9); // Kurs 100 → 200, unabhängig von Einzahlungen
  assert.deepStrictEqual(r.fehlend, []);
  assert.strictEqual(r.punkte.at(-1).tag, "2025-12-31");
}

// Fehlender Kurs: kein Absturz, Meldung
{
  const kurse = { B: reihe("2024-01-01", 100, () => 50) };
  const r = R.rueckrechnung({ startdatum: "2024-01-01", einmalbetrag: 1000, sparrate: 0, positionen: [{ ticker: "X", anteil: 1 }] }, kurse, "B", "2024-03-01");
  assert.ok(r.fehlend.length > 0);
  assert.strictEqual(r.kennzahlen, null);
}

// Max. Verlust
{
  const kurse = { A: reihe("2024-01-01", 400, (i) => (i < 200 ? 100 : i < 300 ? 60 : 90)), B: reihe("2024-01-01", 400, () => 1) };
  const r = R.rueckrechnung({ startdatum: "2024-01-01", einmalbetrag: 1000, sparrate: 0, positionen: [{ ticker: "A", anteil: 1 }] }, kurse, "B", "2025-02-04");
  near(r.kennzahlen.maxVerlust, -0.4, 1e-9);
}

// Szenario: reine Klasse folgt genau den Annahmen
{
  const def = sz.szenarien.find((s) => s.id === "ki_blase");
  const r = R.szenario([{ name: "Tech", anteil: 100, klassen: { aktien_tech: 1 } }], def, 10000);
  near(r.realistisch.ende.veraenderung, def.stoesse.mittel.aktien_tech[1] / 100);
  near(r.realistisch.tief.veraenderung, def.stoesse.mittel.aktien_tech[0] / 100);
  assert.strictEqual(r.realistisch.tief.monat, def.tief_monat);
  assert.ok(r.worst.ende.veraenderung <= r.best.ende.veraenderung);
  assert.strictEqual(r.realistisch.pfad.length, def.horizont_monate + 1);
}

// Szenario: worst/best je Depot – Öl-Depot profitiert vom schweren Ölschock
{
  const def = sz.szenarien.find((s) => s.id === "oelschock");
  const r = R.szenario([{ name: "Öl", anteil: 1, klassen: { rohstoffe_oel: 1 } }], def, 1000);
  assert.strictEqual(r.best.variante, "schwer");
  assert.strictEqual(r.worst.variante, "mild");
}

// Mischung und Klassenanteile
{
  const pos = [{ name: "A", anteil: 75, klassen: { aktien_welt: 0.9, aktien_em: 0.1 } }, { name: "G", anteil: 25, klassen: { gold: 1 } }];
  const k = R.klassenAnteile(pos);
  near(k.aktien_welt, 0.675); near(k.aktien_em, 0.075); near(k.gold, 0.25);
  const def = sz.szenarien.find((s) => s.id === "rezession");
  const r = R.szenario(pos, def, 100);
  const e = 0.675 * def.stoesse.mittel.aktien_welt[1] + 0.075 * def.stoesse.mittel.aktien_em[1] + 0.25 * def.stoesse.mittel.gold[1];
  near(r.realistisch.ende.veraenderung, e / 100);
  near(r.realistisch.beitraege.reduce((a, b) => a + b.beitrag, 0), r.realistisch.ende.wert - 100, 1e-6);
}

// Alle Szenarien vollständig
for (const s of sz.szenarien) for (const v of ["schwer", "mittel", "mild"]) assert.strictEqual(Object.keys(s.stoesse[v]).length, Object.keys(sz.klassen).length, s.id);

console.log("ok");
