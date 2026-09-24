import csv
import json
import secrets
from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import actions, classifier, config, portfolio
from .db import get_conn, init_db, rows

app = FastAPI(title="Second Brain", docs_url=None, redoc_url=None)
init_db()


# ---------------------------------------------------------------- Auth
def auth(authorization: str = Header(default="")):
    if not config.API_TOKEN:
        raise HTTPException(503, "API_TOKEN fehlt in der .env")
    token = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(token, config.API_TOKEN):
        raise HTTPException(401, "Token ungültig")


def monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


# ---------------------------------------------------------------- Eingabe
class Capture(BaseModel):
    text: str
    source: str = "text"


@app.post("/api/capture", dependencies=[Depends(auth)])
def capture(body: Capture):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Leere Eingabe")
    with get_conn() as conn:
        entry_id = conn.execute("INSERT INTO entries (source, raw_text) VALUES (?, ?)",
                                (body.source, text)).lastrowid
        try:
            result = classifier.classify(conn, text)
        except Exception:  # letzte Absicherung: Rohdaten bleiben, Eintrag geht in die Inbox
            result = {"actions": [], "reply": "In der Inbox (Sortierung fehlgeschlagen).",
                      "needs_review": True}
        if result.get("usage"):
            conn.execute("INSERT INTO llm_usage (model, input_tokens, output_tokens) VALUES (?,?,?)",
                         (config.CLAUDE_MODEL, result["usage"]["input_tokens"],
                          result["usage"]["output_tokens"]))

        if result["needs_review"]:
            conn.execute("UPDATE entries SET status = 'inbox', suggestion = ? WHERE id = ?",
                         (json.dumps(result["actions"], ensure_ascii=False), entry_id))
            reply = "Unsicher, liegt in der Inbox." if result["actions"] else result["reply"]
            return {"status": "inbox", "reply": reply, "entry_id": entry_id}
        try:
            results = actions.execute(conn, entry_id, result["actions"])
        except Exception as exc:
            conn.execute("UPDATE entries SET status = 'inbox', suggestion = ? WHERE id = ?",
                         (json.dumps(result["actions"], ensure_ascii=False), entry_id))
            return {"status": "inbox", "reply": f"In der Inbox: {exc}", "entry_id": entry_id}
        return {"status": "processed", "reply": result["reply"], "results": results,
                "entry_id": entry_id}


# ---------------------------------------------------------------- Inbox
class AsType(BaseModel):
    type: str  # todo | thought


@app.post("/api/inbox/{entry_id}/accept", dependencies=[Depends(auth)])
def inbox_accept(entry_id: int):
    with get_conn() as conn:
        e = conn.execute("SELECT * FROM entries WHERE id = ? AND status = 'inbox'",
                         (entry_id,)).fetchone()
        if not e or not e["suggestion"]:
            raise HTTPException(404, "Kein Vorschlag vorhanden")
        try:
            results = actions.execute(conn, entry_id, json.loads(e["suggestion"]))
        except Exception as exc:
            raise HTTPException(400, str(exc))
        conn.execute("UPDATE entries SET status = 'processed' WHERE id = ?", (entry_id,))
        return {"results": results}


@app.post("/api/inbox/{entry_id}/as", dependencies=[Depends(auth)])
def inbox_as(entry_id: int, body: AsType):
    with get_conn() as conn:
        e = conn.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
        if not e:
            raise HTTPException(404, "Eintrag nicht gefunden")
        action = ({"type": "todo.create", "title": e["raw_text"]} if body.type == "todo"
                  else {"type": "thought.save", "text": e["raw_text"]})
        results = actions.execute(conn, entry_id, [action])
        conn.execute("UPDATE entries SET status = 'processed' WHERE id = ?", (entry_id,))
        return {"results": results}


