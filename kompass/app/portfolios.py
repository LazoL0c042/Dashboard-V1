"""Hypothetische Portfolios: mehrere pro Nutzer, frei änderbar.

Die Berechnung (Rückrechnung, Kennzahlen, Szenarien) läuft im Browser
(static/rechnen.js). Der Server speichert und liefert Kurse.
"""
import json
from datetime import date, timedelta

from . import market, products, scenarios
from .db import one, rows

MAX_POSITIONEN = 20


def _pruefe(d: dict) -> dict:
    name = (d.get("name") or "").strip()
    if not name:
        raise ValueError("Bitte einen Namen angeben.")
    try:
        start = date.fromisoformat(d.get("startdatum") or "")
    except ValueError:
        raise ValueError("Startdatum fehlt oder ist ungültig.")
    if start > date.today():
        raise ValueError("Das Startdatum darf nicht in der Zukunft liegen.")
    if start < date(1990, 1, 1):
        raise ValueError("Startdatum frühestens 1990 – davor gibt es kaum Kurse.")
    einmal, spar = float(d.get("einmalbetrag") or 0), float(d.get("sparrate") or 0)
    if einmal < 0 or spar < 0 or (einmal == 0 and spar == 0):
        raise ValueError("Einmalbetrag oder Sparrate muss größer als 0 sein.")
    pos = []
    for p in d.get("positionen") or []:
        ticker = (p.get("ticker") or "").strip()
        anteil = float(p.get("anteil") or 0)
        if not ticker or anteil <= 0:
            continue
        kat = products.finde(p.get("id") or p.get("isin") or ticker)
        klassen = p.get("klassen") or (kat or {}).get("klassen") or {}
        klassen = {k: float(v) for k, v in klassen.items() if k in scenarios.klassen() and float(v) > 0}
        if not klassen:
            raise ValueError(f"Für {ticker} fehlt die Anlageklasse.")
        pos.append({
            "ticker": ticker, "isin": p.get("isin") or (kat or {}).get("isin", ""),
            "name": (p.get("name") or (kat or {}).get("name") or ticker).strip()[:120],
            "anteil": anteil, "klassen": klassen,
        })
    if not pos:
        raise ValueError("Mindestens eine Position mit Anteil angeben.")
    if len(pos) > MAX_POSITIONEN:
        raise ValueError(f"Höchstens {MAX_POSITIONEN} Positionen.")
    return {"name": name[:120], "beschreibung": (d.get("beschreibung") or "").strip()[:1000],
            "startdatum": start.isoformat(), "einmalbetrag": einmal, "sparrate": spar, "positionen": pos}


def _aus_row(r: dict) -> dict:
    r["positionen"] = json.loads(r.pop("positionen_json"))
    return r


def anlegen(conn, user_id: int, d: dict) -> int:
    p = _pruefe(d)
    cur = conn.execute(
        "INSERT INTO portfolios (user_id, name, beschreibung, startdatum, einmalbetrag, sparrate, positionen_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, p["name"], p["beschreibung"], p["startdatum"], p["einmalbetrag"], p["sparrate"],
         json.dumps(p["positionen"], ensure_ascii=False)),
    )
    conn.commit()
    return cur.lastrowid


def aendern(conn, user_id: int, pid: int, d: dict) -> bool:
    p = _pruefe(d)
    cur = conn.execute(
        "UPDATE portfolios SET name = ?, beschreibung = ?, startdatum = ?, einmalbetrag = ?, sparrate = ?, "
        "positionen_json = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
        (p["name"], p["beschreibung"], p["startdatum"], p["einmalbetrag"], p["sparrate"],
         json.dumps(p["positionen"], ensure_ascii=False), pid, user_id),
    )
    conn.commit()
    return cur.rowcount > 0


def loeschen(conn, user_id: int, pid: int) -> bool:
    cur = conn.execute("DELETE FROM portfolios WHERE id = ? AND user_id = ?", (pid, user_id))
    conn.commit()
    return cur.rowcount > 0


def get(conn, user_id: int, pid: int) -> dict | None:
    r = one(conn, "SELECT * FROM portfolios WHERE id = ? AND user_id = ?", (pid, user_id))
    return _aus_row(r) if r else None


def liste(conn, user_id: int) -> list[dict]:
    return [_aus_row(r) for r in rows(conn, "SELECT * FROM portfolios WHERE user_id = ? ORDER BY id", (user_id,))]


def woechentlich(reihe: list[tuple[str, float]]) -> list[list]:
    """Tageskurse auf den letzten Kurs je Kalenderwoche verdichten (letzter Tag immer dabei)."""
    out, letzte_woche = [], None
    for tag, kurs in reihe:
        woche = date.fromisoformat(tag).isocalendar()[:2]
        if woche == letzte_woche:
            out[-1] = [tag, round(kurs, 6)]
        else:
            out.append([tag, round(kurs, 6)])
            letzte_woche = woche
    return out


def kurse(conn, tickers: list[str], start: date, fetch_fn=None) -> dict:
    """Wochenkurse je Ticker ab `start` (7 Tage Puffer), für die Berechnung im Browser."""
    out = {}
    for t in dict.fromkeys(tickers):
        h = market.history(conn, t, start - timedelta(days=7), fetch_fn)
        out[t] = woechentlich(h)
    return out
