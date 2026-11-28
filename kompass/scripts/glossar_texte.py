"""Ergänzt data/glossar.json um ausführliche Klassen-Texte, neue Unterklassen und schreibt data/wirkung.json.

Aufruf (aus kompass/): python scripts/glossar_texte.py
Texte sind Erklärungen; Zahlen darin sind als Größenordnung markiert.
"""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
G = BASE / "data" / "glossar.json"

KLASSEN = {
    "aktien": {
        "erklaerung": [
            "Eine Aktie ist ein Anteil an einem Unternehmen. Wer sie besitzt, ist Miteigentümer: Er bekommt einen Teil der Gewinne (Dividende) und profitiert, wenn das Unternehmen wertvoller wird.",
            "Ein Aktien-ETF bündelt hunderte oder tausende Aktien in einem Wertpapier und bildet einen Index nach, zum Beispiel den MSCI World. So streut man mit einem Kauf über viele Firmen, Branchen und Länder.",
            "Langfristig waren Aktien die renditestärkste klassische Anlage – aber mit Einbrüchen von 30 bis 50 % in Krisen (Größenordnung).",
        ],
        "funktionsweise": ["Rendite = Kursgewinne + Dividenden", "Kurse spiegeln erwartete künftige Gewinne, abgezinst mit dem Zins", "Indizes gewichten meist nach Börsenwert: große Firmen haben großen Einfluss"],
        "gut_fuer": ["Vermögensaufbau über 10 Jahre und länger", "Schutz vor Inflation über Zeit (Firmen erhöhen Preise)", "Sparpläne mit kleinen Beträgen"],
        "schlecht_fuer": ["Geld, das in den nächsten 3–5 Jahren gebraucht wird", "Notgroschen", "Menschen, die in Crashs verkaufen würden"],
        "begriffe": [
            ["KGV (Kurs-Gewinn-Verhältnis)", "Preis einer Aktie geteilt durch den Gewinn pro Aktie. Hoch = teuer bezahlt oder hohe Erwartungen."],
            ["Shiller-KGV (CAPE)", "KGV mit dem inflationsbereinigten Durchschnittsgewinn der letzten 10 Jahre – glättet Konjunkturschwankungen."],
            ["Dividende", "Ausschüttung eines Teils des Gewinns an die Aktionäre."],
            ["Marktkapitalisierung", "Börsenwert eines Unternehmens: Aktienkurs mal Anzahl der Aktien."],
            ["Index", "Korb von Aktien nach festen Regeln, z. B. MSCI World, S&P 500, DAX."],
            ["Thesaurierend / Ausschüttend", "Thesaurierende ETFs legen Dividenden automatisch wieder an, ausschüttende zahlen sie aufs Konto."],
            ["TER", "Laufende jährliche Kosten eines Fonds in Prozent des Vermögens."],
            ["Replikation", "Physisch: der ETF kauft die Aktien. Synthetisch (Swap): eine Bank liefert die Indexrendite per Tauschgeschäft."],
            ["Klumpenrisiko", "Zu viel Gewicht auf einem Land, einer Branche oder wenigen Firmen."],
            ["Faktoren", "Eigenschaften mit historisch höherer Rendite: Value (günstig), Momentum (Trend), Quality (solide), Small Caps, Minimum Volatility."],
        ],
    },
    "anleihen": {
        "erklaerung": [
            "Eine Anleihe ist ein Kredit, den du einem Staat oder Unternehmen gibst. Dafür bekommst du regelmäßig Zinsen (Kupon) und am Ende der Laufzeit dein Geld zurück.",
            "Anleihen werden an der Börse gehandelt. Ihr Kurs bewegt sich gegenläufig zum Marktzins: Steigen die Zinsen, sind alte Anleihen mit niedrigerem Kupon weniger wert – ihr Kurs fällt. Fallen die Zinsen, steigt der Kurs.",
            "Im Depot sind Anleihen der Stabilisator: In Rezessionen und Aktiencrashs steigen gute Staatsanleihen oft, weil Anleger Sicherheit suchen und Notenbanken die Zinsen senken. In Inflationsphasen (wie 2022) fallen dagegen Aktien und Anleihen gemeinsam.",
        ],
        "funktionsweise": ["Rendite = Kupon + Kursveränderung", "Kurs und Rendite bewegen sich gegenläufig", "Je länger die Laufzeit (Duration), desto stärker reagiert der Kurs auf Zinsänderungen", "Je schlechter die Bonität (Rating), desto höher der Zins – und das Ausfallrisiko"],
        "gut_fuer": ["Puffer gegen Aktiencrashs (vor allem Staatsanleihen hoher Bonität)", "Planbare Erträge", "Kürzere Anlagehorizonte (kurze Laufzeiten)"],
        "schlecht_fuer": ["Phasen hoher, steigender Inflation", "Lange Laufzeiten bei steigenden Zinsen", "Hohe Renditeziele"],
        "begriffe": [
            ["Kupon", "Jährlicher Zins einer Anleihe, bezogen auf den Nennwert."],
            ["Rendite (Yield)", "Tatsächliche Verzinsung bezogen auf den aktuellen Kurs – steigt, wenn der Kurs fällt."],
            ["Duration", "Faustregel für die Zinsempfindlichkeit: Duration 7 heißt, 1 Prozentpunkt mehr Zins kostet rund 7 % Kurs."],
            ["Rating", "Bonitätsnote von Agenturen (AAA = beste). Unter BBB− gilt eine Anleihe als „Hochzins“ (High Yield)."],
            ["Realzins", "Rendite minus Inflation. Negativer Realzins = Geld verliert trotz Zinsen an Kaufkraft."],
            ["Zinskurve", "Renditen nach Laufzeit. Invers (kurz > lang) gilt als Rezessionssignal."],
            ["Spread", "Zinsaufschlag gegenüber sicheren Staatsanleihen – Maß für das wahrgenommene Risiko."],
            ["Inflationsindexiert", "Anleihen, deren Rückzahlung mit der Inflation steigt (z. B. US-TIPS)."],
            ["Währungsgesichert (hedged)", "Fondsklasse, die Wechselkursschwankungen absichert – wichtig bei Fremdwährungsanleihen."],
        ],
    },
    "liquiditaet": {
        "erklaerung": [
            "Liquidität ist Geld, das sofort oder kurzfristig verfügbar ist: Girokonto, Tagesgeld, Festgeld und Geldmarktfonds.",
            "Es gibt praktisch kein Kursrisiko, dafür folgt der Zins dem Leitzins der Notenbank. Nach Inflation bleibt oft wenig oder keine echte Rendite.",
        ],
        "funktionsweise": ["Zins folgt mit Verzögerung dem EZB-Einlagenzins", "Bankeinlagen sind in der EU bis 100.000 € je Bank und Person gesetzlich gesichert", "Geldmarkt-ETFs investieren in sehr kurzfristige Geldanlagen"],
        "gut_fuer": ["Notgroschen (3–6 Monatsausgaben)", "Geld für Ausgaben in den nächsten 1–3 Jahren", "Liquiditätsreserve zum Nachkaufen in Crashs"],
        "schlecht_fuer": ["Langfristigen Vermögensaufbau", "Schutz vor Inflation"],
        "begriffe": [["Einlagensicherung", "Gesetzlicher Schutz von Bankguthaben bis 100.000 € je Bank und Kunde in der EU."], ["€STR", "Euro-Kurzfristzins, an dem sich Geldmarktfonds orientieren."], ["Festgeld", "Fester Zins für feste Laufzeit, vorher meist nicht verfügbar."]],
    },
    "edelmetalle": {
        "erklaerung": [
            "Edelmetalle wie Gold und Silber werfen keine Zinsen oder Dividenden ab. Ihr Wert entsteht aus Knappheit, Vertrauen und Nachfrage – als Schmuck, Industrierohstoff und vor allem als Krisen- und Inflationsschutz.",
            "Gold gilt seit Jahrtausenden als Wertspeicher und wird von Notenbanken als Reserve gehalten. Silber ist stärker Industriemetall und schwankt deutlich mehr.",
        ],
        "funktionsweise": ["Preis in US-Dollar – für Euro-Anleger zählt auch der Wechselkurs", "Wichtigster Treiber historisch: der Realzins (Zins minus Inflation)", "Nachfrage von Notenbanken, Schmuck (Indien, China) und Investoren"],
        "gut_fuer": ["Beimischung von 5–15 % als Krisenpuffer (verbreitete Faustregel)", "Schutz bei Währungs- und Vertrauenskrisen", "Steuerfreie Gewinne nach 1 Jahr (physisch, Xetra-Gold)"],
        "schlecht_fuer": ["Laufende Erträge", "Phasen steigender Realzinsen", "Kurzfristige Planbarkeit"],
        "begriffe": [["Feinunze", "31,1 Gramm – Handelseinheit für Gold und Silber."], ["ETC", "Exchange Traded Commodity: Schuldverschreibung, die einen Rohstoffpreis abbildet, oft physisch besichert."], ["Spread", "Differenz zwischen Kauf- und Verkaufspreis beim Händler."], ["Lieferanspruch", "Recht, sich das Gold ausliefern zu lassen – entscheidend für die Steuerfreiheit nach 1 Jahr."]],
    },
    "rohstoffe": {
        "erklaerung": [
            "Rohstoffe sind Energie (Öl, Gas), Industriemetalle (Kupfer, Aluminium) und Agrargüter (Weizen, Kaffee). Privatanleger kaufen sie meist über Terminkontrakte in ETCs oder Rohstoff-ETFs.",
            "Rohstoffpreise schwanken stark mit Konjunktur, Wetter und Politik. Langfristig haben Rohstoffe als Anlage wenig Rendite gebracht, können aber in Inflations- und Angebotsschocks schützen.",
        ],
        "funktionsweise": ["Terminkontrakte müssen regelmäßig „gerollt“ werden – das kostet oder bringt Rendite (Contango/Backwardation)", "Nachfrage hängt an der Weltkonjunktur, Angebot an Förderung und Politik"],
        "gut_fuer": ["Schutz bei Ölpreis- und Inflationsschocks", "Kurze Beimischung in Stagflation"],
        "schlecht_fuer": ["Langfristiges Halten", "Anfänger (komplexe Produkte)"],
        "begriffe": [["Contango", "Spätere Terminkontrakte sind teurer – beim Rollen verliert man laufend."], ["Backwardation", "Spätere Kontrakte sind billiger – Rollen bringt Ertrag."], ["Brent / WTI", "Referenzsorten für Rohöl (Europa / USA)."]],
    },
    "immobilien": {
        "erklaerung": [
            "Immobilien sind Sachwerte mit laufenden Mieteinnahmen. Direkt gekauft brauchen sie viel Kapital und Arbeit; über börsennotierte Immobilienfirmen (REITs) oder Fonds geht es mit kleinen Beträgen.",
            "Immobilien reagieren stark auf Zinsen: Steigende Zinsen machen Finanzierungen teurer und drücken die Preise, sinkende Zinsen wirken umgekehrt.",
        ],
        "funktionsweise": ["Rendite = Miete − Kosten + Wertänderung", "Kreditfinanzierung wirkt als Hebel – in beide Richtungen", "REITs schütten den Großteil ihrer Gewinne aus und schwanken wie Aktien"],
        "gut_fuer": ["Langfristigen Sachwert-Aufbau", "Laufende Erträge", "Inflationsschutz über Mieten (mit Verzögerung)"],
        "schlecht_fuer": ["Kurzfristig benötigtes Geld (direkt)", "Kleine Budgets bei Direktkauf", "Phasen stark steigender Zinsen"],
        "begriffe": [["REIT", "Real Estate Investment Trust – börsennotierte Immobilienfirma mit Ausschüttungspflicht."], ["Mietrendite", "Jahresmiete geteilt durch Kaufpreis."], ["Kaufnebenkosten", "Grunderwerbsteuer, Notar, Grundbuch, Makler – zusammen grob 10–15 % (Größenordnung, je Bundesland)."], ["Spekulationsfrist", "Verkauf einer vermieteten Immobilie nach 10 Jahren steuerfrei."]],
    },
    "krypto": {
        "erklaerung": [
            "Kryptowerte sind digitale Einheiten auf einer Blockchain – einer dezentralen Datenbank ohne zentrale Stelle. Bitcoin ist begrenzt auf 21 Millionen Stück, Ethereum ist eine Plattform für Programme.",
            "Krypto hat keinen inneren Ertrag wie Dividenden oder Zinsen. Der Preis hängt an Nachfrage, Liquidität und Vertrauen – mit extremen Schwankungen und mehreren Einbrüchen von 70–80 % (Größenordnung).",
        ],
        "funktionsweise": ["Preis reagiert stark auf Zinsen und Liquidität (seit 2020 ähnlich wie Tech-Aktien)", "Verwahrung: Börse (Pleiterisiko) oder eigene Wallet (Schlüssel verloren = Geld weg)", "Direkt gehalten nach 1 Jahr steuerfrei"],
        "gut_fuer": ["Kleine spekulative Beimischung (verbreitet: höchstens 1–5 %)", "Wer die Technologie verstehen und mittragen will"],
        "schlecht_fuer": ["Sicherheitsorientierte Anleger", "Kurzfristig benötigtes Geld", "Große Depotanteile"],
        "begriffe": [["Blockchain", "Fälschungssichere, verteilte Datenbank aller Transaktionen."], ["Wallet", "Speicher für die privaten Schlüssel, die den Zugriff auf Kryptowerte erlauben."], ["Halving", "Halbierung der Bitcoin-Neuausgabe etwa alle 4 Jahre."], ["Stablecoin", "An eine Währung gekoppelter Coin, z. B. an den US-Dollar."], ["MiCA", "EU-Verordnung, die Krypto-Anbieter und Stablecoins reguliert."], ["Staking", "Coins hinterlegen, um ein Netzwerk abzusichern, gegen Belohnung."]],
    },
    "hebel": {
        "erklaerung": [
            "Hebelprodukte (Knock-outs, Optionsscheine, gehebelte ETFs) vervielfachen die Bewegung eines Basiswerts. Mit wenig Kapital lassen sich große Positionen bewegen – Gewinne und Verluste wachsen gleich schnell.",
            "Sie sind für kurzfristige Spekulation gebaut, nicht für langfristiges Anlegen. Bei täglicher Hebelung verlieren sie in Seitwärtsphasen Wert, Knock-outs können schlagartig wertlos werden.",
        ],
        "funktionsweise": ["Hebel 2: 1 % Bewegung im Basiswert ≈ 2 % im Produkt", "Täglicher Neuabgleich führt zu Pfadabhängigkeit (Volatility Decay)", "Emittent (eine Bank) stellt die Kurse – Emittentenrisiko"],
        "gut_fuer": ["Kurzfristige, klar begrenzte Wetten mit kleinem Einsatz", "Absicherung erfahrener Anleger"],
        "schlecht_fuer": ["Langfristigen Vermögensaufbau", "Anfänger", "Sparpläne"],
        "begriffe": [["Knock-out-Schwelle", "Wird sie berührt, verfällt das Produkt (fast) wertlos."], ["Volatility Decay", "Wertverlust gehebelter Produkte bei Schwankungen ohne Trend."], ["Termingeschäft", "Steuerliche Kategorie mit eigener Verlustverrechnung."]],
    },
    "beteiligungen": {
        "erklaerung": [
            "Beteiligungen sind Anteile an Firmen, die nicht an der Börse gehandelt werden: Private Equity (reifere Firmen), Venture Capital (Start-ups) oder Crowdinvesting über Plattformen.",
            "Sie versprechen hohe Chancen, binden das Kapital aber oft viele Jahre, sind teuer und intransparent. Bei Start-ups ist der Totalverlust der Normalfall für viele Einzelbeteiligungen.",
        ],
        "funktionsweise": ["Rendite entsteht beim Verkauf oder Börsengang (Exit)", "Bewertungen nur periodisch, nicht täglich", "Streuung über viele Beteiligungen ist Pflicht"],
        "gut_fuer": ["Erfahrene Anleger mit langem Horizont", "Kleine Beimischung zur Streuung"],
        "schlecht_fuer": ["Geld, das verfügbar bleiben muss", "Kleine Depots ohne Streuung"],
        "begriffe": [["ELTIF", "Europäischer langfristiger Investmentfonds – seit 2024 (ELTIF 2.0) leichter für Privatanleger zugänglich."], ["Exit", "Verkauf oder Börsengang einer Beteiligung."], ["Nachrangdarlehen", "Darlehen, das bei Pleite erst nach allen anderen bedient wird."]],
    },
}

