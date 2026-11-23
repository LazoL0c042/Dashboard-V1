"""Kurse über yfinance (inoffiziell, kann ausfallen) mit Tages-Cache in SQLite.

Nur lesend. Die Kursquelle ist austauschbar: nur `fetch` muss ersetzt werden.
"""
from datetime import date, datetime, timedelta

CACHE_STUNDEN = 12


def fetch(ticker: str, start: date) -> list[tuple[str, float]]:
    import yfinance as yf

    df = yf.Ticker(ticker).history(start=start.isoformat(), interval="1d", auto_adjust=True)
    if df is None or df.empty:
        return []
    return [(idx.date().isoformat(), float(v)) for idx, v in df["Close"].items() if v == v]


def history(conn, ticker: str, start: date, fetch_fn=None) -> list[tuple[str, float]]:
    """Tagesschlusskurse ab `start`. Lädt nach, wenn Cache älter als 12 Std. oder Start fehlt."""
    fetch_fn = fetch_fn or fetch
    log = conn.execute("SELECT fetched_at FROM price_fetch_log WHERE ticker = ?", (ticker,)).fetchone()
    first = conn.execute("SELECT MIN(day) FROM price_cache WHERE ticker = ?", (ticker,)).fetchone()[0]
    stale = not log or datetime.fromisoformat(log[0]) < datetime.now() - timedelta(hours=CACHE_STUNDEN)
    # Ab 7 Tage vor Start laden, damit Wochenenden/Feiertage abgedeckt sind
    if stale or not first or first > (start - timedelta(days=7)).isoformat():
        try:
            data = fetch_fn(ticker, start - timedelta(days=10))
        except Exception:
            data = []
        if data:
            conn.executemany(
                "INSERT OR REPLACE INTO price_cache (ticker, day, close) VALUES (?, ?, ?)",
                [(ticker, d, c) for d, c in data],
            )
            conn.execute(
                "INSERT OR REPLACE INTO price_fetch_log (ticker, fetched_at) VALUES (?, ?)",
                (ticker, datetime.now().isoformat(timespec="seconds")),
            )
            conn.commit()
    return [
        (r[0], r[1])
        for r in conn.execute(
            "SELECT day, close FROM price_cache WHERE ticker = ? AND day >= ? ORDER BY day",
            (ticker, (start - timedelta(days=10)).isoformat()),
        )
    ]


def price_on(hist: list[tuple[str, float]], day: str) -> tuple[str, float] | None:
    """Letzter Kurs an oder vor `day` (höchstens 7 Tage zurück)."""
    best = None
    for d, c in hist:
        if d <= day:
            best = (d, c)
        else:
            break
    if best and (date.fromisoformat(day) - date.fromisoformat(best[0])).days <= 7:
        return best
    return None


def last(conn, ticker: str, fetch_fn=None) -> tuple[str, float] | None:
    h = history(conn, ticker, date.today() - timedelta(days=14), fetch_fn)
    return h[-1] if h else None
