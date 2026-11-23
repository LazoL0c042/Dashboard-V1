"""Produktkatalog, Kennzahlen (live aus Kursen + Stammdaten mit Quelle) und Bewertung."""
import json
import math
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from . import market
from .db import rows

KATALOG = Path(__file__).resolve().parent.parent / "data" / "produkte.json"

# Offengelegte Bewertungsregeln: (Schlüssel, Name, Einheit, gut-Grenze, mittel-Grenze, höher_ist_besser)
REGELN = [
    ("ter", "Laufende Kosten (TER)", "%", 0.20, 0.50, False),
    ("volumen_mio", "Fondsvolumen", "Mio. €", 1000, 100, True),
    ("top10_anteil", "Anteil Top-10-Positionen", "%", 25, 40, False),
    ("volatilitaet", "Schwankung p.a. (3 J.)", "%", 15, 25, False),
    ("max_verlust", "Max. Verlust (5 J.)", "%", -20, -35, True),
]


@lru_cache(maxsize=1)
def katalog() -> list[dict]:
    return json.loads(KATALOG.read_text(encoding="utf-8"))["produkte"]


def finde(isin_oder_ticker: str) -> dict | None:
    for p in katalog():
        if isin_oder_ticker and isin_oder_ticker in (p["isin"], p["ticker"]):
            return p
    return None


def kategorien() -> list[str]:
    return list(dict.fromkeys(p["kategorie"] for p in katalog()))


# ---------- Kennzahlen aus Kursreihe ----------

def kpis(hist: list[tuple[str, float]], heute: date | None = None) -> dict:
    """Rendite 1/3/5 J. (p.a.), Volatilität (3 J., annualisiert), max. Verlust (5 J.). Werte in %."""
    if len(hist) < 20:
        return {}
    heute = heute or date.fromisoformat(hist[-1][0])
    end = hist[-1][1]
    out = {"stand": hist[-1][0], "kurs": end}

    def ab(jahre):
        tag = (heute - timedelta(days=round(365.25 * jahre))).isoformat()
        return market.price_on(hist, tag)

    for j in (1, 3, 5):
        p = ab(j)
        if p:
            out[f"rendite_{j}j"] = ((end / p[1]) ** (1 / j) - 1) * 100
    seit3 = (heute - timedelta(days=3 * 365)).isoformat()
    r3 = [c for d, c in hist if d >= seit3]
    if len(r3) > 60:
        logs = [math.log(b / a) for a, b in zip(r3, r3[1:]) if a > 0 and b > 0]
        mean = sum(logs) / len(logs)
        var = sum((x - mean) ** 2 for x in logs) / (len(logs) - 1)
        out["volatilitaet"] = math.sqrt(var) * math.sqrt(252) * 100
    seit5 = (heute - timedelta(days=5 * 365)).isoformat()
    peak, mdd = 0.0, 0.0
    for d, c in hist:
        if d < seit5:
            continue
        peak = max(peak, c)
        mdd = min(mdd, c / peak - 1)
    out["max_verlust"] = mdd * 100
    return out


def bewerte(werte: dict) -> list[dict]:
    out = []
    for key, name, einheit, gut, mittel, hoeher in REGELN:
        if key not in werte or werte[key] in (None, ""):
            continue
        try:
            v = float(werte[key])
        except (TypeError, ValueError):
            continue
        if hoeher:
            note = "gut" if v >= gut else "mittel" if v >= mittel else "schwach"
            regel = f"gut ab {gut} {einheit}, mittel ab {mittel} {einheit}"
        else:
            note = "gut" if v <= gut else "mittel" if v <= mittel else "schwach"
            regel = f"gut bis {gut} {einheit}, mittel bis {mittel} {einheit}"
        out.append({"kpi": key, "name": name, "wert": v, "einheit": einheit, "note": note, "regel": regel})
    return out


# ---------- Stammdaten (TER, Top-10 ...) mit Quelle ----------

def fakten(conn, isin: str) -> dict:
    return {
        r["key"]: {"wert": r["value"], "quelle": r["source"], "datum": r["fetched_at"]}
        for r in rows(conn, "SELECT * FROM product_facts WHERE isin = ?", (isin,))
    }


def setze_fakt(conn, isin: str, key: str, value, quelle: str) -> None:
    if not quelle.strip():
        raise ValueError("Ohne Quelle wird nichts gespeichert.")
    conn.execute(
        "INSERT OR REPLACE INTO product_facts (isin, key, value, source, fetched_at) VALUES (?, ?, ?, ?, datetime('now'))",
        (isin, key, json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value, quelle.strip()),
    )
    conn.commit()


def lade_yahoo_fakten(conn, p: dict) -> list[str]:
    """Versucht TER, Volumen und Top-10 über yfinance. Für europäische ETFs oft lückenhaft."""
    geladen = []
    try:
        import yfinance as yf

        fd = yf.Ticker(p["ticker"]).funds_data
        ops = getattr(fd, "fund_operations", None)
        if ops is not None and not ops.empty:
            col = ops.columns[0]
            for label, key, faktor in (("Annual Report Expense Ratio", "ter", 100), ("Total Net Assets", "volumen_mio", 1)):
                if label in ops.index and ops.loc[label, col] == ops.loc[label, col]:
                    setze_fakt(conn, p["isin"], key, round(float(ops.loc[label, col]) * faktor, 4), "Yahoo Finance (yfinance)")
                    geladen.append(key)
        top = getattr(fd, "top_holdings", None)
        if top is not None and not top.empty:
            liste = [{"name": str(i if "Name" not in top else top.loc[i, "Name"]),
                      "anteil": round(float(top.loc[i, "Holding Percent"]) * 100, 2)} for i in top.index[:10]]
            setze_fakt(conn, p["isin"], "top10", liste, "Yahoo Finance (yfinance)")
            setze_fakt(conn, p["isin"], "top10_anteil", round(sum(x["anteil"] for x in liste), 2), "Yahoo Finance (yfinance)")
            geladen.append("top10")
    except Exception:
        pass
    return geladen


def detail(conn, p: dict, fetch_fn=None) -> dict:
    hist = market.history(conn, p["ticker"], date.today() - timedelta(days=5 * 366), fetch_fn) if p.get("ticker") else []
    live = kpis(hist)
    f = fakten(conn, p["isin"]) if p.get("isin") else {}
    werte = {**{k: v["wert"] for k, v in f.items()}, **live}
    return {**p, "live": live, "live_quelle": "Yahoo Finance (yfinance), Tageskurse", "fakten": f, "bewertung": bewerte(werte)}


def katalog_fuer_modell(conn) -> list[dict]:
    return [
        {"name": p["name"], "isin": p["isin"], "kategorie": p["kategorie"],
         "kennzahlen": {k: f"{v['wert']} (Quelle: {v['quelle']}, {v['datum']})" for k, v in fakten(conn, p["isin"]).items()
                        if k != "top10"} if p["isin"] else {}}
        for p in katalog()
    ]


def markiere_verifiziert(produkte: list) -> list[dict]:
    isins = {p["isin"] for p in katalog() if p["isin"]}
    out = []
    for p in produkte if isinstance(produkte, list) else []:
        if isinstance(p, dict):
            p["verifiziert"] = bool(p.get("isin")) and p.get("isin") in isins
            out.append(p)
    return out
