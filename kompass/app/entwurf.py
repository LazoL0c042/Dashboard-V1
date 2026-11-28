"""Portfolio-Entwurf (Warenkorb): Positionen sammeln, gewichten, dann als Portfolio speichern."""
import json
from datetime import date, timedelta

from . import glossar, products, scenarios
from .db import one

MAX_POSITIONEN = 20


def leer() -> dict:
    return {"name": "", "beschreibung": "", "risiko": 3, "einmalbetrag": 10000, "sparrate": 300,
            "horizont_jahre": 20, "rueckrechnung_jahre": 5, "positionen": [], "bau": None}


def _laden(r) -> dict:
    return {**leer(), **json.loads(r["inhalt_json"]), "id": r["id"], "updated_at": r["updated_at"]}


def get(conn, user_id: int, eid: int | None = None) -> dict:
    """Ein Entwurf (Strategie in Arbeit). Ohne eid: der zuletzt bearbeitete, sonst ein leerer (noch ohne id)."""
    if eid is not None:
        r = one(conn, "SELECT * FROM strategien WHERE id = ? AND user_id = ?", (eid, user_id))
        if not r:
            raise LookupError("Entwurf nicht gefunden")
        return _laden(r)
    r = one(conn, "SELECT * FROM strategien WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1", (user_id,))
    return _laden(r) if r else {**leer(), "id": None}


def liste(conn, user_id: int) -> list[dict]:
    from .db import rows
    out = []
    for r in rows(conn, "SELECT * FROM strategien WHERE user_id = ? ORDER BY updated_at DESC, id DESC", (user_id,)):
        e = _laden(r)
        out.append({"id": e["id"], "name": e["name"] or "Unbenannter Entwurf", "risiko": e["risiko"], "einmalbetrag": e["einmalbetrag"],
                    "sparrate": e["sparrate"], "horizont_jahre": e["horizont_jahre"], "updated_at": e["updated_at"],
                    "positionen": [{"name": p["name"], "anteil": p["anteil"], "asset_id": p.get("asset_id"), "klassen": p.get("klassen", {})} for p in e["positionen"]],
                    "schritt": (e.get("bau") or {}).get("schritt")})
    return out


def neu(conn, user_id: int, d: dict | None = None) -> dict:
    cur = conn.execute("INSERT INTO strategien (user_id, inhalt_json) VALUES (?, ?)", (user_id, json.dumps(leer(), ensure_ascii=False)))
    conn.commit()
    return speichern(conn, user_id, {**leer(), **(d or {})}, cur.lastrowid)


def loeschen(conn, user_id: int, eid: int) -> bool:
    cur = conn.execute("DELETE FROM strategien WHERE id = ? AND user_id = ?", (eid, user_id))
    conn.commit()
    return cur.rowcount > 0


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


def speichern(conn, user_id: int, d: dict, eid: int | None = None) -> dict:
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
    # Summe nie über 100 %: überzählige Prozente bei der letzten Position kappen
    rest = 100.0
    for p in pos:
        p["anteil"] = max(0.0, min(float(p["anteil"]), rest))
        rest -= p["anteil"]
    e["positionen"] = pos
    if isinstance(d.get("bau"), dict):
        e["bau"] = _bau(d["bau"])
    eid = eid if eid is not None else d.get("id")
    if eid is None:
        cur = conn.execute("INSERT INTO strategien (user_id, inhalt_json) VALUES (?, ?)", (user_id, json.dumps(e, ensure_ascii=False)))
        eid = cur.lastrowid
    else:
        cur = conn.execute("UPDATE strategien SET inhalt_json = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ? AND user_id = ?",
                           (json.dumps(e, ensure_ascii=False), eid, user_id))
        if cur.rowcount == 0:
            raise LookupError("Entwurf nicht gefunden")
    conn.commit()
    return get(conn, user_id, eid)


