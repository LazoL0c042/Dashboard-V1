# AERA Command Center — Dashboard Grundgerüst

Lokales Web-Dashboard für den 4-Personen-Trading-Fund. 2 Module aktiv (Research, Validierung), 5 gesperrt — erweiterbar ohne Code-Umbau.

---

## App starten

```bash
cd frontend
npm install
npm start
```

Browser öffnet sich unter `http://localhost:3000`.

---

## Projektstruktur

```
frontend/
├── public/
│   ├── research_log.json       # Datenquelle für Research-Modul
│   └── validation_log.json     # Datenquelle für Validierungs-Modul
└── src/
    ├── modules/
    │   ├── registry.js         # ← HIER steuert man, welche Module aktiv sind
    │   └── useModuleData.js    # Generischer Daten-Hook (JSON fetch)
    ├── components/
    │   └── ModuleTile.js       # Kachel-Komponente (aktiv oder gesperrt)
    ├── pages/
    │   ├── CommandCenter.js    # Startseite mit allen 7 Kacheln
    │   ├── ResearchPage.js     # Detailseite Research
    │   └── ValidierungPage.js  # Detailseite Validierung
    └── App.js                  # Router
```

---

## Wie man ein gesperrtes Modul entsperrt

Alles läuft über `src/modules/registry.js`. Jedes Modul hat dort einen Eintrag:

```js
{
  id: "strategie",
  label: "Strategie-Engine",
  description: "Folgt in Monat 2",
  status: "locked",       // ← ändern auf "active"
  dataUrl: null,          // ← Pfad zur JSON-Datenquelle eintragen
  route: null,            // ← Route eintragen, z.B. "/strategie"
  accentColor: "#7c83a0", // ← Akzentfarbe für die Kachel
}
```

**Schritte zum Entsperren (Beispiel: Strategie-Engine):**

1. In `registry.js` den Eintrag für `"strategie"` anpassen:

```js
{
  id: "strategie",
  label: "Strategie-Engine",
  description: "Signale & Positionsgrößen",
  status: "active",                    // war: "locked"
  dataUrl: "/strategie_log.json",      // war: null
  route: "/strategie",                 // war: null
  accentColor: "#ff9800",
}
```

2. Die JSON-Datei `public/strategie_log.json` anlegen (oder aus dem Python-System befüllen lassen).

3. Eine neue Seite `src/pages/StrategiePage.js` anlegen — analog zu `ResearchPage.js`.

4. In `src/App.js` die neue Route eintragen:

```jsx
<Route path="/strategie" element={<StrategiePage />} />
```

Die Startseite und alle anderen Module bleiben unverändert. Die Kachel schaltet automatisch auf aktiv, sobald `status: "active"` gesetzt ist.

---

## Datenquellen aus Python anschließen

Damit echte AERA-Agent-Daten erscheinen: euer Python-Skript schreibt seine Ergebnisse in `frontend/public/research_log.json` — im Format das die Datei schon hat. Das Dashboard liest die Datei beim Seitenaufruf per HTTP-Request, kein Neustart nötig.

Für Produktion (Live-System): `dataUrl` in `registry.js` auf eine echte API-URL zeigen lassen statt auf eine statische JSON-Datei. Der `useModuleData`-Hook fetcht beides identisch.
