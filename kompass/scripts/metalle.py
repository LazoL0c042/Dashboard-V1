"""Metalle im Glossar: Edelmetalle (Gold, Silber, Platin, Palladium, Rhodium) und
Industrie- & Zukunftsmetalle (Kupfer, Aluminium, Nickel, Zink, Zinn, Lithium, Kobalt,
Seltene Erden, Uran, Industriemetall-Korb).

Für jedes Metall: was es ausmacht, Einsatz, wann gefragt, wo Engpässe drohen, und die
drei Wege – physisch, Papier (ETC/Zertifikat/Future), Aktien (Minen-ETFs) – mit
Situationen, in denen welcher Weg Sinn ergibt.

Regel: Keine Zahlen aus dem Gedächtnis. Texte sind qualitativ; einzige Zahlen sind
gesetzliche Regeln (Umsatzsteuer, Haltefrist). Erwartung/Schwankung sind als
Annahme (Größenordnung) gekennzeichnet wie im übrigen Glossar.
Produkte: ISINs gelten als UNGEPRÜFT (geprueft=false), bis der Server sie bestätigt.
"""
import json
from pathlib import Path

D = Path(__file__).resolve().parent.parent / "data"

# ---------- Steuertexte (vereinfacht, Stand 2026) ----------
ST_PHYS_GOLD = ("Physisches Anlagegold ist von der Umsatzsteuer befreit (§ 25c UStG). Gewinne beim privaten Verkauf nach mehr als 1 Jahr "
                "Haltedauer steuerfrei (§ 23 EStG); darunter persönlicher Steuersatz, Freigrenze 1.000 € pro Jahr.")
ST_PHYS_UST = ("Barren: 19 % Umsatzsteuer beim Kauf, die beim Verkauf nicht zurückkommt (Ausnahme: Lagerung im Zollfreilager). Münzen teils "
               "differenzbesteuert. Gewinne nach mehr als 1 Jahr Haltedauer steuerfrei (§ 23 EStG), darunter persönlicher Steuersatz.")
ST_ETC = ("ETCs und Zertifikate: in der Regel Abgeltungsteuer (25 % + Soli), keine Steuerfreiheit nach 1 Jahr. Ausnahme wie bei "
          "Xetra-Gold nur mit verbrieftem Lieferanspruch – im Einzelfall prüfen.")
ST_AKTIEN = ("Aktien-ETF: Abgeltungsteuer auf Gewinne und Ausschüttungen, 30 % Teilfreistellung, Vorabpauschale. Keine Steuerfreiheit nach 1 Jahr.")

PHYS_NEIN = {"geht": "nein", "text": "Für Privatanleger praktisch nicht möglich: kein Endkundenmarkt, große Mindestmengen, Lagerung und Qualitätsnachweis aufwendig.",
             "pro": [], "contra": ["Kein sinnvoller Zugang"], "steuer": ""}


def weg(geht, text, pro, contra, steuer):
    return {"geht": geht, "text": text, "pro": pro, "contra": contra, "steuer": steuer}


def asset(id_, name, eltern, kurz, risiko, liq, kompl, rendite, schw, ticker, hinweis, klassen, steuer, mindest, bes, pro, contra,
          steuerklasse, knoten, metall):
    return {"id": id_, "name": name, "klasse": eltern, "eltern": eltern, "kurz": kurz, "risiko": risiko, "liquiditaet": liq,
            "komplexitaet": kompl, "erwartung": {"rendite": rendite, "schwankung": schw}, "ticker": ticker, "ticker_hinweis": hinweis,
            "klassen": klassen, "historie": None, "hebel": 1, "steuer": steuer, "mindestkapital": mindest, "besonderheiten": bes,
            "pro": pro, "contra": contra, "produkte": [], "steuerklasse": steuerklasse, "hist_proxy": None,
            "wirkung_knoten": knoten, "metall": metall}


# ---------- Edelmetalle ----------

GOLD_METALL = {
    "art": "Edelmetall · Währungsmetall", "engpass": "gering", "zyklus": "gering",
    "ausmacht": [
        "Gold ist vor allem ein Wertspeicher. Fast alles jemals geförderte Gold existiert noch – jährlich kommt nur ein kleiner Teil dazu. Deshalb bestimmt nicht die Industrie den Preis, sondern Anleger und Notenbanken.",
        "Gold bringt keinen Zins. Darum ist es attraktiv, wenn Zinsen nach Abzug der Inflation (Realzins) niedrig oder negativ sind, und unattraktiv, wenn sichere Anleihen real gut verzinst sind.",
    ],
    "einsatz": ["Schmuck (größter Nachfrageblock)", "Barren und Münzen für Anleger", "Reserven der Notenbanken", "Elektronik in kleinen Mengen (Kontakte)"],
    "gefragt_wenn": ["Realzinsen sinken oder sind negativ", "Vertrauen in Währungen, Staatsschulden oder Banken sinkt", "Geopolitische Krisen, Sanktionen – Notenbanken kaufen als dollarfreie Reserve", "Der Dollar schwächelt"],
    "schwach_wenn": ["Realzinsen steigen deutlich (z. B. 1980er, 2013)", "Starke Dollar-Phasen", "Lange Börsen-Booms ohne Angst"],
    "engpaesse": ["Kaum Engpassrisiko: riesiger oberirdischer Bestand, Recycling reagiert auf Preise", "Physische Knappheit entsteht eher regional (Münzen und kleine Barren in Panikphasen ausverkauft, höhere Aufschläge)"],
    "wege": {
        "physisch": weg("ja", "Barren und Münzen beim Händler oder der Bank; Lagerung zu Hause, im Schließfach oder beim Händler.",
                        ["Kein Emittentenrisiko", "Umsatzsteuerfrei, nach 1 Jahr steuerfrei", "Funktioniert auch ohne Finanzsystem"],
                        ["Spanne zwischen Kauf- und Verkaufspreis", "Lagerung und Versicherung", "Kleine Stückelungen teurer pro Gramm"], ST_PHYS_GOLD),
        "papier": weg("ja", "Gold-ETCs: börsengehandelte Schuldverschreibungen, meist mit physischem Gold im Tresor hinterlegt (z. B. Xetra-Gold mit Lieferanspruch).",
                      ["Börsentäglich handelbar, kleine Beträge, Sparplan", "Sehr geringe Spanne", "Mit Lieferanspruch steuerlich wie physisch"],
                      ["Emittentenrisiko trotz Hinterlegung", "Laufende Gebühr", "Ohne Lieferanspruch: Abgeltungsteuer"], ST_ETC),
        "aktien": weg("ja", "Goldminen-ETFs oder Streaming-/Royalty-Firmen, die Förderrechte finanzieren.",
                      ["Hebel auf den Goldpreis, teils Dividenden"],
                      ["Fallen in Aktiencrashs oft mit", "Kosten (Energie, Löhne) und Länderrisiken"], ST_AKTIEN),
    },
    "welcher_weg": [
        ["Krisenreserve, die auch ohne Banken funktioniert", "Physisch, kleine Stückelungen"],
        ["Fester Depotanteil zum Ausbalancieren, Sparplan", "ETC mit Lieferanspruch (steuerfrei nach 1 Jahr)"],
        ["Wette auf deutlich steigenden Goldpreis", "Minen-ETF als kleine Beimischung"],
    ],
}

