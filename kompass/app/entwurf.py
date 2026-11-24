"""Portfolio-Entwurf (Warenkorb): Positionen sammeln, gewichten, dann als Portfolio speichern."""
import json
from datetime import date, timedelta

from . import glossar, products, scenarios
from .db import one

MAX_POSITIONEN = 20


def leer() -> dict:
    return {"name": "", "beschreibung": "", "risiko": 3, "einmalbetrag": 10000, "sparrate": 300,
            "horizont_jahre": 20, "rueckrechnung_jahre": 5, "positionen": []}


def get(conn, user_id: int) -> dict:
    r = one(conn, "SELECT inhalt_json FROM entwuerfe WHERE user_id = ?", (user_id,))
    return {**leer(), **json.loads(r["inhalt_json"])} if r else leer()


def _zahl(v, lo, hi, default):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


def position_aus(quelle: dict) -> dict | None:
    """Baut eine Position aus einem Glossar-Eintrag (asset_id), Katalogprodukt (id/isin/ticker) oder eigenen Angaben."""
    a = glossar.finde(quelle.get("asset_id") or "")
    kat = products.finde(quelle.get("id") or quelle.get("isin") or quelle.get("ticker") or "")
    if a:
        p = kat or (a["katalog"][0] if a["katalog"] else None)
        pos = {"asset_id": a["id"], "name": (p or {}).get("name") or a["name"], "ticker": (p or {}).get("ticker") or a.get("ticker") or "",
               "isin": (p or {}).get("isin", ""), "klassen": a["klassen"], "hebel": a.get("hebel", 1),
               "erwartung": a["erwartung"], "risiko": a["risiko"]}
    elif kat:
        pos = {"asset_id": None, "name": kat["name"], "ticker": kat["ticker"], "isin": kat["isin"], "klassen": kat["klassen"], "hebel": 1}
    elif quelle.get("ticker") and quelle.get("klassen"):
        pos = {"asset_id": None, "name": quelle.get("name") or quelle["ticker"], "ticker": quelle["ticker"], "isin": "",
               "klassen": quelle["klassen"], "hebel": 1}
    else:
        return None
    pos["klassen"] = {k: float(v) for k, v in pos["klassen"].items() if k in scenarios.klassen()}
    pos["anteil"] = _zahl(quelle.get("anteil", 10), 0, 100, 10)
    if quelle.get("warum"):
        pos["warum"] = str(quelle["warum"])[:500]
    return pos


def speichern(conn, user_id: int, d: dict) -> dict:
    e = leer()
    e["name"] = str(d.get("name") or "")[:120]
    e["beschreibung"] = str(d.get("beschreibung") or "")[:1000]
    e["risiko"] = int(_zahl(d.get("risiko"), 1, 5, 3))
    e["einmalbetrag"] = _zahl(d.get("einmalbetrag"), 0, 10_000_000, 0)
    e["sparrate"] = _zahl(d.get("sparrate"), 0, 100_000, 0)
    e["horizont_jahre"] = int(_zahl(d.get("horizont_jahre"), 1, 60, 20))
    e["rueckrechnung_jahre"] = _zahl(d.get("rueckrechnung_jahre"), 0, 30, 5)
    pos = []
    for p in (d.get("positionen") or [])[:MAX_POSITIONEN]:
        q = position_aus(p) if not p.get("klassen") or p.get("asset_id") else {**p, "anteil": _zahl(p.get("anteil"), 0, 100, 10)}
        if q:
            if p.get("ticker"):
                q["ticker"] = str(p["ticker"]).strip()[:30]
            pos.append(q)
    e["positionen"] = pos
    conn.execute(
        "INSERT INTO entwuerfe (user_id, inhalt_json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET "
        "inhalt_json = excluded.inhalt_json, updated_at = datetime('now')",
        (user_id, json.dumps(e, ensure_ascii=False)),
    )
    conn.commit()
    return e


def hinzufuegen(conn, user_id: int, quelle: dict) -> dict:
    e = get(conn, user_id)
    pos = position_aus(quelle)
    if not pos:
        raise ValueError("Unbekanntes Produkt oder Asset.")
    schluessel = lambda x: (x.get("asset_id"), x.get("ticker"))  # noqa: E731
    if any(schluessel(x) == schluessel(pos) for x in e["positionen"]):
        raise ValueError(f"{pos['name']} ist schon im Entwurf.")
    if len(e["positionen"]) >= MAX_POSITIONEN:
        raise ValueError(f"Höchstens {MAX_POSITIONEN} Positionen.")
    e["positionen"].append(pos)
    return speichern(conn, user_id, e)


def leeren(conn, user_id: int) -> None:
    conn.execute("DELETE FROM entwuerfe WHERE user_id = ?", (user_id,))
    conn.commit()


def als_portfolio(e: dict) -> dict:
    """Eingabe für portfolios.anlegen. Wirft ValueError, wenn Ticker fehlen."""
    ohne = [p["name"] for p in e["positionen"] if not p.get("ticker")]
    if ohne:
        raise ValueError("Für die Rückrechnung braucht jede Position einen Ticker. Fehlt bei: " + ", ".join(ohne))
    start = date.today() - timedelta(days=round(365.25 * float(e.get("rueckrechnung_jahre") or 0)))
    return {"name": e["name"] or "Neues Portfolio", "beschreibung": e["beschreibung"], "startdatum": start.isoformat(),
            "einmalbetrag": e["einmalbetrag"], "sparrate": e["sparrate"],
            "positionen": [{"ticker": p["ticker"], "isin": p.get("isin", ""), "name": p["name"], "anteil": p["anteil"],
                            "klassen": p["klassen"]} for p in e["positionen"] if p["anteil"] > 0]}