@app.post("/api/inbox/{entry_id}/dismiss", dependencies=[Depends(auth)])
def inbox_dismiss(entry_id: int):
    with get_conn() as conn:
        conn.execute("UPDATE entries SET status = 'dismissed' WHERE id = ?", (entry_id,))
    return {"ok": True}


@app.post("/api/undo/{log_id}", dependencies=[Depends(auth)])
def undo(log_id: int):
    with get_conn() as conn:
        try:
            return {"reply": actions.undo(conn, log_id)}
        except ValueError as exc:
            raise HTTPException(404, str(exc))


# ---------------------------------------------------------------- Heute
@app.get("/api/today", dependencies=[Depends(auth)])
def today():
    t = date.today()
    start = monday(t)
    with get_conn() as conn:
        inbox = rows(conn.execute(
            "SELECT id, raw_text, created_at, suggestion FROM entries "
            "WHERE status = 'inbox' ORDER BY created_at DESC"))
        for e in inbox:
            e["suggestion"] = json.loads(e["suggestion"]) if e["suggestion"] else []
        todos = rows(conn.execute(
            "SELECT * FROM todos WHERE done = 0 ORDER BY "
            "CASE WHEN due_date IS NOT NULL AND due_date <= ? THEN 0 ELSE 1 END, "
            "priority, due_date IS NULL, due_date, created_at LIMIT 8", (t.isoformat(),)))
        plan = rows(conn.execute("SELECT * FROM week_plan WHERE date = ? ORDER BY id",
                                 (t.isoformat(),)))
        habits = rows(conn.execute(
            "SELECT h.*, "
            " (SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id = h.id AND l.date >= ?) AS week_count, "
            " (SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id = h.id AND l.date = ?) AS today_done "
            "FROM habits h WHERE h.active = 1 ORDER BY h.category, h.name",
            (start.isoformat(), t.isoformat())))
        recent = rows(conn.execute(
            "SELECT id, action, summary, created_at FROM action_log "
            "WHERE undone = 0 AND action != 'query' ORDER BY id DESC LIMIT 5"))
    return {"date": t.isoformat(), "inbox": inbox, "todos": todos, "plan": plan,
            "habits": habits, "recent": recent}


# ---------------------------------------------------------------- ToDos
class TodoIn(BaseModel):
    title: str
    project: str | None = None
    priority: int = 2
    due_date: str | None = None


@app.get("/api/todos", dependencies=[Depends(auth)])
def list_todos(done: int = 0):
    with get_conn() as conn:
        return rows(conn.execute(
            "SELECT * FROM todos WHERE done = ? ORDER BY priority, due_date IS NULL, due_date, "
            "created_at DESC LIMIT 200", (done,)))


@app.post("/api/todos", dependencies=[Depends(auth)])
def add_todo(body: TodoIn):
    with get_conn() as conn:
        return {"reply": actions.todo_create(conn, None, body.model_dump())}


@app.post("/api/todos/{todo_id}/toggle", dependencies=[Depends(auth)])
def toggle_todo(todo_id: int):
    with get_conn() as conn:
        conn.execute(
            "UPDATE todos SET done = 1 - done, "
            "done_at = CASE WHEN done = 0 THEN datetime('now','localtime') END WHERE id = ?",
            (todo_id,))
    return {"ok": True}


# ---------------------------------------------------------------- Woche & Checklisten
class HabitIn(BaseModel):
    name: str
    category: str
    target_per_week: int = 3


class PlanIn(BaseModel):
    date: str
    title: str