SILBER_METALL = {
    "art": "Edelmetall · Industriemetall", "engpass": "mittel", "zyklus": "mittel",
    "ausmacht": [
        "Silber hat zwei Gesichter: Es läuft oft mit Gold, wird aber zu einem großen Teil in der Industrie verbraucht. Es schwankt deshalb deutlich stärker – in Edelmetall-Haussen steigt es meist stärker, in Rezessionen fällt es stärker.",
        "Silber leitet Strom und Wärme besser als jedes andere Metall. Ein großer Teil fällt nur als Nebenprodukt beim Abbau von Blei, Zink und Kupfer an – höhere Preise erhöhen das Angebot deshalb nur langsam.",
    ],
    "einsatz": ["Photovoltaik (Leitpasten in Solarzellen)", "Elektronik, Kontakte, Leiterplatten", "Elektroautos (Steuerelektronik)", "Schmuck und Besteck", "Barren und Münzen", "Medizin (antibakteriell)"],
    "gefragt_wenn": ["Gold steigt und Anleger suchen den „günstigeren“ Hebel", "Starker Solarausbau", "Industrie läuft gut und Inflation steigt"],
    "schwach_wenn": ["Rezession – die Industrienachfrage bricht weg", "Solarindustrie spart Silber pro Zelle ein (Thrifting)", "Steigende Realzinsen"],
    "engpaesse": ["Angebot reagiert träge, weil Silber meist Nebenprodukt ist", "Mehrere Jahre mit Nachfrageüberschuss wurden aus Lagerbeständen gedeckt – sinken die Bestände, können Preisspitzen entstehen", "Förderung konzentriert auf wenige Länder (u. a. Mexiko, Peru, China)"],
    "wege": {
        "physisch": weg("ja", "Barren und Münzen. Wegen des niedrigen Preises pro Gramm braucht Silber viel Platz.",
                        ["Kein Emittentenrisiko", "Nach 1 Jahr steuerfrei"],
                        ["19 % Umsatzsteuer auf Barren frisst Jahre an Rendite", "Hohe Spannen", "Lagerung sperrig"], ST_PHYS_UST),
        "papier": weg("ja", "Silber-ETCs, physisch hinterlegt – ohne Umsatzsteuer.",
                      ["Keine Umsatzsteuer", "Kleine Beträge, Sparplan"], ["Emittentenrisiko", "Abgeltungsteuer"], ST_ETC),
        "aktien": weg("ja", "Silberminen-ETFs – meist Firmen, die auch Gold, Zink oder Kupfer fördern.",
                      ["Starker Hebel auf den Silberpreis"], ["Extrem schwankungsanfällig", "Wenige reine Silberförderer"], ST_AKTIEN),
    },
    "welcher_weg": [
        ["Mittelfristige Wette auf Edelmetall-Hausse", "ETC – keine Umsatzsteuer"],
        ["Krisenreserve für den Ernstfall", "Münzen (differenzbesteuert) statt Barren"],
        ["Spekulation auf Solarboom und knappes Angebot", "Silberminen-ETF, klein dosiert"],
    ],
}

PLATIN_METALL = {
    "art": "Edelmetall · Platingruppe", "engpass": "hoch", "zyklus": "hoch",
    "ausmacht": [
        "Platin ist seltener als Gold und wird überwiegend in der Industrie gebraucht. Die Förderung ist extrem konzentriert: Der Großteil kommt aus Südafrika, ein weiterer Teil aus Russland.",
        "Lange Zeit war Platin teurer als Gold; seit Jahren ist es deutlich günstiger. Anleger sehen darin entweder eine Chance (Wasserstoff, Angebotsprobleme) oder ein Zeichen dauerhaft schwacher Nachfrage (Diesel-Rückgang).",
    ],
    "einsatz": ["Katalysatoren, vor allem Diesel und Lkw", "Wasserstoff: Elektrolyse (PEM) und Brennstoffzellen", "Chemie (Katalysatoren in Raffinerien, Düngemittel)", "Glasfaser- und Glasherstellung", "Schmuck (besonders in China und Japan)", "Medizin (Implantate)"],
    "gefragt_wenn": ["Wasserstoffwirtschaft wächst", "Autohersteller ersetzen teureres Palladium durch Platin", "Stromausfälle und Streiks in Südafrika bremsen die Förderung", "Schmucknachfrage in Asien steigt"],
    "schwach_wenn": ["Elektroautos verdrängen Verbrenner (keine Katalysatoren)", "Rezession in der Autoindustrie", "Wasserstoffprojekte verzögern sich"],
    "engpaesse": ["Südafrika: Stromversorgung (Lastabwürfe), Bahn-Logistik, Arbeitskämpfe, alternde tiefe Minen", "Russland: Sanktionsrisiko", "Kaum Ausweichmöglichkeiten – neue Minen brauchen viele Jahre", "Recycling aus Altkatalysatoren hängt von Schrottquoten ab"],
    "wege": {
        "physisch": weg("eingeschränkt", "Barren und Münzen (z. B. Platin-Maple-Leaf) bei Edelmetallhändlern.",
                        ["Kein Emittentenrisiko", "Nach 1 Jahr steuerfrei"], ["19 % Umsatzsteuer", "Hohe Spannen, kleiner Markt"], ST_PHYS_UST),
        "papier": weg("ja", "Platin-ETCs, physisch hinterlegt.", ["Keine Umsatzsteuer", "Börsentäglich"], ["Emittentenrisiko", "Abgeltungsteuer"], ST_ETC),
        "aktien": weg("eingeschränkt", "Kaum reine Platin-ETFs; Förderer sind wenige südafrikanische Konzerne, enthalten in breiten Bergbau-ETFs.",
                      ["Hebel auf Preis"], ["Länderrisiko Südafrika", "Wenige Titel, hohe Klumpen"], ST_AKTIEN),
    },
    "welcher_weg": [
        ["Langfristige Wette auf Wasserstoff und Angebotsengpass", "ETC als kleine Beimischung"],
        ["Ergänzung zu Gold mit mehr Industriebezug", "ETC – physisch lohnt wegen Umsatzsteuer kaum"],
    ],
}

PALLADIUM_METALL = {
    "art": "Edelmetall · Platingruppe", "engpass": "hoch", "zyklus": "hoch",
    "ausmacht": [
        "Palladium ist fast reines Industriemetall: Der Löwenanteil steckt in Katalysatoren von Benzinautos. Russland ist einer der größten Förderer, daneben Südafrika.",
        "Palladium hatte einen spektakulären Boom und danach einen tiefen Absturz – ein Lehrstück dafür, wie stark der Preis an einer einzigen Anwendung hängt.",
    ],
    "einsatz": ["Katalysatoren für Benziner und Hybride (Hauptanwendung)", "Elektronik (Kondensatoren)", "Zahnmedizin", "Chemische Katalyse"],
    "gefragt_wenn": ["Strengere Abgasnormen, besonders in China", "Mehr Hybridautos (brauchen weiter Katalysatoren)", "Sanktionen oder Exportstopps Russlands"],
    "schwach_wenn": ["Reine Elektroautos setzen sich durch", "Hersteller tauschen Palladium gegen günstigeres Platin", "Autoverkäufe brechen ein"],
    "engpaesse": ["Starke Abhängigkeit von Russland (Sanktions- und Lieferrisiko)", "Meist Nebenprodukt von Nickel- und Platinminen", "Gleichzeitig strukturelles Nachfrageproblem durch E-Mobilität"],
    "wege": {
        "physisch": weg("eingeschränkt", "Barren und Münzen bei spezialisierten Händlern.", ["Kein Emittentenrisiko"], ["19 % Umsatzsteuer", "Sehr kleiner Markt, hohe Spannen"], ST_PHYS_UST),
        "papier": weg("ja", "Palladium-ETCs, physisch hinterlegt.", ["Keine Umsatzsteuer"], ["Emittentenrisiko", "Extreme Schwankung"], ST_ETC),
        "aktien": weg("eingeschränkt", "Nur über breite Bergbau-ETFs (große Nickel-/Palladiumkonzerne, teils sanktioniert).", [], ["Kaum gezielter Zugang"], ST_AKTIEN),
    },
    "welcher_weg": [["Kurzfristige Wette auf Lieferstopp aus Russland", "ETC, nur klein und mit Ausstiegsplan"],
                    ["Langfristiger Vermögensaufbau", "Eher nicht – Hauptanwendung schrumpft mit der E-Mobilität"]],
}

