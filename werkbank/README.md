# Werkbank – persönliches Sprach-Interface

Gedanken einsprechen, automatisch sortieren lassen, Aufgaben, Woche, Checklisten,
Ziele und Vermögen an einem Ort. Läuft als Python-Server, bedient wird es auf
iPhone und iPad über einen Kurzbefehl und eine Web-App auf dem Homescreen.

## Was schon funktioniert (Phase 1 + Gerüst für 2–4)

| Bereich    | Stand |
|------------|-------|
| Eingabe    | Mikrofon-Knopf in der Web-App (lokales Whisper, kein Siri), Textfeld oder Kurzbefehl. "ToDo: …" und "Gedanke: …" werden ohne KI sortiert, alles andere per Claude API. Unsicheres landet in der Inbox. Jede Aktion ist rückgängig machbar. |
| Aufgaben   | Projekte, Priorität, Fälligkeit, überfällig-Markierung |
| Woche      | Tagesplan, Checklisten-Raster (Sport, Lernen, Arbeit …), Ziele mit Fortschritt |
| Gedanken   | Volltextsuche |
| Vermögen   | Mehrere Portfolios, Einstiegskurs, P&L, Verteilung nach Portfolio, Anlageklasse, Region, Währung, Titel. Kurse beim Öffnen, höchstens alle 15 Min. neu. Fremdwährungen werden in EUR umgerechnet. CSV-Import. |
| Startseite | Arcade-HUD: Spracheingabe in der Mitte, Quests + Wochenplan, Deadlines, Checkliste, Finanzen (verdeckt), Wochenscore mit Rang, Streak, XP und Level |
| Kosten     | API-Verbrauch des Monats unter Einstellungen |

## 1. Lokal starten (Laptop)

```bash
cd werkbank
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # dann API_TOKEN und ANTHROPIC_API_KEY eintragen
pytest -q                   # muss grün sein
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Im Browser `http://127.0.0.1:8000` öffnen und den API_TOKEN eingeben.

## 2. Vom iPhone und iPad erreichen (Tailscale)

Der Server wird nie offen ins Internet gestellt. Tailscale baut ein privates Netz
nur zwischen deinen Geräten.

1. Tailscale auf Laptop, iPhone und iPad installieren, überall mit demselben Konto anmelden.
2. In der Tailscale-Verwaltung (Web) unter DNS: MagicDNS und HTTPS-Zertifikate aktivieren.
3. Auf dem Laptop: `tailscale serve --bg 8000`
   Tailscale zeigt eine Adresse wie `https://laptop.dein-netz.ts.net`
   (je nach Version kann der Befehl leicht abweichen, siehe `tailscale serve --help`).
4. Auf dem iPhone in Safari diese Adresse öffnen, Teilen, "Zum Home-Bildschirm".
5. In der Tailscale-App auf dem iPhone "VPN On Demand" aktivieren, damit die
   Verbindung automatisch steht.

**Laptop als Server:** Funktioniert, solange er an ist und nicht schläft. Klappt
er zu oder geht in den Ruhezustand, gehen Eingaben ins Leere. Zum Bauen und
Testen ideal, als Dauerlösung nicht. Solange du den Laptop nutzt: Energiesparen
für Netzbetrieb deaktivieren (macOS: `caffeinate -s` im Terminal laufen lassen).

## 3. Spracheingabe in der Web-App (ohne Siri)

Auf der Startseite den großen Knopf tippen, sprechen, nochmal tippen. Am Laptop geht
auch die Leertaste (Escape bricht ab). Die Aufnahme geht an deinen Server und wird dort
mit Whisper transkribiert. Das Audio verlässt ihn nicht und wird nicht gespeichert.

- **Modell vorab laden** (einmaliger Download, danach offline):
  `python -m app.transcriber`. Ohne diesen Schritt lädt die erste Aufnahme das Modell.
- **Modellgröße** in der `.env`: `WHISPER_MODEL=small` (Standard, ~0,5 GB, 2–5 s pro
  Satz auf dem Laptop) oder `medium` (~1,5 GB, besser bei Dialekt, langsamer).
