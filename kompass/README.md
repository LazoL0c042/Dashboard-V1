# Kompass – Investment-Entscheidungen durchdenken, speichern, ehrlich prüfen

Private Web-App für dich und eingeladene Freunde. Läuft auf deinem Oracle-Server,
erreichbar nur über Tailscale, bedienbar auf iPad und iPhone wie eine App.

| Bereich | Was es tut |
|---|---|
| **Council** | Alle Rollen bekommen die aktuellen Marktindikatoren und die ähnlichsten historischen Fälle als Material; der Geschichts-Experte vergleicht ausdrücklich damals mit heute. Auf jeder Ereignisseite: „Council: mit heute vergleichen“. |
| **Council (Ablauf)** | Moderator klärt deine Idee mit Rückfragen. Dann diskutieren 5 Experten (Geopolitik, Finanzen, Geschichte, Kritiker, Rendite) bis zu 4 Runden. Konsens nur, wenn die Wahrscheinlichkeiten höchstens 15 Punkte auseinanderliegen **und** der Kritiker seinen Einwand als widerlegt markiert. Danach prüfen Statistiker, Pre-Mortem und Produkt-Analyst. Ergebnis: Bewertung, Richtung, Optionen, Langfristplan nach Lebensphasen, Produkte zur eigenen Auswahl. |
| **Pläne → Portfolios** | Beliebig viele hypothetische Depots pro Konto (Start in der Vergangenheit möglich). Rückrechnung mit echten Kursen, Vergleich mit dem MSCI World bei gleichen Einzahlungen. Detailansicht mit interaktivem Wertverlauf (€ oder %, 1J/3J/5J/Max), Kennzahlen (Rendite p.a. zeitgewichtet, max. Verlust, Schwankung), Positionen mit Kursverlauf, Aufteilung nach Position und Anlageklasse. |
| **Portfolio bauen (Schritt für Schritt)** | 1. Gewichtung der Anlageklassen (mit Vorlagen) · 2. Anlagen innerhalb jeder Klasse – mehrere ETFs/Anlagen je Klasse · 3. Risiko mit Tauschvorschlägen (sicherer bzw. spekulativer) und erwarteter Spanne · 4. konkrete Produkte, bewertet nach Kosten, Größe, Schwankung, Domizil, Risiko-Passung · 5. Bewertung nach allgemeinen Faustregeln (Notgroschen, Streuung, Aktienquote zum Horizont, Spekulations-/Krypto-Grenzen, Kosten, USA-Klumpen). Anteile können nie über 100 % gehen. |
| **Portfolio-Council & Entwurf** | „Mit dem Council bauen“: Gespräch mit Portfolio-Berater und Kritiker – Vorschläge für Produkte und Gewichtungen, Bewertung jeder Gewichtung, Rückfragen, auf Wunsch Suche nach aktuellen Quellen. Vorschläge landen per Tipp im **Entwurf** (Warenkorb): Gewichte per Regler, Risikobereitschaft 1–5, erwartete Spanne (Monte-Carlo aus Annahmen), Klumpen- und Risikohinweise, dann „Als Portfolio speichern“. |
| **Glossar** | Alle Anlageklassen und Unterklassen als Karten (Aktien-ETFs, Branchen-ETFs, Anleihen, Tagesgeld, Gold, Gold gehebelt, Silber, Öl, Immobilien direkt/REITs/offene Fonds/Crowd, Bitcoin, Memecoins, Stablecoins, Krypto-ETPs, Hebelprodukte, Private Equity, Start-ups): kurze Beschreibung, Risiko, Kursverlauf, lange Historie, Pro/Contra, Besonderheiten, Steuern, „+ Entwurf“. Daten: `data/glossar.json`. |
| **Historische Ereignisse** (Glossar) | 13 Extremereignisse von der Hyperinflation 1923 über 1929, Ölkrise, Volcker, Dotcom, Finanzkrise bis Corona, Zinswende und Krypto-Winter: Ursachen, Verlauf, Folgen je Anlageklasse, Lehren. Kennzahlen (Verlust, Dauer, Erholung, Shiller-KGV, Zins, Inflation, Gold) berechnet aus den Rohdaten (`scripts/build_ereignisse.py`). Dazu die **Marktlage heute** (FRED, EZB, CNN Fear & Greed, multpl.com) und „Am ähnlichsten zu heute“. |
| **Quellen** | 25 vertrauenswürdige Finanzquellen (`data/medien.json`). Die Nachrichtensuche in Recherche, Council und Portfolio-Council nimmt nur Treffer von diesen Seiten. |
| **Szenarien** | Knopf „Szenario anwenden“ bei Portfolios, Entscheidungen und Council-Ergebnissen: KI-Blase, Zinsen hoch/runter, Ölschock, Rezession, Stagflation, Dollar-Schwäche, Eskalation oder ein eigenes Szenario (KI übersetzt es in Annahmen). Ergebnis: Worst/Realistisch/Best mit Verlauf über die Zeit, Beitrag je Position, Auslöser, Phasen, Begründung je Anlageklasse, historisches Vorbild und auf Wunsch eine KI-Begründung für genau diese Strategie. Annahmen: `data/szenarien.json`. |
| **Pläne → Entscheidungen** | Strategie wird mit komplettem Council-Protokoll, Profil und Kursen vom Entscheidungstag **eingefroren**. Auswertung jederzeit: Markt (MSCI World, gleiche Einzahlungen) geschlagen? Ziel erreicht/auf Kurs? Im Plus? Dazu Nachbesprechung mit dem Council und Trefferquote über alle Pläne. |
| **Recherche** | Frage, Briefing oder Analyse auf Abruf. Material nur aus tagesschau, Deutsche Welle, EZB (Presse + Datenportal) und Bundestag DIP. Jede Aussage mit Quellennummer. Dazu **Produkte**: Katalog mit ISIN, Live-Renditen, Schwankung, max. Verlust, TER/Top-10 mit Quelle und offengelegte Bewertungsregeln. |
| **Rechner** | Beliebig viele Anlagen aus dem Glossar (Regler, zusammen max. 100 %). Zwei Rechnungen: alle Anlagen mit Annahmen (Monte-Carlo) und historischer Test für Anlagen mit langer Datenreihe. Steuern je Anlage nach passender Regel. Alt: Startkapital, Sparrate, Jahre, Mix. Worst/Realistisch/Best aus echten historischen Zeiträumen (5. Perzentil, Median, 95. Perzentil), inflationsbereinigt. Optional nach deutschen Steuern. |
| **Profil** | Entsteht aus den Council-Gesprächen; nur bestätigte Angaben zählen. |

