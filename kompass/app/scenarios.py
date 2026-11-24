"""Szenarien: feste Annahmen (data/szenarien.json) plus KI-Begründung und eigene Szenarien.

Die Zahlen sind Größenordnungen, angelehnt an historische Vorbilder. Die Rechnung
läuft im Browser (static/rechnen.js). Hier: Daten, Prüfung, KI-Aufträge.
"""
import json
from functools import lru_cache
from pathlib import Path

from . import llm, prompts
from .db import one

DATEI = Path(__file__).resolve().parent.parent / "data" / "szenarien.json"
VARIANTEN = ("schwer", "mittel", "mild")


@lru_cache(maxsize=1)
def daten() -> dict:
    return json.loads(DATEI.read_text(encoding="utf-8"))


def klassen() -> dict:
    return daten()["klassen"]


def finde(sid: str) -> dict | None:
    return next((s for s in daten()["szenarien"] if s["id"] == sid), None)


def pruefe_stoesse(roh: dict) -> dict:
    """Stöße aus einem Modell absichern: alle Klassen, Zahlen begrenzt (−95 % … +300 %)."""
    out = {}
    for v in VARIANTEN:
        out[v] = {}
        quelle = (roh or {}).get(v) or {}
        for k in klassen():
            paar = quelle.get(k) or [0, 0]
            try:
                tief, ende = float(paar[0]), float(paar[1])
            except (TypeError, ValueError, IndexError):
                tief, ende = 0.0, 0.0
            out[v][k] = [max(-95.0, min(300.0, tief)), max(-95.0, min(300.0, ende))]
    return out


def start(conn, user_id: int, eingabe: dict) -> int:
    if not eingabe.get("szenario") and not (eingabe.get("freitext") or "").strip():
        raise ValueError("Szenario wählen oder eigenes Szenario beschreiben.")
    if eingabe.get("szenario") and not finde(eingabe["szenario"]):
        raise ValueError("Unbekanntes Szenario.")
    if not eingabe.get("positionen"):
        raise ValueError("Keine Positionen angegeben.")
    cur = conn.execute("INSERT INTO szenario_ki (user_id, eingabe_json) VALUES (?, ?)",
                       (user_id, json.dumps(eingabe, ensure_ascii=False)))
    conn.commit()
    return cur.lastrowid


def get(conn, user_id: int, kid: int) -> dict | None:
    r = one(conn, "SELECT * FROM szenario_ki WHERE id = ? AND user_id = ?", (kid, user_id))
    if r:
        r["eingabe"] = json.loads(r.pop("eingabe_json"))
        r["ergebnis"] = json.loads(r.pop("ergebnis_json")) if r["ergebnis_json"] else None
    return r


def run(conn, kid: int, chat_fn=llm.chat) -> None:
    from .council import parse_json

    r = one(conn, "SELECT * FROM szenario_ki WHERE id = ?", (kid,))
    e = json.loads(r["eingabe_json"])
    pos_text = "\n".join(
        f"- {p.get('name')}: {float(p.get('anteil', 0)):.1f} % ({', '.join(klassen().get(k, k) for k in p.get('klassen', {}))})"
        for p in e["positionen"]
    )
    try:
        if e.get("szenario"):
            s = finde(e["szenario"])
            system = prompts.SZENARIO_ANALYSE
            inhalt = (
                f"SZENARIO: {s['name']} – {s['kurz']}\nAuslöser: {s['ausloeser']}\nVorbild: {s['vorbild']}\n"
                f"Horizont: {s['horizont_monate']} Monate\n\nSTRATEGIE/DEPOT ({e.get('titel', '')}):\n{pos_text}\n"
                f"Depotwert: {e.get('depotwert')} €\n\nBERECHNETES ERGEBNIS (Annahmen-Modell):\n"
                f"{json.dumps(e.get('ergebnis_kurz', {}), ensure_ascii=False)}"
            )
            pflicht = ("einordnung",)
        else:
            system = prompts.SZENARIO_FREI
            inhalt = (
                f"EIGENES SZENARIO DES NUTZERS:\n{e['freitext']}\n\nSTRATEGIE/DEPOT ({e.get('titel', '')}):\n{pos_text}\n"
                f"ANLAGEKLASSEN (Schlüssel): {json.dumps(klassen(), ensure_ascii=False)}"
            )
            pflicht = ("stoesse", "name")
        messages = [{"role": "system", "content": system}, {"role": "user", "content": inhalt}]
        text, anbieter, modell = chat_fn(conn, "szenario", messages)
        d = parse_json(text)
        if d is None or any(k not in d for k in pflicht):
            text, anbieter, modell = chat_fn(conn, "szenario", messages + [
                {"role": "assistant", "content": text},
                {"role": "user", "content": "Antworte ausschließlich mit dem JSON im verlangten Schema."}])
            d = parse_json(text)
        if d is None or any(k not in d for k in pflicht):
            raise ValueError("Das Modell hat kein gültiges Ergebnis geliefert.")
        if not e.get("szenario"):
            d["id"] = "eigenes"
            d["stoesse"] = pruefe_stoesse(d.get("stoesse"))
            d["horizont_monate"] = max(3, min(120, int(d.get("horizont_monate") or 24)))
            tm = d.get("tief_monat")
            tm = int(tm) if isinstance(tm, (int, float)) else d["horizont_monate"] // 2
            d["tief_monat"] = max(1, min(d["horizont_monate"] - 1, tm))
            d["geschaetzt_von_ki"] = True
        conn.execute("UPDATE szenario_ki SET ergebnis_json = ?, status = 'fertig', provider = ?, model = ? WHERE id = ?",
                     (json.dumps(d, ensure_ascii=False), anbieter, modell, kid))
    except Exception as ex:
        conn.execute("UPDATE szenario_ki SET ergebnis_json = ?, status = 'fehler' WHERE id = ?",
                     (json.dumps({"fehler": str(ex)}, ensure_ascii=False), kid))
    conn.commit()
