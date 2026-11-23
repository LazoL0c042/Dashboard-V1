# Investment-Tool („Kompass“) – Design

Stand: 2026-11-23 · Status: Entwurf zur Freigabe

## 1. Absicht

Ein privates Werkzeug, mit dem Peter und ein kleiner Kreis ausgewählter Freunde
Investment-Ideen gründlich durchdenken, entscheiden, speichern und später ehrlich
überprüfen. Es soll Denkfehler sichtbar machen, nicht Euphorie erzeugen.

Der Kern ist ein Lernkreislauf:
**Idee → Council diskutiert → Strategie entschieden und eingefroren → später gegen
MSCI World und eigenes Ziel ausgewertet → daraus lernen.**

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Vier Bereiche: **Pläne, Council, Recherche, Rechner**. Dazu ein Profil pro Nutzer.
- Council aus 5 Fachrollen + 3 Prüfern, kostenlos betrieben über Gratis-Kontingente
  verschiedener Modellanbieter.
- Jede Strategie wird mit vollständigem Council-Protokoll, Begründung und Kursen
  vom Entscheidungstag gespeichert und ist jederzeit neu auswertbar.
- Ehrliche Szenarien (Worst/Realistisch/Best) auf historischer Basis, optional nach
  deutschen Steuern.
- Produktübersicht je Kategorie mit Kennzahlen und Quellen.
- Langfristplan: welche Anlageklasse in welchem Lebensabschnitt, mit Vor- und Nachteilen.

**Nicht-Ziele**
- Keine Broker-Anbindung, keine Orders, kein schreibender Zugriff auf Konten.
- Kein öffentlicher Zugang, keine offene Registrierung.
- Keine lokalen Modelle (vorerst), keine kostenpflichtigen APIs.
- Keine Sprache/Whisper, keine Verbindung zu Werkbank oder „Jarvis“.
- Kein Vorab-Interview.

**Anti-Ziele** (Fehlschlag, auch wenn es technisch läuft)
- Zahlen ohne Quelle oder ohne Kennzeichnung als Schätzung.
- Scheinkonsens: Council einigt sich, weil Modelle gefällig sind, nicht weil Argumente
  widerlegt wurden.
- Rechner, der durch fehlende Steuern, Kosten oder Inflation zu gut aussieht.
- Auswertung, die nachträglich die Begründung umschreibt (Rückschaufehler).

## 3. Rahmenbedingungen

- **Hardware:** Peter hat nur iPad (M-Chip) und einen Laptop, der nicht dauerhaft läuft.
  → Betrieb auf **Oracle Cloud Always Free** (ARM, Ubuntu 24.04), Zugang nur über
  **Tailscale** (Gerät mit Freunden geteilt). Anleitung: `docs/oracle-server-anleitung.md`.
- **Kosten:** 0 €. Nur kostenlose Kontingente und kostenlose Datenquellen.
- **Nutzer:** wenige, eingeladen, „auf eigene Gefahr“. Sichtbarer Hinweis:
  keine Anlageberatung.
- **Genauigkeit:** echte Zahlen, so wenig Rundung wie möglich. Fehlende Werte werden
  geschätzt und sichtbar als **„geschätzt“** markiert.
- **Datenschutz:** Profil- und Strategiedaten gehen an Cloud-Modelle, deren Gratis-Stufen
  Eingaben teils zum Training nutzen. Jeder Nutzer sieht das beim ersten Login und
  bestätigt es. Exakte Zahlen werden gesendet (Peters Entscheidung).
- **Sprache:** UI und Code-Kommentare Deutsch.
- **Repo:** eigener Ordner `kompass/` in diesem Repo. `werkbank/` wird nicht verändert.

## 4. Ansätze

