# Holzmappe Peters Zimmerei – Fantasy-Reise durch die Holzwelten

Stand: 2026-11-06 · Status: Entwurf zur Abnahme

## 1. Ziel

Die bestehende Holzmappe (PDF, 8 Holzarten) wird zu einer interaktiven 3D-Reise
im Stil eines Fantasy-Buchs. Am Ende der Reise liegt die eigentliche Holzmappe,
die geöffnet und als sachliche, druckfertige Arbeitsmappe genutzt wird.

- **Zweck:** Eigener Lernerfolg. Inhalt muss fachlich korrekt und abgabefertig
  sein (Quellen, Werte, Korrekturen), auch wenn er nicht abgegeben wird.
- **Nutzung:** Tablet und PC. Wird nicht veröffentlicht.
- **Erfolgskriterien:**
  1. Jedes der 8 Hölzer hat eine eigene, unverwechselbare 3D-Szene.
  2. Alle Fachwerte sind recherchiert, geprüft, mit Quelle belegt; Fehler der
     Ursprungsfassung sind korrigiert und in einer Korrekturliste aufgeführt.
  3. Details stören die Szene nicht: Werte erscheinen erst nach Antippen der Holztafel.
  4. Die Mappe am Ende lässt sich als saubere A4-Seiten drucken.
  5. Läuft flüssig auf einem aktuellen Tablet.

## 2. Getroffene Entscheidungen

| Thema | Entscheidung |
|---|---|
| Medium | Interaktive Website, ein Artefakt (claude.ai), Quelle im Repo unter `holzmappe/` |
| Darstellung Welten | Echte 3D-Szenen (three.js, WebGL), sehr detailliert, „lush & dreamy“, mehrere Tiefenebenen |
| Stil | Kupferstich: 3D-Szenen mit Stich-Nachbearbeitung (Tuschekonturen + Schraffur in Schatten + Papierkorn); Buchseiten, Logo, Mappe als klassischer Kupferstich |
| Text | Keine Fantasy im Text, nur sachliche Sprache. Fantasy nur im Design. Reich-Namen sind Gestaltung, keine Prosa |
| Navigation | Zwei Varianten zum Vergleich: **Buch** (Umblättern, Kapitel je Holz, Detailseite nach der Szene) und **Weltkarte** (8 Reiche, Holztafel antippen → Details) |
| Details | Werte auf Holztafel in der Szene (Karte) bzw. auf der Folgeseite (Buch); in der Szene nur dezent und bildlich |
| Ton | Generierter Umgebungsklang je Reich, per Knopf zuschaltbar, standardmäßig aus |
| Preis | Nur Hauptwert €/m³ Schnittholz (Richtwert) |
| Bilder | Originalfotos aus dem PDF in der Mappe am Ende; alles andere (Szenen, Werkstücke, Logo, Ornamente) selbst erstellt |
| Fachliche Fehler | Werden korrigiert, fehlende Werte ergänzt, mit Quelle |
| Logo | Markenname „Peters Zimmerei“ bleibt, Logo neu im Kupferstich-Stil |

## 3. Ablauf

1. **Prolog:** Geschlossenes, ledergebundenes Buch im 3D-Raum, neues Siegel
   „Peters Zimmerei“. Antippen → Buch öffnet sich, Kamera fährt hinein.
2. **Reiseart wählen:** „Buch“ oder „Weltkarte“. Umschaltbar jederzeit über das Menü.
3. **8 Kapitel** in fester Reihenfolge: Nadelhölzer (Kiefer, Fichte, Tanne,
   Lärche, Douglasie), dann Laubhölzer (Eiche, Robinie, Buche).
4. **Epilog:** Werkstatt-Szene, auf der Werkbank liegt die Holzmappe.
   Antippen → Mappe öffnet sich.
5. **Die Mappe:** sachliche Arbeitsmappe (Abschnitt 8).

### Variante Buch
- Doppelseite pro Kapitel-Schritt. Seite 1: 3D-Szene, eingefasst in Kupferstich-Rahmen
  mit Kapitelüberschrift (Holzname, botanischer Name). Umblättern → Seite 2: Detailseite
  (Werte, Eigenschaften, kleine Stich-Grafiken zu Schwund/Härte/Einsatz).
