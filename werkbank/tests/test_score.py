"""Wochenscore, Streak und XP mit fester Datenbank und festem Datum."""
import sqlite3
from datetime import date
from pathlib import Path

import pytest

from app import score

SCHEMA = Path(__file__).resolve().parent.parent / "app" / "schema.sql"
TODAY = date(2026, 9, 24)            # Donnerstag
MON = date(2026, 9, 21)


@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA.read_text(encoding="utf-8"))
    return c


def habit(c, name, target):
    return c.execute("INSERT INTO habits (name, category, target_per_week) VALUES (?, 'Sport', ?)",
                     (name, target)).lastrowid


def log(c, habit_id, day):
    c.execute("INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)", (habit_id, day))


def todo(c, title, created, due=None, done_at=None):
    c.execute("INSERT INTO todos (title, created_at, due_date, done, done_at) VALUES (?, ?, ?, ?, ?)",
              (title, f"{created} 10:00:00", due, 1 if done_at else 0,
               f"{done_at} 18:00:00" if done_at else None))


def test_empty_week_only_keeps_deadline_points(conn):
    w = score.week_score(conn, MON, TODAY)
    assert w["score"] == 20
    assert w["parts"]["habits"]["points"] == 0 and w["parts"]["todos"]["points"] == 0


def test_full_week_scores_100(conn):
    h = habit(conn, "Training", 2)
    log(conn, h, "2026-09-21")
    log(conn, h, "2026-09-23")
    todo(conn, "A", "2026-09-21", due="2026-09-22", done_at="2026-09-22")
    assert score.week_score(conn, MON, TODAY)["score"] == 100


def test_habits_capped_and_same_day_counted_once(conn):
    h = habit(conn, "Training", 2)
    for day in ["2026-09-21", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]:
        log(conn, h, day)
    habit(conn, "Lernen", 2)  # 0 von 2
    w = score.week_score(conn, MON, TODAY)
    # Training zählt höchstens 2, Lernen 0 → 2 von 4 → 25 Punkte
    assert w["parts"]["habits"] == {"points": 25, "max": 50, "done": 2, "target": 4}


def test_todo_ratio_and_missed_deadlines(conn):
    todo(conn, "erledigt", "2026-09-21", done_at="2026-09-21")
    todo(conn, "offen", "2026-09-22")
    todo(conn, "verpasst", "2026-09-15", due="2026-09-22")
    todo(conn, "zu spät", "2026-09-15", due="2026-09-21", done_at="2026-09-23")
    todo(conn, "heute fällig", "2026-09-15", due="2026-09-24")      # heute noch nicht verpasst
    todo(conn, "letzte Woche", "2026-09-10", due="2026-09-16")      # andere Woche
    w = score.week_score(conn, MON, TODAY)
    assert w["parts"]["todos"]["done"] == 2 and w["parts"]["todos"]["total"] == 5
    assert w["parts"]["todos"]["points"] == 12                      # 30 * 2/5
    assert w["parts"]["deadlines"] == {"points": 0, "max": 20, "missed": 2}


def test_streak_counts_consecutive_weeks(conn):
    h = habit(conn, "Training", 1)
    for day in ["2026-09-07", "2026-09-14", "2026-09-21"]:
        log(conn, h, day)
    for day in ["2026-09-08", "2026-09-15", "2026-09-22"]:
        todo(conn, "Q", day, done_at=day)
    # Woche ab 31.08. ohne Quests: 50 + 0 + 20 = 70 zählt noch, die Woche davor (20) nicht
    log(conn, h, "2026-08-31")
    assert score.streak(conn, TODAY) == 4


def test_streak_is_zero_when_last_week_failed(conn):
    assert score.streak(conn, TODAY) == 0


def test_xp_and_level(conn):
    h = habit(conn, "Training", 3)
    for i in range(10):
        log(conn, h, f"2026-09-{i + 10:02d}")                         # 50 XP
    for i in range(5):
        todo(conn, f"T{i}", "2026-09-01", done_at="2026-09-02")     # 50 XP
    conn.execute("INSERT INTO thoughts (text) VALUES ('Idee')")      # 2 XP
    x = score.xp(conn)
    assert x["total"] == 102
    assert x["level"] == 2 and x["level_start"] == 100 and x["next_level"] == 300
