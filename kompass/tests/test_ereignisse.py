import json

import pytest

from app import indikatoren

FRED = "observation_date,DGS10\n2026-11-19,4.10\n2026-11-20,.\n2026-11-21,4.25\n"
CPI = "observation_date,CPIAUCSL\n2025-10-01,300\n2026-10-01,309\n"
EZB = "KEY,TIME_PERIOD,OBS_VALUE\nX,2026-11,2.0\n"
CNN = json.dumps({"fear_and_greed": {"score": 23.4, "timestamp": "2026-11-21T20:00:00"}})
MULTPL = '<table><tr><td class="left">Nov 1, 2026</td><td class="right">&#x2002;37.12</td></tr></table>'


def fetch(url, params=None):
    if "fredgraph" in url:
        return CPI if params["id"] == "CPIAUCSL" else FRED
    if "ecb" in url:
        return EZB
    if "cnn" in url:
        return CNN
    if "multpl" in url:
        return MULTPL
    raise ConnectionError()


def test_ereignisse_daten_berechnet():
    d = indikatoren.ereignisse()
    assert len(d["ereignisse"]) >= 12
    dot = indikatoren.finde_ereignis("dotcom_2000")["kennzahlen"]
    assert dot["cape_hoch"] > 40 and dot["verlust_real"] < -0.4
    fk = indikatoren.finde_ereignis("finanzkrise_2008")["kennzahlen"]
    assert fk["tief"] == "2009-03" and fk["monate_bis_erholt"] > 24
    for e in d["ereignisse"]:
        assert e["ursachen"] and e["lehren"] and e["verlauf"], e["id"]
        if e["kennzahlen"]:
            assert e["kennzahlen"]["verlust_nominal"] <= 0 and e["kennzahlen"]["reihe"]


def test_indikatoren_abruf_und_cache(conn, monkeypatch):
    monkeypatch.setenv("KOMPASS_OFFLINE", "0")
    ind = indikatoren.aktuell(conn, fetch=fetch)
    assert ind["us_zins_10j"]["wert"] == 4.25 and ind["us_zins_10j"]["datum"] == "2026-11-21"
    assert ind["us_inflation"]["wert"] == pytest.approx(3.0)
    assert ind["fear_greed"]["wert"] == 23.4 and ind["cape"]["wert"] == 37.12 and ind["cape"]["live"]
    # zweiter Aufruf nutzt den Cache, auch wenn die Quellen weg sind
    def kaputt(url, params=None):
        raise ConnectionError()
    assert indikatoren.aktuell(conn, fetch=kaputt)["fear_greed"]["wert"] == 23.4


def test_fallback_ohne_quellen(conn, monkeypatch):
    monkeypatch.setenv("KOMPASS_OFFLINE", "1")
    ind = indikatoren.aktuell(conn)
    assert ind["cape"]["live"] is False and "Kompass-Daten" in ind["cape"]["quelle"]
    assert "fear_greed" not in ind


def test_aehnlichkeit_findet_dotcom_bei_hohem_kgv():
    ind = {"cape": {"wert": 43}, "us_zins_10j": {"wert": 5.8}, "us_inflation": {"wert": 3.4}}
    a = indikatoren.aehnlichkeit(ind)
    assert a[0]["id"] == "dotcom_2000" and a[0]["aehnlichkeit"] > 80
    ind2 = {"cape": {"wert": 9.5}, "us_zins_10j": {"wert": 12.5}, "us_inflation": {"wert": 12.6}}
    assert indikatoren.aehnlichkeit(ind2)[0]["id"] == "volcker_1980"


def test_vergleich_ki(conn, user, user2):
    vid = indikatoren.vergleich_start(conn, user, "dotcom_2000")
    def chat(c, rolle, msgs):
        assert rolle == "geschichte" and "Shiller" in msgs[1]["content"]
        return json.dumps({"kurzfazit": "x", "gemeinsamkeiten": ["Hohe Bewertung"], "unterschiede": ["Gewinne heute real"]}), "f", "m"
    indikatoren.vergleich_run(conn, vid, chat)
    r = indikatoren.vergleich_get(conn, user, vid)
    assert r["status"] == "fertig" and r["ergebnis"]["gemeinsamkeiten"] == ["Hohe Bewertung"]
    assert indikatoren.vergleich_get(conn, user2, vid) is None
    with pytest.raises(ValueError):
        indikatoren.vergleich_start(conn, user, "gibtsnicht")


def test_council_kontext_enthaelt_marktlage(conn, user):
    from app import council
    sid = council.create(conn, user, "Lohnt sich jetzt der Einstieg in Tech-Aktien?")
    s = council.session_for(conn, user, sid)
    k = council._kontext(conn, s, [])
    assert "MARKTINDIKATOREN HEUTE" in k and "ÄHNLICHSTE HISTORISCHE FÄLLE" in k