- Umblättern per Wischen (Tablet), Klick auf Seitenrand oder Pfeiltasten. Seite wölbt
  sich in 3D mit Schattenverlauf. Während des Blätterns wird die laufende Szene als
  Standbild auf die Seite gelegt.
- Inhaltsverzeichnis-Seite am Anfang mit Sprung zu jedem Kapitel.

### Variante Weltkarte
- Gestochene Karte als 3D-Relief: 8 Reiche, Nadel- und Laubholz als zwei Landstriche.
  Kamera schwebt darüber. Antippen eines Reichs → Kameraflug in die Szene.
- In der Szene: Holztafel antippen → Tafel wird vergrößert (Overlay) mit allen Werten.
- Zurück zur Karte über Kompass-Knopf. Besuchte Reiche werden auf der Karte markiert.
- Nach allen 8 Reichen (oder jederzeit über die Karte) erscheint die Werkstatt.

## 4. Szenenaufbau (gilt für jedes Kapitel)

Jede Szene ist eine 3D-Welt mit mindestens 4 Tiefenebenen:

1. **Himmel/Licht:** Farbverlauf, Sonne/Mond, Lichtstrahlen (God Rays), Wolken.
2. **Ferne:** Landschaftssilhouette (Hügel, Berge, Wald) im Nebel, Tiefenunschärfe.
3. **Hauptebene:** Der Baum als Hauptfigur in artgerechter Wuchsform, prozedural
   modelliert (Stamm mit Rinde, Äste, Nadeln/Blätter instanziert, Früchte/Zapfen).
4. **Mittelgrund:** 1–3 Werkstücke, in die Landschaft eingebunden.
5. **Vordergrund:** Gräser, Farne, Steine, Stammscheibe mit Jahrringen.
6. **Partikel:** je Reich (Harzfunken, Nebelschwaden, Blätter, Pollen, Glühwürmchen).

**Kamera:** Langsamer Einflug beim Betreten, danach leichte Parallaxe nach
Maus/Neigung des Tablets (begrenzt), sanftes Atmen.

**Render-Pipeline:** physikalisch basierte Materialien, ACES-Tonemapping,
Nebel, weiche Schatten, Bloom, Tiefenunschärfe, Stich-Effekt (Konturen aus
Tiefe/Normalen, Schraffur nach Helligkeit, Papierkorn, Sepia-Tinte gemischt mit
Reichsfarbe). Effektstärke je Reich einstellbar.

### Eigenschaften in der Szene (bildlich, nebensächlich)

| Eigenschaft | Darstellung |
|---|---|
| Harz | Leuchtende Harztropfen am Stamm; Menge nach Harzgehalt der Art (Tanne und Laubhölzer: keine) |
| Schwund | Stammscheibe im Vordergrund mit Schwindrissen; Rissbild nach tangential/radial-Verhältnis |
| Arbeiten | Ein Brett nahe der Stammscheibe verzieht sich langsam (Schüsselung); Stärke nach differentiellem Schwindmaß / Stehvermögen |
| Trocknung | Kleiner Stapel mit Stapellatten neben dem Brett; Risse/Verfärbung je nach Trocknungsverhalten |
| Härte | Messingplatte mit Kugeleindruck; Eindruckgröße nach Brinell-Härte |
| Einsatz | Gestochene Wappen an der Holztafel: innen, außen, tragend, dekorativ (aktiv/inaktiv) |

### Holztafel
3D-Holzschild im Bild, im Holz der jeweiligen Art. Antippen (Raycast) → Overlay
mit großer Tafel, die alle Werte aus Abschnitt 6 zeigt, jeweils mit Kurzerklärung.
Im Buch erscheint derselbe Inhalt auf der Detailseite.

## 5. Die acht Reiche

