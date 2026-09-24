"""Führt Aktionen aus dem Katalog aus. Jede Aktion wird protokolliert und ist umkehrbar."""
from datetime import date

from .db import rows


def _log(conn, entry_id, action, table, row_id, summary):
    conn.execute(
        "INSERT INTO action_log (entry_id, action, table_name, row_id, summary) "
        "VALUES (?, ?, ?, ?, ?)", (entry_id, action, table, row_id, summary))
    return summary


def _index(conn, kind, ref_id, text):
    conn.execute("INSERT INTO search_index (kind, ref_id, text) VALUES (?, ?, ?)",
                 (kind, ref_id, text))


def _find(conn, table, column, name):
    if not name:
        return None
    row = conn.execute(
        f"SELECT id FROM {table} WHERE lower({column}) = lower(?) AND active = 1",
        (name,)).fetchone()
    if row:
        return row["id"]
    row = conn.execute(
        f"SELECT id FROM {table} WHERE lower({column}) LIKE lower(?) AND active = 1 LIMIT 1",
        (f"%{name}%",)).fetchone()
    return row["id"] if row else None


def thought_save(conn, entry_id, a):
    text = a.get("text") or ""
    tags = ",".join(a.get("tags") or [])
    cur = conn.execute(
        "INSERT INTO thoughts (entry_id, text, category, project, tags) VALUES (?, ?, ?, ?, ?)",
        (entry_id, text, a.get("category"), a.get("project"), tags))
    _index(conn, "thought", cur.lastrowid, f"{text} {a.get('project') or ''} {tags}")
    return _log(conn, entry_id, "thought.save", "thoughts", cur.lastrowid,
                f"Gedanke: {text[:60]}")


def todo_create(conn, entry_id, a):
    title = a.get("title") or ""
    cur = conn.execute(
        "INSERT INTO todos (entry_id, title, project, priority, due_date) VALUES (?, ?, ?, ?, ?)",
        (entry_id, title, a.get("project"), int(a.get("priority") or 2), a.get("due_date")))
    _index(conn, "todo", cur.lastrowid, f"{title} {a.get('project') or ''}")
    return _log(conn, entry_id, "todo.create", "todos", cur.lastrowid, f"ToDo: {title}")


def todo_complete(conn, entry_id, a):
    todo_id = int(a["todo_id"])
    conn.execute("UPDATE todos SET done = 1, done_at = datetime('now','localtime') WHERE id = ?",
                 (todo_id,))
    title = conn.execute("SELECT title FROM todos WHERE id = ?", (todo_id,)).fetchone()
    return _log(conn, entry_id, "todo.complete", "todos", todo_id,
                f"Erledigt: {title['title'] if title else todo_id}")


def week_plan(conn, entry_id, a):
    cur = conn.execute("INSERT INTO week_plan (entry_id, date, title) VALUES (?, ?, ?)",
                       (entry_id, a.get("date") or date.today().isoformat(), a.get("title")))
    return _log(conn, entry_id, "week.plan", "week_plan", cur.lastrowid,
                f"Woche {a.get('date')}: {a.get('title')}")


def checklist_log(conn, entry_id, a):
    habit_id = _find(conn, "habits", "name", a.get("habit"))
    if habit_id is None:
        raise ValueError(f"Unbekannte Gewohnheit: {a.get('habit')}")
    cur = conn.execute(
        "INSERT INTO habit_logs (entry_id, habit_id, date, amount, unit, note) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (entry_id, habit_id, a.get("date") or date.today().isoformat(),
         a.get("amount"), a.get("unit"), a.get("note")))
    return _log(conn, entry_id, "checklist.log", "habit_logs", cur.lastrowid,
                f"Abgehakt: {a.get('habit')}")


def progress_log(conn, entry_id, a):
    goal_id = _find(conn, "goals", "title", a.get("goal"))
    if goal_id is None:
        raise ValueError(f"Unbekanntes Ziel: {a.get('goal')}")
    cur = conn.execute(
        "INSERT INTO progress_logs (entry_id, goal_id, value, note) VALUES (?, ?, ?, ?)",
        (entry_id, goal_id, a.get("value"), a.get("note")))
    return _log(conn, entry_id, "progress.log", "progress_logs", cur.lastrowid,
                f"Fortschritt: {a.get('goal')}")


def query(conn, entry_id, a):
    # Phase 3: Antwort per Claude über gefundene Notizen. Jetzt: nur Volltextsuche.
    from .classifier import fts_query
    q = fts_query(a.get("question") or "")
    hits = rows(conn.execute(
        "SELECT kind, ref_id, text FROM search_index WHERE search_index MATCH ? "
        "ORDER BY rank LIMIT 10", (q,))) if q else []
    return {"summary": f"{len(hits)} Treffer", "hits": hits}


HANDLERS = {
    "thought.save": thought_save,
    "todo.create": todo_create,
    "todo.complete": todo_complete,
    "week.plan": week_plan,
    "checklist.log": checklist_log,
    "progress.log": progress_log,
    "query": query,
}


def execute(conn, entry_id: int, actions: list[dict]) -> list:
    """Alle oder keine: schlägt eine Aktion fehl, wird nichts geschrieben."""
    results = []
    conn.execute("SAVEPOINT exec_actions")
    try:
        for a in actions:
            results.append(HANDLERS[a["type"]](conn, entry_id, a))
    except Exception:
        conn.execute("ROLLBACK TO exec_actions")
        conn.execute("RELEASE exec_actions")
        raise
    conn.execute("RELEASE exec_actions")
    return results


def undo(conn, log_id: int) -> str:
    log = conn.execute("SELECT * FROM action_log WHERE id = ? AND undone = 0",
                       (log_id,)).fetchone()
    if not log:
        raise ValueError("Aktion nicht gefunden oder schon rückgängig gemacht")
    if log["action"] == "todo.complete":
        conn.execute("UPDATE todos SET done = 0, done_at = NULL WHERE id = ?", (log["row_id"],))
    else:
        conn.execute(f"DELETE FROM {log['table_name']} WHERE id = ?", (log["row_id"],))
        kind = {"thoughts": "thought", "todos": "todo"}.get(log["table_name"])
        if kind:
            conn.execute("DELETE FROM search_index WHERE kind = ? AND ref_id = ?",
                         (kind, log["row_id"]))
    conn.execute("UPDATE action_log SET undone = 1 WHERE id = ?", (log_id,))
    return f"Rückgängig: {log['summary']}"
