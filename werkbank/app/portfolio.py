"""Vermögen: Positionen, Kurse (Cache, Standard 15 Min.), Verteilungen.

Nur lesend. Kein Code in diesem Projekt darf Orders platzieren.
Kursquelle ist austauschbar: nur fetch_quote() muss ersetzt werden.
"""
import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta

from . import config
from .db import rows


def fetch_quote(symbol: str) -> tuple[float, str | None]:
    """Holt den letzten Kurs. yfinance ist inoffiziell und kann ausfallen."""
    import yfinance as yf

    info = yf.Ticker(symbol).fast_info
    price = getattr(info, "last_price", None)
    currency = getattr(info, "currency", None)
    if price is None:
        raise ValueError(f"Kein Kurs für {symbol}")
    return float(price), currency


def get_price(conn, symbol: str, force: bool = False) -> tuple[float | None, str | None, str | None]:
    """(Kurs, Währung, Zeitstempel). Nutzt Cache, wenn jünger als PRICE_TTL_MINUTES."""
    row = conn.execute("SELECT * FROM price_cache WHERE symbol = ?", (symbol,)).fetchone()
    fresh_until = datetime.now() - timedelta(minutes=config.PRICE_TTL_MINUTES)
    if row and not force and datetime.fromisoformat(row["fetched_at"]) > fresh_until:
        return row["price"], row["currency"], row["fetched_at"]
    try:
        price, currency = fetch_quote(symbol)
    except Exception:
        # Kursquelle weg: alten Wert zeigen statt nichts
        return (row["price"], row["currency"], row["fetched_at"]) if row else (None, None, None)
    now = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "INSERT INTO price_cache (symbol, price, currency, fetched_at) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(symbol) DO UPDATE SET price = excluded.price, "
        "currency = excluded.currency, fetched_at = excluded.fetched_at",
        (symbol, price, currency, now))
    return price, currency, now


def fx_rate(conn, currency: str) -> float:
    base = config.BASE_CURRENCY
    if not currency or currency.upper() == base:
        return 1.0
    rate, _, _ = get_price(conn, f"{currency.upper()}{base}=X")
    return rate or 1.0


def overview(conn, force: bool = False) -> dict:
    positions = rows(conn.execute(
        "SELECT p.*, pf.name AS portfolio FROM positions p "
        "JOIN portfolios pf ON pf.id = p.portfolio_id ORDER BY pf.name, p.name"))

    total = invested = 0.0
    oldest_price = None
    by = {k: defaultdict(float) for k in ("portfolio", "asset_class", "region", "currency", "position")}

    for p in positions:
        if p["manual_price"] is not None or not p["ticker"]:
            price, stamp = p["manual_price"] or p["entry_price"], None
        else:
            price, _, stamp = get_price(conn, p["ticker"], force)
            price = price if price is not None else p["entry_price"]
        fx = fx_rate(conn, p["currency"])
        value = p["quantity"] * price * fx
        cost = p["quantity"] * p["entry_price"] * fx
        p.update({
            "price": price,
            "value": round(value, 2),
            "cost": round(cost, 2),
            "pnl": round(value - cost, 2),
            "pnl_pct": round((value / cost - 1) * 100, 2) if cost else None,
            "price_time": stamp,
        })
        total += value
        invested += cost
        if stamp and (oldest_price is None or stamp < oldest_price):
            oldest_price = stamp
        by["portfolio"][p["portfolio"]] += value
        by["asset_class"][p["asset_class"] or "Ohne Angabe"] += value
        by["region"][p["region"] or "Ohne Angabe"] += value
        by["currency"][p["currency"]] += value
        by["position"][p["name"]] += value

    def shares(d):
        return sorted(
            [{"name": k, "value": round(v, 2), "pct": round(v / total * 100, 1) if total else 0}
             for k, v in d.items()], key=lambda x: -x["value"])

    if positions:
        conn.execute(
            "INSERT INTO net_worth_snapshots (date, total, invested) VALUES (?, ?, ?) "
            "ON CONFLICT(date) DO UPDATE SET total = excluded.total, invested = excluded.invested",
            (date.today().isoformat(), round(total, 2), round(invested, 2)))

    return {
        "base_currency": config.BASE_CURRENCY,
        "total": round(total, 2),
        "invested": round(invested, 2),
        "pnl": round(total - invested, 2),
        "pnl_pct": round((total / invested - 1) * 100, 2) if invested else None,
        "prices_as_of": oldest_price,
        "positions": positions,
        "allocation": {k: shares(v) for k, v in by.items()},
        "history": rows(conn.execute(
            "SELECT date, total, invested FROM net_worth_snapshots ORDER BY date DESC LIMIT 365")),
    }


CSV_COLUMNS = ["portfolio", "name", "ticker", "isin", "quantity", "entry_price",
               "currency", "asset_class", "region", "bought_at"]


def ensure_portfolio(conn, name: str, broker: str | None = None) -> int:
    row = conn.execute("SELECT id FROM portfolios WHERE name = ?", (name,)).fetchone()
    if row:
        return row["id"]
    return conn.execute("INSERT INTO portfolios (name, broker) VALUES (?, ?)",
                        (name, broker)).lastrowid


def import_csv(conn, text: str) -> int:
    """Generisches Format (Semikolon oder Komma). Broker-spezifische Parser: Phase 4."""
    dialect = csv.Sniffer().sniff(text.splitlines()[0], delimiters=";,")
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    missing = {"portfolio", "name", "quantity", "entry_price"} - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"Fehlende Spalten: {', '.join(sorted(missing))}")
    count = 0
    for r in reader:
        pid = ensure_portfolio(conn, r["portfolio"].strip())
        conn.execute(
            "INSERT INTO positions (portfolio_id, name, ticker, isin, quantity, entry_price, "
            "currency, asset_class, region, bought_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (pid, r["name"].strip(), (r.get("ticker") or "").strip() or None,
             (r.get("isin") or "").strip() or None,
             float(r["quantity"].replace(",", ".")), float(r["entry_price"].replace(",", ".")),
             (r.get("currency") or "EUR").strip().upper(), r.get("asset_class") or None,
             r.get("region") or None, r.get("bought_at") or None))
        count += 1
    return count