| Holz | Reich | Licht/Farbe | Baum (Besonderheit) | Werkstücke |
|---|---|---|---|---|
| Kiefer | Das Bernsteinreich | Bernstein, Abendsonne | Schirmkrone, rotbraune „Spiegelrinde“ oben, märkische Sandheide | Dachstuhl, Fensterrahmen |
| Fichte | Die Nebelsäulen der Riesen | Blaugrauer Nebel, Morgenlicht | Spitzer Kegel, hängende Zapfen, Bergwald | Brettschichtholz-Träger, Geigendecke |
| Tanne | Der Silberne Hain | Silbernes Mondlicht | Stehende Zapfen, flache „Storchennest“-Krone im Alter, silbergraue Rinde | Möbel (Schrank), Wandverkleidung |
| Lärche | Das Goldene Herbstreich | Herbstgold | Lichte Krone, goldene Nadeln, Nadelfall | Terrasse, Fassade, Steg ins Wasser |
| Douglasie | Die Wanderin aus dem Westen | Abendrot | Sehr hoher Stamm, Zapfen mit dreizipfligen Deckschuppen | Fassade, Fenster |
| Eiche | Der Thron der Alten | Bronze, Tiefgrün | Breite knorrige Krone, Eicheln, Weide | Fass, Fachwerk, Parkett |
| Robinie | Die Dornenfestung | Oliv, Dornen | Tief gefurchte Rinde, Dornen, weiße Blütentrauben, Hülsen | Spielplatzgerät, Zaunpfosten |
| Buche | Die Hallen der Waldmutter | Kupfer; zum Außenbereich hin Fäulnis | Glatte graue Rinde, Hallenwald, Bucheckern | Bugholzstuhl, Werkzeugstiel |

Die Reich-Namen erscheinen nur als Gestaltungselement (Karte, Kapitelkopf),
nicht in Fließtexten.

## 6. Fachinhalt

### Felder je Holzart
- Deutscher, botanischer, englischer Name; Kurzzeichen DIN EN 13556
- Nadel-/Laubholz; heimisch oder eingebürgert (mit Herkunft)
- Rohdichte (lufttrocken, Mittelwert und Spanne) in g/cm³
- Brinell-Härte quer und längs zur Faser in N/mm²
- Schwindmaße radial, tangential, (ggf. längs), volumetrisch in %
- Differentielles Schwindmaß in %/% radial und tangential
- Stehvermögen / Arbeiten
- Harz: Harzkanäle ja/nein, Harzgehalt, Folgen (Verkleben, Ausbluten, Oberfläche)
- Trocknung: Verhalten, Neigung zu Rissen/Verformung/Verfärbung, Hinweise
- Festigkeit: Biegefestigkeit, Druckfestigkeit längs, E-Modul (Mittelwerte), bei
  Bauholz übliche Festigkeitsklasse
- Dauerhaftigkeitsklasse Kernholz nach DIN EN 350; Gebrauchsklassen nach DIN EN 335
- Aussehen / Maserung
- Einsatzbereiche: innen, außen, tragend, dekorativ (je Ja/Nein/Bedingt + Begründung)
- Typische Verwendung
- Bearbeitung (Hobeln, Verleimen, Oberfläche, Korrosion bei Gerbstoff mit Eisen)
- Preis: €/m³ Schnittholz (Richtwert, Stand 2026)

### Quellen
Bevorzugt Fachquellen, je Wert eine Quelle angegeben. Kandidaten: Wagenführ
„Holzatlas“, Informationsdienst Holz, DIN EN 350, DIN 68364, Sell „Eigenschaften
und Kenngrößen von Holzarten“, holzvomfach.de, Thünen-Institut, materialarchiv.ch.
Werte, die zwischen Quellen stark streuen, werden als Spanne angegeben.

### Bereits bekannte Korrekturen
- Robinie: nicht heimisch, sondern aus Nordamerika eingebürgert. Aussage
  „härtestes heimisches Holz“ prüfen und richtigstellen.
- Douglasie: nicht heimisch, aus Nordamerika (eingebürgert seit 19. Jh.).
- Lärche: „härtestes heimisches Nadelholz“ prüfen (Eibe).
- Tanne/Fichte: Resonanzholz vor allem Fichte; Tanne-Aussage präzisieren.
- Fehlende Brinell-Werte ergänzen (Tanne, Lärche, Douglasie, Robinie, Buche).
- Alle übrigen Angaben werden ebenfalls geprüft; Funde kommen in die Korrekturliste.

## 7. Logo

Neues Siegel im Kupferstich-Stil: Rundsiegel mit Schriftzug „Peters Zimmerei“,
Motiv aus Zimmermannswerkzeug (Breitbeil, Winkel) und Jahrringen, Schraffur-Füllung.
Als SVG; erscheint auf Buchdeckel, Mappe, Kopfzeilen und Druckseiten.

