# CLAUDE.md – Werkbank

## Ziel
Persönliches Sprach-Interface für einen Einzelnutzer (Peter). Gedanken per iPhone
einsprechen, automatisch sortieren und verknüpfen. Dashboard für Aufgaben, Woche,
Checklisten, Ziele und Privatvermögen. Sprache in Code-Kommentaren und UI: Deutsch.

## Stack (nicht ohne Rückfrage ändern)
- Python 3.12, FastAPI, SQLite (sqlite3, kein ORM), pytest
- Frontend: Vanilla JS, eine HTML-Datei, kein Build-Schritt, PWA
- Eingabe: Apple Kurzbefehl → POST /api/capture
- Sortierung: Claude API (Standard: Haiku), JSON-Ausgabe
- Kurse: yfinance, gekapselt in portfolio.fetch_quote()
- Netz: nur über Tailscale, nie öffentlicher Port

## Aktionskatalog (abschließend)
thought.save, todo.create, todo.complete, week.plan, checklist.log, progress.log, query.
Neue Aktionen nur mit Rückfrage. Jede neue Aktion braucht: Handler in actions.py,
Eintrag in HANDLERS, Beschreibung im SYSTEM_PROMPT, Undo-Unterstützung, Test.

## Harte Regeln
1. Vermögensdaten (portfolios, positions, price_cache, net_worth_snapshots) werden
   NIE an die Claude API oder einen anderen externen Dienst außer der Kursquelle gesendet.
   classifier.py importiert portfolio.py nicht.
2. Kein Code, der Orders platziert oder schreibend auf ein Broker-Konto zugreift.
3. Rohdaten in `entries` werden nie gelöscht.
4. Unsicher sortierte Eingaben gehen in die Inbox, es wird nie geraten.
5. Aktionen einer Eingabe laufen alles-oder-nichts (SAVEPOINT in actions.execute).
6. Geheimnisse nur in .env. Nie loggen, nie committen.
7. Jede Änderung: `pytest -q` muss grün sein, bevor sie als fertig gilt.

## Phasen
- [x] Phase 1: Eingabe, Klassifikation, Inbox, ToDos, Gedanken, Undo
- [~] Phase 2: Woche, Checklisten, Ziele (Gerüst steht, Feinschliff offen)
- [ ] Phase 3: Embeddings für Kontextverknüpfung, query mit Claude-Antwort über
      gefundene Notizen, Wochenreview Sonntag mit 3 datenbasierten Vorschlägen
      (Zahlen liefert bereits GET /api/review/week)
- [~] Phase 4: Vermögen (Gerüst steht). Offen: IBKR read-only per API,
      Broker-spezifische CSV-Parser, Verlaufschart aus net_worth_snapshots
- [ ] Später: Server-Umzug (Docker), Push-Mitteilungen

## Arbeitsweise
Plan-Modus zuerst, Plan zeigen, erst nach Freigabe umsetzen. Kleine Commits.
Keine Features außerhalb der aktuellen Phase ohne Rückfrage.