NEUE_ASSETS = [
    dict(id="welt_faktor", name="Faktor-ETFs Welt", eltern="aktien", kurz="Welt-ETFs, die gezielt nach Eigenschaften wie Momentum, Qualität, Value oder geringer Schwankung auswählen.",
         risiko=3, liquiditaet=5, komplexitaet=3, erwartung={"rendite": 7, "schwankung": 15}, ticker=None, klassen={"aktien_welt": 1}, historie=None, hebel=1,
         steuer="Abgeltungsteuer; Teilfreistellung 30 % als Aktien-ETF.", mindestkapital="ab 1 €",
         besonderheiten=["Faktoren können jahrelang schlechter laufen als der breite Markt", "Momentum wechselt oft die Branchen, Minimum Volatility fällt in Crashs meist weniger", "Etwas höhere Kosten als reine Welt-ETFs"],
         pro=["Gezielte Ausrichtung auf historisch belohnte Eigenschaften", "Kann Klumpen im Welt-ETF verringern"], contra=["Keine Garantie für die Prämie", "Mehr Entscheidungen, mehr Fehlerquellen"],
         steuerklasse="aktien_etf", hist_proxy="aktien", ticker_hinweis=""),
    dict(id="welt_smallcap", name="Small Caps Welt", eltern="aktien", kurz="Kleine börsennotierte Firmen aus Industrieländern – mehr Wachstumschance, mehr Schwankung.",
         risiko=4, liquiditaet=4, komplexitaet=2, erwartung={"rendite": 7.5, "schwankung": 20}, ticker=None, klassen={"aktien_welt": 1}, historie=None, hebel=1,
         steuer="Abgeltungsteuer; Teilfreistellung 30 %.", mindestkapital="ab 1 €",
         besonderheiten=["Ergänzt den MSCI World, der nur große und mittlere Firmen enthält", "In Rezessionen meist stärker betroffen"], pro=["Breitere Streuung", "Historische Größenprämie"], contra=["Höhere Schwankung", "Lange Phasen ohne Mehrrendite"],
         steuerklasse="aktien_etf", hist_proxy="aktien", ticker_hinweis=""),
    dict(id="welt_dividende", name="Dividenden-ETFs", eltern="aktien", kurz="ETFs mit Firmen, die hohe oder stetig steigende Dividenden zahlen.",
         risiko=3, liquiditaet=5, komplexitaet=2, erwartung={"rendite": 6.5, "schwankung": 14}, ticker=None, klassen={"aktien_welt": 1}, historie=None, hebel=1,
         steuer="Ausschüttungen jährlich steuerpflichtig (nach Pauschbetrag); Teilfreistellung 30 %.", mindestkapital="ab 1 €",
         besonderheiten=["Dividende ist kein Gratisgeld: Der Kurs sinkt um die Ausschüttung", "Oft Übergewicht in Banken, Energie, Versorgern", "Weniger Tech-Klumpen als der MSCI World"],
         pro=["Laufende Erträge", "Oft ruhigere Kurse"], contra=["Häufig schlechter als der breite Markt in Tech-Booms", "Steuer früher fällig als bei thesaurierenden ETFs"],
         steuerklasse="aktien_etf", hist_proxy="aktien", ticker_hinweis=""),
    dict(id="welt_esg", name="Nachhaltige Welt-ETFs (ESG/SRI)", eltern="aktien", kurz="Welt-ETFs, die Firmen nach Umwelt-, Sozial- und Führungskriterien ausschließen oder gewichten.",
         risiko=3, liquiditaet=5, komplexitaet=2, erwartung={"rendite": 7, "schwankung": 15}, ticker=None, klassen={"aktien_welt": 1}, historie=None, hebel=1,
         steuer="Abgeltungsteuer; Teilfreistellung 30 %.", mindestkapital="ab 1 €",
         besonderheiten=["„ESG“ ist kein geschützter Begriff – Kriterien unterscheiden sich stark", "SRI-Indizes schließen strenger aus, dadurch weniger Firmen und mehr Abweichung vom Markt"],
         pro=["Ausrichtung nach eigenen Werten", "Weniger Öl, Tabak, Waffen"], contra=["Kann deutlich vom MSCI World abweichen", "Teils höhere Kosten"],
         steuerklasse="aktien_etf", hist_proxy="aktien", ticker_hinweis=""),
    dict(id="europa", name="Aktien Europa", eltern="aktien", kurz="Europäische Unternehmen – günstiger bewertet als die USA, weniger Tech, mehr Industrie und Banken.",
         risiko=3, liquiditaet=5, komplexitaet=1, erwartung={"rendite": 6.5, "schwankung": 16}, ticker=None, klassen={"aktien_welt": 1}, historie=None, hebel=1,
         steuer="Abgeltungsteuer; Teilfreistellung 30 %.", mindestkapital="ab 1 €",
         besonderheiten=["Gegengewicht zum USA-Klumpen im MSCI World", "Kein Währungsrisiko bei Euro-Ländern"], pro=["Niedrigere Bewertungen", "Heimatwährung"], contra=["Weniger Wachstumsbranchen", "Lange schwächer als die USA"],
         steuerklasse="aktien_etf", hist_proxy="aktien", ticker_hinweis=""),
    dict(id="dax", name="Aktien Deutschland (DAX & Co.)", eltern="aktien", kurz="Die größten deutschen Firmen. Bekannt, aber ein kleiner, exportlastiger Markt.",
         risiko=3, liquiditaet=5, komplexitaet=1, erwartung={"rendite": 6.5, "schwankung": 18}, ticker=None, klassen={"aktien_welt": 1}, historie=None, hebel=1,
         steuer="Abgeltungsteuer; Teilfreistellung 30 %.", mindestkapital="ab 1 €",
         besonderheiten=["Starker Länderklumpen (Home Bias)", "Der DAX ist ein Performance-Index: Dividenden sind im Indexstand enthalten"], pro=["Vertraute Firmen", "Kein Währungsrisiko"], contra=["Sehr wenig Streuung", "Abhängig von Export und Industrie"],
         steuerklasse="aktien_etf", hist_proxy="aktien", ticker_hinweis=""),
    dict(id="themen", name="Themen-ETFs", eltern="aktien", kurz="ETFs zu Zukunftsthemen wie KI, Robotik, Gesundheit, Wasser oder Rüstung.",
         risiko=5, liquiditaet=4, komplexitaet=3, erwartung={"rendite": 7, "schwankung": 28}, ticker=None, klassen={"aktien_tech": 0.6, "aktien_welt": 0.4}, historie=None, hebel=1,
         steuer="Abgeltungsteuer; Teilfreistellung 30 %.", mindestkapital="ab 1 €",
         besonderheiten=["Viele Themen-ETFs werden auf dem Höhepunkt eines Hypes aufgelegt", "Oft wenige, teure Wachstumswerte", "Höhere Kosten (TER oft deutlich über Welt-ETFs)"],
         pro=["Gezielte Wette auf einen Trend", "Einfacher als Einzelaktien"], contra=["Hohe Schwankung", "Thema richtig, Preis falsch – häufigster Fehler"],
         steuerklasse="aktien_etf", hist_proxy=None, ticker_hinweis=""),
    dict(id="gleichgewichtet", name="Gleichgewichtete ETFs (Equal Weight)", eltern="aktien", kurz="Jede Firma im Index bekommt das gleiche Gewicht – die Riesen dominieren nicht mehr.",
         risiko=3, liquiditaet=4, komplexitaet=2, erwartung={"rendite": 7, "schwankung": 17}, ticker=None, klassen={"aktien_usa": 1}, historie=None, hebel=1,
         steuer="Abgeltungsteuer; Teilfreistellung 30 %.", mindestkapital="ab 1 €",
         besonderheiten=["Gegenmittel gegen die Konzentration weniger Tech-Konzerne", "Regelmäßiges Umschichten verursacht etwas höhere Kosten"], pro=["Weniger Klumpen", "Mehr Gewicht für mittelgroße Firmen"], contra=["Schlechter, wenn die Großen weiter dominieren"],
         steuerklasse="aktien_etf", hist_proxy="aktien", ticker_hinweis=""),
]

