"""Konfiguration aus Umgebungsvariablen (.env)."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # dotenv ist optional
    pass

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"
DB_PATH = os.getenv("KOMPASS_DB", str(DATA / "kompass.db"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() == "true"
SESSION_DAYS = 30
BENCHMARK = {"name": "iShares Core MSCI World", "isin": "IE00B4L5Y983", "ticker": "EUNL.DE"}


def key(name: str) -> str:
    """API-Schlüssel lesen. Wird nie geloggt."""
    return os.getenv(name, "").strip()