RHODIUM_METALL = {
    "art": "Edelmetall · Platingruppe (Nische)", "engpass": "hoch", "zyklus": "hoch",
    "ausmacht": [
        "Rhodium ist eines der seltensten Metalle überhaupt und fällt nur als Nebenprodukt der Platinförderung an – vor allem in Südafrika. Der Markt ist winzig, schon kleine Käufe bewegen den Preis.",
        "Der Preis hat sich in wenigen Jahren vervielfacht und danach einen großen Teil wieder verloren. Das ist kein Wertspeicher, sondern ein Spekulationsobjekt mit Industriepreis.",
    ],
    "einsatz": ["Katalysatoren (Stickoxid-Reduktion)", "Glasfaser- und Glasindustrie", "Chemie"],
    "gefragt_wenn": ["Verschärfte Stickoxid-Grenzwerte", "Förderausfälle in Südafrika"],
    "schwach_wenn": ["Elektroautos", "Autoindustrie spart Rhodium ein"],
    "engpaesse": ["Angebot hängt fast vollständig an Platinminen in Südafrika – mehr Rhodium gibt es nur, wenn mehr Platin gefördert wird", "Sehr illiquider Markt"],
    "wege": {
        "physisch": weg("eingeschränkt", "Nur als Pulver oder kleine Barren bei wenigen Händlern; Rückkauf schwierig.", [], ["Hohe Spannen", "Schwer wieder zu verkaufen", "19 % Umsatzsteuer"], ST_PHYS_UST),
        "papier": weg("eingeschränkt", "Vereinzelte ETCs, oft wenig Volumen.", [], ["Illiquide", "Emittentenrisiko"], ST_ETC),
        "aktien": weg("eingeschränkt", "Indirekt über Platinförderer.", [], ["Kein gezielter Zugang"], ST_AKTIEN),
    },
    "welcher_weg": [["Fast jede Situation", "Finger weg oder nur als Lehrgeld-Betrag – zu klein und zu illiquide"]],
}

# ---------- Industrie- & Zukunftsmetalle ----------

KUPFER_METALL = {
    "art": "Industriemetall · Elektrifizierung", "engpass": "hoch", "zyklus": "hoch",
    "ausmacht": [
        "Kupfer gilt als „Dr. Copper“: Weil es fast überall verbaut wird, zeigt sein Preis früh, wie es der Weltwirtschaft geht. China ist der mit Abstand größte Verbraucher.",
        "Gleichzeitig ist Kupfer das Metall der Elektrifizierung: Stromnetze, Elektroautos, Wind- und Solarparks und Rechenzentren brauchen deutlich mehr Kupfer als die alte Technik.",
    ],
    "einsatz": ["Stromkabel und Stromnetze", "Bau (Leitungen, Rohre)", "Elektromotoren, Elektroautos, Ladesäulen", "Wind- und Solaranlagen", "Rechenzentren und Elektronik", "Klimaanlagen"],
    "gefragt_wenn": ["Weltkonjunktur und besonders China wachsen", "Staaten bauen Stromnetze und Energiewende aus", "Konjunkturprogramme mit viel Infrastruktur", "Der Dollar schwächelt"],
    "schwach_wenn": ["Rezession oder Immobilienkrise in China", "Starker Dollar", "Hohe Lagerbestände an den Metallbörsen"],
    "engpaesse": ["Förderung konzentriert auf Chile und Peru (Wassermangel, Proteste, Steuer- und Lizenzstreit)", "Sinkender Erzgehalt in alten Minen", "Neue Minen brauchen oft mehr als zehn Jahre von Fund bis Förderung", "Schmelz- und Raffineriekapazität stark in China konzentriert"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("ja", "Kupfer-ETCs auf Terminkontrakte (LME/COMEX).", ["Direkter Bezug zum Kupferpreis", "Börsentäglich"],
                           ["Rollverluste bei Contango", "Emittentenrisiko", "Abgeltungsteuer"], ST_ETC),
             "aktien": weg("ja", "Kupferminen-ETFs oder breite Bergbau-ETFs mit großen Kupferförderern.", ["Dividenden möglich", "Kein Rollverlust", "Profitiert überproportional bei steigendem Preis"],
                           ["Firmen- und Länderrisiken", "Fällt in Aktiencrashs mit"], ST_AKTIEN)},
    "welcher_weg": [["Mehrjährige Wette auf Elektrifizierung und Netzausbau", "Kupferminen-ETF"],
                    ["Kurzfristige Konjunktur- oder China-Erholung", "Kupfer-ETC"],
                    ["Schutz gegen Inflationsschübe im Depot", "Breiter Industriemetall-Korb statt Einzelmetall"]],
}

ALU_METALL = {
    "art": "Industriemetall · Energieintensiv", "engpass": "mittel", "zyklus": "hoch",
    "ausmacht": [
        "Aluminium ist das meistgenutzte Nichteisenmetall. Bauxit gibt es reichlich – knapp ist der Strom: Die Elektrolyse verbraucht so viel Energie, dass der Strompreis die Kosten bestimmt.",
        "China produziert den größten Teil der Welt-Aluminiums. Politische Obergrenzen für die chinesische Produktion und Energiepreise in Europa bewegen den Preis stark.",
    ],
    "einsatz": ["Verpackung (Dosen, Folien)", "Fahrzeug- und Flugzeugbau (Leichtbau)", "Bau (Fenster, Fassaden)", "Stromleitungen", "Solar-Rahmen"],
    "gefragt_wenn": ["Leichtbau für Elektroautos", "Konjunktur", "Energiepreise steigen und Hütten müssen schließen (Angebot sinkt)"],
    "schwach_wenn": ["Rezession", "China exportiert Überschüsse"],
    "engpaesse": ["Europäische Hütten wurden in der Energiekrise gedrosselt", "Chinas Produktionsdeckel", "Sanktionen gegen russisches Aluminium", "Bauxit aus wenigen Ländern (u. a. Guinea, Australien)"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("ja", "Aluminium-ETCs auf Terminkontrakte.", ["Direkter Preisbezug"], ["Rollverluste", "Abgeltungsteuer"], ST_ETC),
             "aktien": weg("eingeschränkt", "Über breite Bergbau-ETFs; wenige reine Aluminiumkonzerne.", [], ["Wenig gezielter Zugang"], ST_AKTIEN)},
    "welcher_weg": [["Wette auf Energiepreise und Konjunktur", "ETC oder Industriemetall-Korb"]],
}

NICKEL_METALL = {
    "art": "Industriemetall · Batteriemetall", "engpass": "mittel", "zyklus": "hoch",
    "ausmacht": [
        "Nickel steckt vor allem in Edelstahl, zunehmend auch in Batterien mit hoher Reichweite. Indonesien hat sich mit einem Exportverbot für Erz und großen Hüttenprojekten zum dominierenden Anbieter gemacht.",
        "Der Nickelmarkt ist berüchtigt: Im März 2022 setzte die Londoner Metallbörse (LME) den Handel aus und annullierte Geschäfte, nachdem der Preis explodiert war. Papier-Investments sind hier also nicht risikolos.",
    ],
    "einsatz": ["Edelstahl (Hauptanwendung)", "Batterien (NMC-Kathoden)", "Superlegierungen (Turbinen, Luftfahrt)", "Galvanik"],
    "gefragt_wenn": ["Boom bei Edelstahl und Bau", "Elektroautos mit nickelreichen Batterien"],
    "schwach_wenn": ["Überangebot aus Indonesien", "Batteriehersteller wechseln zu nickelfreien LFP-Zellen"],
    "engpaesse": ["Abhängigkeit von Indonesien (Exportpolitik) und Russland (Sanktionen)", "Hochreines Nickel in Batteriequalität ist knapper als Nickel für Edelstahl"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("ja", "Nickel-ETCs auf Terminkontrakte.", ["Direkter Preisbezug"], ["Rollverluste", "Börsenrisiko (LME-Aussetzung 2022)", "Abgeltungsteuer"], ST_ETC),
             "aktien": weg("eingeschränkt", "Über Bergbau- und Batteriemetall-ETFs.", [], ["Wenig gezielt"], ST_AKTIEN)},
    "welcher_weg": [["Batterie-Thema allgemein", "Breiter Batteriemetall-ETF statt Nickel allein"]],
}

