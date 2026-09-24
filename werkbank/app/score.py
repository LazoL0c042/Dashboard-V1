"""Wochenscore, Streak und XP für das Dashboard.

Liest nur Aufgaben, Gewohnheiten, Gedanken und Ziele. Keine Vermögensdaten.

Wochenscore (0–100):
  50 Punkte  Checklisten: erreichte Tage / Wochenziel, pro Gewohnheit gedeckelt
  30 Punkte  Quests: erledigte / alle ToDos der Woche (angelegt, fällig oder erledigt)
  20 Punkte  Deadlines: minus 10 pro verpasster Fälligkeit in dieser Woche
Streak: aufeinanderfolgende Wochen mit mindestens STREAK_MIN Punkten.
"""
from datetime import date, timedelta

WEIGHTS = {"habits": 50, "todos": 30, "deadlines": 20}
DEADLINE_PENALTY = 10
STREAK_MIN = 70
XP_PER = {"todo": 10, "habit": 5, "progress": 5, "thought": 2}
XP_LEVEL_STEP = 50  # Level L beginnt bei 50 * L * (L - 1) XP


def monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def week_score(conn, start: date, today: date) -> dict:
    s, e = start.isoformat(), (start + timedelta(days=6)).isoformat()

    habits = conn.execute(
        "SELECT h.target_per_week AS target, "
        "(SELECT COUNT(DISTINCT l.date) FROM habit_logs l "
        " WHERE l.habit_id = h.id AND l.date BETWEEN ? AND ?) AS done "
        "FROM habits h WHERE h.active = 1", (s, e)).fetchall()
    h_target = sum(h["target"] for h in habits)
    h_done = sum(min(h["done"], h["target"]) for h in habits)

    pool = conn.execute(
        "SELECT done, date(done_at) AS done_day, due_date FROM todos "
        "WHERE date(created_at) BETWEEN ? AND ? OR due_date BETWEEN ? AND ? "
        "OR date(done_at) BETWEEN ? AND ?", (s, e, s, e, s, e)).fetchall()
    t_done = sum(1 for t in pool if t["done"] and t["done_day"] and t["done_day"] <= e)

    # Verpasst: Fälligkeit in dieser Woche liegt vor heute, nicht rechtzeitig erledigt
    cutoff = min(e, (today - timedelta(days=1)).isoformat())
    missed = conn.execute(
        "SELECT COUNT(*) FROM todos WHERE due_date BETWEEN ? AND ? "
        "AND (done = 0 OR date(done_at) > due_date)", (s, cutoff)).fetchone()[0]

    parts = {
        "habits": {"points": WEIGHTS["habits"] * h_done / h_target if h_target else 0,
                   "max": WEIGHTS["habits"], "done": h_done, "target": h_target},
        "todos": {"points": WEIGHTS["todos"] * t_done / len(pool) if pool else 0,
                  "max": WEIGHTS["todos"], "done": t_done, "total": len(pool)},
        "deadlines": {"points": max(0, WEIGHTS["deadlines"] - DEADLINE_PENALTY * missed),
                      "max": WEIGHTS["deadlines"], "missed": missed},
    }
    total = round(sum(p["points"] for p in parts.values()))
    for p in parts.values():
        p["points"] = round(p["points"])
    return {"week_start": s, "score": total, "parts": parts}


def streak(conn, today: date, max_weeks: int = 104) -> int:
    """Abgeschlossene Wochen in Folge über STREAK_MIN, plus die laufende, wenn schon erreicht."""
    start = monday(today)
    count = 1 if week_score(conn, start, today)["score"] >= STREAK_MIN else 0
    for i in range(1, max_weeks + 1):
        if week_score(conn, start - timedelta(weeks=i), today)["score"] < STREAK_MIN:
            break
        count += 1
    return count


def xp(conn) -> dict:
    counts = {
        "todo": conn.execute("SELECT COUNT(*) FROM todos WHERE done = 1").fetchone()[0],
        "habit": conn.execute("SELECT COUNT(*) FROM habit_logs").fetchone()[0],
        "progress": conn.execute("SELECT COUNT(*) FROM progress_logs").fetchone()[0],
        "thought": conn.execute("SELECT COUNT(*) FROM thoughts").fetchone()[0],
    }
    total = sum(XP_PER[k] * n for k, n in counts.items())
    level = 1
    while XP_LEVEL_STEP * (level + 1) * level <= total:
        level += 1
    return {"total": total, "level": level,
            "level_start": XP_LEVEL_STEP * level * (level - 1),
            "next_level": XP_LEVEL_STEP * (level + 1) * level}


def overview(conn, today: date | None = None) -> dict:
    today = today or date.today()
    return {"week": week_score(conn, monday(today), today),
            "streak": streak(conn, today), "streak_min": STREAK_MIN, "xp": xp(conn)}
