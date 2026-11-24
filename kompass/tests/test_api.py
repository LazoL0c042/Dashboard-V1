import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(str(tmp_path / "t.db"), runner=lambda fn: None)  # Hintergrundjobs nicht ausführen
    return TestClient(app)


def anmelden(client):
    assert client.post("/api/setup", json={"name": "peter", "pw": "geheim123"}).status_code == 200


def test_ohne_login_401(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/plaene").status_code == 401


def test_setup_nur_einmal(client):
    assert client.get("/api/status").json()["setup_noetig"]
    anmelden(client)
    assert client.post("/api/setup", json={"name": "x", "pw": "geheim123"}).status_code == 403
    assert client.get("/api/me").json()["is_admin"]


def test_rechner_drei_szenarien_mit_steuern(client):
    anmelden(client)
    r = client.post("/api/rechner", json={"start": 10000, "monthly": 300, "years": 20, "mix": {"aktien": 100},
                                          "steuern": {"aktiv": True}})
    assert r.status_code == 200
    s = r.json()["szenarien"]
    assert set(s) == {"worst", "realistisch", "best"}
    assert s["realistisch"]["steuer"]["steuer"] > 0
    assert s["realistisch"]["end_real_netto"] < s["realistisch"]["end_real"]


def test_rechner_zu_lang(client):
    anmelden(client)
    r = client.post("/api/rechner", json={"years": 70, "monthly": 100, "mix": {"gold": 1}})
    assert r.status_code == 422 and "höchstens" in r.json()["detail"]


def test_council_braucht_hinweis_und_fremde_sitzung_404(client):
    anmelden(client)
    assert client.post("/api/council", json={"idea": "Gold kaufen als Absicherung"}).status_code == 403
    client.post("/api/hinweis")
    sid = client.post("/api/council", json={"idea": "Gold kaufen als Absicherung"}).json()["id"]
    assert client.get(f"/api/council/{sid}").status_code == 200
    code = client.post("/api/admin/einladung").json()["code"]
    client.post("/api/logout")
    assert client.post("/api/register", json={"name": "anna", "pw": "geheim456", "invite": code}).status_code == 200
    assert client.get(f"/api/council/{sid}").status_code == 404
    assert client.post("/api/admin/einladung").status_code == 403


def test_produkte_katalog(client):
    anmelden(client)
    d = client.get("/api/produkte").json()
    assert d["benchmark"]["isin"] == "IE00B4L5Y983"
    assert "Edelmetalle" in d["kategorien"]


def test_portfolios_und_kurse(client, monkeypatch):
    from app import market
    monkeypatch.setattr(market, "fetch", lambda t, s: [("2024-01-02", 10.0), ("2024-01-03", 11.0), ("2024-01-10", 12.0)])
    anmelden(client)
    body = {"name": "Test", "startdatum": "2024-01-02", "einmalbetrag": 1000, "sparrate": 0,
            "positionen": [{"ticker": "EUNL.DE", "isin": "IE00B4L5Y983", "anteil": 100}]}
    pid = client.post("/api/portfolios", json=body).json()["id"]
    assert client.get("/api/portfolios").json()["portfolios"][0]["positionen"][0]["klassen"] == {"aktien_welt": 1}
    body["name"] = "Neu"
    assert client.put(f"/api/portfolios/{pid}", json=body).status_code == 200
    k = client.get("/api/kurse", params={"tickers": "EUNL.DE,4GLD.DE", "start": "2024-01-02"}).json()["kurse"]
    assert k["EUNL.DE"] == [["2024-01-03", 11.0], ["2024-01-10", 12.0]]
    assert client.post("/api/portfolios", json={**body, "positionen": []}).status_code == 400
    assert client.delete(f"/api/portfolios/{pid}").status_code == 200
    assert client.get(f"/api/portfolios/{pid}").status_code == 404


def test_szenarien_endpunkt(client):
    anmelden(client)
    d = client.get("/api/szenarien").json()
    assert "ki_blase" in [s["id"] for s in d["szenarien"]]
    client.post("/api/hinweis")
    r = client.post("/api/szenario/ki", json={"szenario": "ki_blase", "positionen": [{"name": "A", "anteil": 1, "klassen": {"aktien_welt": 1}}]})
    assert r.status_code == 200
    assert client.get(f"/api/szenario/ki/{r.json()['id']}").json()["status"] == "laeuft"


def test_rechner_mit_steuer_mix_und_steuern_endpunkt(client):
    anmelden(client)
    r = client.post("/api/rechner", json={"start": 10000, "monthly": 0, "years": 10, "mix": {"aktien": 50, "gold": 50},
                                          "steuern": {"aktiv": True}, "steuer_anteile": {"aktien_etf": 0.5, "gold_physisch": 0.5}})
    assert r.status_code == 200
    teile = r.json()["szenarien"]["realistisch"]["steuer"]["teile"]
    assert {t["klasse"] for t in teile} == {"aktien_etf", "gold_physisch"}
    s = client.post("/api/steuern/mix", json={"jahre": 10, "faelle": [{"end_nominal": 20000, "eingezahlt": 10000}],
                                              "anteile": {"krypto_direkt": 1}}).json()
    assert s[0]["steuer"] == 0