ZINK_METALL = {
    "art": "Industriemetall", "engpass": "mittel", "zyklus": "hoch",
    "ausmacht": ["Zink schützt Stahl vor Rost (Verzinken) und hängt deshalb eng an Bau, Autos und Infrastruktur. Die Verhüttung ist energieintensiv.",
                 "Zink ist für Anleger ein reiner Konjunkturwert – ohne Wertspeicher-Funktion und ohne großes Zukunftsthema."],
    "einsatz": ["Verzinkung von Stahl", "Messing und Legierungen", "Batterien (Nische)", "Gummi und Chemie"],
    "gefragt_wenn": ["Infrastruktur- und Bauboom", "Energiepreise zwingen Hütten zur Drosselung"],
    "schwach_wenn": ["Rezession, Immobilienkrise in China"],
    "engpaesse": ["Europäische Hütten in der Energiekrise gedrosselt", "Minenschließungen bei niedrigen Preisen"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("ja", "Zink-ETCs auf Terminkontrakte, teils wenig Volumen.", [], ["Rollverluste", "Illiquide", "Abgeltungsteuer"], ST_ETC),
             "aktien": weg("eingeschränkt", "Über breite Bergbau-ETFs.", [], ["Kein gezielter Zugang"], ST_AKTIEN)},
    "welcher_weg": [["Konjunkturwette", "Industriemetall-Korb statt Zink allein"]],
}

ZINN_METALL = {
    "art": "Industriemetall · Elektronik", "engpass": "hoch", "zyklus": "hoch",
    "ausmacht": ["Zinn ist das Lot der Elektronik: Fast jede Leiterplatte wird damit verlötet. Der Markt ist klein und das Angebot kommt aus wenigen, teils instabilen Regionen.",
                 "Kleine Märkte mit konzentriertem Angebot neigen zu heftigen Preissprüngen."],
    "einsatz": ["Lötzinn für Elektronik (Hauptanwendung)", "Weißblech (Konservendosen)", "Chemie, Glas"],
    "gefragt_wenn": ["Elektronik- und Halbleiterzyklus läuft", "Förderausfälle"],
    "schwach_wenn": ["Elektronik-Flaute"],
    "engpaesse": ["Myanmar (Wa-Region) stoppte 2023 die Förderung zeitweise", "Indonesien beschränkt Exporte", "Konflikte im Kongo (Bisie-Mine)"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("eingeschränkt", "Vereinzelte ETCs auf Terminkontrakte, wenig Volumen.", [], ["Illiquide", "Rollverluste"], ST_ETC),
             "aktien": weg("eingeschränkt", "Kaum Zinnförderer an westlichen Börsen.", [], ["Kein sinnvoller Zugang"], ST_AKTIEN)},
    "welcher_weg": [["Fast jede Situation", "Nur über breite Körbe – Einzelwette lohnt kaum"]],
}

LITHIUM_METALL = {
    "art": "Batteriemetall", "engpass": "mittel", "zyklus": "sehr hoch",
    "ausmacht": [
        "Lithium ist das Herz der Akkus in Elektroautos, Handys und Stromspeichern. Lithium selbst ist nicht selten – knapp sind schnell erschließbare Lagerstätten und vor allem Verarbeitungskapazität, die stark in China liegt.",
        "Lithium ist ein Lehrbeispiel für den Schweinezyklus: Ein Preisboom löste weltweit neue Projekte aus, danach stürzte der Preis tief, Minen wurden stillgelegt – bis zum nächsten Engpass.",
    ],
    "einsatz": ["Batterien für Elektroautos", "Stationäre Stromspeicher", "Elektronik-Akkus", "Glas, Keramik, Schmierfette"],
    "gefragt_wenn": ["Elektroauto-Verkäufe und Speicherausbau wachsen schneller als erwartet", "Projekte verzögern sich"],
    "schwach_wenn": ["Überangebot durch viele neue Projekte", "Elektroauto-Absatz enttäuscht", "Neue Batteriechemie (z. B. Natrium-Ionen) ersetzt Lithium teilweise"],
    "engpaesse": ["Förderung: Australien (Gestein), Chile/Argentinien (Salzseen), China", "Verarbeitung zu Batteriequalität größtenteils in China", "Chile verstaatlicht teilweise die Lithiumförderung", "Wasserverbrauch und Umweltkonflikte bei Salzseen"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("nein", "Kein liquider Terminmarkt für Privatanleger; Lithium-ETCs gibt es kaum.", [], ["Kein direkter Zugang zum Preis"], ""),
             "aktien": weg("ja", "Lithium- und Batterie-ETFs (Förderer, Verarbeiter, Batteriehersteller).", ["Einziger praktikabler Weg", "Breite über die Wertschöpfungskette"],
                           ["Enthält oft viele Batterie- und Autofirmen, nicht nur Lithium", "Sehr hohe Schwankung", "Thematische ETFs sind oft teuer"], ST_AKTIEN)},
    "welcher_weg": [["Langfristige Wette auf Elektromobilität", "Batterie-/Lithium-ETF, kleine Beimischung"],
                    ["Antizyklisch nach einem Preiscrash", "Lithium-ETF in Tranchen kaufen – nur mit Geduld für Jahre"]],
}

KOBALT_METALL = {
    "art": "Batteriemetall · Konfliktrohstoff", "engpass": "hoch", "zyklus": "sehr hoch",
    "ausmacht": [
        "Kobalt stabilisiert viele Lithium-Ionen-Batterien und steckt in Superlegierungen. Der Großteil kommt aus der Demokratischen Republik Kongo, verarbeitet wird überwiegend in China.",
        "Kobalt fällt meist als Nebenprodukt von Kupfer- und Nickelminen an. Der Markt ist politisch: 2025 setzte der Kongo Exporte zeitweise aus, um den Preis zu stützen.",
    ],
    "einsatz": ["Batterien (NMC/NCA)", "Superlegierungen für Turbinen", "Hartmetalle, Werkzeuge", "Katalysatoren"],
    "gefragt_wenn": ["Exportstopps oder Quoten im Kongo", "Nachfrage nach Hochleistungsbatterien"],
    "schwach_wenn": ["Kobaltfreie LFP-Batterien gewinnen Marktanteile", "Überangebot aus neuen Kupfer-Kobalt-Minen"],
    "engpaesse": ["Extreme Länderkonzentration im Kongo", "Kinderarbeit und Kleinbergbau – Reputations- und Lieferkettenrisiken", "Verarbeitung in China"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("nein", "Kein zugänglicher Terminmarkt für Privatanleger.", [], ["Kein direkter Zugang"], ""),
             "aktien": weg("eingeschränkt", "Indirekt über Batteriemetall- und Bergbau-ETFs.", [], ["Kobaltanteil gering", "Ethische Fragen"], ST_AKTIEN)},
    "welcher_weg": [["Fast jede Situation", "Nur indirekt über breite Batteriemetall-ETFs"]],
}

SE_METALL = {
    "art": "Strategische Metalle", "engpass": "hoch", "zyklus": "sehr hoch",
    "ausmacht": [
        "Seltene Erden (z. B. Neodym, Praseodym, Dysprosium) sind gar nicht so selten – selten sind wirtschaftliche Lagerstätten und vor allem die Trennung, die aufwendig und umweltbelastend ist. China dominiert Förderung und besonders Verarbeitung.",
        "Dazu zählen im weiteren Sinn strategische Metalle wie Gallium, Germanium, Wolfram oder Antimon. China hat ab 2023 Exportkontrollen für Gallium und Germanium und 2025 für mehrere schwere Seltene Erden eingeführt – diese Metalle sind Teil der Geopolitik.",
    ],
    "einsatz": ["Permanentmagnete in E-Motoren und Windturbinen", "Rüstung (Lenkwaffen, Radar)", "Elektronik, Halbleiter (Gallium, Germanium)", "Glasfaser, Infrarot-Optik", "Katalysatoren"],
    "gefragt_wenn": ["Exportkontrollen Chinas", "Aufrüstung und Wunsch nach unabhängigen Lieferketten", "Ausbau von Windkraft und E-Mobilität"],
    "schwach_wenn": ["China flutet den Markt, um Konkurrenzprojekte unwirtschaftlich zu machen", "Neue Magnettechnik ohne Seltene Erden"],
    "engpaesse": ["Extreme Abhängigkeit von China bei Trennung und Magnetproduktion", "Westliche Projekte brauchen Jahre und staatliche Förderung", "Preise werden teils politisch gesetzt"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("nein", "Kein liquider Terminmarkt für Privatanleger.", [], ["Kein direkter Zugang"], ""),
             "aktien": weg("ja", "ETFs auf Seltene Erden und strategische Metalle.", ["Einziger praktikabler Weg", "Profitiert von Exportkontrollen"],
                           ["Enthält chinesische Firmen mit eigenem Risiko", "Kleine Firmen, sehr hohe Schwankung", "Politik kann Preise drücken"], ST_AKTIEN)},
    "welcher_weg": [["Wette auf Entkopplung von China und Aufrüstung", "Seltene-Erden-ETF, klein dosiert"]],
}

