import json

import pytest

from app import berater, council, entwurf, glossar, research

NEWS = """<?xml version="1.0"?><rss><channel>
<item><title>EZB lässt Zinsen unverändert</title><link>https://news.google.com/a</link><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>
<source url="https://www.handelsblatt.com">Handelsblatt</source></item>
<item><title>Krypto-Geheimtipp!!!</title><link>https://news.google.com/b</link><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>
<source url="https://www.irgendein-blog.xyz">Blog</source></item>
</channel></rss>"""


def fetch(url, params=None, headers=None):
    if "news.google.com" in url:
        return NEWS
    raise ConnectionError()


def test_suche_nur_vertrauenswuerdige_quellen():
    items = research.suche("EZB Zinsen", fetch)
    assert [i["quelle"] for i in items] == ["Handelsblatt"]
    assert items[0]["domain"] == "handelsblatt.com"


def test_glossar_vollstaendig_und_mit_historie():
    d = glossar.daten()
    hk = {h["id"] for h in d["hauptklassen"]}
    for a in d["assets"]:
        assert a["eltern"] in hk and 1 <= a["risiko"] <= 5 and a["kurz"] and a["pro"] and a["contra"], a["id"]
    gold = glossar.finde("gold")
    assert gold["langfrist"]["zeitraum"][0] == 1972
    assert "steuerfrei" in gold["steuer"]
    assert "1.000 €" in glossar.finde("bitcoin")["steuer"]
    assert len(glossar.medien()["quellen"]) == 25


def test_entwurf_warenkorb(conn, user, user2):
    e = entwurf.hinzufuegen(conn, user, {"asset_id": "msci_world", "anteil": 70})
    e = entwurf.hinzufuegen(conn, user, {"asset_id": "bitcoin", "anteil": 5})
    assert [p["ticker"] for p in e["positionen"]] == ["EUNL.DE", "BTC-EUR"]
    with pytest.raises(ValueError, match="schon"):
        entwurf.hinzufuegen(conn, user, {"asset_id": "bitcoin"})
    assert entwurf.get(conn, user2)["positionen"] == []
    e["risiko"] = 9
    assert entwurf.speichern(conn, user, e)["risiko"] == 5
    p = entwurf.als_portfolio(entwurf.get(conn, user))
    assert p["positionen"][1]["klassen"] == {"krypto": 1.0}


def test_entwurf_ohne_ticker_nicht_speicherbar(conn, user):
    entwurf.hinzufuegen(conn, user, {"asset_id": "tagesgeld", "anteil": 20})
    with pytest.raises(ValueError, match="Ticker"):
        entwurf.als_portfolio(entwurf.get(conn, user))


def test_berater_mit_recherche_und_kritiker(conn, user):
    cid = berater.anlegen(conn, user, "Ich will ein spekulatives Depot")
    aufrufe = []

    def chat(c, rolle, messages):
        aufrufe.append(rolle)
        sys = messages[0]["content"]
        if "Recherche-Analyst" in sys:
            return "Antwort [1]", "fake", "m"
        if "Portfolio-Berater" in sys:
            if "Die Recherche ist jetzt im Material" in messages[1]["content"]:
                return json.dumps({"antwort": "Vorschlag", "vorschlag": {"name": "Wachstum", "positionen": [
                    {"asset_id": "msci_world", "anteil": 80, "warum": "Basis"}, {"asset_id": "gold_hebel", "anteil": 20}]},
                    "fragen": [], "profil": [{"key": "risiko", "value": "4"}], "recherche": ""}), "fake", "m"
            return json.dumps({"antwort": "Ich suche kurz", "recherche": "Goldpreis aktuell"}), "fake", "m"
        return json.dumps({"kommentar": "20 % Hebel ist zu viel", "gewichtungen": [{"name": "Gold gehebelt", "urteil": "zu hoch"}]}), "fake", "m"

    berater.antworten(conn, cid, "Was hältst du von Gold gehebelt?", chat, fetch)
    ms = berater.nachrichten(conn, cid)
    assert [m["rolle"] for m in ms] == ["nutzer", "system", "berater", "kritiker"]
    v = ms[2]["data"]["vorschlag"]["aufgeloest"]
    assert v[1]["hebel"] == 2 and v[1]["klassen"] == {"gold": 1.0}
    assert berater.chat_for(conn, user, cid)["research_ids"]
    assert berater.chat_for(conn, user, cid)["status"] == "bereit"


def test_berater_fehler(conn, user):
    cid = berater.anlegen(conn, user, "x")
    berater.antworten(conn, cid, "hallo", lambda c, r, m: ("kaputt", "f", "m"), fetch)
    assert berater.chat_for(conn, user, cid)["status"] == "fehler"


def test_council_recherche_anhaengen(conn, user):
    sid = council.create(conn, user, "Lohnt sich Gold bei den aktuellen Zinsen?")
    council.recherche_anhaengen(conn, sid, "EZB Zinsen", lambda c, r, m: ("Material [1]", "f", "m"), fetch)
    s = council.session_for(conn, user, sid)
    assert len(json.loads(s["research_ids"])) == 1
    assert council.messages_for(conn, sid)[-1]["role"] == "recherche"
    assert "Material [1]" in council._recherche_text(conn, s)