Alles läuft über **kostenlose** Modell-Zugänge. Kein Vorab-Interview.

---

## 1. Auf dem Oracle-Server starten

Voraussetzung: Server eingerichtet nach `../docs/oracle-server-anleitung.md` (Docker + Tailscale).

```bash
git clone https://github.com/LazoL0c042/Dashboard-V1.git
cd Dashboard-V1/kompass
cp .env.example .env
nano .env            # Schlüssel eintragen (Abschnitt 2), COOKIE_SECURE=true lassen
docker compose up -d --build
docker compose logs -f   # Strg+C zum Verlassen
```

Nach außen freigeben (nur ins Tailscale-Netz):

```bash
sudo tailscale serve --bg --https=8443 http://127.0.0.1:8001
```

Dann auf dem iPad in Safari: `https://<servername>.<dein-netz>.ts.net:8443`
→ Teilen → **Zum Home-Bildschirm**. Beim ersten Öffnen legst du dein Admin-Konto an.

> Werkbank kann parallel auf Port 443 laufen (`tailscale serve --bg --https=443 http://127.0.0.1:8000`).
> **Achtung:** Wenn du den Server mit Freunden teilst, sehen sie über Tailscale alle freigegebenen
> Ports, also auch den Login der Werkbank. Beschränke geteilte Nutzer in den Tailscale-
> Zugriffsregeln (Access Controls) auf Port 8443 – oder lass die Werkbank woanders laufen.

Aktualisieren: `git pull && docker compose up -d --build`

Backup täglich (`crontab -e`): `15 3 * * * /home/ubuntu/Dashboard-V1/kompass/backup.sh`
(braucht `sudo apt install sqlite3`).

## 2. Kostenlose Modell-Zugänge

Mindestens zwei Anbieter eintragen, besser alle fünf – dann laufen die Rollen auf
verschiedenen Modellfamilien und ein Limit bei einem Anbieter stoppt den Council nicht.

| Anbieter | Schlüssel holen | Hinweis |
|---|---|---|
| Groq | console.groq.com/keys | großzügige Tageslimits |
| Mistral | console.mistral.ai → Plan „Experiment“ | Telefonnummer nötig, Eingaben dürfen zum Training genutzt werden |
| OpenRouter | openrouter.ai/keys | nur Modelle mit `:free`; mit 10 $ einmaligem Guthaben deutlich höhere Gratis-Limits |
| Cerebras | cloud.cerebras.ai | schnell |
| Google Gemini | aistudio.google.com/apikey | **Gratis-Stufe in der EU vorher prüfen** – war zeitweise ausgeschlossen |

Bundestag DIP: Den öffentlichen API-Schlüssel von dip.bundestag.de (Hilfe → API) als
`DIP_API_KEY` eintragen. Ohne ihn fehlen nur die Gesetzgebungsvorgänge.

Modellnamen ändern sich bei den Anbietern. Wenn eine Rolle immer auf das Ersatzmodell
springt: **Einstellungen → Rollen → Modelle** anpassen. Dort siehst du auch den Tagesverbrauch.

Ein voller Council-Lauf braucht etwa 30–50 Modellaufrufe.

## 3. Freunde einladen

1. Tailscale-Verwaltung → Gerät `server` → **Share** → Link an den Freund.
2. Kompass → **Einstellungen** → **Einladungscode erzeugen** → Code an den Freund.
3. Der Freund öffnet die Adresse, tippt „Ich habe einen Einladungscode“ und legt sein Konto an.

Jeder sieht nur seine eigenen Daten. Beim ersten Login bestätigt jeder den Hinweis
(keine Anlageberatung, Daten gehen an kostenlose Modell-Anbieter).

## 4. Lokal entwickeln

```bash
cd kompass
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -q
COOKIE_SECURE=false uvicorn app.main:app --port 8001
```

Historische Daten neu bauen: `python scripts/build_history.py --download`
(Quellen und Grenzen: `data/history/QUELLEN.md`).

## 5. Grenzen – ehrlich

- **Gratis-Modelle** sind schwächer als bezahlte und haben Tageslimits.
- **Rechner:** Historie ist US-Aktien (Shiller) als Ersatz für „Welt“, in USD-Logik. Die USA
  waren historisch überdurchschnittlich – das Ergebnis ist eher zu optimistisch.
  Tagesgeld, Krypto und Immobilien nur mit deiner eigenen Annahme.
- **Steuern** vereinfacht (Steuerzahlungen mindern den Zinseszins im Modell nicht).
  Basiszins für die Vorabpauschale in `data/steuer_de.json` jährlich nachtragen.
- **Kurse** über yfinance (inoffiziell). Stammdaten wie TER/Top-10 von Yahoo sind für
  europäische ETFs oft lückenhaft → als Admin mit Quelle nachtragen.
- **Ticker** im Katalog vor dem ersten Plan einmal öffnen und prüfen, ob ein Kurs kommt.