WIRKUNG = {
    "_hinweis": "Typische Zusammenhänge zwischen Märkten. Richtung = was meist passiert, wenn der Ausgangsfaktor steigt. Keine Naturgesetze: Zusammenhänge können sich zeitweise umkehren.",
    "knoten": [
        {"id": "leitzins", "name": "Leitzins", "art": "treiber"}, {"id": "realzins", "name": "Realzins / Anleiherenditen", "art": "treiber"},
        {"id": "inflation", "name": "Inflation", "art": "treiber"}, {"id": "dollar", "name": "US-Dollar", "art": "treiber"},
        {"id": "konjunktur", "name": "Konjunktur", "art": "treiber"}, {"id": "angst", "name": "Angst / Volatilität (VIX)", "art": "treiber"},
        {"id": "kreditstress", "name": "Kreditstress (Spreads)", "art": "treiber"},
        {"id": "aktien", "name": "Aktien", "art": "anlage", "klasse": "aktien"}, {"id": "tech", "name": "Wachstums-/Tech-Aktien", "art": "anlage", "klasse": "aktien"},
        {"id": "em", "name": "Schwellenländer", "art": "anlage", "klasse": "aktien"}, {"id": "anleihen", "name": "Anleihekurse", "art": "anlage", "klasse": "anleihen"},
        {"id": "gold", "name": "Gold", "art": "anlage", "klasse": "edelmetalle"}, {"id": "oel", "name": "Öl & Rohstoffe", "art": "anlage", "klasse": "rohstoffe"},
        {"id": "immobilien", "name": "Immobilien", "art": "anlage", "klasse": "immobilien"}, {"id": "krypto", "name": "Krypto", "art": "anlage", "klasse": "krypto"},
        {"id": "tagesgeld", "name": "Tagesgeld-Zins", "art": "anlage", "klasse": "liquiditaet"},
    ],
    "kanten": [
        {"von": "leitzins", "nach": "anleihen", "richtung": -1, "staerke": 3, "warum": "Neue Anleihen zahlen mehr Zins, ältere mit niedrigerem Kupon verlieren an Wert.", "beispiel": "2022: Euro-Staatsanleihen mit zweistelligen Verlusten (Größenordnung)."},
        {"von": "leitzins", "nach": "aktien", "richtung": -1, "staerke": 2, "warum": "Künftige Gewinne werden stärker abgezinst, Kredite für Firmen und Konsumenten werden teurer.", "beispiel": "2022: Aktien fielen mit den Zinserhöhungen."},
        {"von": "leitzins", "nach": "tech", "richtung": -1, "staerke": 3, "warum": "Bei Wachstumsfirmen liegen die Gewinne weit in der Zukunft – höhere Zinsen drücken ihren heutigen Wert besonders stark.", "beispiel": "2022: Nasdaq rund −33 % (Größenordnung)."},
        {"von": "leitzins", "nach": "immobilien", "richtung": -1, "staerke": 3, "warum": "Finanzierungen werden teurer, Käufer können weniger zahlen; Mietrenditen müssen steigen.", "beispiel": "2022–2023: Immobilienpreise in Deutschland gaben nach."},
        {"von": "leitzins", "nach": "krypto", "richtung": -1, "staerke": 2, "warum": "Weniger billiges Geld für spekulative Anlagen.", "beispiel": "2022: Krypto-Winter während der Zinswende."},
        {"von": "leitzins", "nach": "dollar", "richtung": 1, "staerke": 2, "warum": "Höhere US-Zinsen ziehen Kapital in den Dollar (gilt für Fed-Zinsen).", "beispiel": "2022: starker Dollar."},
        {"von": "leitzins", "nach": "konjunktur", "richtung": -1, "staerke": 2, "warum": "Teure Kredite bremsen Investitionen und Konsum – meist mit 12–24 Monaten Verzögerung.", "beispiel": "Volcker 1980–82: zwei Rezessionen."},
        {"von": "leitzins", "nach": "tagesgeld", "richtung": 1, "staerke": 3, "warum": "Banken geben Leitzinsänderungen (verzögert) an Sparer weiter.", "beispiel": "2023: Tagesgeld wieder mit spürbaren Zinsen."},
        {"von": "realzins", "nach": "gold", "richtung": -1, "staerke": 3, "warum": "Gold zahlt keine Zinsen. Steigt der Realzins, wird das Halten von Gold relativ teurer (Opportunitätskosten).", "beispiel": "1981–2001: hohe Realzinsen, Gold verlor real stark. Seit 2022 zeitweise schwächer wegen Notenbankkäufen."},
        {"von": "realzins", "nach": "tech", "richtung": -1, "staerke": 2, "warum": "Höhere reale Diskontierung trifft lang laufende Wachstumserwartungen.", "beispiel": "2022."},
        {"von": "inflation", "nach": "leitzins", "richtung": 1, "staerke": 3, "warum": "Notenbanken erhöhen die Zinsen, um die Inflation zu bremsen.", "beispiel": "2022: schnellste Zinserhöhungen seit Jahrzehnten."},
        {"von": "inflation", "nach": "anleihen", "richtung": -1, "staerke": 3, "warum": "Feste Kupons verlieren an Kaufkraft, Anleger verlangen höhere Renditen.", "beispiel": "1970er und 2022."},
        {"von": "inflation", "nach": "gold", "richtung": 1, "staerke": 1, "warum": "Langfristig Schutz vor Geldentwertung – kurzfristig aber unzuverlässig.", "beispiel": "1970er: starker Anstieg; 2022: kaum Reaktion."},
        {"von": "inflation", "nach": "immobilien", "richtung": 1, "staerke": 1, "warum": "Mieten und Baukosten steigen mit – solange die Zinsen nicht stärker steigen.", "beispiel": "Sachwertcharakter in den 1970ern."},
        {"von": "oel", "nach": "inflation", "richtung": 1, "staerke": 3, "warum": "Energie steckt in fast allen Preisen: Transport, Produktion, Heizen.", "beispiel": "1973 und 2022."},
        {"von": "oel", "nach": "konjunktur", "richtung": -1, "staerke": 2, "warum": "Hohe Energiepreise wirken wie eine Steuer auf Firmen und Haushalte.", "beispiel": "Ölkrise 1973/74."},
        {"von": "dollar", "nach": "gold", "richtung": -1, "staerke": 2, "warum": "Gold wird in Dollar gehandelt – ein starker Dollar macht es für andere Währungen teurer.", "beispiel": "Typisches Muster, mit Ausnahmen in Krisen."},
        {"von": "dollar", "nach": "em", "richtung": -1, "staerke": 3, "warum": "Viele Schwellenländer haben Schulden in Dollar; Kapital fließt in die USA ab.", "beispiel": "Asienkrise 1997, 2022."},
        {"von": "dollar", "nach": "oel", "richtung": -1, "staerke": 1, "warum": "Rohstoffe in Dollar werden für andere teurer, die Nachfrage sinkt.", "beispiel": "Langfristiges Muster."},
        {"von": "dollar", "nach": "aktien", "richtung": 1, "staerke": 1, "warum": "Für Euro-Anleger: Ein steigender Dollar erhöht den Euro-Wert von US-Aktien (Währungsgewinn).", "beispiel": "Gilt nur aus Sicht eines Euro-Anlegers."},
        {"von": "konjunktur", "nach": "aktien", "richtung": 1, "staerke": 3, "warum": "Mehr Umsatz und Gewinne – Börsen nehmen das aber meist vorweg.", "beispiel": "Märkte drehen typischerweise Monate vor der Wirtschaft."},
        {"von": "konjunktur", "nach": "oel", "richtung": 1, "staerke": 2, "warum": "Mehr Produktion und Verkehr brauchen mehr Energie.", "beispiel": "Rohstoffboom 2003–2008."},
        {"von": "konjunktur", "nach": "em", "richtung": 1, "staerke": 2, "warum": "Schwellenländer exportieren Rohstoffe und Industriegüter.", "beispiel": "2003–2007."},
        {"von": "angst", "nach": "aktien", "richtung": -1, "staerke": 3, "warum": "In Panik verkaufen Anleger riskante Anlagen.", "beispiel": "VIX-Spitzen 2008 und 2020."},
        {"von": "angst", "nach": "anleihen", "richtung": 1, "staerke": 2, "warum": "Flucht in sichere Staatsanleihen.", "beispiel": "2008: Bundesanleihen gesucht."},
        {"von": "angst", "nach": "gold", "richtung": 1, "staerke": 1, "warum": "Sicherer Hafen – in der akuten Panik wird Gold aber manchmal verkauft, um Liquidität zu beschaffen.", "beispiel": "März 2020: kurz gefallen, dann Rekord."},
        {"von": "angst", "nach": "krypto", "richtung": -1, "staerke": 2, "warum": "Risikoanlagen werden zuerst verkauft.", "beispiel": "März 2020."},
        {"von": "kreditstress", "nach": "aktien", "richtung": -1, "staerke": 3, "warum": "Steigende Risikoaufschläge zeigen, dass Firmen schwerer an Geld kommen – oft ein Frühwarnsignal.", "beispiel": "2007–2008: Spreads stiegen vor dem Crash."},
        {"von": "aktien", "nach": "leitzins", "richtung": 1, "staerke": 1, "warum": "Bei großen Crashs senken Notenbanken häufig die Zinsen („Fed-Put“) – fallende Aktien → fallende Zinsen.", "beispiel": "2008, 2020."},
        {"von": "tech", "nach": "krypto", "richtung": 1, "staerke": 2, "warum": "Seit 2020 bewegen sich Krypto und Tech-Aktien oft gemeinsam – beide hängen an Liquidität und Risikolaune.", "beispiel": "2021–2022."},
    ],
}


def main():
    g = json.loads(G.read_text(encoding="utf-8"))
    for h in g["hauptklassen"]:
        h.update(KLASSEN[h["id"]])
    vorhanden = {a["id"] for a in g["assets"]}
    for a in NEUE_ASSETS:
        if a["id"] not in vorhanden:
            a["produkte"] = []
            g["assets"].append(a)
    G.write_text(json.dumps(g, ensure_ascii=False, indent=1), encoding="utf-8")
    (BASE / "data" / "wirkung.json").write_text(json.dumps(WIRKUNG, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(g["assets"]), "Assets,", len(WIRKUNG["kanten"]), "Wirkungen")


if __name__ == "__main__":
    main()