| Ansatz | Vorteil | Nachteil |
|---|---|---|
| **A) Eigene App, gleicher Stack wie Werkbank** (FastAPI, SQLite, Vanilla-JS-PWA) | Bewährt, läuft auf iPad als Homescreen-App, Mehrbenutzer einfach, kein Build-Schritt, Peter kennt die Struktur | Mehr Handarbeit im Frontend |
| B) Streamlit-App | Sehr schnell gebaut | Schwach auf dem iPad, Mehrbenutzer/Login umständlich, lange Council-Läufe blockieren die Oberfläche |
| C) Als Bereich in Werkbank | Teilt Server und Login | Von Peter verworfen: soll getrennt sein und für andere nutzbar |

**Gewählt: A.** (Peter hat die technische Umsetzung abgegeben; B scheitert an iPad und
Mehrbenutzer, C an Peters Vorgabe.)

## 5. Aufbau

### 5.1 Technik
- Python 3.12, FastAPI, SQLite (sqlite3, kein ORM), httpx, yfinance, pytest.
- Frontend: Vanilla JS, eine HTML-Datei + CSS, PWA, kein Build-Schritt.
- Lange Council-Läufe laufen als Hintergrundaufgabe; die Seite zeigt den Fortschritt
  Beitrag für Beitrag (Polling oder Server-Sent Events). Das iPad darf zwischendurch
  die App schließen, der Lauf geht weiter.
- Docker + docker-compose für den Server.

### 5.2 Nutzer und Zugang
- Login mit Benutzername + Passwort (Hash mit `hashlib.scrypt`), Sitzungs-Cookie.
- Rolle **Admin** (Peter): erstellt Einladungscodes, verwaltet Modell-Schlüssel und
  Rollen-Zuordnung, sieht Kontingent-Verbrauch.
- Alle Nutzerdaten sind per `user_id` getrennt. Kein Nutzer sieht Daten eines anderen.

### 5.3 Profil (statt Interview)
- Kein Vorab-Interview. Was ein Nutzer dem Council im Gespräch beantwortet
  (Alter, Horizont, Kapital, Sparrate, Ziel, Risikobereitschaft, Wissensstand,
  Einkommen, Rücklagen, Schulden …), schlägt die App als Profil-Fakt vor.
  Der Nutzer bestätigt mit einem Tipp; erst dann wird gespeichert.
- Jeder Fakt hat Wert, Datum, Herkunft (Sitzung) und Status *angegeben* / *geschätzt*.
- Profil jederzeit einseh- und änderbar. Änderungen werden versioniert, damit eine
  gespeicherte Strategie immer auf den Profilstand vom Entscheidungstag verweist.

### 5.4 Modell-Schicht (kostenlos, mehrere Anbieter)
- Ein Modul `llm.py` spricht OpenAI-kompatible Schnittstellen an. Startkandidaten:
  **Groq, Mistral, OpenRouter (:free-Modelle), Cerebras, Google Gemini**.
- Admin ordnet jeder Rolle Anbieter + Modell zu, mit Ersatzliste. Bei Limit (HTTP 429)
  oder Ausfall springt die Rolle auf den nächsten Eintrag; im Protokoll steht, welches
  Modell tatsächlich geantwortet hat.
- **Vielfalt ist Pflicht:** Kritiker und Rendite-Optimierer laufen auf verschiedenen
  Modellfamilien; die App warnt, wenn alle 5 Mitglieder auf derselben Familie landen.
- Tageszähler pro Anbieter; vor einem Lauf schätzt die App den Bedarf und warnt, wenn
  das Kontingent knapp wird.
- Schlüssel nur in `.env` auf dem Server, nie im Browser, nie geloggt.

### 5.5 Council

**Phase 0 – Verstehen.** Ein Moderator fasst die Idee zusammen und stellt Rückfragen,
bis Ziel, Betrag, Horizont und Risiko klar sind (aus Profil vorbefüllt). Neue Antworten
→ Profil-Vorschläge (5.3). Nutzer gibt „Diskussion starten“ frei.

**Phase 1 – Fachrunde (5 Mitglieder):**
Geopolitik-Experte · Finanz-Experte · Geschichts-Experte · Absoluter Kritiker ·
Rendite-Optimierer.

