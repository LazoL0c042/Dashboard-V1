import sqlite3
from datetime import date, timedelta

import pytest

from app import plans


def linear(start_preis, end_preis, start=date(2024, 1, 1), tage=730):
    return [((start + timedelta(days=i)).isoformat(), start_preis + (end_preis - start_preis) * i / tage)
            for i in range(tage + 1)]


def frozen(sparrate=100, einmal=1000, ziel=None, horizont=2, produkte=None):
    return {
        "entscheidung": {"einmalbetrag": einmal, "sparrate": sparrate, "zielbetrag": ziel, "horizont_jahre": horizont,
                         "startdatum": "2024-01-01",
                         "produkte": produkte or [{"ticker": "GOLD", "anteil": 1.0}]},
        "benchmark": {"ticker": "EUNL.DE"},
    }


def hist_fn(data):
    return lambda t, s: data.get(t, [])


def test_steigender_kurs_im_plus_und_markt_vergleich():
    data = {"GOLD": linear(100, 200), "EUNL.DE": linear(100, 150)}
    a = plans.evaluate(frozen(), hist_fn(data), heute=date(2025, 12, 31))
    assert a["eingezahlt"] == 1000 + 100 * 23
    assert a["im_plus"] and a["markt_geschlagen"]
    assert a["fehlende_kurse"] == []


def test_benchmark_besser():
    data = {"GOLD": linear(100, 110), "EUNL.DE": linear(100, 200)}
    a = plans.evaluate(frozen(), hist_fn(data), heute=date(2025, 12, 31))
    assert a["markt_geschlagen"] is False


def test_fehlender_kurs_kein_absturz():
    data = {"EUNL.DE": linear(100, 150)}
    a = plans.evaluate(frozen(), hist_fn(data), heute=date(2025, 12, 31))
    assert a["wert"] is None and a["im_plus"] is None and a["markt_geschlagen"] is None
    assert a["fehlende_kurse"]


def test_ziel_auf_kurs_und_erreicht():
    data = {"GOLD": linear(100, 200), "EUNL.DE": linear(100, 150)}
    a = plans.evaluate(frozen(ziel=3000, horizont=4), hist_fn(data), heute=date(2025, 12, 31))
    assert a["ziel"]["status"] == "auf Kurs"
    a = plans.evaluate(frozen(ziel=100000, horizont=1), hist_fn(data), heute=date(2025, 12, 31))
    assert a["ziel"]["status"] == "verfehlt"


def test_freeze_unveraenderlich_und_nur_eigene(conn, user, user2):
    fake_fetch = lambda t, s: linear(100, 110, start=date.today() - timedelta(days=30), tage=30)  # noqa: E731
    pid = plans.freeze(conn, user, {"titel": "Gold", "einmalbetrag": 1000, "horizont_jahre": 5,
                                    "produkte": [{"ticker": "4GLD.DE", "anteil": 1}]}, fetch_fn=fake_fetch)
    p = plans.get(conn, user, pid)
    assert p["frozen"]["kurse_am_entscheidungstag"]["EUNL.DE"]["kurs"] == pytest.approx(110)
    assert plans.get(conn, user2, pid) is None
    with pytest.raises(sqlite3.DatabaseError):
        conn.execute("UPDATE plans SET title = 'x'")
    plans.nachtrag(conn, user, pid, "notiz", {"text": "hallo"})
    assert plans.get(conn, user, pid)["frozen"]["entscheidung"]["titel"] == "Gold"
    with pytest.raises(LookupError):
        plans.nachtrag(conn, user2, pid, "notiz", {"text": "fremd"})


def test_freeze_ohne_produkt_abgelehnt(conn, user):
    with pytest.raises(ValueError):
        plans.freeze(conn, user, {"einmalbetrag": 1000, "produkte": []})