def _bau(b: dict) -> dict:
    """Zwischenstand des Schritt-für-Schritt-Baukastens (nur bekannte Felder)."""
    hk = {h["id"] for h in glossar.daten()["hauptklassen"]}
    assets = {a["id"] for a in glossar.daten()["assets"]}
    gew = {k: _zahl(v, 0, 100, 0) for k, v in (b.get("gewichte") or {}).items() if k in hk}
    if sum(gew.values()) > 100.5:
        raise ValueError("Die Gewichte der Anlageklassen ergeben mehr als 100 %.")
    auswahl = {}
    for k, liste in (b.get("auswahl") or {}).items():
        if k in hk and isinstance(liste, list):
            auswahl[k] = [{"asset_id": x["asset_id"], "anteil": _zahl(x.get("anteil"), 0, 100, 0)} for x in liste
                          if isinstance(x, dict) and x.get("asset_id") in assets]
    produkte_wahl = {k: str(v)[:40] for k, v in (b.get("produkte") or {}).items() if k in assets}
    return {"schritt": int(_zahl(b.get("schritt"), 1, 5, 1)), "gewichte": gew, "auswahl": auswahl, "produkte": produkte_wahl}


def hinzufuegen(conn, user_id: int, quelle: dict, eid: int | None = None) -> dict:
    e = get(conn, user_id, eid)
    pos = position_aus(quelle)
    if not pos:
        raise ValueError("Unbekanntes Produkt oder Asset.")
    schluessel = lambda x: (x.get("asset_id"), x.get("ticker"))  # noqa: E731
    if any(schluessel(x) == schluessel(pos) for x in e["positionen"]):
        raise ValueError(f"{pos['name']} ist schon im Entwurf.")
    if sum(float(p.get("anteil") or 0) for p in e["positionen"]) + pos["anteil"] > 100.5:
        frei = max(0.0, 100 - sum(float(p.get("anteil") or 0) for p in e["positionen"]))
        if frei <= 0:
            raise ValueError("Der Entwurf ist schon zu 100 % verteilt. Reduziere erst eine andere Position.")
        pos["anteil"] = frei
    if len(e["positionen"]) >= MAX_POSITIONEN:
        raise ValueError(f"Höchstens {MAX_POSITIONEN} Positionen.")
    e["positionen"].append(pos)
    return speichern(conn, user_id, e, e["id"])


def leeren(conn, user_id: int, eid: int | None = None) -> None:
    e = get(conn, user_id, eid)
    if e["id"] is not None:
        loeschen(conn, user_id, e["id"])


def als_portfolio(e: dict, conn=None) -> dict:
    """Eingabe für portfolios.anlegen. Wirft ValueError, wenn Ticker fehlen (versucht vorher, sie über die ISIN aufzulösen)."""
    if conn is not None:
        for p in e["positionen"]:
            if not p.get("ticker") and p.get("isin"):
                kat = products.finde(p["isin"])
                if kat:
                    p["ticker"] = products.mit_status(conn, kat, aufloesen=True).get("ticker", "")
    summe = sum(float(p.get("anteil") or 0) for p in e["positionen"])
    if abs(summe - 100) > 0.5:
        raise ValueError(f"Die Anteile ergeben {summe:.0f} % – verteile genau 100 %, bevor du speicherst.")
    ohne = [p["name"] for p in e["positionen"] if not p.get("ticker")]
    if ohne:
        raise ValueError("Für die Rückrechnung braucht jede Position einen Ticker. Fehlt bei: " + ", ".join(ohne))
    start = date.today() - timedelta(days=round(365.25 * float(e.get("rueckrechnung_jahre") or 0)))
    return {"name": e["name"] or "Neues Portfolio", "beschreibung": e["beschreibung"], "startdatum": start.isoformat(),
            "einmalbetrag": e["einmalbetrag"], "sparrate": e["sparrate"],
            "positionen": [{"ticker": p["ticker"], "isin": p.get("isin", ""), "name": p["name"], "anteil": p["anteil"],
                            "klassen": p["klassen"]} for p in e["positionen"] if p["anteil"] > 0]}