- Jede Runde liefert jedes Mitglied strukturiert (JSON):
  Position, **Wahrscheinlichkeit in %** dass die Idee ihr Ziel erreicht, Kernargumente,
  stärkster Einwand, was sich seit der letzten Runde geändert hat, offene Datenfragen.
- Mitglieder sehen alle Beiträge der Vorrunde.
- **Einigkeit** = Spanne der Wahrscheinlichkeiten ≤ 15 Prozentpunkte **und** der
  Kritiker markiert seinen stärksten Einwand ausdrücklich als widerlegt (mit Begründung).
- **Höchstens 4 Runden.** Ohne Einigkeit: Ergebnis „Dissens“, Positionen werden offen
  nebeneinander gezeigt, keine erzwungene Empfehlung.
- Ergebnis: Bewertung (gut/mittel/schlecht), Wahrscheinlichkeit, empfohlene Richtung,
  **Liste sinnvoller Optionen in der gewählten Kategorie** (keine Einzelprodukte),
  und ein **Langfristplan** (Lebensphasen bis Zielalter: Anlageklasse, Anteil,
  Vor-/Nachteile, was der Nutzer tun kann, um das Ziel zu erreichen).

**Phase 2 – Prüfrunde (3 Prüfer), nur nach Einigkeit:**
- **Statistiker:** prüft die Wahrscheinlichkeit gegen historische Basisraten.
- **Pre-Mortem:** „Es ist Zieljahr, die Strategie ist gescheitert – warum?“ Letzte Schwachstellen.
- **Produkt-Analyst:** die besten konkreten Produkte für die Strategie, mit Kennzahlen
  und Quelle (nutzt Recherche + Produktdaten). Der Nutzer wählt selbst.

**Regeln für alle Rollen:** Jede Zahl mit Quelle + Datum oder als „geschätzt“
markiert. Aktuelle Ereignisse nur aus der Recherche, nicht aus dem Modellgedächtnis.

### 5.6 Pläne (gespeicherte Strategien)
Beim Speichern wird eingefroren (nie mehr änderbar, nur ergänzbar):
- Idee im Wortlaut, vollständiges Council-Protokoll (jede Runde, jedes Modell)
- **Was** (Kategorie, gewählte Produkte/ISINs), **wofür** (Ziel, Zielbetrag),
  **wie lange** (Horizont), **warum** (Thesen), Betrag/Sparrate
- Prüfkriterien: woran man erkennt, ob die These stimmt
- Profilstand (Version), Kurse aller Produkte und des **iShares Core MSCI World
  (IE00B4L5Y983)** am Entscheidungstag

**Auswertung auf Abruf:**
1. **Markt geschlagen?** Gleiche Ein- und Auszahlungen hypothetisch in den MSCI World
   ETF gesteckt, verglichen.
2. **Ziel erreicht?** (bzw. auf Kurs, anteilig nach verstrichener Zeit)
3. **Im Plus?**
Plus optional: Council-Nachbesprechung „Was haben wir falsch oder richtig eingeschätzt?“
– wird als Nachtrag gespeichert, das Original bleibt unverändert.

Übersicht aller Pläne: Trefferquote je Kriterium, damit sichtbar wird, welche Art Ideen
bei diesem Nutzer funktioniert.

### 5.7 Recherche
- Nur auf Abruf: freie Frage, **Briefing** (z. B. „Geopolitik diese Woche“,
  „neue Gesetze mit Wirkung auf Anleger“) oder **Analyse** zu einem Thema.
- Quellen (nur vertrauenswürdige, kostenlos):
  - Deutsche Gesetze: **Bundestag DIP-API**, Bundesgesetzblatt, BMF, BaFin
  - Wirtschaft/Geld: **EZB Data Portal**, Bundesbank, Destatis, Eurostat
  - Nachrichten: RSS von tagesschau.de, Deutsche Welle, Reuters, Bundesregierung, EZB
  - Websuche über ein Modell mit Suchfunktion, sofern im Gratis-Kontingent verfügbar
