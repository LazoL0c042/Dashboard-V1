"""Grundtests. Laufen ohne API-Key und ohne Internet: pytest -q"""
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["API_TOKEN"] = "test-token"
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import portfolio  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
H = {"Authorization": "Bearer test-token"}


def test_auth_required():
    assert client.get("/api/today").status_code == 401
    assert client.get("/api/today", headers=H).status_code == 200


@pytest.mark.parametrize("text,kind", [
    ("ToDo: Steuererklärung abgeben", "todo"),
    ("aufgabe, Werkzeug für Montag packen", "todo"),
    ("Gedanke: Abbund-Software mal testen", "thought"),
    ("Idee - Sneaker-Drops per Bot tracken", "thought"),
])
def test_prefix_rules(text, kind):
    r = client.post("/api/capture", json={"text": text}, headers=H).json()
    assert r["status"] == "processed"
    if kind == "todo":
        titles = [t["title"] for t in client.get("/api/todos", headers=H).json()]
        assert any(text.split(maxsplit=1)[1].strip(" ,-:") in t for t in titles)


def test_without_key_goes_to_inbox_and_can_be_resolved():
    r = client.post("/api/capture", json={"text": "morgen Kollegen wegen Gerüst fragen"}, headers=H).json()
    assert r["status"] == "inbox"
    inbox = client.get("/api/today", headers=H).json()["inbox"]
    assert any(e["id"] == r["entry_id"] for e in inbox)
    client.post(f"/api/inbox/{r['entry_id']}/as", json={"type": "todo"}, headers=H)
    inbox = client.get("/api/today", headers=H).json()["inbox"]
    assert all(e["id"] != r["entry_id"] for e in inbox)


def test_undo_removes_item():
    client.post("/api/capture", json={"text": "todo: wird rückgängig gemacht"}, headers=H)
    recent = client.get("/api/today", headers=H).json()["recent"]
    client.post(f"/api/undo/{recent[0]['id']}", headers=H)
    titles = [t["title"] for t in client.get("/api/todos", headers=H).json()]
    assert "wird rückgängig gemacht" not in titles


def test_habit_toggle_and_week():
    habit = client.get("/api/habits", headers=H).json()[0]
    assert client.post(f"/api/habits/{habit['id']}/toggle", headers=H).json()["done"] is True
    week = client.get("/api/week", headers=H).json()
    assert next(h for h in week["habits"] if h["id"] == habit["id"])["count"] == 1


def test_portfolio_math(monkeypatch):
    quotes = {"AAA": (120.0, "EUR"), "BBB": (60.0, "USD"), "USDEUR=X": (0.5, None)}
    monkeypatch.setattr(portfolio, "fetch_quote", lambda s: quotes[s])
    csv_text = ("portfolio;name;ticker;quantity;entry_price;currency;asset_class\n"
                "Depot A;Aktie A;AAA;10;100;EUR;Aktie\n"
                "Depot B;Aktie B;BBB;10;50;USD;ETF\n")
    assert client.post("/api/portfolio/import", json={"csv": csv_text}, headers=H).json()["imported"] == 2
    client.post("/api/positions", headers=H, json={
        "portfolio": "Depot A", "name": "Tagesgeld", "quantity": 1, "entry_price": 1000,
        "asset_class": "Cash", "manual_price": 1000})
    d = client.get("/api/portfolio?refresh=1", headers=H).json()
    # A: 10*120 = 1200, B: 10*60*0.5 = 300, Cash: 1000
    assert d["total"] == 2500
    assert d["invested"] == 1000 + 250 + 1000
    assert {a["name"] for a in d["allocation"]["portfolio"]} == {"Depot A", "Depot B"}


def test_llm_path_multi_action_and_threshold(monkeypatch):
    from app import classifier, config
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "fake")
    monkeypatch.setattr(classifier, "call_claude", lambda text, ctx: {
        "actions": [
            {"type": "todo.create", "confidence": 0.95, "title": "Holz bestellen", "project": "Werkstatt"},
            {"type": "checklist.log", "confidence": 0.9, "habit": "Training", "amount": 45, "unit": "min"},
        ],
        "reply": "ToDo angelegt, Training abgehakt.",
        "usage": {"input_tokens": 500, "output_tokens": 80},
    })
    r = client.post("/api/capture", json={"text": "Holz bestellen und war 45 min trainieren"}, headers=H).json()
    assert r["status"] == "processed" and len(r["results"]) == 2
    assert client.get("/api/usage", headers=H).json()["calls"] >= 1

    monkeypatch.setattr(classifier, "call_claude", lambda text, ctx: {
        "actions": [{"type": "thought.save", "confidence": 0.3, "text": "unklar"}], "reply": "?"})
    r = client.post("/api/capture", json={"text": "hmm irgendwas"}, headers=H).json()
    assert r["status"] == "inbox"
    assert client.post(f"/api/inbox/{r['entry_id']}/accept", headers=H).status_code == 200


def test_unknown_habit_rolls_back_everything(monkeypatch):
    from app import classifier, config
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "fake")
    monkeypatch.setattr(classifier, "call_claude", lambda text, ctx: {"actions": [
        {"type": "todo.create", "confidence": 0.9, "title": "darf nicht bleiben"},
        {"type": "checklist.log", "confidence": 0.9, "habit": "Gibtsnicht"}], "reply": ""})
    r = client.post("/api/capture", json={"text": "x"}, headers=H).json()
    assert r["status"] == "inbox"
    titles = [t["title"] for t in client.get("/api/todos", headers=H).json()]
    assert "darf nicht bleiben" not in titles