URAN_METALL = {
    "art": "Energiemetall", "engpass": "hoch", "zyklus": "sehr hoch",
    "ausmacht": [
        "Uran ist Brennstoff für Kernkraftwerke. Die Nachfrage ist sehr gut planbar (Kraftwerke laufen Jahrzehnte), das Angebot kaum: Nach Jahren niedriger Preise wurde zu wenig investiert.",
        "Kasachstan ist der größte Förderer, Kanada und Australien folgen; Russland ist bei der Anreicherung bedeutend. Die USA haben Importe von angereichertem Uran aus Russland per Gesetz beschränkt.",
    ],
    "einsatz": ["Brennstoff für Kernkraftwerke", "Neue Kleinreaktoren (SMR) – Stromhunger von Rechenzentren", "Medizin und Forschung (Nische)"],
    "gefragt_wenn": ["Staaten verlängern Laufzeiten oder bauen neue Reaktoren", "Rechenzentren suchen CO₂-arme Dauerleistung", "Lieferprobleme aus Kasachstan oder Russland"],
    "schwach_wenn": ["Atomunfall oder politischer Ausstieg", "Neue Minen kommen schneller als erwartet"],
    "engpaesse": ["Förderung in wenigen Ländern, Transportwege durch Russland", "Anreicherungskapazität knapp und politisch heikel", "Lange Vorlaufzeiten für neue Minen"],
    "wege": {"physisch": weg("eingeschränkt", "Nur indirekt: Fonds wie der Sprott Physical Uranium Trust (Kanada) oder Yellow Cake (London) halten physisches Uran – für Anleger sind das Wertpapiere.",
                             ["Direkter Bezug zum Uranpreis"], ["Handel an ausländischen Börsen", "Kurs kann vom Wert des Urans abweichen (Auf-/Abschlag)"], ST_AKTIEN),
             "papier": weg("nein", "Kein Uran-ETC für Privatanleger in Europa.", [], [], ""),
             "aktien": weg("ja", "Uran-ETFs (Minen, teils physische Uran-Fonds als Beimischung).", ["Breiter Zugang über einen ETF"],
                           ["Wenige große Titel prägen den ETF", "Extrem schwankungsanfällig", "Politisches Risiko"], ST_AKTIEN)},
    "welcher_weg": [["Langfristige Wette auf Kernkraft-Renaissance", "Uran-ETF, kleine Beimischung"],
                    ["Reine Rohstoffpreis-Wette", "Physischer Uran-Fonds (ausländische Börse beachten)"]],
}

KORB_METALL = {
    "art": "Korb aus Industriemetallen", "engpass": "mittel", "zyklus": "hoch",
    "ausmacht": ["Ein Korb aus Kupfer, Aluminium, Zink und Nickel streut das Risiko einzelner Metalle. Er bildet vor allem die Weltkonjunktur und Chinas Nachfrage ab.",
                 "Für die meisten Anleger ist der Korb sinnvoller als eine Einzelwette auf ein Industriemetall."],
    "einsatz": ["Siehe einzelne Metalle: Bau, Energie, Fahrzeuge, Elektronik"],
    "gefragt_wenn": ["Konjunkturaufschwung", "Inflationsphasen mit realem Wachstum", "Schwacher Dollar"],
    "schwach_wenn": ["Rezession", "Starker Dollar"],
    "engpaesse": ["Engpässe einzelner Metalle wirken gedämpft"],
    "wege": {"physisch": PHYS_NEIN,
             "papier": weg("ja", "ETCs auf Industriemetall-Indizes (Terminkontrakte).", ["Breit, einfach"], ["Rollverluste", "Abgeltungsteuer"], ST_ETC),
             "aktien": weg("ja", "Breite Bergbau-ETFs.", ["Dividenden", "Kein Rollverlust"], ["Firmenrisiken", "Enthalten auch Eisenerz, Kohle"], ST_AKTIEN)},
    "welcher_weg": [["Inflations- und Konjunkturschutz im Depot", "Industriemetall-ETC oder Bergbau-ETF, klein dosiert"]],
}

