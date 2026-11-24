import json
from datetime import date, timedelta

import pytest

from app import portfolios, scenarios

GUT = {"name": "Welt + Gold", "startdatum": "2020-01-02", "einmalbetrag": 5000, "sparrate": 200,
       "positionen": [{"ticker": "EUNL.DE", "isin": "IE00B4L5Y983", "anteil": 80},
                      {"ticker": "4GLD.DE", "isin": "DE000A0S9GB0", "anteil": 20}]}


def test_anlegen_mit_klassen_aus_katalog(conn, user):
    pid = portfolios.anlegen(conn, user, GUT)
    p = portfolios.get(conn, user, pid)
    assert p["positionen"][0]["klassen"] == {"aktien_welt": 1}
    assert p["positionen"][1]["name"].startswith("Xetra-Gold")


def test_eigener_ticker_braucht_klasse(conn, user):
    d = {**GUT, "positionen": [{"ticker": "NVDA", "anteil": 100}]}
    with pytest.raises(ValueError, match="Anlageklasse"):
        portfolios.anlegen(conn, user, d)
    d["positionen"][0]["klassen"] = {"aktien_tech": 1}
    assert portfolios.anlegen(conn, user, d)


def test_portfolio_max_100_prozent(conn, user):
    d = {**GUT, "positionen": [{"ticker": "EUNL.DE", "isin": "IE00B4L5Y983", "anteil": 80}, {"ticker": "4GLD.DE", "isin": "DE000A0S9GB0", "anteil": 30}]}
    with pytest.raises(ValueError, match="höchstens 100"):
        portfolios.anlegen(conn, user, d)


def test_pruefungen(conn, user):
    with pytest.raises(ValueError, match="Zukunft"):
        portfolios.anlegen(conn, user, {**GUT, "startdatum": (date.today() + timedelta(days=3)).isoformat()})
    with pytest.raises(ValueError, match="größer als 0"):
        portfolios.anlegen(conn, user, {**GUT, "einmalbetrag": 0, "sparrate": 0})
    with pytest.raises(ValueError, match="Position"):
        portfolios.anlegen(conn, user, {**GUT, "positionen": []})


def test_mehrere_aendern_loeschen_nur_eigene(conn, user, user2):
    a = portfolios.anlegen(conn, user, GUT)
    portfolios.anlegen(conn, user, {**GUT, "name": "Zweites"})
    assert [p["name"] for p in portfolios.liste(conn, user)] == ["Welt + Gold", "Zweites"]
    assert not portfolios.aendern(conn, user2, a, {**GUT, "name": "fremd"})
    assert portfolios.get(conn, user2, a) is None
    assert portfolios.aendern(conn, user, a, {**GUT, "name": "Neu"})
    assert portfolios.get(conn, user, a)["name"] == "Neu"
    assert not portfolios.loeschen(conn, user2, a)
    assert portfolios.loeschen(conn, user, a)
    assert len(portfolios.liste(conn, user)) == 1


def test_woechentlich():
    reihe = [((date(2024, 1, 1) + timedelta(days=i)).isoformat(), float(i)) for i in range(15)]
    w = portfolios.woechentlich(reihe)
    assert [x[0] for x in w] == ["2024-01-07", "2024-01-14", "2024-01-15"]


def test_szenarien_vollstaendig():
    d = scenarios.daten()
    assert len(d["szenarien"]) >= 8
    for s in d["szenarien"]:
        for v in scenarios.VARIANTEN:
            assert set(s["stoesse"][v]) == set(d["klassen"]), s["id"]
        assert 0 < s["tief_monat"] < s["horizont_monate"]


def test_pruefe_stoesse_begrenzt_und_fuellt():
    st = scenarios.pruefe_stoesse({"schwer": {"krypto": [-150, 999], "gold": ["x", 1]}})
    assert st["schwer"]["krypto"] == [-95.0, 300.0]
    assert st["schwer"]["gold"] == [0.0, 0.0]
    assert st["mild"]["aktien_welt"] == [0.0, 0.0]


def test_ki_eigenes_szenario(conn, user):
    kid = scenarios.start(conn, user, {"freitext": "China blockiert Taiwan", "positionen": [{"name": "Welt", "anteil": 100, "klassen": {"aktien_welt": 1}}]})

    def chat(c, rolle, messages):
        assert rolle == "szenario"
        return json.dumps({"name": "Taiwan-Blockade", "horizont_monate": 500, "tief_monat": 0,
                           "stoesse": {"mittel": {"aktien_tech": [-40, -20]}}}), "fake", "m"

    scenarios.run(conn, kid, chat)
    r = scenarios.get(conn, user, kid)
    assert r["status"] == "fertig"
    e = r["ergebnis"]
    assert e["horizont_monate"] == 120 and e["tief_monat"] == 1 and e["geschaetzt_von_ki"]
    assert e["stoesse"]["mittel"]["aktien_tech"] == [-40.0, -20.0]
    assert set(e["stoesse"]["schwer"]) == set(scenarios.klassen())


def test_ki_fehler_landet_im_status(conn, user, user2):
    kid = scenarios.start(conn, user, {"szenario": "ki_blase", "positionen": [{"name": "Welt", "anteil": 1, "klassen": {"aktien_welt": 1}}]})
    scenarios.run(conn, kid, lambda c, r, m: ("kaputt", "fake", "m"))
    assert scenarios.get(conn, user, kid)["status"] == "fehler"
    assert scenarios.get(conn, user2, kid) is None
    with pytest.raises(ValueError):
        scenarios.start(conn, user, {"szenario": "gibtsnicht", "positionen": [{}]})