## 8. Die Mappe (Abschluss)

- Gestaltung: Papier, Kupferstich-Rahmen, Logo, ruhig und sachlich.
- Inhalt:
  1. Deckblatt (wie Ursprungsfassung, neu gestaltet)
  2. Inhaltsverzeichnis
  3. Je Holzart ein Steckbrief mit den 3 Originalfotos (Baum, Holz, Frucht) und allen
     Feldern aus Abschnitt 6
  4. Vergleichstabelle aller 8 Hölzer (Rohdichte, Brinell, Schwindmaße,
     Dauerhaftigkeit, Einsatz, Preis), dazu Balkendiagramm Härte und Dichte
  5. Fachbegriffe (Brinell-Härte, Schwindmaß, differentielles Schwindmaß,
     Stehvermögen, Dauerhaftigkeitsklasse, Gebrauchsklasse, Kern/Splint, ring-/zerstreutporig)
  6. Korrekturliste (Ursprungsfassung → korrigiert, mit Begründung und Quelle)
  7. Quellenverzeichnis (Fachquellen + Bildquellen aus Ursprungsfassung)
- Bedienung: Blättern, Sprung über Inhaltsverzeichnis, Knopf „Drucken“.
- Druck: eigene Druckansicht, A4 hochformatig, je Holzart eine Seite, Seitenzahlen,
  Kopf-/Fußzeile, keine Animationen.

## 9. Ton

Im Browser erzeugt (Web Audio), keine Audiodateien. Je Reich eigene Mischung
(Wind, Blätterrauschen, Wasser, Vögel, Knistern, Grillen). Knopf oben rechts,
standardmäßig aus, Zustand wird lokal gemerkt. Weiche Überblendung beim Kapitelwechsel.

## 10. Technik

- Eine HTML-Datei als Artefakt; three.js als Modul von cdn.jsdelivr.net mit
  fester Version; Originalfotos als zusätzliche Dateien des Artefakts.
- Quelle im Repo unter `holzmappe/`: `index.html`, Daten (`holzdaten.js`),
  Szenen je Holz (eine Datei pro Reich), gemeinsame Bausteine (Baum-Generator,
  Werkstücke, Effekte, Ton, Buch, Karte, Mappe). Für das Artefakt wird zu einer
  Datei zusammengeführt (einfaches Skript, kein Framework).
- Ein Renderer, Szenen werden beim Wechsel aufgebaut und freigegeben.
- **Qualitätsstufen:** automatisch nach gemessener Bildrate (Schatten, Partikelzahl,
  Bloom/Tiefenunschärfe, Auflösungsfaktor). Bei „Bewegung reduzieren“: keine
  Kamerafahrten, keine Partikel.
- **Ohne WebGL:** Hinweis und direkter Zugang zur Mappe.
- Dunkel/Hell: Szenen sind eigene Welten; Mappe und Bedienelemente folgen dem
  Systemmodus mit Papier-Variante.

## 11. Umsetzung in Etappen

1. Fachrecherche und Datendatei mit Quellen + Korrekturliste.
2. Grundgerüst (Renderer, Effekte, Prolog, beide Navigationsvarianten, Ton,
   Holztafel-Overlay) + **Kiefer-Kapitel komplett** → **Abnahme durch Peter**.
3. Restliche 7 Kapitel im abgenommenen Stil.
4. Werkstatt-Epilog und Mappe inkl. Druckansicht.
5. Feinschliff, Leistungstest auf Tablet-Auflösung, Veröffentlichung als privates Artefakt.

## 12. Nicht enthalten

- Fotorealistische Bilder (Szenen sind gerendert, keine Fotos).
- Weitere Holzarten über die 8 hinaus.
- Integration in die Werkbank-App.
- Fremdsprachen.

## 13. Risiken

- **Leistung auf Tablets:** 3D mit Nachbearbeitung ist teuer. Gegenmittel:
  Qualitätsstufen, instanzierte Geometrie, begrenzte Partikel.
- **Stilmischung 3D + Kupferstich:** wird am Kiefer-Kapitel abgenommen, bevor
  die übrigen Kapitel entstehen.
- **Streuende Fachwerte:** als Spanne mit Quelle angeben statt Scheingenauigkeit.
