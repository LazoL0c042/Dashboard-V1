import json

from app import council, profile
from app.db import one


def mitglied(p, widerlegt=False):
    return json.dumps({"position": "Pos", "wahrscheinlichkeit": p, "argumente": ["a"],
                       "staerkster_einwand": "e", "einwand_widerlegt": widerlegt, "aenderung": "", "offene_fragen": []})


SYN = json.dumps({"bewertung": "mittel", "zusammenfassung": "z", "richtung": "Welt-ETF", "kategorie": "Aktien",
                  "optionen": [], "langfristplan": [], "massnahmen": [], "risiken": [], "dissens": ""})


def fake(probs_pro_runde, kritiker_widerlegt_ab=99, kaputt_fuer=None):
    """probs_pro_runde: Liste je Runde von dict rolle->p."""
    zaehler = {"runde": {}}

    def chat(conn, rolle, messages):
        if kaputt_fuer == rolle:
            return "kein json", "fake", "m"
        if rolle == "moderator":
            sys = messages[0]["content"]
            if "Bevor der Council" in sys:
                return json.dumps({"verstaendnis": "v", "fragen": ["Wie alt?"],
                                   "profil": [{"key": "alter", "value": "34", "status": "angegeben"}], "bereit": True}), "fake", "m"
            return SYN, "fake", "m"
        if rolle in council.FACH:
            n = zaehler["runde"].get(rolle, 0)
            zaehler["runde"][rolle] = n + 1
            p = probs_pro_runde[min(n, len(probs_pro_runde) - 1)][rolle]
            return mitglied(p, widerlegt=(rolle == "kritiker" and n + 1 >= kritiker_widerlegt_ab)), "fake", "m"
        if rolle == "produkt":
            return json.dumps({"produkte": [{"name": "X", "isin": "IE00B4L5Y983"}, {"name": "Y", "isin": "XX000"}]}), "fake", "m"
        return json.dumps({"ok": True}), "fake", "m"

    return chat


def runde(*ps):
    return dict(zip(council.FACH, ps))


def test_konsens_regel():
    b = {r: {"wahrscheinlichkeit": 60} for r in council.FACH}
    b["kritiker"]["einwand_widerlegt"] = False
    assert council.konsens(b) == (False, 0)
    b["kritiker"]["einwand_widerlegt"] = True
    assert council.konsens(b)[0]
    b["rendite"]["wahrscheinlichkeit"] = 80
    assert not council.konsens(b)[0]


def test_parse_json_mit_codeblock():
    assert council.parse_json('Hier:\n```json\n{"a": 1}\n```') == {"a": 1}
    assert council.parse_json("nix") is None


def test_klaeren_schlaegt_profil_vor(conn, user):
    sid = council.create(conn, user, "Ich will 20 % meines Depots in Gold umschichten.")
    d = council.klaeren(conn, sid, chat_fn=fake([runde(50, 50, 50, 50, 50)]))
    assert d["fragen"] == ["Wie alt?"]
    assert profile.pending(conn, user)[0]["key"] == "alter"
    assert profile.current(conn, user) == {}


def test_einigung_in_runde_2_dann_pruefrunde(conn, user):
    sid = council.create(conn, user, "Ich will 20 % meines Depots in Gold umschichten.")
    chat = fake([runde(40, 70, 55, 20, 80), runde(50, 55, 52, 48, 58)], kritiker_widerlegt_ab=2)
    council.run(conn, sid, chat_fn=chat)
    s = one(conn, "SELECT * FROM council_sessions WHERE id = ?", (sid,))
    assert s["status"] == "fertig"
    r = json.loads(s["result_json"])
    assert r["synthese"]["runden"] == 2
    assert r["synthese"]["wahrscheinlichkeit"] == 52
    assert set(r["pruefung"]) == {"statistiker", "premortem", "produkt"}
    prod = {p["isin"]: p["verifiziert"] for p in r["pruefung"]["produkt"]["produkte"]}
    assert prod == {"IE00B4L5Y983": True, "XX000": False}


def test_kein_konsens_nach_4_runden(conn, user):
    sid = council.create(conn, user, "Alles auf eine Aktie setzen, die ich gut finde.")
    council.run(conn, sid, chat_fn=fake([runde(10, 80, 40, 5, 90)]))
    s = one(conn, "SELECT * FROM council_sessions WHERE id = ?", (sid,))
    assert s["status"] == "dissens"
    r = json.loads(s["result_json"])
    assert "pruefung" not in r and r["synthese"]["runden"] == 4
    fach = conn.execute("SELECT COUNT(*) FROM council_messages WHERE session_id = ? AND phase = 'fach' AND role != 'moderator'", (sid,)).fetchone()[0]
    assert fach == 20


def test_kritiker_blockiert_trotz_kleiner_spanne(conn, user):
    sid = council.create(conn, user, "Monatlich 500 € in einen Welt-ETF sparen.")
    council.run(conn, sid, chat_fn=fake([runde(62, 62, 62, 60, 62)], kritiker_widerlegt_ab=99))
    assert one(conn, "SELECT status FROM council_sessions WHERE id = ?", (sid,))["status"] == "dissens"


def test_kaputtes_json_fuehrt_zu_fehler_und_protokoll_bleibt(conn, user):
    sid = council.create(conn, user, "Monatlich 500 € in einen Welt-ETF sparen.")
    council.run(conn, sid, chat_fn=fake([runde(50, 50, 50, 50, 50)], kaputt_fuer="geschichte"))
    s = one(conn, "SELECT * FROM council_sessions WHERE id = ?", (sid,))
    assert s["status"] == "fehler" and "Geschichts-Experte" in s["error"]
    assert len(council.messages_for(conn, sid)) == 2  # Geopolitik + Finanzen bleiben erhalten


def test_protokoll_unveraenderlich(conn, user):
    import sqlite3

    import pytest

    sid = council.create(conn, user, "Monatlich 500 € in einen Welt-ETF sparen.")
    council.log(conn, sid, "fach", "kritiker", "x")
    with pytest.raises(sqlite3.DatabaseError):
        conn.execute("UPDATE council_messages SET content = 'y'")
