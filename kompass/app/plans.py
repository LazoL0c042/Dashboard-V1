"""Pläne: eingefrorene Strategien und ihre Auswertung gegen den MSCI World."""
import json
from datetime import date, timedelta

from . import config, council, market, profile
from .db import one, rows


def _monate(start: date, heute: date) -> list[date]:
    """Einzahlungstermine: Start und dann jeden Monat am gleichen Tag (bis heute)."""
    out, m = [], 0
    while True:
        y, mo = start.year + (start.month - 1 + m) // 12, (start.month - 1 + m) % 12 + 1
        tag = min(start.day, 28)
        d = date(y, mo, tag if m else start.day)
        if d > heute:
            return out
        out.append(d)
        m += 1


def freeze(conn, user_id: int, eingabe: dict, session_id: int | None = None, fetch_fn=None) -> int:
    produkte = [p for p in eingabe.get("produkte", []) if p.get("ticker")]
    if not produkte:
        raise ValueError("Mindestens ein Produkt mit Ticker angeben, sonst ist keine Auswertung möglich.")
    summe = sum(float(p.get("anteil", 1)) for p in produkte)
    if summe <= 0:
        raise ValueError("Anteile müssen positiv sein.")
    ergebnis, protokoll = None, []
    if session_id is not None:
        s = council.session_for(conn, user_id, session_id)
        if not s:
            raise LookupError("Council-Sitzung nicht gefunden")
        if s["status"] not in ("fertig", "dissens"):
            raise ValueError("Die Council-Sitzung ist noch nicht abgeschlossen.")
        ergebnis = json.loads(s["result_json"]) if s["result_json"] else None
        protokoll = council.messages_for(conn, session_id)
    heute = date.today().isoformat()
    kurse = {}
    for t in [p["ticker"] for p in produkte] + [config.BENCHMARK["ticker"]]:
        k = market.last(conn, t, fetch_fn)
        kurse[t] = {"kurs": k[1], "datum": k[0], "quelle": "Yahoo Finance"} if k else None
    frozen = {
        "entscheidung": {
            "titel": eingabe.get("titel", "").strip() or "Strategie",
            "was": eingabe.get("was", ""),
            "wofuer": eingabe.get("wofuer", ""),
            "horizont_jahre": float(eingabe.get("horizont_jahre") or 0),
            "warum": eingabe.get("warum", ""),
            "kriterien": eingabe.get("kriterien", ""),
            "einmalbetrag": float(eingabe.get("einmalbetrag") or 0),
            "sparrate": float(eingabe.get("sparrate") or 0),
            "zielbetrag": float(eingabe["zielbetrag"]) if eingabe.get("zielbetrag") not in (None, "") else None,
            "produkte": [{**p, "anteil": float(p.get("anteil", 1)) / summe} for p in produkte],
            "startdatum": eingabe.get("startdatum") or heute,
        },
        "benchmark": config.BENCHMARK,
        "kurse_am_entscheidungstag": kurse,
        "profil": profile.current(conn, user_id),
        "ergebnis": ergebnis,
        "protokoll": protokoll,
        "eingefroren_am": heute,
    }
    if frozen["entscheidung"]["einmalbetrag"] <= 0 and frozen["entscheidung"]["sparrate"] <= 0:
        raise ValueError("Einmalbetrag oder Sparrate muss größer als 0 sein.")
    cur = conn.execute(
        "INSERT INTO plans (user_id, session_id, title, frozen_json) VALUES (?, ?, ?, ?)",
        (user_id, session_id, frozen["entscheidung"]["titel"], json.dumps(frozen, ensure_ascii=False)),
    )
    conn.commit()
    return cur.lastrowid


def get(conn, user_id: int, plan_id: int) -> dict | None:
    p = one(conn, "SELECT * FROM plans WHERE id = ? AND user_id = ?", (plan_id, user_id))
    if not p:
        return None
    p["frozen"] = json.loads(p.pop("frozen_json"))
    p["nachtraege"] = [
        {**a, "content": json.loads(a.pop("content_json"))}
        for a in rows(conn, "SELECT * FROM plan_addenda WHERE plan_id = ? ORDER BY id", (plan_id,))
    ]
    return p


def liste(conn, user_id: int) -> list[dict]:
    out = []
    for p in rows(conn, "SELECT id, title, created_at, frozen_json FROM plans WHERE user_id = ? ORDER BY id DESC", (user_id,)):
        f = json.loads(p.pop("frozen_json"))
        letzte = one(
            conn,
            "SELECT content_json, created_at FROM plan_addenda WHERE plan_id = ? AND kind = 'auswertung' ORDER BY id DESC LIMIT 1",
            (p["id"],),
        )
        p["letzte_auswertung"] = {**json.loads(letzte["content_json"]), "am": letzte["created_at"]} if letzte else None
        p["horizont_jahre"] = f["entscheidung"]["horizont_jahre"]
        p["bewertung"] = (f.get("ergebnis") or {}).get("synthese", {}).get("bewertung")
        out.append(p)
    return out