- Jedes Ergebnis speichert Quelle-URL und Abrufzeit. Recherchen sind im Council zitierbar.

### 5.8 Produkte
- Kategorien: ETFs, Aktien, Edelmetalle (physisch, ETC, Minen), Krypto (ETP/direkt),
  Anleihen, Tagesgeld/Geldmarkt, Immobilien (REITs, nur auf Nachfrage), Sonstiges.
- Kennzahlen je Produkt (je nach Art): TER/laufende Kosten, Fondsvolumen, Auflage,
  Replikation, Ertragsverwendung, Domizil, **Top-10-Positionen**, Länder/Sektoren,
  Tracking Difference, Rendite 1/3/5 J., Volatilität, max. Verlust.
- Kurse und Renditen live über yfinance. Stammdaten (TER, Top-10 …) aus Recherche mit
  Quelle + Datum, zwischengespeichert, vom Admin korrigierbar.
- Bewertung der Kennzahlen mit offengelegten Regeln (z. B. TER ≤ 0,20 % = gut), damit
  nachvollziehbar ist, warum ein Produkt vorne liegt.
- Startliste zum Selbst-Recherchieren: Anhang A.

### 5.9 Rechner
- Eingaben: Startkapital, monatliche Sparrate, optionale jährliche Erhöhung, Jahre,
  Anlageklasse (oder eigener Mix).
- **Szenarien aus echten historischen Daten:** rollierende Zeiträume gleicher Länge
  → Worst = 5. Perzentil, Realistisch = Median, Best = 95. Perzentil.
  Immer auch inflationsbereinigt (Kaufkraft heute). Kosten (TER) werden abgezogen.
- Historische Reihen liegen als CSV mit Quellenangabe im Repo; Zahlen werden **nicht
  aus dem Gedächtnis** eingetragen. Ist eine Reihe zu kurz, zeigt der Rechner das an.
- **Zusatz „nach deutschen Steuern“** (vereinfachtes Modell, so beschriftet):
  Abgeltungsteuer 25 % + Soli (26,375 %), optional Kirchensteuer, Sparerpauschbetrag
  (1.000 € / 2.000 € zusammen), Teilfreistellung (Aktien-ETF 30 %, Misch 15 %),
  Vorabpauschale mit amtlichem Basiszins des Jahres, Gold physisch/Xetra-Gold und
  Krypto steuerfrei nach 1 Jahr Haltedauer, Zinsen jährlich besteuert.
  Steuerwerte stehen in einer Konfigurationsdatei mit Quelle und Gültigkeitsjahr.

### 5.10 Design
- Startseite: vier Kacheln **Pläne · Council · Recherche · Rechner**, sonst nichts.
- Pastellfarben, viel Weißraum, eine Schrift, nur die nötigsten Zahlen; Details
  aufklappbar. Für iPad im Hoch- und Querformat, funktioniert auch am iPhone.
- „Geschätzt“ und „Quelle“ als kleine, einheitliche Marker an jeder Zahl.

```
┌──────────── Kompass ────────────┐
│  ┌────────┐  ┌────────┐         │
│  │ Pläne  │  │Council │         │
│  │ 4 aktiv│  │        │         │
│  └────────┘  └────────┘         │
│  ┌────────┐  ┌────────┐         │
│  │Recherche│ │Rechner │         │
│  └────────┘  └────────┘         │
└─────────────────────────────────┘
```

## 6. Harte Regeln (kommen in `kompass/CLAUDE.md`)
1. Kein Code, der Orders platziert oder schreibend auf Broker-Konten zugreift.
2. Gespeicherte Strategien und Council-Protokolle werden nie verändert, nur ergänzt.
3. Jede angezeigte Zahl hat Quelle + Datum oder ist als „geschätzt“ markiert.
4. Nutzerdaten strikt getrennt; kein Nutzer sieht Daten anderer.
5. Geheimnisse nur in `.env`, nie loggen, nie committen.
6. Nur kostenlose Dienste. Neue Anbieter nur mit Rückfrage.
7. `pytest -q` grün, bevor etwas als fertig gilt.
8. Kein öffentlicher Port, nur Tailscale.