- **Das Mikrofon braucht HTTPS.** Über `tailscale serve` (Abschnitt 2) oder `localhost`
  klappt es. Unter einer reinen `http://`-Adresse sperrt der Browser das Mikrofon.
- Auf dem iPhone fragt die Homescreen-App je nach iOS-Version bei jedem Start einmal
  nach der Mikrofon-Erlaubnis. Das ist eine Vorgabe von Apple, nicht von der App.
- Wochenscore: 50 Punkte Checklisten, 30 Quests, 20 Deadlines (−10 pro verpasster).
  Ab 70 Punkten zählt die Woche für die Streak.

## 4. Kurzbefehl "Notieren" (optional)

In der Kurzbefehle-App einen neuen Kurzbefehl anlegen:

1. **Text diktieren**: Sprache Deutsch, "Aufhören: Nach kurzer Pause"
2. **Inhalte von URL abrufen**
   - URL: `https://laptop.dein-netz.ts.net/api/capture`
   - Methode: POST
   - Header: `Authorization` = `Bearer DEIN_API_TOKEN`
   - Anforderungstext: JSON, Felder `text` = *Diktierter Text*, `source` = `shortcut`
3. **Wörterbuchwert abrufen**: Schlüssel `reply`
4. **Mitteilung anzeigen**: *Wörterbuchwert*

Kurzbefehl "Notieren" nennen. Dann auslösen per "Hey Siri, Notieren", über die
Action-Taste (Einstellungen, Action-Taste, Kurzbefehl) oder als Widget. Über
iCloud ist er auch auf dem iPad.

Beispiele zum Einsprechen:
- "ToDo: Holz für den Carport bestellen" (ohne KI, sofort)
- "Morgen um drei Berufsschule, und ich war heute 40 Minuten laufen" (zwei Aktionen)
- "Idee: Kurs über Abbund-Software für Azubis" (ohne KI)

## 5. Vermögen einpflegen

- **Einzeln:** Vermögen, "Position hinzufügen". Symbol im Yahoo-Format
  (`SAP.DE`, `IWDA.AS`, `AAPL`, `BTC-EUR`). Ohne Symbol einen festen Wert
  eintragen (Tagesgeld, Immobilie, Bausparvertrag).
- **CSV:** Spalten `portfolio;name;ticker;isin;quantity;entry_price;currency;asset_class;region;bought_at`

Kursquelle ist `yfinance`: kostenlos, aber inoffiziell, kann ausfallen oder
Verzögerungen haben. Fällt sie aus, zeigt die App den letzten bekannten Kurs.
Tauschen: nur `fetch_quote()` in `app/portfolio.py` ersetzen.

Vermögensdaten verlassen den Server nie. Sie werden nicht an die Claude API geschickt.

## 6. Umzug auf den eigenen Server

Empfehlung: kleiner VPS in Deutschland oder ein Mac mini zu Hause.

```bash
# auf dem Server, im Projektordner
cp .env.example .env    # ausfüllen, NEUEN Token erzeugen
docker compose up -d --build
tailscale serve --bg 8000
```

Daten vom Laptop übernehmen: `data/brain.db` per `scp` kopieren, bevor der Container
startet. Danach die URL im Kurzbefehl anpassen. Tägliche Sicherung:
`backup.sh` per cron (Anleitung in der Datei).

## Projektstruktur

```
app/
  main.py         API-Endpunkte
  classifier.py   Präfix-Regeln + Claude API, Aktionskatalog
  actions.py      Ausführen, protokollieren, rückgängig
  portfolio.py    Positionen, Kurs-Cache, Verteilungen, CSV-Import
  transcriber.py  Lokale Spracherkennung (Whisper)
  score.py        Wochenscore, Streak, XP
  schema.sql      Datenbankschema
  db.py, config.py
static/           Web-App (HTML, CSS, JS, Service Worker, Icons)
tests/            pytest, läuft ohne Internet und API-Key
CLAUDE.md         Regeln für die Weiterentwicklung mit Claude Code
```