EDEL_KN = ["gold"]
IND_KN = ["industriemetalle"]
NEUE_ASSETS = [
    asset("platin", "Platin", "edelmetalle", "Seltenes Edelmetall mit vor allem industrieller Nachfrage: Katalysatoren, Wasserstoff, Schmuck. Förderung fast nur in Südafrika und Russland.",
          5, 3, 3, 3, 28, "PL=F", "Terminkontrakt in USD", {"gold": 0.4, "rohstoffe_oel": 0.6}, ST_PHYS_UST + " ETCs: Abgeltungsteuer.", "ab 1 € per ETC",
          ["Stark von Südafrika abhängig", "Wasserstoff als mögliche neue Nachfrage", "Physisch mit 19 % Umsatzsteuer", "Angezeigter Kurs: Terminkontrakt in Dollar"],
          ["Angebot kann kaum wachsen", "Mögliche Gewinner der Wasserstoffwirtschaft"], ["Starke Schwankung", "Nachfrage leidet unter E-Autos"], "sonstiges", ["gold", "industriemetalle"], PLATIN_METALL),
    asset("palladium", "Palladium", "edelmetalle", "Fast reines Industriemetall für Benzin-Katalysatoren. Stark abhängig von Russland – und von der Zukunft des Verbrennungsmotors.",
          5, 3, 3, 2, 35, "PA=F", "Terminkontrakt in USD", {"gold": 0.3, "rohstoffe_oel": 0.7}, ST_PHYS_UST + " ETCs: Abgeltungsteuer.", "ab 1 € per ETC",
          ["Boom und tiefer Absturz in wenigen Jahren", "Sanktionsrisiko Russland", "Angezeigter Kurs: Terminkontrakt in Dollar"],
          ["Preissprünge bei Lieferstopps"], ["Hauptanwendung schrumpft mit E-Mobilität", "Extreme Schwankung"], "sonstiges", ["gold", "industriemetalle"], PALLADIUM_METALL),
    asset("rhodium", "Rhodium", "edelmetalle", "Extrem seltenes Nebenprodukt der Platinförderung. Winziger, illiquider Markt mit enormen Preissprüngen.",
          5, 1, 4, 2, 50, None, "", {"gold": 0.2, "rohstoffe_oel": 0.8}, ST_PHYS_UST, "hoch, schwer handelbar",
          ["Kein Referenzkurs bei Yahoo", "Kaum Produkte, schwer wieder zu verkaufen"], ["Kurze Preisspitzen bei Engpässen"], ["Illiquide", "Kaum Zugang", "Keine Wertspeicher-Funktion"],
          "sonstiges", ["gold", "industriemetalle"], RHODIUM_METALL),
    asset("kupfer", "Kupfer", "metalle", "Das Metall der Elektrifizierung und Konjunkturbarometer („Dr. Copper“). Stromnetze, E-Autos, Rechenzentren brauchen viel davon.",
          4, 4, 3, 4, 25, "HG=F", "Terminkontrakt in USD (COMEX)", {"rohstoffe_oel": 0.7, "aktien_welt": 0.3}, ST_ETC, "ab 1 € per ETC",
          ["Neue Minen brauchen mehr als zehn Jahre", "Förderung konzentriert auf Chile und Peru", "Angezeigter Kurs: Terminkontrakt in Dollar"],
          ["Strukturelle Nachfrage durch Energiewende", "Inflationsschutz bei Wachstum"], ["Fällt in Rezessionen stark", "Hängt an China"], "sonstiges", IND_KN, KUPFER_METALL),
    asset("aluminium", "Aluminium", "metalle", "Meistgenutztes Nichteisenmetall. Preis hängt am Strompreis und an Chinas Produktion.",
          4, 3, 3, 3, 22, "ALI=F", "Terminkontrakt in USD", {"rohstoffe_oel": 0.8, "aktien_welt": 0.2}, ST_ETC, "ab 1 € per ETC",
          ["Energiepreise bestimmen die Kosten", "Angezeigter Kurs: Terminkontrakt in Dollar"], ["Leichtbau-Nachfrage"], ["Überangebot aus China", "Rollverluste bei ETCs"], "sonstiges", IND_KN, ALU_METALL),
    asset("nickel", "Nickel", "metalle", "Edelstahl- und Batteriemetall. Indonesien dominiert das Angebot; 2022 stoppte die LME den Handel.",
          5, 3, 4, 3, 35, None, "Kein frei verfügbarer Referenzkurs", {"rohstoffe_oel": 0.8, "aktien_welt": 0.2}, ST_ETC, "ab 1 € per ETC",
          ["LME-Handelsstopp und annullierte Geschäfte im März 2022", "Indonesiens Exportpolitik"], ["Batterie-Nachfrage"], ["Überangebot", "LFP-Batterien ohne Nickel"], "sonstiges", IND_KN, NICKEL_METALL),
    asset("zink", "Zink", "metalle", "Rostschutz für Stahl – ein reiner Konjunkturwert ohne großes Zukunftsthema.",
          4, 2, 3, 2, 25, None, "Kein frei verfügbarer Referenzkurs", {"rohstoffe_oel": 0.8, "aktien_welt": 0.2}, ST_ETC, "ab 1 € per ETC",
          ["Energieintensive Verhüttung"], ["Profitiert von Infrastrukturprogrammen"], ["Kein Wachstumsthema", "Illiquide ETCs"], "sonstiges", IND_KN, ZINK_METALL),
    asset("zinn", "Zinn", "metalle", "Lot der Elektronik. Kleiner Markt, Angebot aus instabilen Regionen – heftige Preissprünge.",
          5, 2, 4, 2, 30, None, "Kein frei verfügbarer Referenzkurs", {"rohstoffe_oel": 0.8, "aktien_tech": 0.2}, ST_ETC, "–",
          ["Förderstopps in Myanmar", "Kaum Produkte"], ["Elektronikzyklus"], ["Illiquide", "Kaum Zugang"], "sonstiges", IND_KN, ZINN_METALL),
    asset("lithium", "Lithium", "metalle", "Herz der Akkus. Nicht selten, aber Verarbeitung in China konzentriert – extremer Preiszyklus.",
          5, 4, 3, 5, 45, None, "Kein Lithium-Terminkurs bei Yahoo; Zugang über Aktien-ETFs", {"aktien_tech": 0.4, "aktien_em": 0.3, "rohstoffe_oel": 0.3}, ST_AKTIEN, "ab 1 € per ETF",
          ["Boom und Absturz in wenigen Jahren", "Nur über Aktien-ETFs investierbar"], ["Wachstum durch E-Mobilität und Speicher"], ["Schweinezyklus", "Neue Batteriechemien"], "aktien_etf", IND_KN, LITHIUM_METALL),
    asset("kobalt", "Kobalt", "metalle", "Batterie- und Legierungsmetall, fast nur aus dem Kongo. Politischer Preis, ethische Fragen.",
          5, 2, 4, 3, 45, None, "Kein frei verfügbarer Referenzkurs", {"rohstoffe_oel": 0.6, "aktien_em": 0.4}, ST_AKTIEN, "nur indirekt",
          ["Exportstopp des Kongo 2025", "Nur indirekt investierbar"], ["Preissprünge bei Exportstopps"], ["LFP-Batterien ohne Kobalt", "Lieferketten-Ethik"], "aktien_etf", IND_KN, KOBALT_METALL),
    asset("seltene_erden", "Seltene Erden & strategische Metalle", "metalle", "Magnetmetalle und Hightech-Rohstoffe (Neodym, Gallium, Germanium …). China dominiert und setzt sie geopolitisch ein.",
          5, 3, 4, 4, 40, None, "Kein Referenzkurs; Zugang über Aktien-ETFs", {"aktien_em": 0.5, "rohstoffe_oel": 0.5}, ST_AKTIEN, "ab 1 € per ETF",
          ["Exportkontrollen Chinas 2023 und 2025", "Nur über Aktien-ETFs investierbar"], ["Profitiert von Entkopplung und Aufrüstung"], ["China kann Preise drücken", "Sehr hohe Schwankung"], "aktien_etf", IND_KN, SE_METALL),
    asset("uran", "Uran", "metalle", "Brennstoff der Kernkraft. Planbare Nachfrage, träges Angebot – und viel Politik.",
          5, 3, 3, 5, 45, "URA", "Global X Uranium ETF (USD) als Stellvertreter", {"rohstoffe_oel": 0.5, "aktien_welt": 0.5}, ST_AKTIEN, "ab 1 € per ETF",
          ["Physischer Zugang nur über ausländische Fonds", "Russland bei der Anreicherung wichtig"], ["Kernkraft-Renaissance, Rechenzentren"], ["Unfall- und Politikrisiko", "Extreme Schwankung"], "aktien_etf", IND_KN, URAN_METALL),
    asset("industriemetalle_breit", "Industriemetalle (Korb)", "metalle", "Korb aus Kupfer, Aluminium, Zink und Nickel – Konjunktur und China in einem Produkt.",
          4, 4, 3, 3, 20, None, "", {"rohstoffe_oel": 0.8, "aktien_welt": 0.2}, ST_ETC, "ab 1 € per ETC",
          ["Rollverluste bei Terminkontrakten"], ["Breiter als ein Einzelmetall"], ["Fällt in Rezessionen"], "sonstiges", IND_KN, KORB_METALL),
]

HAUPT_EDEL = {
    "kurz": "Gold, Silber und die Platinmetalle Platin, Palladium und Rhodium. Wertspeicher (Gold) bis fast reines Industriemetall (Palladium).",
    "erklaerung": [
        "Edelmetalle rosten nicht und sind selten. Gold ist vor allem Wertspeicher und Krisenwährung. Silber ist halb Edel-, halb Industriemetall. Platin, Palladium und Rhodium – die Platingruppe – werden überwiegend in der Industrie verbraucht, vor allem in Katalysatoren.",
        "Je mehr ein Metall in der Industrie steckt, desto stärker hängt es an der Konjunktur und desto stärker schwankt es. Gold glättet ein Depot in Krisen; Platin und Palladium tun das nicht.",
        "Jedes Edelmetall lässt sich auf drei Wegen kaufen: physisch (Barren, Münzen), auf Papier (ETCs) oder über Aktien von Minen. Die Wege unterscheiden sich stark bei Steuern, Kosten und Risiko – auf jeder Metallseite steht der Vergleich.",
    ],
    "funktionsweise": ["Kein Zins, keine Dividende – Rendite nur über den Preis", "Gold reagiert auf Realzins, Dollar und Angst", "Silber und Platinmetalle zusätzlich auf Industrie und Autoindustrie", "Physisch: Gold umsatzsteuerfrei, andere Metalle mit 19 % Umsatzsteuer"],
    "gut_fuer": ["Krisenschutz und Streuung (Gold)", "Schutz gegen Geldentwertung bei niedrigen Realzinsen", "Gezielte Wetten auf Wasserstoff (Platin) oder Solar (Silber)"],
    "schlecht_fuer": ["Laufendes Einkommen", "Phasen stark steigender Realzinsen", "Wer große Schwankung nicht aushält (Platinmetalle)"],
}

