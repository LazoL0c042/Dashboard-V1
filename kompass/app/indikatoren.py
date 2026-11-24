"""Aktuelle Marktindikatoren (Zinsen, Inflation, VIX, Fear & Greed, Shiller-KGV …) und
Vergleich mit historischen Extremereignissen (data/ereignisse.json).

Quellen (kostenlos): FRED (St. Louis Fed, CSV ohne Schlüssel), EZB Data Portal, CNN Fear & Greed
(inoffizielle Schnittstelle), multpl.com (Shiller-KGV). Jede Quelle kann ausfallen – dann bleibt der
letzte Wert aus dem Cache, sonst der letzte Stand der Kompass-Daten (klar markiert).
"""
import csv
import io
import json
import math
import os
import re
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

import httpx

from .db import one, rows

DATEI = Path(__file__).resolve().parent.parent / "data" / "ereignisse.json"
CACHE_STUNDEN = 6

INDIKATOREN = {
    "us_zins_10j": {"name": "US-Staatsanleihe 10 J.", "einheit": "%", "quelle": "FRED (DGS10)", "url": "https://fred.stlouisfed.org/series/DGS10", "art": "fred", "serie": "DGS10"},
    "us_leitzins": {"name": "US-Leitzins (Fed Funds)", "einheit": "%", "quelle": "FRED (FEDFUNDS)", "url": "https://fred.stlouisfed.org/series/FEDFUNDS", "art": "fred", "serie": "FEDFUNDS"},
    "us_inflation": {"name": "US-Inflation (CPI, Vorjahr)", "einheit": "%", "quelle": "FRED (CPIAUCSL)", "url": "https://fred.stlouisfed.org/series/CPIAUCSL", "art": "fred_yoy", "serie": "CPIAUCSL"},
    "zinskurve": {"name": "Zinskurve USA (10 J. minus 2 J.)", "einheit": "Pp.", "quelle": "FRED (T10Y2Y)", "url": "https://fred.stlouisfed.org/series/T10Y2Y", "art": "fred", "serie": "T10Y2Y"},
    "vix": {"name": "VIX (Angstbarometer)", "einheit": "", "quelle": "FRED (VIXCLS)", "url": "https://fred.stlouisfed.org/series/VIXCLS", "art": "fred", "serie": "VIXCLS"},
    "hy_spread": {"name": "Risikoaufschlag Hochzinsanleihen", "einheit": "Pp.", "quelle": "FRED (BAMLH0A0HYM2)", "url": "https://fred.stlouisfed.org/series/BAMLH0A0HYM2", "art": "fred", "serie": "BAMLH0A0HYM2"},
    "us_arbeitslos": {"name": "US-Arbeitslosenquote", "einheit": "%", "quelle": "FRED (UNRATE)", "url": "https://fred.stlouisfed.org/series/UNRATE", "art": "fred", "serie": "UNRATE"},
    "ezb_einlagenzins": {"name": "EZB-Einlagenzins", "einheit": "%", "quelle": "EZB Data Portal", "url": "https://data.ecb.europa.eu/", "art": "ezb", "serie": "FM/B.U2.EUR.4F.KR.DFR.LEV"},
    "euro_inflation": {"name": "Inflation Euroraum (HVPI)", "einheit": "%", "quelle": "EZB Data Portal", "url": "https://data.ecb.europa.eu/", "art": "ezb", "serie": "ICP/M.U2.N.000000.4.ANR"},
    "fear_greed": {"name": "CNN Fear & Greed Index", "einheit": "von 100", "quelle": "CNN", "url": "https://www.cnn.com/markets/fear-and-greed", "art": "cnn"},
    "cape": {"name": "Shiller-KGV (CAPE) S&P 500", "einheit": "", "quelle": "multpl.com (Shiller-Daten)", "url": "https://www.multpl.com/shiller-pe", "art": "multpl"},
}


@lru_cache(maxsize=1)
def ereignisse() -> dict:
    return json.loads(DATEI.read_text(encoding="utf-8"))


def finde_ereignis(eid: str) -> dict | None:
    return next((e for e in ereignisse()["ereignisse"] if e["id"] == eid), None)


def _get(url: str, params: dict | None = None) -> str:
    r = httpx.get(url, params=params, timeout=10, follow_redirects=True,
                  headers={"User-Agent": "Mozilla/5.0 (Kompass)", "Accept": "*/*"})
    r.raise_for_status()
    return r.text


def _fred(serie: str, fetch, yoy: bool = False) -> tuple[float, str]:
    txt = fetch("https://fred.stlouisfed.org/graph/fredgraph.csv", {"id": serie})
    werte = [(r[0], float(r[1])) for r in csv.reader(io.StringIO(txt)) if len(r) == 2 and re.match(r"\d{4}-", r[0]) and r[1] not in (".", "")]
    if not werte:
        raise ValueError("keine Werte")
    if not yoy:
        return werte[-1][1], werte[-1][0]
    tag, wert = werte[-1]
    vorjahr = f"{int(tag[:4]) - 1}{tag[4:]}"
    alt = next((w for d, w in reversed(werte) if d <= vorjahr), None)
    return (wert / alt - 1) * 100, tag


