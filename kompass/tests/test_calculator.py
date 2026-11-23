import pytest

from app import calculator as calc


def flat(rate=0.0, infl=0.0, years=range(1900, 2000)):
    return {y: {"aktien": rate, "anleihen": rate, "gold": rate, "inflation": infl} for y in years}


def test_null_rendite_endwert_gleich_einzahlung():
    r = calc.simulate(1000, 100, 10, {"aktien": 1}, ter=0, series=flat())
    s = r["szenarien"]["realistisch"]
    assert s["eingezahlt"] == pytest.approx(1000 + 100 * 12 * 10)
    assert s["end_nominal"] == pytest.approx(s["eingezahlt"])


def test_inflation_senkt_realwert():
    r = calc.simulate(1000, 0, 10, {"aktien": 1}, ter=0, series=flat(0.0, 0.02))
    s = r["szenarien"]["realistisch"]
    assert s["end_real"] == pytest.approx(1000 / 1.02**10)


def test_ter_wird_abgezogen():
    r = calc.simulate(1000, 0, 10, {"aktien": 1}, ter=0.01, series=flat(0.0))
    assert r["szenarien"]["realistisch"]["end_nominal"] == pytest.approx(1000 * 0.99**10)


def test_reihenfolge_mit_echten_daten():
    r = calc.simulate(10000, 200, 20, {"aktien": 0.7, "anleihen": 0.3})
    s = r["szenarien"]
    assert s["worst"]["end_real"] <= s["realistisch"]["end_real"] <= s["best"]["end_real"]
    assert r["fenster"] > 100


def test_zu_langer_horizont():
    with pytest.raises(calc.ZuWenigDaten, match="höchstens"):
        calc.simulate(1000, 0, 60, {"gold": 1})


def test_mix_wird_normalisiert():
    r = calc.simulate(1000, 0, 10, {"aktien": 70, "anleihen": 30}, series=flat())
    assert r["mix"] == {"aktien": 0.7, "anleihen": 0.3}


def test_eigene_annahme():
    r = calc.simulate(1000, 0, 10, {"eigene": 1}, ter=0, custom_rate=0.03, series=flat())
    assert r["szenarien"]["best"]["end_nominal"] == pytest.approx(1000 * 1.03**10)
    with pytest.raises(ValueError):
        calc.simulate(1000, 0, 10, {"eigene": 1}, series=flat())


def test_unbekannte_klasse():
    with pytest.raises(ValueError):
        calc.simulate(1000, 0, 10, {"krypto": 1}, series=flat())
