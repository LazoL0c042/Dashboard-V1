import sqlite3
from contextlib import contextmanager
from pathlib import Path

from . import config

SCHEMA = Path(__file__).with_name("schema.sql")

DEFAULT_HABITS = [
    ("Training", "Sport", 3),
    ("Lernen Berufsschule", "Lernen", 4),
    ("Deep Work Projekte", "Arbeit", 4),
]


def connect() -> sqlite3.Connection:
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def get_conn():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA.read_text(encoding="utf-8"))
        if conn.execute("SELECT COUNT(*) FROM habits").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO habits (name, category, target_per_week) VALUES (?, ?, ?)",
                DEFAULT_HABITS,
            )


def rows(cursor) -> list[dict]:
    return [dict(r) for r in cursor.fetchall()]
