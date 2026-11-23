import json
from datetime import date, timedelta

import pytest

from app import products, research

RSS = """<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title>EZB senkt Zinsen</title><link>https://ex.de/1</link><pubDate>Mon, 17 Nov 2026 10:00:00 +0100</pubDate>
<description>&lt;p&gt;Die Notenbank senkt den Leitzins.&lt;/p&gt;</description></item>
<item><title>Wahl in Frankreich</title><link>https://ex.de/2</link><pubDate>Tue, 18 Nov 2026 10:00:00 +0100</pubDate></item>
</channel></rss>"""

RDF = """<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item><title>Gold auf Rekordhoch</title><link>https://dw.com/a</link><dc:date>2026-11-19T08:00:00Z</dc:date></item></rdf:RDF>"""

EZB = "KEY,TIME_PERIOD,OBS_VALUE\nFM.B,2026-11-20,2.0\n"


def test_rss_parser():
    items = research.parse_feed(RSS, "tagesschau", "wirtschaft")
    assert [i["titel"] for i in items] == ["EZB senkt Zinsen", "Wahl in Frankreich"]
    assert items[0]["datum"] == "2026-11-17"
    assert items[0]["text"] == "Die Notenbank senkt den Leitzins."


def test_rdf_parser():
    items = research.parse_feed(RDF, "DW", "geopolitik")
    assert items[0]["titel"] == "Gold auf Rekordhoch" and items[0]["datum"] == "2026-11-19"


def fake_fetch(url, params=None, headers=None):
    if "ecb.europa.eu/service" in url:
        return EZB
    if "dw.com" in url:
        raise ConnectionError("weg")
    return RSS


def test_collect_kaputte_quelle_stoppt_nichts():
    items, fehler = research.collect("frage", "Was macht die EZB mit den Zinsen?", "alles", fake_fetch)
    assert any("Deutsche Welle" in f for f in fehler)
    assert items[0]["quelle"] == "EZB Data Portal"
    titel = [i["titel"] for i in items]
    assert titel.index("EZB senkt Zinsen") < titel.index("Wahl in Frankreich")


def test_recherche_lauf_speichert_quellen(conn, user):
    rid = research.start(conn, user, "briefing", "Geldpolitik")
    calls = []

    def chat(conn_, rolle, messages):
        calls.append(messages[1]["content"])
        return "Antwort [1]", "fake", "m"

    research.run(conn, rid, "geldpolitik", chat, fake_fetch)
    r = research.get(conn, user, rid)
    assert r["status"] == "fertig" and r["answer"].startswith("Antwort")
    assert r["quellen"] and all("abgerufen" in q for q in r["quellen"])
    assert "[1]" in calls[0]


def test_recherche_ohne_quellen_ohne_modell(conn, user):
    rid = research.start(conn, user, "frage", "Irgendwas")

    def kaputt(url, params=None, headers=None):
        raise ConnectionError()

    def chat(*a):
        raise AssertionError("Modell darf ohne Material nicht gefragt werden")

    research.run(conn, rid, "alles", chat, kaputt)
    assert "Keine Quelle" in research.get(conn, user, rid)["answer"]


def test_kpis_bekannte_reihe():
    heute = date(2026, 1, 1)
    hist = [((heute - timedelta(days=6 * 365 - i)).isoformat(), 100.0) for i in range(6 * 365 + 1)]
    # Einbruch auf 60 und Erholung
    hist[-400] = (hist[-400][0], 60.0)
    k = products.kpis(hist, heute)
    assert k["rendite_1j"] == pytest.approx(0)
    assert k["max_verlust"] == pytest.approx(-40)
    assert k["volatilitaet"] > 0


def test_bewertung_regeln():
    b = {x["kpi"]: x["note"] for x in products.bewerte({"ter": 0.12, "volumen_mio": 50, "max_verlust": -30})}
    assert b == {"ter": "gut", "volumen_mio": "schwach", "max_verlust": "mittel"}


def test_fakt_ohne_quelle_abgelehnt(conn):
    with pytest.raises(ValueError):
        products.setze_fakt(conn, "IE00B4L5Y983", "ter", 0.2, " ")
    products.setze_fakt(conn, "IE00B4L5Y983", "ter", 0.2, "ishares.com Factsheet")
    assert products.fakten(conn, "IE00B4L5Y983")["ter"]["quelle"] == "ishares.com Factsheet"


def test_katalog_benchmark_vorhanden():
    assert products.finde("IE00B4L5Y983")["ticker"] == "EUNL.DE"
    assert json.dumps(products.katalog_fuer_modell.__doc__ or "") is not None


def test_gold_physisch_eigene_kennung():
    assert products.finde("GOLD-PHYSISCH")["name"].startswith("Gold physisch")
    assert products.finde("4GLD.DE")["isin"] == "DE000A0S9GB0"
