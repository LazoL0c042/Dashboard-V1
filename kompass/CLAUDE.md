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

## Council-Regeln (aus der Spezifikation)
5 Fachrollen, max. 4 Runden. Konsens = Spanne ≤ 15 Punkte UND Kritiker `einwand_widerlegt=true`.
Ohne Konsens: Dissens zeigen, keine Prüfrunde. Wahrscheinlichkeit = Median (berechnet, nicht vom Modell).
Erfolg = im Plus UND Ziel erreicht UND MSCI World geschlagen.