def _ezb(serie: str, fetch) -> tuple[float, str]:
    flow, key = serie.split("/", 1)
    txt = fetch(f"https://data-api.ecb.europa.eu/service/data/{flow}/{key}", {"lastNObservations": "1", "format": "csvdata"})
    d = list(csv.DictReader(io.StringIO(txt)))[-1]
    return float(d["OBS_VALUE"]), d["TIME_PERIOD"]


def _cnn(fetch) -> tuple[float, str]:
    d = json.loads(fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", None))
    fg = d["fear_and_greed"]
    return float(fg["score"]), str(fg.get("timestamp", ""))[:10]


def _multpl(fetch) -> tuple[float, str]:
    html = fetch("https://www.multpl.com/shiller-pe/table/by-month", None)
    m = re.search(r"<td[^>]*>\s*([A-Z][a-z]{2} \d{1,2}, \d{4})\s*</td>\s*<td[^>]*>\s*(?:&#x2002;|\s)*([\d.]+)", html)
    if not m:
        raise ValueError("Tabelle nicht gefunden")
    return float(m.group(2)), datetime.strptime(m.group(1), "%b %d, %Y").date().isoformat()


def abrufen(key: str, fetch=_get) -> tuple[float, str]:
    i = INDIKATOREN[key]
    if i["art"] == "fred":
        return _fred(i["serie"], fetch)
    if i["art"] == "fred_yoy":
        return _fred(i["serie"], fetch, yoy=True)
    if i["art"] == "ezb":
        return _ezb(i["serie"], fetch)
    if i["art"] == "cnn":
        return _cnn(fetch)
    return _multpl(fetch)


def offline() -> bool:
    return os.getenv("KOMPASS_OFFLINE", "").lower() in ("1", "true")


def aktuell(conn, fetch=_get, max_stunden: int = CACHE_STUNDEN) -> dict:
    """Alle Indikatoren: frisch aus dem Cache oder neu abgerufen. Fehlende Werte → Fallback auf Kompass-Daten."""
    cache = {r["key"]: r for r in rows(conn, "SELECT * FROM indikatoren")}
    grenze = (datetime.now() - timedelta(hours=max_stunden)).isoformat()
    out = {}
    veraltet = [k for k in INDIKATOREN if not cache.get(k) or cache[k]["abgerufen"] < grenze]
    if veraltet and not offline():
        # parallel abrufen, damit eine langsame Quelle nicht alles aufhält
        from concurrent.futures import ThreadPoolExecutor

        def hole(key):
            try:
                return key, abrufen(key, fetch)
            except Exception:
                return key, None

        with ThreadPoolExecutor(max_workers=6) as ex:
            for key, erg in ex.map(hole, veraltet):
                if erg:
                    jetzt = datetime.now().isoformat(timespec="seconds")
                    conn.execute("INSERT OR REPLACE INTO indikatoren (key, wert, datum, abgerufen) VALUES (?, ?, ?, ?)", (key, erg[0], erg[1], jetzt))
                    cache[key] = {"wert": erg[0], "datum": erg[1], "abgerufen": jetzt}
        conn.commit()
    for key, i in INDIKATOREN.items():
        c = cache.get(key)
        if c:
            out[key] = {**{k: i[k] for k in ("name", "einheit", "quelle", "url")}, "wert": c["wert"], "datum": c["datum"], "live": True}
    # Fallback aus den Kompass-Langfristdaten (Shiller), wenn live nichts kam
    ls = ereignisse()["letzter_stand"]
    for key, wert in (("cape", ls["cape"]), ("us_zins_10j", ls["zins"]), ("us_inflation", ls["inflation"] * 100 if ls["inflation"] is not None else None)):
        if key not in out and wert is not None:
            out[key] = {**{k: INDIKATOREN[key][k] for k in ("name", "einheit", "url")}, "quelle": "Kompass-Daten (Shiller), nicht live",
                        "wert": wert, "datum": ls["monat"], "live": False}
    return out


# Ähnlichkeit: gleiche Kennzahlen damals (am Hoch vor dem Einbruch) und heute, grob normiert.
SKALA = {"cape": 8.0, "zins": 2.5, "inflation": 2.5}


def aehnlichkeit(ind: dict, liste: list[dict] | None = None) -> list[dict]:
    heute = {"cape": ind.get("cape", {}).get("wert"), "zins": ind.get("us_zins_10j", {}).get("wert"),
             "inflation": ind.get("us_inflation", {}).get("wert")}
    out = []
    for e in liste or ereignisse()["ereignisse"]:
        k = e.get("kennzahlen")
        if not k:
            continue
        damals = {"cape": k["cape_hoch"], "zins": k["zins_hoch"], "inflation": k["inflation_hoch"] * 100 if k["inflation_hoch"] is not None else None}
        teile, gruende = [], []
        for m, s in SKALA.items():
            if heute[m] is None or damals[m] is None:
                continue
            d = (heute[m] - damals[m]) / s
            teile.append(d * d)
            gruende.append({"kennzahl": m, "damals": damals[m], "heute": heute[m], "nah": abs(d) < 0.5})
        if len(teile) < 2:
            continue
        dist = math.sqrt(sum(teile) / len(teile))
        out.append({"id": e["id"], "name": e["name"], "zeitraum": e["zeitraum"], "aehnlichkeit": round(100 * math.exp(-dist), 1), "vergleich": gruende})
    return sorted(out, key=lambda x: -x["aehnlichkeit"])


def text_fuer_modell(conn) -> str:
    """Kurzfassung für die Council-Rollen: Indikatoren heute + ähnlichste historische Fälle."""
    ind = aktuell(conn)
    zeilen = [f"- {v['name']}: {v['wert']:.2f} {v['einheit']} (Stand {v['datum']}, {v['quelle']}{'' if v['live'] else ', NICHT live'})" for v in ind.values()]
    aehnl = aehnlichkeit(ind)[:3]
    faelle = []
    for a in aehnl:
        e = finde_ereignis(a["id"])
        k = e["kennzahlen"]
        faelle.append(
            f"- {e['name']} ({e['zeitraum']}), Ähnlichkeit {a['aehnlichkeit']:.0f} %: damals Shiller-KGV {k['cape_hoch']}, 10J-Zins {k['zins_hoch']} %, "
            f"Inflation {k['inflation_hoch'] * 100:.1f} %; Verlust real {k['verlust_real']:.0%} in {k['monate_bis_tief']} Monaten. Ursachen: {'; '.join(e['ursachen'][:3])}"
        )
    alle = ", ".join(f"{e['name']} ({e['zeitraum']})" for e in ereignisse()["ereignisse"])
    return ("MARKTINDIKATOREN HEUTE:\n" + ("\n".join(zeilen) or "- keine verfügbar")
            + "\n\nÄHNLICHSTE HISTORISCHE FÄLLE (nach Shiller-KGV, Zins, Inflation am Hoch vor dem Einbruch):\n" + ("\n".join(faelle) or "- keine")
            + f"\n\nWEITERE EREIGNISSE IM KOMPASS-GLOSSAR: {alle}")


# ---------- KI-Vergleich: Ereignis damals vs. heute ----------

def vergleich_start(conn, user_id: int, eid: str) -> int:
    if not finde_ereignis(eid):
        raise ValueError("Unbekanntes Ereignis")
    cur = conn.execute("INSERT INTO ereignis_vergleiche (user_id, ereignis_id) VALUES (?, ?)", (user_id, eid))
    conn.commit()
    return cur.lastrowid


def vergleich_get(conn, user_id: int, vid: int) -> dict | None:
    r = one(conn, "SELECT * FROM ereignis_vergleiche WHERE id = ? AND user_id = ?", (vid, user_id))
    if r:
        r["ergebnis"] = json.loads(r.pop("ergebnis_json")) if r["ergebnis_json"] else None
    return r


def vergleich_run(conn, vid: int, chat_fn=None) -> None:
    from . import llm, prompts
    from .council import parse_json

    chat_fn = chat_fn or llm.chat
    r = one(conn, "SELECT * FROM ereignis_vergleiche WHERE id = ?", (vid,))
    e = finde_ereignis(r["ereignis_id"])
    try:
        inhalt = (f"HISTORISCHES EREIGNIS:\n{json.dumps({k: e[k] for k in ('name', 'zeitraum', 'kurz', 'ursachen', 'verlauf', 'lehren', 'heute_achten')}, ensure_ascii=False)}\n"
                  f"KENNZAHLEN DAMALS (berechnet aus Shiller-Daten, Monatsdurchschnitte): "
                  f"{json.dumps({k: v for k, v in (e.get('kennzahlen') or {}).items() if 'reihe' not in k}, ensure_ascii=False)}\n\n"
                  f"{text_fuer_modell(conn)}")
        msgs = [{"role": "system", "content": prompts.EREIGNIS_VERGLEICH}, {"role": "user", "content": inhalt}]
        text, anbieter, modell = chat_fn(conn, "geschichte", msgs)
        d = parse_json(text)
        if d is None or "gemeinsamkeiten" not in d:
            text, anbieter, modell = chat_fn(conn, "geschichte", msgs + [{"role": "assistant", "content": text},
                                                                        {"role": "user", "content": "Antworte ausschließlich mit dem JSON im verlangten Schema."}])
            d = parse_json(text)
        if d is None or "gemeinsamkeiten" not in d:
            raise ValueError("Das Modell hat keinen gültigen Vergleich geliefert.")
        conn.execute("UPDATE ereignis_vergleiche SET ergebnis_json = ?, status = 'fertig', provider = ?, model = ? WHERE id = ?",
                     (json.dumps(d, ensure_ascii=False), anbieter, modell, vid))
    except Exception as ex:
        conn.execute("UPDATE ereignis_vergleiche SET ergebnis_json = ?, status = 'fehler' WHERE id = ?",
                     (json.dumps({"fehler": str(ex)}, ensure_ascii=False), vid))
    conn.commit()
