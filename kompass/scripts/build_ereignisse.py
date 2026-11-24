"""Baut data/ereignisse.json: historische Extremereignisse mit Ursachen (Text) und
Kennzahlen, die aus den Rohdaten berechnet werden (keine Zahlen aus dem Gedächtnis).

Aufruf (aus kompass/): python scripts/build_ereignisse.py
Rohdaten: data/raw/sp500.csv (Shiller: S&P 500, KGV10/CAPE, 10J-Zins, CPI), data/raw/gold.csv (Weltbank).
Zahlen in den Texten sind als Größenordnung gekennzeichnet.
"""
import csv
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RAW = BASE / "data" / "raw"
OUT = BASE / "data" / "ereignisse.json"

# Texte: Ursachen, Verlauf, Lehren. "fenster" = Zeitraum für die Berechnung (Monat von, Monat bis).
EREIGNISSE = [
    {
        "id": "hyperinflation_1923", "name": "Hyperinflation in Deutschland", "zeitraum": "1919–1923", "kategorie": "Inflation",
        "kurz": "Die Mark verlor fast ihren gesamten Wert. Ersparnisse wurden ausgelöscht, Sachwerte blieben erhalten.",
        "ursachen": ["Kriegsfinanzierung über die Notenpresse statt über Steuern", "Reparationen nach dem Ersten Weltkrieg in Gold und Devisen",
                     "Ruhrbesetzung 1923: Produktion brach ein, die Regierung bezahlte den Streik mit neuem Geld", "Vertrauensverlust in die Währung beschleunigte die Flucht in Sachwerte"],
        "verlauf": [{"zeitraum": "1919–1921", "was": "Hohe, aber noch beherrschbare Inflation."},
                    {"zeitraum": "1922–1923", "was": "Preise verdoppelten sich zuletzt innerhalb von Tagen; Löhne wurden täglich ausgezahlt."},
                    {"zeitraum": "Ende 1923", "was": "Währungsreform mit der Rentenmark beendete die Hyperinflation."}],
        "auswirkungen": {"geldmarkt": "Totalverlust aller Ersparnisse und Anleihen in Mark", "anleihen": "Praktisch wertlos", "aktien_welt": "Nominal astronomisch gestiegen, real stark schwankend", "gold": "Erhielt die Kaufkraft", "immobilien": "Sachwert blieb, Hypotheken wurden entwertet"},
        "lehren": ["Geldwert hängt am Vertrauen in Staat und Notenbank", "Nominalwerte (Konten, Anleihen) sind bei Geldentwertung am stärksten gefährdet", "Streuung über Sachwerte schützt"],
        "heute_achten": ["Staatsfinanzierung durch die Notenbank", "Inflation deutlich über Zins (negativer Realzins)", "Vertrauensverlust in eine Währung"],
        "fenster": None, "daten_hinweis": "Keine Kompass-Daten für Deutschland 1923 – nur qualitativ.",
    },
    {
        "id": "crash_1929", "name": "Börsencrash 1929 und Große Depression", "zeitraum": "1929–1932", "kategorie": "Crash & Depression",
        "kurz": "Der größte Börsencrash des 20. Jahrhunderts. US-Aktien verloren den Großteil ihres Werts, die Weltwirtschaft brach ein.",
        "ursachen": ["Spekulationsblase mit Aktienkäufen auf Kredit", "Sehr hohe Bewertungen nach den „Goldenen Zwanzigern“", "Notenbank straffte zu spät und dann falsch, Bankenpleiten wurden nicht verhindert",
                     "Goldstandard verhinderte Geldpolitik gegen die Deflation", "Handelskrieg (Smoot-Hawley-Zölle 1930) verschärfte den Einbruch"],
        "verlauf": [{"zeitraum": "Okt. 1929", "was": "Schwarzer Donnerstag und Dienstag: Panikverkäufe."},
                    {"zeitraum": "1930–1932", "was": "Bankenpleiten, Deflation, Massenarbeitslosigkeit; Aktien fielen weiter bis zum Tief 1932."},
                    {"zeitraum": "ab 1933", "was": "Abkehr vom Goldstandard und Konjunkturpolitik leiteten die Erholung ein."}],
        "auswirkungen": {"aktien_usa": "Verlust des Großteils des Werts (siehe Kennzahlen)", "anleihen": "Staatsanleihen stabil, Unternehmensanleihen fielen aus", "gold": "Preis staatlich fixiert, 1934 aufgewertet", "geldmarkt": "Bankeinlagen ohne Sicherung gingen verloren"},
        "lehren": ["Kredit-finanzierte Spekulation verstärkt Crashs", "Notenbanken müssen in Krisen Liquidität geben", "Erholung auf das alte Hoch kann Jahrzehnte dauern – ohne Dividenden noch länger"],
        "heute_achten": ["Sehr hohes Shiller-KGV", "Wertpapierkredite auf Rekordniveau", "Zölle und Handelskonflikte"],
        "fenster": ["1929-01", "1936-12"],
    },
    {
        "id": "oelkrise_1973", "name": "Ölkrise und Stagflation", "zeitraum": "1973–1974", "kategorie": "Inflation & Ölschock",
        "kurz": "Ein Ölembargo vervielfachte den Ölpreis. Hohe Inflation traf auf schwaches Wachstum – Aktien und Anleihen verloren gleichzeitig.",
        "ursachen": ["Ölembargo arabischer Förderländer nach dem Jom-Kippur-Krieg", "Ende des Bretton-Woods-Systems 1971: Dollar nicht mehr an Gold gebunden", "Zu lockere Geldpolitik in den Jahren davor", "Hohe Bewertungen der „Nifty Fifty“-Wachstumsaktien"],
        "verlauf": [{"zeitraum": "1973", "was": "Ölpreis vervielfacht sich (Größenordnung: Vervierfachung), Inflation steigt."},
                    {"zeitraum": "1974", "was": "Rezession, Aktien fallen weiter, Anleihen verlieren real."},
                    {"zeitraum": "1975–1980", "was": "Erholung der Aktien, aber hohe Inflation bleibt bis Anfang der 1980er."}],
        "auswirkungen": {"aktien_usa": "Starker Einbruch (siehe Kennzahlen)", "anleihen": "Real deutliche Verluste", "gold": "Starker Anstieg (siehe Kennzahlen)", "rohstoffe_oel": "Ölpreis vervielfacht"},
        "lehren": ["In Stagflation versagen Aktien und Anleihen gleichzeitig", "Gold und Rohstoffe schützen", "Energieabhängigkeit ist ein Marktrisiko"],
        "heute_achten": ["Inflation über dem Notenbankziel", "Energiepreisschocks", "Hohe Bewertungen weniger Großkonzerne"],
        "fenster": ["1972-06", "1976-12"],
    },
    {
        "id": "volcker_1980", "name": "Volcker-Zinsschock", "zeitraum": "1979–1982", "kategorie": "Zinsschock",
        "kurz": "Die US-Notenbank hob die Zinsen auf Rekordniveau, um die Inflation zu brechen. Es folgten zwei Rezessionen – und danach ein jahrzehntelanger Aufschwung.",
        "ursachen": ["Inflation im zweistelligen Bereich nach zwei Ölkrisen", "Neuer Fed-Chef Paul Volcker stellte die Inflationsbekämpfung über alles", "Leitzins zeitweise bei rund 20 % (Größenordnung)"],
        "verlauf": [{"zeitraum": "1979–1980", "was": "Drastische Zinserhöhungen, kurze Rezession."},
                    {"zeitraum": "1981–1982", "was": "Zweite, tiefe Rezession; Aktien bewertet so günstig wie selten."},
                    {"zeitraum": "ab Aug. 1982", "was": "Zinsen sinken, Beginn eines langen Bullenmarkts für Aktien und Anleihen."}],
        "auswirkungen": {"anleihen": "Erst Verluste, danach die beste Anleihenphase der Geschichte", "aktien_usa": "Seitwärts mit Einbrüchen, extrem niedriges KGV", "gold": "Spitze 1980, danach jahrzehntelanger Abschwung"},
        "lehren": ["Hohe Zinsen brechen Inflation – mit Rezession als Preis", "Günstige Bewertungen am Tiefpunkt legen die Basis für hohe Renditen danach", "Gold-Spitzen nach Inflationsphasen können lange Durststrecken einleiten"],
        "heute_achten": ["Abstand zwischen Leitzins und Inflation (Realzins)", "Inverse Zinskurve als Rezessionssignal"],
        "fenster": ["1979-06", "1983-06"],
    },
    {
        "id": "black_monday_1987", "name": "Schwarzer Montag", "zeitraum": "Oktober 1987", "kategorie": "Crash",
        "kurz": "Der größte Tagesverlust der US-Börsengeschichte. Die Wirtschaft blieb stabil, die Kurse erholten sich innerhalb von rund zwei Jahren.",
        "ursachen": ["Computergesteuerter Programmhandel und „Portfolio-Versicherung“ verstärkten Verkäufe", "Steigende Zinsen und schwacher Dollar", "Starker Anstieg in den Monaten davor"],
        "verlauf": [{"zeitraum": "19. Okt. 1987", "was": "Dow Jones verliert an einem Tag rund 22 % (Größenordnung)."},
                    {"zeitraum": "Danach", "was": "Fed sichert Liquidität zu; keine Rezession, Erholung bis 1989."}],
        "auswirkungen": {"aktien_usa": "Kurzer, heftiger Einbruch (Monatsdaten glätten den Tagesverlust)", "anleihen": "Gewinne als sicherer Hafen"},
        "lehren": ["Crashs ohne Wirtschaftskrise erholen sich meist schnell", "Wer nicht verkauft, verliert am Ende wenig", "Markttechnik kann Panik verstärken"],
        "heute_achten": ["Hoher Anteil automatisierter und gehebelter Strategien", "Starke Kursanstiege in kurzer Zeit"],
        "fenster": ["1987-06", "1989-12"], "hoch_bis": "1987-10",
    },
    {
        "id": "japan_1990", "name": "Platzen der Japan-Blase", "zeitraum": "1990–2003", "kategorie": "Blase",
        "kurz": "Aktien und Immobilien in Japan waren extrem überbewertet. Der Nikkei brauchte über drei Jahrzehnte bis zum alten Hoch.",
        "ursachen": ["Extrem lockere Geldpolitik in den 1980ern", "Aktien-KGVs und Bodenpreise auf irrealen Niveaus", "Verflechtung von Banken und Unternehmen über Kredite und Beteiligungen", "Zinserhöhungen der Bank of Japan ab 1989 ließen die Blase platzen"],
        "verlauf": [{"zeitraum": "1990–1992", "was": "Nikkei halbiert sich (Größenordnung)."},
                    {"zeitraum": "1990er–2000er", "was": "„Verlorene Jahrzehnte“: Deflation, Bankenkrise, mehrere weitere Einbrüche."},
                    {"zeitraum": "2024", "was": "Der Nikkei erreicht erstmals wieder das Hoch von 1989."}],
        "auswirkungen": {"aktien_welt": "Japan war damals der größte Teil des Weltaktienmarkts – Länderklumpen kosteten Jahrzehnte", "immobilien": "Bodenpreise fielen über viele Jahre", "anleihen": "Japanische Staatsanleihen stiegen bei sinkenden Zinsen"},
        "lehren": ["Ein einzelnes Land kann jahrzehntelang zurückbleiben – Streuung über Länder ist wichtig", "Extreme Bewertungen sind kein kurzfristiges, aber ein langfristiges Risiko", "Auch Immobilien können lange fallen"],
        "heute_achten": ["Hoher Länderanteil (heute: USA im MSCI World)", "Bewertungen weit über dem historischen Mittel"],
        "fenster": None, "daten_hinweis": "Keine japanischen Daten in Kompass – nur qualitativ.",
    },
    {
        "id": "asienkrise_1997", "name": "Asien- und Russlandkrise, LTCM", "zeitraum": "1997–1998", "kategorie": "Währungskrise",
        "kurz": "Mehrere asiatische Währungen brachen ein, Russland wurde zahlungsunfähig, ein großer Hedgefonds musste gerettet werden.",
        "ursachen": ["Hohe Auslandsschulden in Dollar bei festen Wechselkursen", "Spekulative Kapitalzuflüsse in Immobilien und Aktien", "Russlands Staatspleite 1998", "LTCM: extrem gehebelter Hedgefonds verlor seine Wetten"],
        "verlauf": [{"zeitraum": "Juli 1997", "was": "Thailand gibt den Baht frei, Krise erfasst Indonesien, Südkorea, Malaysia."},
                    {"zeitraum": "Aug.–Sep. 1998", "was": "Russland-Pleite, LTCM-Rettung durch Banken unter Aufsicht der Fed."},
                    {"zeitraum": "Ende 1998", "was": "Zinssenkungen, US-Aktien erholen sich schnell."}],
        "auswirkungen": {"aktien_em": "Schwellenländer brachen stark ein", "aktien_usa": "Kurzer Rücksetzer, schnelle Erholung", "anleihen": "Flucht in US-Staatsanleihen"},
        "lehren": ["Schulden in Fremdwährung sind gefährlich", "Hebel macht aus kleinen Fehlern Pleiten", "Krisen in Schwellenländern erreichen Industrieländer oft nur kurz"],
        "heute_achten": ["Dollar-Schulden von Schwellenländern bei starkem Dollar", "Hoher Hebel bei Fonds"],
        "fenster": ["1997-06", "1999-06"], "hoch_bis": "1998-08",
    },
    {
        "id": "dotcom_2000", "name": "Dotcom-Blase", "zeitraum": "2000–2002", "kategorie": "Blase",
        "kurz": "Internet-Aktien wurden ohne Gewinne zu Fantasiepreisen gehandelt. Nach dem Platzen verlor der Nasdaq rund 80 % (Größenordnung).",
        "ursachen": ["Euphorie über das Internet: Umsatzwachstum zählte mehr als Gewinne", "Rekord-Bewertungen (höchstes Shiller-KGV der Geschichte, siehe Kennzahlen)", "Billiges Kapital und eine Flut an Börsengängen", "Zinserhöhungen der Fed 1999–2000"],
        "verlauf": [{"zeitraum": "März 2000", "was": "Nasdaq erreicht den Höchststand."},
                    {"zeitraum": "2000–2002", "was": "Viele Internetfirmen gehen pleite, auch der breite Markt fällt; 9/11 und Bilanzskandale (Enron) verschärfen den Abschwung."},
                    {"zeitraum": "2003–2007", "was": "Erholung des breiten Markts; der Nasdaq-100 erreicht sein altes Hoch erst rund 15 Jahre später (Größenordnung)."}],
        "auswirkungen": {"aktien_tech": "Einbruch um rund 80 % (Größenordnung)", "aktien_usa": "Breiter Markt fiel deutlich (siehe Kennzahlen)", "anleihen": "Gewinne durch sinkende Zinsen", "gold": "Bodenbildung, danach Beginn eines langen Aufschwungs"},
        "lehren": ["Eine richtige Technologie-These schützt nicht vor einer falschen Bewertung", "Bei extremen KGVs folgten historisch schwache 10-Jahres-Renditen", "Branchenklumpen können Jahrzehnte kosten"],
        "heute_achten": ["Hohe Bewertungen von Technologie-/KI-Konzernen", "Konzentration weniger Firmen im Index", "Börsengang-Welle und Hype-Themen"],
        "fenster": ["1999-06", "2004-12"],
    },
    {
        "id": "finanzkrise_2008", "name": "Globale Finanzkrise", "zeitraum": "2007–2009", "kategorie": "Bankenkrise",
        "kurz": "Faule US-Immobilienkredite brachten das Bankensystem an den Rand des Zusammenbruchs. Weltweit fielen Aktien um mehr als die Hälfte (Größenordnung).",
        "ursachen": ["Kredite an Hauskäufer ohne ausreichende Bonität (Subprime)", "Verbriefung: Risiken wurden in komplexe Papiere verpackt und weltweit verkauft", "Extremer Hebel bei Banken", "Pleite von Lehman Brothers im September 2008 löste Panik aus"],
        "verlauf": [{"zeitraum": "2007", "was": "Erste Hedgefonds und Kreditfonds geraten in Schieflage."},
                    {"zeitraum": "Sep. 2008", "was": "Lehman-Pleite, Rettung von AIG, Interbankenmarkt friert ein."},
                    {"zeitraum": "März 2009", "was": "Tiefpunkt; Notenbanken senken Zinsen auf null und kaufen Anleihen."},
                    {"zeitraum": "2009–2013", "was": "Erholung der Aktien; US-Markt erreicht das alte Hoch rund 2013 (Größenordnung)."}],
        "auswirkungen": {"aktien_welt": "Einbruch um mehr als die Hälfte (Größenordnung)", "immobilien": "Starker Einbruch, vor allem REITs", "anleihen": "Staatsanleihen gewannen, Unternehmensanleihen fielen", "gold": "Kurz gefallen, danach starker Anstieg"},
        "lehren": ["Hebel und Intransparenz im Finanzsystem sind die gefährlichste Mischung", "Staatsanleihen sind in echten Krisen der beste Puffer", "Wer in der Panik verkaufte, verpasste die Erholung"],
        "heute_achten": ["Spreads von Hochzinsanleihen (Stress im Kreditmarkt)", "Immobilienpreise im Verhältnis zu Einkommen", "Hebel außerhalb der regulierten Banken (Schattenbanken, Private Credit)"],
        "fenster": ["2007-06", "2013-06"],
    },
    {
        "id": "eurokrise_2011", "name": "Euro-Schuldenkrise", "zeitraum": "2010–2012", "kategorie": "Schuldenkrise",
        "kurz": "Griechenland, Irland, Portugal, Spanien und Italien gerieten unter Druck. Der Euro stand auf der Kippe, bis die EZB eingriff.",
        "ursachen": ["Hohe Staatsschulden und Haushaltsdefizite", "Banken- und Immobilienkrisen nach 2008", "Gemeinsame Währung ohne gemeinsame Finanzpolitik", "Teufelskreis zwischen Staaten und heimischen Banken"],
        "verlauf": [{"zeitraum": "2010", "was": "Erstes Hilfspaket für Griechenland."},
                    {"zeitraum": "2011", "was": "Krise erfasst Italien und Spanien, Aktienmärkte fallen deutlich."},
                    {"zeitraum": "Juli 2012", "was": "Draghi: „Whatever it takes“ – die EZB beruhigt die Märkte."}],
        "auswirkungen": {"anleihen": "Bundesanleihen gesucht, Südländer-Anleihen brachen ein", "aktien_welt": "Europäische Banken stark unter Druck", "gold": "Allzeithoch 2011"},
        "lehren": ["Staatsanleihen sind nicht automatisch sicher", "Notenbanken sind der letzte Rettungsanker", "Ländergewichtung innerhalb Europas zählt"],
        "heute_achten": ["Zinsabstand Italien–Deutschland", "Staatsverschuldung bei steigenden Zinsen"],
        "fenster": ["2010-01", "2013-06"],
    },
    {
        "id": "corona_2020", "name": "Corona-Crash", "zeitraum": "Februar–März 2020", "kategorie": "Pandemie",
        "kurz": "Der schnellste Einbruch der Börsengeschichte – und eine der schnellsten Erholungen dank massiver Hilfen.",
        "ursachen": ["Weltweite Lockdowns stoppten Teile der Wirtschaft schlagartig", "Ölpreis-Kollaps (US-Öl kurzzeitig negativ)", "Panik an den Kreditmärkten"],
        "verlauf": [{"zeitraum": "Feb.–März 2020", "was": "Aktien verlieren innerhalb weniger Wochen rund ein Drittel (Größenordnung)."},
                    {"zeitraum": "ab April 2020", "was": "Nullzinsen, Anleihekäufe und staatliche Hilfspakete in Rekordhöhe."},
                    {"zeitraum": "Aug. 2020", "was": "S&P 500 wieder auf Rekordhoch (Größenordnung)."}],
        "auswirkungen": {"aktien_welt": "Kurzer, heftiger Einbruch, schnelle Erholung", "aktien_tech": "Gewinner der Krise", "rohstoffe_oel": "Kollaps", "gold": "Neues Allzeithoch", "krypto": "Erst Einbruch, dann Boom"},
        "lehren": ["Schnelle, entschlossene Hilfen verkürzen Krisen", "Verkaufen in der Panik ist meist der größte Fehler", "Die Hilfen legten den Grund für die Inflation danach"],
        "heute_achten": ["Fear-&-Greed-Index in „extremer Angst“ als Zeichen für Panik", "Geld- und Fiskalpolitik als Gegenkraft"],
        "fenster": ["2019-12", "2021-06"], "hoch_bis": "2020-02",
    },
    {
        "id": "inflation_2022", "name": "Inflationsschub und Zinswende", "zeitraum": "2021–2023", "kategorie": "Inflation & Zinsschock",
        "kurz": "Die Inflation stieg so stark wie seit 40 Jahren. Notenbanken erhöhten so schnell wie nie – Aktien und Anleihen fielen gemeinsam.",
        "ursachen": ["Nachfrage nach Corona-Hilfen traf auf gestörte Lieferketten", "Energiepreisschock nach dem russischen Angriff auf die Ukraine", "Notenbanken reagierten spät („Inflation ist vorübergehend“)"],
        "verlauf": [{"zeitraum": "2021", "was": "Inflation steigt, Zinsen bleiben bei null."},
                    {"zeitraum": "2022", "was": "Schnellste Zinserhöhungen seit Jahrzehnten; Anleihen erleben eines ihrer schlechtesten Jahre."},
                    {"zeitraum": "2023", "was": "Inflation sinkt, Aktien erholen sich angeführt von KI-Konzernen."}],
        "auswirkungen": {"anleihen": "Zweistellige Verluste bei Staatsanleihen (Größenordnung)", "aktien_tech": "Starker Einbruch", "geldmarkt": "Zinsen auf Tagesgeld steigen wieder", "krypto": "Krypto-Winter mit Pleiten (Terra, FTX)", "gold": "Stabil trotz steigender Zinsen"},
        "lehren": ["Das klassische 60/40-Depot schützt nicht vor Inflation", "Lange Anleihen sind zinsempfindlich", "Notenbanken können sich irren"],
        "heute_achten": ["Kerninflation vs. Notenbankziel", "Realzins", "Zinskurve"],
        "fenster": ["2021-06", "2023-09"],
    },
    {
        "id": "krypto_winter_2022", "name": "Krypto-Winter", "zeitraum": "2022", "kategorie": "Blase",
        "kurz": "Bitcoin und andere Kryptowerte verloren den Großteil ihres Werts, große Plattformen gingen pleite.",
        "ursachen": ["Steigende Zinsen entzogen spekulativem Geld die Grundlage", "Zusammenbruch des algorithmischen Stablecoins Terra/UST", "Pleiten von Krypto-Verleihern und der Börse FTX (Betrug)"],
        "verlauf": [{"zeitraum": "Nov. 2021", "was": "Bitcoin auf Rekordhoch."},
                    {"zeitraum": "Mai–Nov. 2022", "was": "Terra-Kollaps, Celsius- und FTX-Pleite; Bitcoin fällt um rund drei Viertel (Größenordnung)."},
                    {"zeitraum": "2023–2024", "was": "Erholung, US-Bitcoin-ETFs werden zugelassen."}],
        "auswirkungen": {"krypto": "Einbruch um rund 75 % bei Bitcoin, stärker bei Altcoins (Größenordnung)"},
        "lehren": ["Krypto-Börsen sind keine Banken – Kundengelder können verloren gehen", "Stablecoins können ihre Bindung verlieren", "Krypto reagiert stark auf Zinsen und Liquidität"],
        "heute_achten": ["Hebel an Krypto-Börsen", "Zinsentwicklung", "Regulierung (MiCA in der EU)"],
        "fenster": None, "daten_hinweis": "Krypto-Kurse sind nicht in den Kompass-Langfristdaten – Kursverlauf im Glossar bei Bitcoin.",
    },
]