HAUPT_IND = {
    "id": "metalle", "name": "Industrie- & Zukunftsmetalle", "farbe": "peach",
    "kurz": "Kupfer, Aluminium, Nickel, Zink, Zinn, Lithium, Kobalt, Seltene Erden und Uran: Rohstoffe für Konjunktur, Energiewende und Hightech.",
    "erklaerung": [
        "Industriemetalle werden verbraucht, nicht gehortet. Ihr Preis folgt deshalb der Weltwirtschaft – allen voran China – und schwankt in Zyklen: Hohe Preise lösen neue Minen aus, die Jahre später auf eine schwächere Nachfrage treffen.",
        "Neu ist der strukturelle Rückenwind: Stromnetze, Elektroautos, Batteriespeicher, Windräder, Rechenzentren und Rüstung brauchen große Mengen Kupfer, Lithium, Nickel, Kobalt und Seltene Erden. Gleichzeitig sind Förderung und Verarbeitung oft auf wenige Länder konzentriert – Engpässe sind damit auch Geopolitik.",
        "Physisch können Privatanleger diese Metalle praktisch nicht kaufen. Es bleiben ETCs auf Terminkontrakte (mit Rollverlusten) und Aktien der Förderer. Bei Lithium, Kobalt und Seltenen Erden gibt es nur den Aktienweg.",
    ],
    "funktionsweise": ["Preis folgt Konjunktur, China und Dollar", "Angebot reagiert mit vielen Jahren Verzögerung (Schweinezyklus)", "ETCs nutzen Terminkontrakte: Contango kostet beim Rollen Rendite", "Minenaktien hebeln den Metallpreis, tragen aber Firmen- und Länderrisiken"],
    "gut_fuer": ["Wetten auf Energiewende und Elektrifizierung", "Inflationsschutz in Wachstumsphasen", "Streuung gegenüber Anleihen"],
    "schlecht_fuer": ["Krisenschutz – in Rezessionen fallen sie oft stark", "Langes Halten über ETCs (Rollverluste)", "Ruhige Nerven: Einbrüche von mehr als der Hälfte sind üblich"],
    "begriffe": [
        ["Contango", "Spätere Terminkontrakte sind teurer als der aktuelle. Beim Rollen kauft ein ETC teurer nach – das kostet laufend Rendite."],
        ["Backwardation", "Spätere Kontrakte sind billiger, typisch bei akuter Knappheit. Rollen bringt dann einen Ertrag."],
        ["LME", "London Metal Exchange – wichtigster Handelsplatz für Industriemetalle; setzte 2022 den Nickelhandel aus."],
        ["Nebenprodukt", "Metall, das beim Abbau eines anderen anfällt (z. B. Kobalt aus Kupferminen). Sein Angebot steigt nicht, nur weil sein eigener Preis steigt."],
        ["Lagerbestände", "Vorräte in den Lagerhäusern der Metallbörsen. Sinkende Bestände gelten als Zeichen von Knappheit."],
        ["Schweinezyklus", "Hohe Preise → viele neue Projekte → Jahre später Überangebot → tiefe Preise → Projekte werden gestoppt → neue Knappheit."],
        ["Exportkontrolle", "Staatliche Beschränkung der Ausfuhr, z. B. Chinas Kontrollen für Gallium, Germanium und Seltene Erden."],
        ["AISC", "All-in Sustaining Costs – Gesamtkosten einer Mine pro Einheit. Liegt der Preis darunter, verdient die Mine kein Geld."],
        ["Royalty/Streaming", "Firmen finanzieren Minen gegen einen Anteil an der künftigen Förderung – weniger Betriebsrisiko als ein Minenbetreiber."],
        ["Offtake-Vertrag", "Langfristige Abnahmezusage (z. B. eines Autobauers) – sichert neue Minenprojekte ab."],
    ],
}
EDEL_BEGRIFFE_NEU = [
    ["Platingruppe", "Platin, Palladium, Rhodium und weitere seltene Metalle, die meist gemeinsam gefördert werden – vor allem in Südafrika und Russland."],
    ["Zollfreilager", "Lager außerhalb des Umsatzsteuergebiets: Silber, Platin und Palladium können dort ohne Umsatzsteuer gekauft und gelagert werden; bei Auslieferung wird sie fällig."],
    ["Differenzbesteuerung", "Umsatzsteuer nur auf die Händlermarge – für manche Silbermünzen günstiger als 19 % auf den vollen Preis."],
    ["Thrifting", "Einsparen eines teuren Metalls in der Produktion, z. B. weniger Silber pro Solarzelle oder Platin statt Palladium im Katalysator."],
    ["Gold-Silber-Ratio", "Wie viele Unzen Silber eine Unze Gold kostet. Hohe Werte gelten manchen als Zeichen, dass Silber relativ günstig ist."],
]

# Produkte (ungeprüft) – asset, isin, name, anbieter, index, ertrag, replikation, klassen, steuerklasse, besonderheit
KL = lambda a: next(x["klassen"] for x in NEUE_ASSETS if x["id"] == a)  # noqa: E731
T = "thesaurierend"
PRODUKTE = [
    ("silber", "JE00B1VS3333", "WisdomTree Physical Silver", "WisdomTree", "Silberpreis", T, "physisch", {"gold": 0.6, "rohstoffe_oel": 0.4}, "sonstiges", "Physisch hinterlegter Silber-ETC ohne Umsatzsteuer."),
    ("silber", "IE000UL6CLP7", "Global X Silver Miners UCITS ETF", "Global X", "Solactive Global Silver Miners", T, "physisch", {"goldminen": 1}, "aktien_etf", "Silberminen – starker Hebel auf den Silberpreis."),
    ("platin", "JE00B1VS2W53", "WisdomTree Physical Platinum", "WisdomTree", "Platinpreis", T, "physisch", None, "sonstiges", "Physisch hinterlegter Platin-ETC ohne Umsatzsteuer."),
    ("palladium", "JE00B1VS3002", "WisdomTree Physical Palladium", "WisdomTree", "Palladiumpreis", T, "physisch", None, "sonstiges", "Physisch hinterlegter Palladium-ETC ohne Umsatzsteuer."),
    ("kupfer", "GB00B15KXQ89", "WisdomTree Copper", "WisdomTree", "Bloomberg Copper Subindex", T, "Terminkontrakte", None, "sonstiges", "Kupfer über Terminkontrakte – Rollverluste möglich."),
    ("kupfer", "IE0003Z9E2Y3", "Global X Copper Miners UCITS ETF", "Global X", "Solactive Global Copper Miners", T, "physisch", {"rohstoffe_oel": 0.5, "aktien_welt": 0.5}, "aktien_etf", "Kupferförderer weltweit."),
    ("aluminium", "GB00B15KXN58", "WisdomTree Aluminium", "WisdomTree", "Bloomberg Aluminum Subindex", T, "Terminkontrakte", None, "sonstiges", "Aluminium über Terminkontrakte."),
    ("nickel", "GB00B15KY435", "WisdomTree Nickel", "WisdomTree", "Bloomberg Nickel Subindex", T, "Terminkontrakte", None, "sonstiges", "Nickel über Terminkontrakte."),
    ("industriemetalle_breit", "GB00B15KYG56", "WisdomTree Industrial Metals", "WisdomTree", "Bloomberg Industrial Metals Subindex", T, "Terminkontrakte", None, "sonstiges", "Korb aus Kupfer, Aluminium, Zink, Nickel."),
    ("industriemetalle_breit", "IE00B6R51Z18", "iShares MSCI Global Metals & Mining Producers", "iShares", "MSCI ACWI Select Metals & Mining Producers ex Gold & Silver", T, "physisch", {"rohstoffe_oel": 0.5, "aktien_welt": 0.5}, "aktien_etf", "Breiter Bergbau-ETF ohne Gold- und Silberminen."),
    ("lithium", "IE00BLCHJN13", "Global X Lithium & Battery Tech UCITS ETF", "Global X", "Solactive Global Lithium", T, "physisch", None, "aktien_etf", "Lithiumförderer und Batteriehersteller."),
    ("lithium", "IE00BKLF1R75", "WisdomTree Battery Solutions UCITS ETF", "WisdomTree", "WisdomTree Battery Solutions", T, "physisch", {"aktien_tech": 0.6, "aktien_welt": 0.4}, "aktien_etf", "Batterie-Wertschöpfungskette, breiter als nur Lithium."),
    ("seltene_erden", "IE0002PG6CA6", "VanEck Rare Earth and Strategic Metals UCITS ETF", "VanEck", "MVIS Global Rare Earth/Strategic Metals", T, "physisch", None, "aktien_etf", "Förderer und Verarbeiter Seltener Erden und strategischer Metalle."),
    ("uran", "IE000NDWFGA5", "Global X Uranium UCITS ETF", "Global X", "Solactive Global Uranium & Nuclear Components", T, "physisch", None, "aktien_etf", "Uranförderer und Kernkraft-Zulieferer, teils physische Uran-Fonds."),
    ("uran", "IE0005YK6564", "Sprott Uranium Miners UCITS ETF", "Sprott", "North Shore Global Uranium Mining", T, "physisch", None, "aktien_etf", "Uranminen und physisches Uran über Fonds."),
]