## 7. Dem Bauenden überlassen
- Genaue Prompts der Rollen, JSON-Schemas, Datenbankschema.
- Welche Gratis-Modelle anfangs welcher Rolle zugeordnet werden (nach aktueller Prüfung
  der Bedingungen und Limits).
- Konkrete historische Datenquellen pro Anlageklasse (MSCI-Indexhistorie, Gold, Anleihen,
  Inflation), solange frei nutzbar und mit Quelle hinterlegt.
- Reihenfolge der Umsetzung (Vorschlag: Login + Rechner → Council → Pläne + Auswertung →
  Recherche → Produkte).

## 8. Offene Risiken
- **Gratis-Kontingente ändern sich** oder verschwinden. Bei Google Gemini war die
  kostenlose Stufe zeitweise für Nutzer im EWR ausgeschlossen – beim Bau prüfen.
- Ein voller Council-Lauf (8 Rollen, bis zu 4 Runden, Rückfragen) braucht ca. 30–50
  Modellaufrufe. Mehrere Nutzer am selben Tag teilen sich die Limits.
- Gratis-Modelle sind schwächer als bezahlte; die Diskussion wird gut, aber nicht
  auf Top-Niveau sein.
- Produkt-Stammdaten (TER, Top-10) aus Websuche können veralten; deshalb Datum sichtbar.

---

## Anhang A – ETF- und Produkt-Startliste zum Selbst-Recherchieren

ISINs zum Nachschlagen. **Kennzahlen bewusst weggelassen**: aktuelle Werte (TER,
Volumen, Top-10) immer live auf den Quellen unten prüfen.

| Bereich | Produkt | ISIN |
|---|---|---|
| Welt (Industrieländer) | iShares Core MSCI World – **Vergleichswert** | IE00B4L5Y983 |
| Welt (Industrieländer) | Xtrackers MSCI World 1C | IE00BJ0KDQ92 |
| Welt inkl. Schwellenländer | Vanguard FTSE All-World (thesaurierend) | IE00BK5BQT80 |
| Welt inkl. Small Caps | SPDR MSCI ACWI IMI | IE00B3YLTY66 |
| Schwellenländer | iShares Core MSCI EM IMI | IE00BKM4GZ66 |
| USA | iShares Core S&P 500 | IE00B5BMR087 |
| Gold (Wertpapier, physisch hinterlegt) | Xetra-Gold | DE000A0S9GB0 |
| Gold (Wertpapier, physisch hinterlegt) | EUWAX Gold II | DE000EWG2LD7 |
| Goldminen | iShares Gold Producers | IE00B6R52036 |
| Staatsanleihen Euro | iShares Core Euro Government Bond | IE00B4WXJJ64 |
| Geldmarkt (Tagesgeld-Ersatz) | Xtrackers II EUR Overnight Rate Swap | LU0290358497 |

**Vertrauenswürdige Quellen**
- Anbieterseiten (Factsheet, Top-10, TER, KID): ishares.com, etf.dws.com (Xtrackers),
  vanguard.de, ssga.com (SPDR), amundietf.de, invesco.com
- Vergleich/Kennzahlen: justetf.com, morningstar.de, extraetf.com
- Unabhängige Einordnung: finanztip.de, test.de (Stiftung Warentest/Finanztest)
- Börsendaten: boerse-frankfurt.de, xetra.com
- Aufsicht/Steuern: bafin.de, bundesfinanzministerium.de
- Gold physisch: Händlerpreise immer mit Spread (Kauf/Verkauf) vergleichen, z. B. auf
  gold.de; Referenzpreis LBMA
