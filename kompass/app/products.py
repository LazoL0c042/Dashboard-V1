"""Produktkatalog, Kennzahlen (live aus Kursen + Stammdaten mit Quelle) und Bewertung."""
import json
import math
import os
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from . import market
from .db import rows

KATALOG = Path(__file__).resolve().parent.parent / "data" / "produkte.json"
EXTRA_STANDARD = Path(__file__).resolve().parent.parent / "data" / "produkte_extra.json"  # per ISIN geprüft nachgeladen


def _extra() -> Path:
    return Path(os.getenv("KOMPASS_PRODUKTE_EXTRA") or EXTRA_STANDARD)

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
    basis = json.loads(KATALOG.read_text(encoding="utf-8"))["produkte"]
    extra = json.loads(_extra().read_text(encoding="utf-8")) if _extra().exists() else []
    isins = {p["isin"] for p in basis if p["isin"]}
    return basis + [p for p in extra if p["isin"] not in isins]


def finde(isin_oder_ticker: str) -> dict | None:
    if not isin_oder_ticker:
        return None
    for feld in ("id", "isin", "ticker"):
        for p in katalog():
            if p.get(feld) == isin_oder_ticker:
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
    p = mit_status(conn, p, aufloesen=True)
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


# ---------- Prüfung gegen Yahoo Finance / justETF, Ticker-Auflösung, Import per ISIN ----------

import os  # noqa: E402
import re  # noqa: E402

import httpx  # noqa: E402


def _get(url: str, params: dict | None = None) -> str:
    r = httpx.get(url, params=params, timeout=12, follow_redirects=True,
                  headers={"User-Agent": "Mozilla/5.0 (Kompass)", "Accept-Language": "de-DE,de;q=0.9"})
    r.raise_for_status()
    return r.text


def _offline() -> bool:
    return os.getenv("KOMPASS_OFFLINE", "").lower() in ("1", "true")


def yahoo_suche(isin: str, fetch=_get) -> dict | None:
    """Findet über die ISIN einen Yahoo-Ticker (bevorzugt Xetra) und den Namen."""
    d = json.loads(fetch("https://query2.finance.yahoo.com/v1/finance/search", {"q": isin, "quotesCount": 10, "newsCount": 0}))
    quotes = [q for q in d.get("quotes", []) if q.get("symbol")]
    if not quotes:
        return None
    best = next((q for q in quotes if q["symbol"].endswith(".DE")), None) or next((q for q in quotes if q.get("exchange") in ("GER", "FRA")), None) or quotes[0]
    return {"ticker": best["symbol"], "name": best.get("longname") or best.get("shortname") or ""}


def _zahl_de(t: str) -> float | None:
    t = t.replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def justetf_fakten(isin: str, fetch=_get) -> dict:
    """Liest Stammdaten von der justETF-Profilseite (inoffiziell, kann sich ändern)."""
    html = fetch("https://www.justetf.com/de/etf-profile.html", {"isin": isin})
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    out = {}
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    if m:
        out["name"] = re.sub(r"<[^>]+>|\s+", " ", m.group(1)).strip()
    m = re.search(r"Gesamtkostenquote \(TER\)\s*([\d,]+)\s*%", text)
    if m:
        out["ter"] = _zahl_de(m.group(1))
    m = re.search(r"Fondsgröße\s*(?:EUR|USD)\s*([\d.,]+)\s*(Mio|Mrd)", text)
    if m and _zahl_de(m.group(1)) is not None:
        out["volumen_mio"] = _zahl_de(m.group(1)) * (1000 if m.group(2) == "Mrd" else 1)
    for key, muster in (("ertrag", r"Ertragsverwendung\s*(Thesaurierend|Ausschüttend)"), ("replikation", r"Replikationsmethode\s*(Physisch \([^)]*\)|Physisch|Synthetisch[^ ]*)"),
                        ("domizil", r"Fondsdomizil\s*([A-ZÄÖÜ][a-zäöü]+)"), ("auflage", r"Auflagedatum[^0-9]*(\d{2}\.\d{2}\.\d{4})")):
        m = re.search(muster, text)
        if m:
            out[key] = m.group(1)
    return out