WIRKUNG_KNOTEN = [
    {"id": "industriemetalle", "name": "Industriemetalle", "kurz": "Metalle", "art": "anlage", "klasse": "metalle"},
    {"id": "china", "name": "China-Nachfrage", "kurz": "China", "art": "treiber", "klasse": None},
    {"id": "energiewende", "name": "Energiewende & E-Autos", "kurz": "E-Wende", "art": "treiber", "klasse": None},
]
WIRKUNG_KANTEN = [
    {"von": "konjunktur", "nach": "industriemetalle", "richtung": 1, "staerke": 3, "warum": "Industriemetalle werden verbraucht – mehr Produktion heißt mehr Nachfrage.", "beispiel": "2008: Kupfer brach mit der Weltwirtschaft ein, 2009 erholte es sich mit Chinas Konjunkturprogramm."},
    {"von": "china", "nach": "industriemetalle", "richtung": 1, "staerke": 3, "warum": "China ist der größte Verbraucher von Kupfer, Aluminium, Nickel und Zink.", "beispiel": "Die Immobilienkrise in China drückte die Nachfrage nach Baumetallen."},
    {"von": "china", "nach": "oel", "richtung": 1, "staerke": 2, "warum": "China ist einer der größten Ölimporteure.", "beispiel": "Lockdowns in China senkten zeitweise die Ölnachfrage."},
    {"von": "energiewende", "nach": "industriemetalle", "richtung": 1, "staerke": 2, "warum": "Netze, E-Autos, Speicher und Windräder brauchen mehr Kupfer, Lithium, Nickel und Seltene Erden.", "beispiel": "Der Lithiumboom folgte dem steilen Anstieg der E-Auto-Verkäufe."},
    {"von": "dollar", "nach": "industriemetalle", "richtung": -1, "staerke": 2, "warum": "Metalle werden in Dollar gehandelt – ein starker Dollar verteuert sie für den Rest der Welt.", "beispiel": "Phasen starker Dollar-Aufwertung gingen oft mit schwachen Metallpreisen einher."},
    {"von": "industriemetalle", "nach": "inflation", "richtung": 1, "staerke": 1, "warum": "Teurere Vorprodukte erhöhen Herstellungskosten.", "beispiel": "2021/22 trugen Rohstoffpreise zur hohen Inflation bei."},
    {"von": "leitzins", "nach": "industriemetalle", "richtung": -1, "staerke": 1, "warum": "Höhere Zinsen bremsen Bau und Investitionen und machen Lagerhaltung teurer.", "beispiel": "Zinswende 2022: Metallpreise fielen von ihren Hochs."},
]


def main():
    g = json.loads((D / "glossar.json").read_text(encoding="utf-8"))
    hk = {h["id"]: h for h in g["hauptklassen"]}
    edel = hk["edelmetalle"]
    edel.update({k: v for k, v in HAUPT_EDEL.items()})
    namen = {b[0] for b in edel.get("begriffe", [])}
    edel["begriffe"] = edel.get("begriffe", []) + [b for b in EDEL_BEGRIFFE_NEU if b[0] not in namen]
    if "metalle" not in hk:
        i = [h["id"] for h in g["hauptklassen"]].index("edelmetalle")
        g["hauptklassen"].insert(i + 1, HAUPT_IND)
    else:
        hk["metalle"].update(HAUPT_IND)
    alt = {a["id"]: a for a in g["assets"]}
    alt["gold"]["metall"], alt["gold"]["wirkung_knoten"] = GOLD_METALL, ["gold"]
    alt["silber"]["metall"], alt["silber"]["wirkung_knoten"] = SILBER_METALL, ["gold", "industriemetalle"]
    alt["goldminen"]["wirkung_knoten"] = ["gold"]
    # neue Assets hinter Silber (Edelmetalle) bzw. hinter den Rohstoffen einfügen
    for a in NEUE_ASSETS:
        if a["id"] in alt:
            alt[a["id"]].update({k: v for k, v in a.items() if k != "produkte"})
            continue
        if a["eltern"] == "edelmetalle":
            ids = [x["id"] for x in g["assets"]]
            pos = max(ids.index(x) for x in ("silber", "platin", "palladium", "rhodium") if x in ids) + 1
            g["assets"].insert(pos, a)
        else:
            g["assets"].append(a)
        alt[a["id"]] = a
    # Produkte ergänzen
    pf = D / "produkte.json"
    p = json.loads(pf.read_text(encoding="utf-8"))
    vorhanden = {x["isin"] for x in p["produkte"] if x["isin"]}
    kat = {"edelmetalle": "Edelmetalle", "metalle": "Industrie- & Zukunftsmetalle"}
    for asset_id, isin, name, anb, index, ertrag, repl, kl, st, bes in PRODUKTE:
        if isin in vorhanden:
            continue
        p["produkte"].append({"kategorie": kat[alt[asset_id]["eltern"]], "name": name, "isin": isin, "ticker": "", "anbieter": anb, "steuerklasse": st,
                              "klassen": kl or alt[asset_id]["klassen"], "id": isin, "asset": asset_id, "index": index, "ertrag": ertrag,
                              "replikation": repl, "besonderheit": bes, "geprueft": False,
                              "links": [{"titel": "justETF", "url": f"https://www.justetf.com/de/etf-profile.html?isin={isin}"}]})
    pf.write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
    for a in g["assets"]:
        a["produkte"] = [x["id"] for x in p["produkte"] if x.get("asset") == a["id"]]
    (D / "glossar.json").write_text(json.dumps(g, ensure_ascii=False, indent=1), encoding="utf-8")
    # Wirkungsgefüge
    w = json.loads((D / "wirkung.json").read_text(encoding="utf-8"))
    ids = {k["id"] for k in w["knoten"]}
    w["knoten"] = [k for k in w["knoten"] if k["id"] not in {n["id"] for n in WIRKUNG_KNOTEN}] + WIRKUNG_KNOTEN
    kurz = {"tech": "Tech-Aktien", "em": "Schwellenl.", "tagesgeld": "Tagesgeld", "anleihen": "Anleihen", "kreditstress": "Kreditstress"}
    for k in w["knoten"]:
        if k["id"] in kurz:
            k["kurz"] = kurz[k["id"]]
    paare = {(k["von"], k["nach"]) for k in w["kanten"]}
    w["kanten"] += [k for k in WIRKUNG_KANTEN if (k["von"], k["nach"]) not in paare]
    (D / "wirkung.json").write_text(json.dumps(w, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(g["assets"]), "Assets,", len(p["produkte"]), "Produkte,", len(w["knoten"]), "Knoten,", len(w["kanten"]), "Kanten")


if __name__ == "__main__":
    main()