@app.get("/api/week", dependencies=[Depends(auth)])
def week(start: str | None = None):
    s = monday(date.fromisoformat(start) if start else date.today())
    days = [(s + timedelta(days=i)).isoformat() for i in range(7)]
    with get_conn() as conn:
        plan = rows(conn.execute(
            "SELECT * FROM week_plan WHERE date BETWEEN ? AND ? ORDER BY date, id", (days[0], days[-1])))
        due = rows(conn.execute(
            "SELECT id, title, due_date, done FROM todos WHERE due_date BETWEEN ? AND ?",
            (days[0], days[-1])))
        habits = rows(conn.execute(
            "SELECT * FROM habits WHERE active = 1 ORDER BY category, name"))
        logs = rows(conn.execute(
            "SELECT habit_id, date FROM habit_logs WHERE date BETWEEN ? AND ?", (days[0], days[-1])))
    done = {(l["habit_id"], l["date"]) for l in logs}
    for h in habits:
        h["days"] = [(h["id"], d) in done for d in days]
        h["count"] = sum(h["days"])
    return {"days": days, "plan": plan, "due": due, "habits": habits}


@app.post("/api/week", dependencies=[Depends(auth)])
def add_plan(body: PlanIn):
    with get_conn() as conn:
        return {"reply": actions.week_plan(conn, None, body.model_dump())}


@app.delete("/api/week/{item_id}", dependencies=[Depends(auth)])
def delete_plan(item_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM week_plan WHERE id = ?", (item_id,))
    return {"ok": True}


@app.get("/api/habits", dependencies=[Depends(auth)])
def list_habits():
    with get_conn() as conn:
        return rows(conn.execute("SELECT * FROM habits ORDER BY active DESC, category, name"))


@app.post("/api/habits", dependencies=[Depends(auth)])
def add_habit(body: HabitIn):
    with get_conn() as conn:
        conn.execute("INSERT INTO habits (name, category, target_per_week) VALUES (?, ?, ?)",
                     (body.name, body.category, body.target_per_week))
    return {"ok": True}


@app.post("/api/habits/{habit_id}/toggle", dependencies=[Depends(auth)])
def toggle_habit(habit_id: int, day: str | None = None):
    d = day or date.today().isoformat()
    with get_conn() as conn:
        existing = conn.execute("SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?",
                                (habit_id, d)).fetchone()
        if existing:
            conn.execute("DELETE FROM habit_logs WHERE id = ?", (existing["id"],))
            return {"done": False}
        conn.execute("INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)", (habit_id, d))
        return {"done": True}


# ---------------------------------------------------------------- Ziele
class GoalIn(BaseModel):
    title: str
    target: float | None = None
    unit: str | None = None
    deadline: str | None = None


@app.get("/api/goals", dependencies=[Depends(auth)])
def list_goals():
    with get_conn() as conn:
        return rows(conn.execute(
            "SELECT g.*, COALESCE((SELECT SUM(value) FROM progress_logs p WHERE p.goal_id = g.id), 0) "
            "AS current FROM goals g WHERE g.active = 1 ORDER BY g.deadline IS NULL, g.deadline"))


@app.post("/api/goals", dependencies=[Depends(auth)])
def add_goal(body: GoalIn):
    with get_conn() as conn:
        conn.execute("INSERT INTO goals (title, target, unit, deadline) VALUES (?, ?, ?, ?)",
                     (body.title, body.target, body.unit, body.deadline))
    return {"ok": True}


# ---------------------------------------------------------------- Gedanken
@app.get("/api/thoughts", dependencies=[Depends(auth)])
def list_thoughts(q: str | None = None):
    with get_conn() as conn:
        if q:
            fq = classifier.fts_query(q) or f'"{q}"'
            ids = [r["ref_id"] for r in conn.execute(
                "SELECT ref_id FROM search_index WHERE kind = 'thought' AND search_index MATCH ? "
                "ORDER BY rank LIMIT 50", (fq,))]
            if not ids:
                return []
            marks = ",".join("?" * len(ids))
            return rows(conn.execute(f"SELECT * FROM thoughts WHERE id IN ({marks})", ids))
        return rows(conn.execute("SELECT * FROM thoughts ORDER BY created_at DESC LIMIT 100"))


# ---------------------------------------------------------------- Vermögen
class PositionIn(BaseModel):
    portfolio: str
    name: str
    ticker: str | None = None
    isin: str | None = None
    quantity: float
    entry_price: float
    currency: str = "EUR"
    asset_class: str | None = None
    region: str | None = None
    bought_at: str | None = None
    manual_price: float | None = None


class CsvIn(BaseModel):
    csv: str


@app.get("/api/portfolio", dependencies=[Depends(auth)])
def get_portfolio(refresh: int = 0):
    with get_conn() as conn:
        return portfolio.overview(conn, force=bool(refresh))


@app.post("/api/positions", dependencies=[Depends(auth)])
def add_position(body: PositionIn):
    with get_conn() as conn:
        pid = portfolio.ensure_portfolio(conn, body.portfolio)
        conn.execute(
            "INSERT INTO positions (portfolio_id, name, ticker, isin, quantity, entry_price, currency, "
            "asset_class, region, bought_at, manual_price) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (pid, body.name, body.ticker or None, body.isin, body.quantity, body.entry_price,
             body.currency.upper(), body.asset_class, body.region, body.bought_at, body.manual_price))
    return {"ok": True}


