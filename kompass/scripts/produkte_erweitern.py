"""Erweitert data/produkte.json um weitere Produkte je Anlage.

ISINs, Namen und Eigenschaften stammen aus dem Kompass-Katalog und gelten als UNGEPRÜFT,
bis der Server sie über Yahoo Finance / justETF bestätigt (products.pruefen). Keine Zahlen.
"""
import json
from pathlib import Path

P = Path(__file__).resolve().parent.parent / "data" / "produkte.json"
T, A = "thesaurierend", "ausschüttend"
PH, SY, SA = "physisch", "synthetisch (Swap)", "physisch (Sampling)"
AK = {"aktien_welt": 1}
NEU = [
    # asset, isin, name, anbieter, index, ertrag, replikation, klassen, steuerklasse, besonderheit
    ("msci_world", "IE00BK1PV551", "Xtrackers MSCI World 1D", "Xtrackers", "MSCI World", A, PH, AK, "aktien_etf", "Ausschüttende Variante des großen Xtrackers-World-ETF."),
    ("msci_world", "IE00B0M62Q58", "iShares MSCI World (Dist)", "iShares", "MSCI World", A, SA, AK, "aktien_etf", "Einer der ältesten World-ETFs in Europa, ausschüttend."),
    ("msci_world", "LU1781541179", "Amundi Core MSCI World", "Amundi", "MSCI World", T, PH, AK, "aktien_etf", "Früher Lyxor; in Luxemburg aufgelegt."),
    ("msci_world", "LU0274208692", "Xtrackers MSCI World Swap 1C", "Xtrackers", "MSCI World", T, SY, AK, "aktien_etf", "Synthetisch: Indexrendite per Swap, kein direkter Aktienbesitz."),
    ("msci_world", "IE00B60SX394", "Invesco MSCI World", "Invesco", "MSCI World", T, SY, AK, "aktien_etf", "Synthetischer World-ETF; Swap kann steuerliche Vorteile bei US-Dividenden haben."),
    ("msci_world", "IE00BK5BQV03", "Vanguard FTSE Developed World (Acc)", "Vanguard", "FTSE Developed", T, SA, AK, "aktien_etf", "FTSE-Index statt MSCI, sonst sehr ähnlich (Industrieländer)."),
    ("msci_world", "IE00BKX55T58", "Vanguard FTSE Developed World (Dist)", "Vanguard", "FTSE Developed", A, SA, AK, "aktien_etf", "Ausschüttende Variante."),
    ("all_world", "IE00B3RBWM25", "Vanguard FTSE All-World (Dist)", "Vanguard", "FTSE All-World", A, SA, {"aktien_welt": 0.9, "aktien_em": 0.1}, "aktien_etf", "Ausschüttende Variante des bekannten All-World-ETF."),
    ("all_world", "IE00B44Z5B48", "SPDR MSCI ACWI", "SPDR", "MSCI ACWI", T, SA, {"aktien_welt": 0.9, "aktien_em": 0.1}, "aktien_etf", "Welt inkl. Schwellenländer, ohne Small Caps."),
    ("welt_faktor", "IE00BP3QZ825", "iShares Edge MSCI World Momentum Factor", "iShares", "MSCI World Momentum", T, PH, AK, "aktien_etf", "Kauft die Gewinner der letzten Monate; schichtet regelmäßig um."),
    ("welt_faktor", "IE00BP3QZ601", "iShares Edge MSCI World Quality Factor", "iShares", "MSCI World Sector Neutral Quality", T, PH, AK, "aktien_etf", "Firmen mit hoher Eigenkapitalrendite, wenig Schulden, stabilen Gewinnen."),
    ("welt_faktor", "IE00BP3QZB59", "iShares Edge MSCI World Value Factor", "iShares", "MSCI World Enhanced Value", T, PH, AK, "aktien_etf", "Günstig bewertete Firmen; lief in Tech-Booms schwächer."),
    ("welt_faktor", "IE00B8FHGS14", "iShares Edge MSCI World Minimum Volatility", "iShares", "MSCI World Minimum Volatility", T, PH, AK, "aktien_etf", "Ziel: geringere Schwankung; fiel in Crashs historisch weniger stark."),
    ("welt_faktor", "IE00BL25JP72", "Xtrackers MSCI World Momentum", "Xtrackers", "MSCI World Momentum", T, PH, AK, "aktien_etf", "Momentum-Faktor von Xtrackers."),
    ("welt_faktor", "IE00BL25JL35", "Xtrackers MSCI World Value", "Xtrackers", "MSCI World Enhanced Value", T, PH, AK, "aktien_etf", "Value-Faktor von Xtrackers."),
    ("welt_faktor", "IE00BL25JN58", "Xtrackers MSCI World Minimum Volatility", "Xtrackers", "MSCI World Minimum Volatility", T, PH, AK, "aktien_etf", "Minimum-Volatility-Faktor von Xtrackers."),
    ("welt_faktor", "IE00BL25JM42", "Xtrackers MSCI World Quality", "Xtrackers", "MSCI World Sector Neutral Quality", T, PH, AK, "aktien_etf", "Quality-Faktor von Xtrackers."),
    ("welt_smallcap", "IE00BF4RFH31", "iShares MSCI World Small Cap", "iShares", "MSCI World Small Cap", T, SA, AK, "aktien_etf", "Tausende kleine Firmen aus Industrieländern."),
    ("welt_smallcap", "IE00BCBJG560", "SPDR MSCI World Small Cap", "SPDR", "MSCI World Small Cap", T, SA, AK, "aktien_etf", "Alternative zu iShares für Small Caps Welt."),
    ("welt_dividende", "IE00B8GKDB10", "Vanguard FTSE All-World High Dividend Yield (Dist)", "Vanguard", "FTSE All-World High Dividend Yield", A, SA, {"aktien_welt": 0.9, "aktien_em": 0.1}, "aktien_etf", "Sehr breit gestreuter Dividenden-ETF, ausschüttend."),
    ("welt_dividende", "IE00BK5BR626", "Vanguard FTSE All-World High Dividend Yield (Acc)", "Vanguard", "FTSE All-World High Dividend Yield", T, SA, {"aktien_welt": 0.9, "aktien_em": 0.1}, "aktien_etf", "Thesaurierende Variante."),
    ("welt_dividende", "IE00B9CQXS71", "SPDR S&P Global Dividend Aristocrats", "SPDR", "S&P Global Dividend Aristocrats", A, PH, AK, "aktien_etf", "Firmen mit mindestens 10 Jahren stabiler oder steigender Dividende."),
    ("welt_dividende", "DE000A0F5UH1", "iShares STOXX Global Select Dividend 100 (DE)", "iShares", "STOXX Global Select Dividend 100", A, PH, AK, "aktien_etf", "100 Firmen mit hoher Dividende; viel Finanz- und Versorgergewicht."),
    ("welt_dividende", "IE00B6YX5D40", "SPDR S&P US Dividend Aristocrats", "SPDR", "S&P High Yield Dividend Aristocrats", A, PH, {"aktien_usa": 1}, "aktien_etf", "US-Firmen mit langer Dividendenhistorie."),
    ("welt_dividende", "IE00B5M1WJ87", "SPDR S&P Euro Dividend Aristocrats", "SPDR", "S&P Euro High Yield Dividend Aristocrats", A, PH, AK, "aktien_etf", "Euro-Raum-Firmen mit stabiler Dividende."),
    ("welt_dividende", "DE0002635281", "iShares EURO STOXX Select Dividend 30 (DE)", "iShares", "EURO STOXX Select Dividend 30", A, PH, AK, "aktien_etf", "Nur 30 Werte – stark konzentriert."),
    ("welt_esg", "IE00BYX2JD69", "iShares MSCI World SRI", "iShares", "MSCI World SRI Select Reduced Fossil Fuel", T, PH, AK, "aktien_etf", "Strenger Nachhaltigkeitsfilter, deutlich weniger Firmen als der MSCI World."),
    ("welt_esg", "IE00BZ02LR44", "Xtrackers ESG MSCI World", "Xtrackers", "MSCI World ESG Leaders", T, PH, AK, "aktien_etf", "Wählt je Branche die nachhaltigsten Firmen."),
    ("welt_esg", "LU0629459743", "UBS MSCI World Socially Responsible", "UBS", "MSCI World SRI", A, PH, AK, "aktien_etf", "SRI-Variante von UBS, ausschüttend."),
    ("gleichgewichtet", "IE00BLNMYC90", "Xtrackers S&P 500 Equal Weight", "Xtrackers", "S&P 500 Equal Weight", T, PH, {"aktien_usa": 1}, "aktien_etf", "Alle 500 Firmen mit gleichem Gewicht."),
    ("gleichgewichtet", "IE00BNGJJT35", "Invesco S&P 500 Equal Weight", "Invesco", "S&P 500 Equal Weight", T, PH, {"aktien_usa": 1}, "aktien_etf", "Alternative Equal-Weight-Umsetzung."),
    ("sp500", "IE00B3XXRP09", "Vanguard S&P 500 (Dist)", "Vanguard", "S&P 500", A, PH, {"aktien_usa": 1}, "aktien_etf", "Ausschüttende Variante."),
    ("sp500", "IE00B6YX5C33", "SPDR S&P 500", "SPDR", "S&P 500", A, PH, {"aktien_usa": 1}, "aktien_etf", "Sehr günstiger S&P-500-ETF."),
    ("sp500", "IE00B3YCGJ38", "Invesco S&P 500", "Invesco", "S&P 500", T, SY, {"aktien_usa": 1}, "aktien_etf", "Synthetisch – kann bei US-Dividenden einen Steuervorteil haben."),
    ("sp500", "LU0490618542", "Xtrackers S&P 500 Swap 1C", "Xtrackers", "S&P 500", T, SY, {"aktien_usa": 1}, "aktien_etf", "Synthetische Alternative von Xtrackers."),
    ("nasdaq", "IE0032077012", "Invesco EQQQ Nasdaq-100 (Dist)", "Invesco", "Nasdaq-100", A, PH, {"aktien_tech": 1}, "aktien_etf", "Ältester Nasdaq-100-ETF in Europa, ausschüttend."),
    ("nasdaq", "IE00BFZXGZ54", "Invesco EQQQ Nasdaq-100 (Acc)", "Invesco", "Nasdaq-100", T, PH, {"aktien_tech": 1}, "aktien_etf", "Thesaurierende Variante."),
    ("em", "IE00B4L5YC18", "iShares MSCI EM (Acc)", "iShares", "MSCI Emerging Markets", T, SA, {"aktien_em": 1}, "aktien_etf", "Große und mittlere Firmen aus Schwellenländern."),
    ("em", "IE00B3VVMM84", "Vanguard FTSE Emerging Markets (Dist)", "Vanguard", "FTSE Emerging", A, SA, {"aktien_em": 1}, "aktien_etf", "FTSE zählt Südkorea zu den Industrieländern – anders als MSCI."),
    ("em", "IE00BK5BR733", "Vanguard FTSE Emerging Markets (Acc)", "Vanguard", "FTSE Emerging", T, SA, {"aktien_em": 1}, "aktien_etf", "Thesaurierende Variante."),
    ("em", "IE00B469F816", "SPDR MSCI Emerging Markets", "SPDR", "MSCI Emerging Markets", T, SA, {"aktien_em": 1}, "aktien_etf", "Alternative zu iShares."),
    ("europa", "IE00B4K48X80", "iShares Core MSCI Europe (Acc)", "iShares", "MSCI Europe", T, SA, AK, "aktien_etf", "Rund 400 Firmen aus Europa inkl. Großbritannien und Schweiz."),
    ("europa", "IE00B1YZSC51", "iShares Core MSCI Europe (Dist)", "iShares", "MSCI Europe", A, SA, AK, "aktien_etf", "Ausschüttende Variante."),
    ("europa", "IE00B945VV12", "Vanguard FTSE Developed Europe (Dist)", "Vanguard", "FTSE Developed Europe", A, SA, AK, "aktien_etf", "Breiter Europa-ETF von Vanguard."),
    ("europa", "LU0274209237", "Xtrackers MSCI Europe 1C", "Xtrackers", "MSCI Europe", T, PH, AK, "aktien_etf", "Europa-ETF von Xtrackers."),
    ("europa", "IE00B53L3W79", "iShares Core EURO STOXX 50 (Acc)", "iShares", "EURO STOXX 50", T, PH, AK, "aktien_etf", "Nur die 50 größten Firmen der Eurozone – konzentriert."),
    ("europa", "IE00B3VWMM18", "iShares MSCI EMU Small Cap", "iShares", "MSCI EMU Small Cap", T, SA, AK, "aktien_etf", "Kleine Firmen aus der Eurozone."),
    ("dax", "DE0005933931", "iShares Core DAX (DE)", "iShares", "DAX", T, PH, AK, "aktien_etf", "Die 40 größten deutschen Firmen."),
    ("dax", "LU0274211480", "Xtrackers DAX 1C", "Xtrackers", "DAX", T, PH, AK, "aktien_etf", "DAX-Alternative von Xtrackers."),
    ("dax", "DE0005933923", "iShares MDAX (DE)", "iShares", "MDAX", T, PH, AK, "aktien_etf", "Mittelgroße deutsche Firmen."),
    ("themen", "IE00BGV5VN51", "Xtrackers Artificial Intelligence & Big Data", "Xtrackers", "Nasdaq Global AI & Big Data", T, PH, {"aktien_tech": 1}, "aktien_etf", "KI- und Datenfirmen weltweit."),
    ("themen", "IE00BYZK4552", "iShares Automation & Robotics", "iShares", "iSTOXX FactSet Automation & Robotics", T, PH, {"aktien_tech": 1}, "aktien_etf", "Robotik und Automatisierung, gleichgewichtet."),
    ("themen", "IE00BYZK4776", "iShares Healthcare Innovation", "iShares", "iSTOXX FactSet Breakthrough Healthcare", T, PH, AK, "aktien_etf", "Biotech und Medizintechnik, sehr schwankungsanfällig."),
    ("themen", "IE00BM67HT60", "Xtrackers MSCI World Information Technology", "Xtrackers", "MSCI World Information Technology", T, PH, {"aktien_tech": 1}, "aktien_etf", "Tech-Sektor der Industrieländer – stark auf wenige Riesen konzentriert."),
    ("themen", "IE00BM67HK77", "Xtrackers MSCI World Health Care", "Xtrackers", "MSCI World Health Care", T, PH, AK, "aktien_etf", "Gesundheitssektor: eher defensiv."),
    ("themen", "IE000YYE6WK5", "VanEck Defense", "VanEck", "MarketVector Global Defense Industry", T, PH, AK, "aktien_etf", "Rüstungsunternehmen; ethisch umstritten, politisch getrieben."),
    ("themen", "IE00B1TXK627", "iShares Global Water", "iShares", "S&P Global Water", A, PH, AK, "aktien_etf", "Wasserversorger und Wassertechnik."),
    ("themen", "IE00BYWQWR46", "VanEck Video Gaming and eSports", "VanEck", "MarketVector Global Video Gaming & eSports ESG", T, PH, {"aktien_tech": 1}, "aktien_etf", "Videospiel-Branche."),
    ("staatsanleihen", "LU0290355717", "Xtrackers II Eurozone Government Bond 1C", "Xtrackers", "iBoxx € Sovereigns Eurozone", T, PH, {"anleihen": 1}, "anleihen_etf", "Alle Laufzeiten, Euro-Staaten."),
    ("staatsanleihen", "IE00B3DKXQ41", "iShares € Govt Bond 1-3yr", "iShares", "ICE Euro Government 1-3 Year", A, PH, {"anleihen": 1}, "anleihen_etf", "Kurze Laufzeiten: wenig Zinsrisiko."),
    ("staatsanleihen", "IE00B1FZS798", "iShares $ Treasury Bond 7-10yr", "iShares", "ICE US Treasury 7-10 Year", A, PH, {"anleihen": 1}, "anleihen_etf", "US-Staatsanleihen in Dollar – Währungsrisiko für Euro-Anleger."),
    ("staatsanleihen", "LU0378818131", "Xtrackers II Global Government Bond 1C EUR hedged", "Xtrackers", "FTSE World Government Bond (EUR hedged)", T, PH, {"anleihen": 1}, "anleihen_etf", "Weltweite Staatsanleihen, Währung abgesichert."),
    ("staatsanleihen", "IE00BDBRDM35", "iShares Core Global Aggregate Bond EUR hedged", "iShares", "Bloomberg Global Aggregate (EUR hedged)", T, SA, {"anleihen": 1}, "anleihen_etf", "Staats- und Unternehmensanleihen weltweit, Euro-abgesichert."),
    ("unternehmensanleihen", "IE00BZ163G84", "Vanguard EUR Corporate Bond", "Vanguard", "Bloomberg Euro Aggregate Corporate", A, SA, {"anleihen": 1}, "anleihen_etf", "Euro-Unternehmensanleihen guter Bonität."),
    ("hochzins", "IE00B66F4759", "iShares € High Yield Corp Bond", "iShares", "Markit iBoxx Euro Liquid High Yield", A, SA, {"anleihen": 0.5, "aktien_welt": 0.5}, "anleihen_etf", "Euro-Hochzinsanleihen; verhält sich in Krisen eher wie Aktien."),
    ("geldmarkt_etf", "FR0010510800", "Amundi Smart Overnight Return", "Amundi", "€STR", T, SY, {"geldmarkt": 1}, "anleihen_etf", "Bildet den Euro-Tageszins ab."),
    ("geldmarkt_etf", "IE00BCRY6557", "iShares € Ultrashort Bond", "iShares", "Markit iBoxx EUR Liquid Investment Grade Ultrashort", A, PH, {"geldmarkt": 1}, "anleihen_etf", "Sehr kurz laufende Anleihen – Tagesgeld-ähnlich mit etwas Kursschwankung."),
    ("gold", "IE00B579F325", "Invesco Physical Gold ETC", "Invesco", "Goldpreis", T, PH, {"gold": 1}, "sonstiges", "Physisch besichert, aber ohne Lieferanspruch – Gewinne sind steuerpflichtig (anders als Xetra-Gold)."),
    ("gold", "IE00B4ND3602", "iShares Physical Gold ETC", "iShares", "Goldpreis", T, PH, {"gold": 1}, "sonstiges", "Günstig, aber ohne Lieferanspruch – steuerpflichtig."),
    ("silber", "IE00B4NCWG09", "iShares Physical Silver ETC", "iShares", "Silberpreis", T, PH, {"gold": 0.6, "rohstoffe_oel": 0.4}, "sonstiges", "Physisch besichertes Silber ohne Mehrwertsteuer, steuerpflichtig."),
    ("goldminen", "IE00BQQP9F84", "VanEck Gold Miners", "VanEck", "NYSE Arca Gold Miners", A, PH, {"goldminen": 1}, "aktien_etf", "Große Goldförderer weltweit."),
    ("rohstoffe_breit", "IE00BDFL4P12", "iShares Diversified Commodity Swap", "iShares", "Bloomberg Commodity", T, SY, {"rohstoffe_oel": 0.6, "gold": 0.2, "aktien_welt": 0.2}, "sonstiges", "Breiter Rohstoffkorb über Terminkontrakte."),
    ("reits", "IE00B8GF1M35", "VanEck Global Real Estate", "VanEck", "GPR Global 100", A, PH, {"immobilien": 1}, "aktien_etf", "100 große Immobilienfirmen weltweit."),
    ("krypto_etp", "DE000A28M8D0", "VanEck Bitcoin ETN", "VanEck", "Bitcoin", T, PH, {"krypto": 1}, "sonstiges", "Mit Bitcoin besicherte Schuldverschreibung."),
    ("krypto_etp", "GB00BJYDH287", "WisdomTree Physical Bitcoin", "WisdomTree", "Bitcoin", T, PH, {"krypto": 1}, "sonstiges", "Physisch besichertes Bitcoin-ETP."),
    ("krypto_etp", "DE000A27Z304", "ETC Group Physical Bitcoin (BTCE)", "ETC Group", "Bitcoin", T, PH, {"krypto": 1}, "krypto_direkt", "Deutsche Schuldverschreibung mit Lieferanspruch – steuerliche Behandlung wie Bitcoin direkt umstritten, prüfen."),
]
KAT = {"msci_world": "Aktien-ETF Welt", "all_world": "Aktien-ETF Welt", "welt_faktor": "Aktien-ETF Faktor", "welt_smallcap": "Aktien-ETF Welt", "welt_dividende": "Aktien-ETF Dividende",
       "welt_esg": "Aktien-ETF Nachhaltig", "gleichgewichtet": "Aktien-ETF USA", "sp500": "Aktien-ETF USA", "nasdaq": "Aktien-ETF Tech", "em": "Aktien-ETF Schwellenländer",
       "europa": "Aktien-ETF Europa", "dax": "Aktien-ETF Deutschland", "themen": "Aktien-ETF Themen", "staatsanleihen": "Anleihen", "unternehmensanleihen": "Anleihen", "hochzins": "Anleihen",
       "geldmarkt_etf": "Tagesgeld & Geldmarkt", "gold": "Edelmetalle", "silber": "Edelmetalle", "goldminen": "Edelmetalle", "rohstoffe_breit": "Rohstoffe", "reits": "Immobilien", "krypto_etp": "Krypto"}


