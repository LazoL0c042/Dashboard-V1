"""Glossar der Anlageklassen und Liste vertrauenswürdiger Medien."""
import json
import statistics
from functools import lru_cache
from pathlib import Path

from . import calculator, products

DATA = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def daten() -> dict:
    d = json.loads((DATA / "glossar.json").read_text(encoding="utf-8"))
    for a in d["assets"]:
        a["langfrist"] = langfrist(a["historie"]) if a.get("historie") else None
        a["katalog"] = [p for p in (products.finde(x) for x in a.get("produkte", [])) if p]
    return d


@lru_cache(maxsize=1)
def medien() -> dict:
    return json.loads((DATA / "medien.json").read_text(encoding="utf-8"))


def finde(aid: str) -> dict | None:
    return next((a for a in daten()["assets"] if a["id"] == aid), None)


def langfrist(spalte: str) -> dict | None:
    """Echte Jahreswerte aus data/history/annual.csv (nominal, USD-Logik)."""
    reihe = calculator.load_series()
    jahre = sorted(y for y, d in reihe.items() if spalte in d)
    if not jahre:
        return None
    werte = [reihe[y][spalte] for y in jahre]
    real = [(1 + reihe[y][spalte]) / (1 + reihe[y]["inflation"]) - 1 for y in jahre]
    geo = statistics.geometric_mean([1 + w for w in werte]) - 1
    geo_real = statistics.geometric_mean([1 + w for w in real]) - 1
    i_min, i_max = werte.index(min(werte)), werte.index(max(werte))
    return {
        "zeitraum": [jahre[0], jahre[-1]], "jahre": len(jahre),
        "rendite_pa": geo, "rendite_pa_real": geo_real,
        "schlechtestes": {"jahr": jahre[i_min], "wert": werte[i_min]},
        "bestes": {"jahr": jahre[i_max], "wert": werte[i_max]},
        "anteil_verlustjahre": sum(1 for w in werte if w < 0) / len(werte),
        "verlauf": [[y, w] for y, w in zip(jahre, werte)],
        "quelle": "Kompass-Historie (Shiller, Weltbank, US BLS) – siehe data/history/QUELLEN.md",
    }


def domains() -> set[str]:
    return {q["domain"] for q in medien()["quellen"]}


@lru_cache(maxsize=1)
def wirkung() -> dict:
    return json.loads((DATA / "wirkung.json").read_text(encoding="utf-8"))
