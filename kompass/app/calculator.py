"""Zinseszins-Rechner mit Szenarien aus echten historischen Jahresrenditen.

Methode: Für jede mögliche Startjahr-Folge gleicher Länge (rollierende Fenster)
wird der Sparplan durchgerechnet. Worst = 5. Perzentil, Realistisch = Median,
Best = 95. Perzentil – sortiert nach Endwert in heutiger Kaufkraft (real).
Reine Rechenlogik, kein I/O außer dem Laden der CSV.
"""
import csv
from functools import lru_cache
from pathlib import Path

HISTORY = Path(__file__).resolve().parent.parent / "data" / "history" / "annual.csv"
KLASSEN = ("aktien", "anleihen", "gold")  # mit historischer Reihe
EIGENE = "eigene"  # eigene Annahme (Tagesgeld, Krypto, Immobilien, Sonstiges)
MIN_FENSTER = 10
PERZENTILE = {"worst": 0.05, "realistisch": 0.50, "best": 0.95}


class ZuWenigDaten(ValueError):
    pass


@lru_cache(maxsize=1)
def load_series() -> dict[int, dict[str, float]]:
    out = {}
    with open(HISTORY, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out[int(r["jahr"])] = {k: float(v) for k, v in r.items() if k != "jahr" and v != ""}
    return out


def _normalize(mix: dict[str, float]) -> dict[str, float]:
    mix = {k: float(v) for k, v in mix.items() if float(v) > 0}
    for k in mix:
        if k not in KLASSEN and k != EIGENE:
            raise ValueError(f"Unbekannte Anlageklasse: {k}")
    total = sum(mix.values())
    if total <= 0:
        raise ValueError("Mix ist leer")
    return {k: v / total for k, v in mix.items()}


def _windows(series: dict, needed: set[str], years: int) -> list[list[int]]:
    usable = sorted(y for y, d in series.items() if needed <= d.keys())
    usable_set = set(usable)
    out = []
    for start in usable:
        span = list(range(start, start + years))
        if all(y in usable_set for y in span):
            out.append(span)
    return out


def _run(window, series, mix, start, monthly, ter, increase, custom_rate):
    wert, deflator, eingezahlt = float(start), 1.0, float(start)
    verlauf, faktor_real = [], 1.0
    for i, y in enumerate(window):
        d = series[y]
        r = sum(w * (custom_rate if k == EIGENE else d[k]) for k, w in mix.items())
        r_net = (1 + r) * (1 - ter) - 1
        einzahlung = monthly * 12 * (1 + increase) ** i
        anfang = wert
        # Einzahlungen über das Jahr verteilt: im Schnitt ein halbes Jahr investiert
        wert = wert * (1 + r_net) + einzahlung * (1 + r_net) ** 0.5
        eingezahlt += einzahlung
        deflator *= 1 + d["inflation"]
        faktor_real *= (1 + r_net) / (1 + d["inflation"])
        verlauf.append({"jahr": y, "anfang": anfang, "einzahlung": einzahlung, "ende": wert})
    n = len(window)
    return {
        "end_nominal": wert,
        "end_real": wert / deflator,
        "eingezahlt": eingezahlt,
        "startjahr": window[0],
        "endjahr": window[-1],
        "rendite_pa_real": faktor_real ** (1 / n) - 1,
        "inflation_pa": deflator ** (1 / n) - 1,
        "verlauf": verlauf,
    }


def simulate(
    start: float,
    monthly: float,
    years: int,
    mix: dict[str, float],
    ter: float = 0.002,
    increase: float = 0.0,
    custom_rate: float | None = None,
    series: dict | None = None,
) -> dict:
    if years < 1:
        raise ValueError("Mindestens 1 Jahr")
    if start < 0 or monthly < 0:
        raise ValueError("Beträge dürfen nicht negativ sein")
    series = series if series is not None else load_series()
    mix = _normalize(mix)
    if EIGENE in mix and custom_rate is None:
        raise ValueError("Für 'eigene' Annahme fehlt die Rendite")
    needed = {k for k in mix if k != EIGENE} | {"inflation"}
    windows = _windows(series, needed, years)
    if len(windows) < MIN_FENSTER:
        max_h = max((h for h in range(1, 200) if len(_windows(series, needed, h)) >= MIN_FENSTER), default=0)
        raise ZuWenigDaten(
            f"Für {years} Jahre gibt es zu wenige historische Zeiträume ({len(windows)}). "
            f"Mit dieser Auswahl sind höchstens {max_h} Jahre seriös rechenbar."
        )
    runs = sorted(
        (_run(w, series, mix, start, monthly, ter, increase, custom_rate) for w in windows),
        key=lambda r: r["end_real"],
    )
    n = len(runs)
    szenarien = {name: runs[round(p * (n - 1))] for name, p in PERZENTILE.items()}
    alle_jahre = [y for w in windows for y in w]
    hinweise = [
        "Historische Daten: US-Aktien (Shiller), US-Anleihen (Näherung), Gold (Weltbank), US-Inflation. "
        "Werte in USD-Logik, Wechselkurs EUR/USD nicht enthalten.",
        "Vergangene Renditen sind keine Garantie. Der US-Markt war historisch überdurchschnittlich erfolgreich.",
    ]
    if EIGENE in mix:
        hinweise.append(
            f"Anteil 'eigene Annahme' mit {custom_rate:.2%} p.a. ist deine Schätzung, keine Historie."
        )
    return {
        "szenarien": szenarien,
        "fenster": n,
        "zeitraum": [min(alle_jahre), max(alle_jahre)],
        "mix": mix,
        "ter": ter,
        "hinweise": hinweise,
    }