def main():
    d = json.loads(P.read_text(encoding="utf-8"))
    vorhanden = {p["isin"] for p in d["produkte"] if p["isin"]}
    for p in d["produkte"]:
        p.setdefault("geprueft", False)
    n = 0
    for asset, isin, name, anb, index, ertrag, repl, kl, st, bes in NEU:
        if isin in vorhanden:
            continue
        d["produkte"].append({"kategorie": KAT[asset], "name": name, "isin": isin, "ticker": "", "anbieter": anb, "steuerklasse": st, "klassen": kl,
                              "id": isin, "asset": asset, "index": index, "ertrag": ertrag, "replikation": repl, "besonderheit": bes, "geprueft": False,
                              "links": [{"titel": "justETF", "url": f"https://www.justetf.com/de/etf-profile.html?isin={isin}"}]})
        n += 1
    d["_hinweis"] = ("Katalog. ISINs und Eigenschaften gelten als ungeprüft (geprueft=false), bis der Server sie über Yahoo Finance/justETF bestätigt. "
                     "Ticker leer = wird über die ISIN aufgelöst. Kennzahlen kommen live oder mit Quelle aus der App, nie aus dieser Datei.")
    P.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(n, "neu,", len(d["produkte"]), "gesamt")


if __name__ == "__main__":
    main()