def _woerter(t: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9&]+", (t or "").lower()) if len(w) > 2 and w not in {"ucits", "etf", "acc", "dist", "the", "usd", "eur"}}


def pruefen(conn, p: dict, fetch=_get) -> dict:
    """Prüft ein Produkt: existiert die ISIN, passt der Name, welcher Ticker? Speichert Ergebnis mit Quelle und Datum."""
    erg = {"isin": p["isin"], "geprueft": False, "quellen": []}
    if not p.get("isin"):
        return erg
    try:
        y = yahoo_suche(p["isin"], fetch)
        if y:
            erg["ticker"], erg["yahoo_name"] = y["ticker"], y["name"]
            erg["quellen"].append("Yahoo Finance")
    except Exception:
        pass
    try:
        j = justetf_fakten(p["isin"], fetch)
        if j:
            erg["justetf"] = j
            erg["quellen"].append("justETF")
    except Exception:
        pass
    gefunden = " ".join(filter(None, [erg.get("yahoo_name"), (erg.get("justetf") or {}).get("name")]))
    erg["geprueft"] = len(_woerter(gefunden) & _woerter(p.get("name", "") + " " + p.get("anbieter", ""))) >= 1
    heute = date.today().isoformat()
    if erg.get("ticker") and not p.get("ticker"):
        setze_fakt(conn, p["isin"], "ticker", erg["ticker"], f"Yahoo Finance Suche, {heute}")
    setze_fakt(conn, p["isin"], "geprueft", "ja" if erg["geprueft"] else "nein", f"{' + '.join(erg['quellen']) or 'keine Quelle erreichbar'}, {heute}")
    for key in ("ter", "volumen_mio", "ertrag", "replikation", "domizil", "auflage"):
        if key in (erg.get("justetf") or {}):
            setze_fakt(conn, p["isin"], key, erg["justetf"][key], f"justETF, {heute}")
    return erg


def mit_status(conn, p: dict, aufloesen: bool = False) -> dict:
    """Produkt mit Ticker (ggf. aufgelöst) und Prüfstatus aus der Datenbank."""
    f = fakten(conn, p["isin"]) if p.get("isin") else {}
    p = {**p}
    if not p.get("ticker") and "ticker" in f:
        p["ticker"] = f["ticker"]["wert"]
    if not p.get("ticker") and aufloesen and p.get("isin") and not _offline():
        try:
            y = yahoo_suche(p["isin"])
            if y:
                p["ticker"] = y["ticker"]
                setze_fakt(conn, p["isin"], "ticker", y["ticker"], f"Yahoo Finance Suche, {date.today().isoformat()}")
        except Exception:
            pass
    if "geprueft" in f:
        p["geprueft"] = f["geprueft"]["wert"] == "ja"
        p["geprueft_quelle"] = f["geprueft"]["quelle"]
    return p