def lade():
    m = {}
    with open(RAW / "sp500.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            m[r["Date"][:7]] = {k: float(r[k]) for k in ("SP500", "Real Price", "Consumer Price Index", "Long Interest Rate", "PE10")}
    g = {}
    with open(RAW / "gold.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            g[r["Date"][:7]] = float(r["Price"])
    return m, g


def monate(von, bis):
    y, mo = int(von[:4]), int(von[5:7])
    out = []
    while f"{y:04d}-{mo:02d}" <= bis:
        out.append(f"{y:04d}-{mo:02d}")
        mo += 1
        if mo > 12:
            y, mo = y + 1, 1
    return out


def inflation_yoy(m, monat):
    y, mo = int(monat[:4]), monat[5:7]
    vor = f"{y - 1:04d}-{mo}"
    a, b = m.get(monat, {}).get("Consumer Price Index", 0), m.get(vor, {}).get("Consumer Price Index", 0)
    return a / b - 1 if a > 0 and b > 0 else None


def kennzahlen(e, m, g):
    von, bis = e["fenster"]
    ms = [x for x in monate(von, bis) if x in m and m[x]["SP500"] > 0]
    # Hoch: höchster Kurs in den ersten 18 Monaten des Fensters; Tief: niedrigster Kurs danach
    erste = [x for x in ms if x <= e["hoch_bis"]] if e.get("hoch_bis") else ms[:18]
    hoch = max(erste, key=lambda x: m[x]["SP500"])
    nach = [x for x in ms if x >= hoch]
    tief = min(nach, key=lambda x: m[x]["SP500"])
    alle = sorted(k for k in m if m[k]["SP500"] > 0)
    erholt = next((x for x in alle if x > tief and m[x]["SP500"] >= m[hoch]["SP500"]), None)
    erholt_real = next((x for x in alle if x > tief and m[x]["Real Price"] >= m[hoch]["Real Price"]), None)
    diff = lambda a, b: (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])  # noqa: E731
    ki = {
        "hoch": hoch, "tief": tief,
        "verlust_nominal": m[tief]["SP500"] / m[hoch]["SP500"] - 1,
        "verlust_real": m[tief]["Real Price"] / m[hoch]["Real Price"] - 1,
        "monate_bis_tief": diff(hoch, tief),
        "monate_bis_erholt": diff(hoch, erholt) if erholt else None,
        "monate_bis_erholt_real": diff(hoch, erholt_real) if erholt_real else None,
        "cape_hoch": m[hoch]["PE10"] or None, "cape_tief": m[tief]["PE10"] or None,
        "zins_hoch": m[hoch]["Long Interest Rate"] or None, "zins_tief": m[tief]["Long Interest Rate"] or None,
        "inflation_hoch": inflation_yoy(m, hoch),
        "inflation_max": max((v for v in (inflation_yoy(m, x) for x in ms) if v is not None), default=None),
        "gold_veraenderung": (g[bis] / g[von] - 1) if von in g and bis in g and int(von[:4]) >= 1972 else None,
    }
    # Monatsreihe für das Diagramm: realer Kurs, Hoch = 100 (12 Monate vor dem Fenster bis Fensterende)
    start = monate(f"{int(von[:4]) - 1:04d}{von[4:]}", von)[0]
    reihe = [x for x in monate(start, bis) if x in m and m[x]["Real Price"] > 0]
    basis = m[hoch]["Real Price"]
    ki["reihe"] = [[x, round(m[x]["Real Price"] / basis * 100, 2)] for x in reihe]
    if ki["gold_veraenderung"] is not None:
        ki["gold_reihe"] = [[x, round(g[x] / g[hoch] * 100, 2)] for x in reihe if x in g and hoch in g]
    return ki


def letzter_stand(m):
    mit = [k for k in sorted(m) if m[k]["PE10"] > 0 and m[k]["Long Interest Rate"] > 0]
    k = mit[-1]
    return {"monat": k, "cape": m[k]["PE10"], "zins": m[k]["Long Interest Rate"], "inflation": inflation_yoy(m, k)}


def build():
    m, g = lade()
    out = []
    for e in EREIGNISSE:
        e = dict(e)
        e["kennzahlen"] = kennzahlen(e, m, g) if e.get("fenster") else None
        out.append(e)
    daten = {
        "_hinweis": "Texte: Einordnung historischer Ereignisse; Zahlen im Text als Größenordnung markiert. Kennzahlen berechnet aus Shiller-Daten "
                    "(S&P 500 Monatsdurchschnitte, Shiller-KGV/CAPE, 10-jähriger US-Zins, US-Verbraucherpreise) und Weltbank-Goldpreisen. "
                    "Monatsdurchschnitte glätten Tagesextreme.",
        "quelle": "Robert Shiller (Yale) via datahub.io s-and-p-500; Weltbank Pink Sheet via datahub.io gold-prices",
        "letzter_stand": letzter_stand(m),
        "ereignisse": out,
    }
    OUT.write_text(json.dumps(daten, ensure_ascii=False, indent=1), encoding="utf-8")
    for e in out:
        k = e["kennzahlen"]
        if k:
            print(f"{e['id']:22} Hoch {k['hoch']} Tief {k['tief']} {k['verlust_nominal']:+.1%} real {k['verlust_real']:+.1%} CAPE {k['cape_hoch']} Zins {k['zins_hoch']} Inf {k['inflation_hoch']}")
    print("letzter Stand", daten["letzter_stand"])


if __name__ == "__main__":
    build()
