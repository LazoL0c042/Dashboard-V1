import pytest

from app import taxes


def test_steuersatz_ohne_kirchensteuer():
    assert taxes.steuersatz() == pytest.approx(0.26375)


def test_steuersatz_mit_kirchensteuer():
    assert taxes.steuersatz(0.09) == pytest.approx(0.279951, abs=1e-6)
    assert taxes.steuersatz(0.08) == pytest.approx(0.278186, abs=1e-6)


def test_aktien_etf_ohne_verlauf():
    r = taxes.nach_steuern(20000, 10000, 5, "aktien_etf")
    assert r["steuer"] == pytest.approx((10000 * 0.7 - 1000) * 0.26375)
    assert r["netto"] == pytest.approx(20000 - r["steuer"])


def test_verlust_keine_steuer():
    r = taxes.nach_steuern(8000, 10000, 5, "aktien_etf")
    assert r["steuer"] == 0
    assert r["netto"] == 8000


def test_gold_nach_einem_jahr_steuerfrei():
    assert taxes.nach_steuern(20000, 10000, 3, "gold_physisch")["steuer"] == 0


def test_vorabpauschale_wird_angerechnet():
    verlauf = [{"anfang": 100000, "einzahlung": 0, "ende": 110000}]
    r = taxes.nach_steuern(110000, 100000, 1, "aktien_etf", verlauf=verlauf)
    bz, _, _ = taxes.basiszins()
    vp = 100000 * bz * 0.7
    assert r["vorabpauschale_summe"] == pytest.approx(vp)
    # Gesamtsteuer = Steuer auf VP (nach Pauschbetrag) + Rest bei Verkauf (nach Pauschbetrag)
    erwartet = max(0, vp * 0.7 - 1000) * 0.26375 + max(0, (10000 - vp) * 0.7 - 1000) * 0.26375
    assert r["steuer"] == pytest.approx(erwartet)


def test_klasse_fuer_mix():
    assert taxes.klasse_fuer_mix({"aktien": 0.7, "anleihen": 0.3}) == "aktien_etf"
    assert taxes.klasse_fuer_mix({"aktien": 0.4, "anleihen": 0.6}) == "misch"
    assert taxes.klasse_fuer_mix({"gold": 1.0}) == "gold_physisch"


def test_mix_steuern_anteilig():
    # 50 % Aktien-ETF, 50 % Gold (steuerfrei nach 1 Jahr): nur die ETF-Hälfte wird besteuert
    r = taxes.nach_steuern_mix(30000, 10000, 5, None, {"aktien_etf": 0.5, "gold_physisch": 0.5})
    erwartet = (10000 * 0.7 - 500) * 0.26375
    assert r["steuer"] == pytest.approx(erwartet)
    assert {t["klasse"] for t in r["teile"]} == {"aktien_etf", "gold_physisch"}


def test_immobilie_nach_10_jahren_steuerfrei():
    assert taxes.nach_steuern(200000, 100000, 11, "immobilie_privat")["steuer"] == 0
    assert taxes.nach_steuern(200000, 100000, 5, "immobilie_privat")["steuer"] > 0


def test_offener_immobilienfonds_60_prozent():
    r = taxes.nach_steuern(20000, 10000, 3, "immobilienfonds")
    assert r["steuer"] == pytest.approx((10000 * 0.4 - 1000) * 0.26375)