def importieren(conn, isin: str, asset_id: str, fetch=_get) -> dict:
    """Nimmt ein Produkt per ISIN in den Katalog auf – nur wenn eine Quelle es bestätigt."""
    from . import glossar

    isin = isin.strip().upper()
    if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}\d", isin):
        raise ValueError("Das ist keine gültige ISIN (12 Zeichen, z. B. IE00B4L5Y983).")
    if finde(isin):
        raise ValueError("Dieses Produkt ist schon im Katalog.")
    a = glossar.finde(asset_id)
    if not a:
        raise ValueError("Unbekannte Anlageklasse.")
    roh = {"isin": isin, "name": "", "anbieter": ""}
    y = None
    try:
        y = yahoo_suche(isin, fetch)
    except Exception:
        pass
    j = {}
    try:
        j = justetf_fakten(isin, fetch)
    except Exception:
        pass
    name = (j.get("name") or (y or {}).get("name") or "").strip()
    if not name:
        raise ValueError("Keine Quelle kennt diese ISIN – nicht aufgenommen.")
    neu = {"kategorie": next((p["kategorie"] for p in katalog() if p.get("asset") == asset_id), a["name"]), "name": name, "isin": isin,
           "ticker": (y or {}).get("ticker", ""), "anbieter": name.split()[0], "steuerklasse": a["steuerklasse"], "klassen": a["klassen"],
           "id": isin, "asset": asset_id, "besonderheit": "Per ISIN nachgeladen – Eigenschaften auf justETF prüfen.", "geprueft": True,
           "links": [{"titel": "justETF", "url": f"https://www.justetf.com/de/etf-profile.html?isin={isin}"}]}
    extra = json.loads(_extra().read_text(encoding="utf-8")) if _extra().exists() else []
    extra.append(neu)
    _extra().write_text(json.dumps(extra, ensure_ascii=False, indent=1), encoding="utf-8")
    katalog.cache_clear()
    heute = date.today().isoformat()
    setze_fakt(conn, isin, "geprueft", "ja", f"{'justETF' if j else 'Yahoo Finance'}, {heute}")
    for key in ("ter", "volumen_mio", "ertrag", "replikation", "domizil", "auflage"):
        if key in j:
            setze_fakt(conn, isin, key, j[key], f"justETF, {heute}")
    _ = roh
    return neu


# ---------- Rangliste je Anlage ----------

def ranking(conn, asset_id: str) -> list[dict]:
    """Bewertet alle Produkte einer Anlage nach Kosten, Größe, Domizil, Prüfstatus und (falls vorhanden) Schwankung.

    Punkte 0–100; fehlende Daten zählen neutral und werden als „unbekannt“ ausgewiesen.
    """
    out = []
    for p in [x for x in katalog() if x.get("asset") == asset_id]:
        p = mit_status(conn, p)
        f = {k: v["wert"] for k, v in (fakten(conn, p["isin"]) if p.get("isin") else {}).items()}
        teile = []

        def teil(name, punkte, max_, text):
            teile.append({"kriterium": name, "punkte": punkte, "max": max_, "text": text})

        ter = _float(f.get("ter"))
        teil("Kosten (TER)", 3 if ter is not None and ter <= 0.2 else 2 if ter is not None and ter <= 0.4 else 1 if ter is None else 1 if ter <= 0.7 else 0, 3,
             f"{ter:.2f} % p.a." if ter is not None else "unbekannt")
        vol = _float(f.get("volumen_mio"))
        teil("Fondsgröße", 3 if vol is not None and vol >= 1000 else 2 if vol is not None and vol >= 300 else 1 if vol is None or vol >= 100 else 0, 3,
             f"{vol:,.0f} Mio. €".replace(",", ".") if vol is not None else "unbekannt")
        dom = {"IE": "Irland", "LU": "Luxemburg", "DE": "Deutschland", "FR": "Frankreich", "GB": "Großbritannien", "CH": "Schweiz"}.get((p.get("isin") or "")[:2], "–")
        us_lastig = any(k in p.get("klassen", {}) for k in ("aktien_welt", "aktien_usa", "aktien_tech"))
        teil("Domizil", 2 if dom == "Irland" or not us_lastig else 1, 2, dom + (" (günstig für US-Dividenden)" if dom == "Irland" and us_lastig else ""))
        geprueft = p.get("geprueft") is True
        teil("Daten geprüft", 2 if geprueft else 0, 2, "bestätigt" if geprueft else "ungeprüft")
        punkte = sum(t["punkte"] for t in teile)
        maximum = sum(t["max"] for t in teile)
        out.append({**p, "score": round(100 * punkte / maximum), "kriterien": teile,
                    "ertrag": f.get("ertrag") or p.get("ertrag"), "replikation": f.get("replikation") or p.get("replikation")})
    return sorted(out, key=lambda x: (-x["score"], x["name"]))


def _float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None
