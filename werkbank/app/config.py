import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

API_TOKEN = os.getenv("API_TOKEN", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.6"))
DB_PATH = Path(os.getenv("DB_PATH", BASE_DIR / "data" / "brain.db"))
BASE_CURRENCY = os.getenv("BASE_CURRENCY", "EUR")
PRICE_TTL_MINUTES = int(os.getenv("PRICE_TTL_MINUTES", "15"))
TIMEZONE = os.getenv("TIMEZONE", "Europe/Berlin")
# Preise in USD pro 1 Mio. Tokens (Standard: Haiku 4.5). Bei Modellwechsel anpassen.
PRICE_INPUT_PER_MTOK = float(os.getenv("PRICE_INPUT_PER_MTOK", "1"))
PRICE_OUTPUT_PER_MTOK = float(os.getenv("PRICE_OUTPUT_PER_MTOK", "5"))