def evaluate(frozen: dict, history_fn, heute: date | None = None) -> dict:
    """history_fn(ticker, start: date) -> [(tag, kurs)]. Gleiche Zahlungen in Plan und Benchmark."""
    heute = heute or date.today()
    e = frozen["entscheidung"]
    start = date.fromisoformat(e["startdatum"])
    termine = _monate(start, heute)
    zahlungen = [(d, (e["einmalbetrag"] if i == 0 else 0) + (e["sparrate"] if i > 0 or e["einmalbetrag"] == 0 else 0))
                 for i, d in enumerate(termine)]
    zahlungen = [(d, z) for d, z in zahlungen if z > 0]
    eingezahlt = sum(z for _, z in zahlungen)
    fehlend = []

    def depotwert(positionen: list[tuple[str, float]]) -> float | None:
        wert = 0.0
        for ticker, anteil in positionen:
            hist = history_fn(ticker, start)
            stueck = 0.0
            for d, z in zahlungen:
                k = market.price_on(hist, d.isoformat())
                if not k:
                    fehlend.append(f"{ticker} am {d.isoformat()}")
                    return None
                stueck += z * anteil / k[1]
            jetzt = market.price_on(hist, heute.isoformat())
            if not jetzt:
                fehlend.append(f"{ticker} aktuell")
                return None
            wert += stueck * jetzt[1]
        return wert

    wert = depotwert([(p["ticker"], p["anteil"]) for p in e["produkte"]])
    bench = depotwert([(frozen["benchmark"]["ticker"], 1.0)])
    jahre_vergangen = (heute - start).days / 365.25
    horizont = e["horizont_jahre"] or None

    ziel = None
    if e.get("zielbetrag") and wert is not None:
        if horizont and jahre_vergangen >= horizont:
            ziel = {"status": "erreicht" if wert >= e["zielbetrag"] else "verfehlt"}
        elif horizont:
            soll = e["zielbetrag"] * jahre_vergangen / horizont
            ziel = {"status": "auf Kurs" if wert >= soll else "hinter Plan", "soll_heute": soll,
                    "hinweis": "Soll-Wert als lineare Näherung (Anteil der vergangenen Zeit am Horizont)."}
    return {
        "stichtag": heute.isoformat(),
        "jahre_vergangen": round(jahre_vergangen, 2),
        "eingezahlt": eingezahlt,
        "wert": wert,
        "benchmark_wert": bench,
        "rendite": (wert / eingezahlt - 1) if wert is not None and eingezahlt else None,
        "benchmark_rendite": (bench / eingezahlt - 1) if bench is not None and eingezahlt else None,
        "markt_geschlagen": (wert > bench) if wert is not None and bench is not None else None,
        "im_plus": (wert > eingezahlt) if wert is not None else None,
        "ziel": ziel,
        "fehlende_kurse": fehlend,
        "quelle": "Yahoo Finance (yfinance), Schlusskurse",
    }


def auswerten(conn, user_id: int, plan_id: int, fetch_fn=None, heute: date | None = None) -> dict:
    p = get(conn, user_id, plan_id)
    if not p:
        raise LookupError("Plan nicht gefunden")
    start = date.fromisoformat(p["frozen"]["entscheidung"]["startdatum"])
    hist = lambda t, s: market.history(conn, t, min(s, start) - timedelta(days=3), fetch_fn)  # noqa: E731
    a = evaluate(p["frozen"], hist, heute)
    nachtrag(conn, user_id, plan_id, "auswertung", a)
    return a


def nachtrag(conn, user_id: int, plan_id: int, kind: str, content: dict) -> int:
    if not one(conn, "SELECT id FROM plans WHERE id = ? AND user_id = ?", (plan_id, user_id)):
        raise LookupError("Plan nicht gefunden")
    cur = conn.execute(
        "INSERT INTO plan_addenda (plan_id, kind, content_json) VALUES (?, ?, ?)",
        (plan_id, kind, json.dumps(content, ensure_ascii=False)),
    )
    conn.commit()
    return cur.lastrowid


def trefferquote(conn, user_id: int) -> dict:
    """Wie oft wurden die drei Kriterien in der jeweils letzten Auswertung erfüllt?"""
    pl = [p for p in liste(conn, user_id) if p["letzte_auswertung"]]
    def quote(key):
        werte = [p["letzte_auswertung"].get(key) for p in pl if p["letzte_auswertung"].get(key) is not None]
        return {"ja": sum(1 for w in werte if w), "von": len(werte)}
    ziel = [p["letzte_auswertung"]["ziel"]["status"] for p in pl if p["letzte_auswertung"].get("ziel")]
    return {
        "markt_geschlagen": quote("markt_geschlagen"),
        "im_plus": quote("im_plus"),
        "ziel": {"ja": sum(1 for z in ziel if z in ("erreicht", "auf Kurs")), "von": len(ziel)},
    }