@app.delete("/api/positions/{position_id}", dependencies=[Depends(auth)])
def delete_position(position_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM positions WHERE id = ?", (position_id,))
    return {"ok": True}


@app.post("/api/portfolio/import", dependencies=[Depends(auth)])
def import_positions(body: CsvIn):
    with get_conn() as conn:
        try:
            return {"imported": portfolio.import_csv(conn, body.csv)}
        except (ValueError, KeyError, csv.Error) as exc:
            raise HTTPException(400, f"Import fehlgeschlagen: {exc}")


# ---------------------------------------------------------------- Wochenreview & Kosten
@app.get("/api/review/week", dependencies=[Depends(auth)])
def review_week():
    """Phase 1: reine Zahlen. Phase 3: Claude formuliert daraus 3 Vorschläge."""
    s = monday(date.today()).isoformat()
    with get_conn() as conn:
        created = conn.execute("SELECT COUNT(*) FROM todos WHERE date(created_at) >= ?", (s,)).fetchone()[0]
        done = conn.execute("SELECT COUNT(*) FROM todos WHERE done = 1 AND date(done_at) >= ?", (s,)).fetchone()[0]
        open_ = conn.execute("SELECT COUNT(*) FROM todos WHERE done = 0").fetchone()[0]
        overdue = conn.execute("SELECT COUNT(*) FROM todos WHERE done = 0 AND due_date < date('now','localtime')").fetchone()[0]
        thoughts = conn.execute("SELECT COUNT(*) FROM thoughts WHERE date(created_at) >= ?", (s,)).fetchone()[0]
        habits = rows(conn.execute(
            "SELECT h.name, h.category, h.target_per_week, "
            "(SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id = h.id AND l.date >= ?) AS done "
            "FROM habits h WHERE h.active = 1", (s,)))
    return {"week_start": s, "todos_created": created, "todos_done": done, "todos_open": open_,
            "todos_overdue": overdue, "thoughts": thoughts, "habits": habits}


@app.get("/api/usage", dependencies=[Depends(auth)])
def usage():
    with get_conn() as conn:
        r = conn.execute(
            "SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS inp, "
            "COALESCE(SUM(output_tokens),0) AS outp FROM llm_usage "
            "WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')").fetchone()
    cost = r["inp"] / 1e6 * config.PRICE_INPUT_PER_MTOK + r["outp"] / 1e6 * config.PRICE_OUTPUT_PER_MTOK
    return {"calls": r["calls"], "input_tokens": r["inp"], "output_tokens": r["outp"],
            "cost_usd": round(cost, 4), "model": config.CLAUDE_MODEL}


@app.get("/api/health")
def health():
    return {"ok": True, "token_set": bool(config.API_TOKEN), "llm": bool(config.ANTHROPIC_API_KEY)}


# Statische App zuletzt einhängen, damit /api/* Vorrang hat
app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent.parent / "static", html=True),
          name="static")
