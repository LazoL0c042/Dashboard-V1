"""Baut data/history/annual.csv aus offenen Rohdaten.

Aufruf (aus kompass/):  python scripts/build_history.py [--download]

Rohdaten (data/raw/) stammen aus den offenen Datensätzen von datahub.io / GitHub
"datasets" (Quellen siehe data/history/QUELLEN.md). Ergebnis: nominale
Jahresrenditen in USD als Dezimalzahl (0.05 = 5 %).
"""
import csv
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RAW = BASE / "data" / "raw"
OUT = BASE / "data" / "history" / "annual.csv"

QUELLEN = {
    "sp500.csv": "https://raw.githubusercontent.com/datasets/s-and-p-500/main/data/data.csv",
    "gold.csv": "https://raw.githubusercontent.com/datasets/gold-prices/main/data/monthly.csv",
    "cpi.csv": "https://raw.githubusercontent.com/datasets/cpi-us/main/data/cpiai.csv",
}

# Modifizierte Duration einer 10-jährigen Anleihe (Näherung)
DURATION = 8.0
# Gold ab freier Preisbildung (Ende Bretton Woods 1971)
GOLD_AB = 1972


def download() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in QUELLEN.items():
        print("lade", url)
        urllib.request.urlretrieve(url, RAW / name)


def read(name: str) -> list[dict]:
    with open(RAW / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def aktien_und_anleihen() -> tuple[dict, dict, dict]:
    monat = {}
    for r in read("sp500.csv"):
        y, m = int(r["Date"][:4]), int(r["Date"][5:7])
        monat[(y, m)] = (
            float(r["SP500"]),
            float(r["Dividend"]),
            float(r["Long Interest Rate"]),
            float(r["Consumer Price Index"]),
        )
    aktien, anleihen, cpi_dez = {}, {}, {}
    jahre = sorted({y for y, _ in monat})
    for y in jahre:
        if (y, 12) in monat and monat[(y, 12)][3] > 0:
            cpi_dez[y] = monat[(y, 12)][3]
        # Aktien: 12 Monate Gesamtrendite, nur wenn alle Dividenden vorhanden
        ok, faktor = True, 1.0
        for m in range(1, 13):
            prev = (y - 1, 12) if m == 1 else (y, m - 1)
            if prev not in monat or (y, m) not in monat:
                ok = False
                break
            p0 = monat[prev][0]
            p1, d1 = monat[(y, m)][0], monat[(y, m)][1]
            if p0 <= 0 or p1 <= 0 or d1 <= 0:
                ok = False
                break
            faktor *= (p1 + d1 / 12) / p0
        if ok:
            aktien[y] = faktor - 1
        # Anleihen: Kupon + Kursänderung aus Zinsänderung (Dez/Dez)
        if (y - 1, 12) in monat and (y, 12) in monat:
            y0, y1 = monat[(y - 1, 12)][2] / 100, monat[(y, 12)][2] / 100
            if y0 > 0 and y1 > 0:
                anleihen[y] = y0 - DURATION * (y1 - y0)
    return aktien, anleihen, cpi_dez


def gold() -> dict:
    dez = {}
    for r in read("gold.csv"):
        if r["Date"].endswith("-12"):
            dez[int(r["Date"][:4])] = float(r["Price"])
    return {y: dez[y] / dez[y - 1] - 1 for y in dez if y - 1 in dez and y >= GOLD_AB}


def inflation(shiller_cpi_dez: dict) -> dict:
    dez = {}
    for r in read("cpi.csv"):
        if r["Date"][5:7] == "12" and r["Index"]:
            dez[int(r["Date"][:4])] = float(r["Index"])
    out = {}
    for y in sorted(set(dez) | set(shiller_cpi_dez)):
        if y in dez and y - 1 in dez:
            out[y] = dez[y] / dez[y - 1] - 1
        elif y in shiller_cpi_dez and y - 1 in shiller_cpi_dez:
            out[y] = shiller_cpi_dez[y] / shiller_cpi_dez[y - 1] - 1
    return out


def build() -> None:
    aktien, anleihen, cpi_dez = aktien_und_anleihen()
    gld = gold()
    infl = inflation(cpi_dez)
    jahre = sorted(set(aktien) | set(anleihen) | set(gld))
    jahre = [y for y in jahre if y in infl]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["jahr", "aktien", "anleihen", "gold", "inflation"])
        for y in jahre:
            fmt = lambda d: f"{d[y]:.6f}" if y in d else ""  # noqa: E731
            w.writerow([y, fmt(aktien), fmt(anleihen), fmt(gld), fmt(infl)])
    print(f"{OUT}: {len(jahre)} Jahre ({jahre[0]}–{jahre[-1]})")


if __name__ == "__main__":
    if "--download" in sys.argv:
        download()
    build()
