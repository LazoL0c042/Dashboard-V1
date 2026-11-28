# CLAUDE.md – Kompass

## Ziel
Private Mehrbenutzer-App (eingeladene Freunde) für Investment-Entscheidungen: Council,
Pläne mit ehrlicher Auswertung gegen MSCI World, Recherche, Rechner. UI und Kommentare Deutsch.
Design: `docs/superpowers/specs/2026-11-23-investment-tool-design.md` im Repo-Root.

## Stack (nicht ohne Rückfrage ändern)
Python 3.12, FastAPI, SQLite (sqlite3, kein ORM), httpx, yfinance, pytest.
Frontend: Vanilla JS, `static/index.html` + `app.js` + `style.css`, kein Build-Schritt, PWA.
Modelle: nur kostenlose Zugänge über OpenAI-kompatible Schnittstellen (`app/llm.py`).

## Harte Regeln
1. Kein Code, der Orders platziert oder schreibend auf Broker-Konten zugreift.
2. Pläne und Council-Protokolle sind unveränderlich (DB-Trigger). Nur Nachträge.
3. Jede angezeigte Zahl hat Quelle + Datum oder ist als „geschätzt“ markiert. Keine Zahlen aus dem Gedächtnis in Daten-Dateien.
4. Nutzerdaten strikt per `user_id` getrennt; jede Abfrage filtert danach.
5. Geheimnisse nur in `.env`. Nie loggen, nie committen.
6. Nur kostenlose Dienste. Neue Anbieter/Quellen nur mit Rückfrage.
7. Kein öffentlicher Port: Bind 127.0.0.1, Zugang über `tailscale serve`.
8. `pytest -q` muss grün sein, bevor etwas als fertig gilt.
9. `werkbank/` wird von diesem Projekt nie verändert.

## Rechenlogik im Browser
Portfolio-Rückrechnung und Szenarien laufen in `static/rechnen.js` (eine Implementierung, Tests in
`tests/js/test_rechnen.js`, werden über pytest ausgeführt). Diagramme: `static/charts.js` (ohne Bibliothek,
Farben `--series-1..3`, geprüft auf Farbenblindheit). Szenario-Annahmen sind Größenordnungen, keine Prognosen.

## Council-Regeln (aus der Spezifikation)
5 Fachrollen, max. 4 Runden. Konsens = Spanne ≤ 15 Punkte UND Kritiker `einwand_widerlegt=true`.
Ohne Konsens: Dissens zeigen, keine Prüfrunde. Wahrscheinlichkeit = Median (berechnet, nicht vom Modell).
Erfolg = im Plus UND Ziel erreicht UND MSCI World geschlagen.

## Design-Regeln (für alle künftigen Änderungen verbindlich)
Der Nutzer will einen einheitlichen Look. Neue Ansichten übernehmen genau diese Bausteine, keine neuen Farben oder Stile:
- **Immer hell.** Kein Dunkelmodus. Hintergrund `--bg` (#fbf8f4, warmes Hellbeige), Karten `--card` (weiß).
- **Pastell-Palette (Tokens in `static/style.css`):** `--mint`, `--lav`, `--sky`, `--peach`, `--sand`, `--rose` als Flächen,
  dazu je eine dunkle Textfarbe (`--mint-d`, `--lav-d`, …). Akzent und Hauptknöpfe: `--lav-d`. Ränder: `--edge`, Linien: `--line`.
- **Diagramme:** nur `--series-1..3` (geprüft auf Farbenblindheit) und `--ref` für Bezugslinien, über `static/charts.js`.
- **Bereiche:** Pläne = Mint, Council/Akzent = Lavendel, Recherche/Glossar = Himmelblau, Rechner = Pfirsich, Warnung = Rose, Hinweis = Sand.
- **Alles Bedienbare sieht aus wie ein Knopf** (Rahmen, Mindesthöhe 44 px). Keine nackten Textlinks.
- **Zahlen per Regler** (`slider()` in `static/ui.js`) mit Einrasten, −/+ und Feinziehen; gekoppelte Anteile nie über 100 %.
- **Leicht verdaulich:** Zusammenfassung vor Detail, Kacheln (`.kpi`), Karten (`.card`, `.pcard`), Details in `<details>`.
- **Fließende Übergänge:** Seiten blenden über `main.wechsel` ein; Karten heben sich beim Überfahren leicht an;
  `prefers-reduced-motion` wird respektiert.
- **Schrift:** Systemschrift, Überschriften 600–700, Zahlen mit `tabular-nums`.
- Die Vorschau (Artefakt „Kompass“) wird aus genau diesen Dateien gebaut – sie muss gleich aussehen wie die App.
