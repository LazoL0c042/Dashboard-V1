"""Wandelt eine Spracheingabe in Aktionen aus dem festen Katalog um.

WICHTIG: Dieses Modul greift NIE auf Vermögensdaten zu. An die Claude API
gehen nur: der Eingabetext, Namen von Projekten/Gewohnheiten/Zielen und
ähnliche frühere Gedanken/ToDos.
"""
import json
import re
from datetime import date

from . import config
from .db import rows

ACTIONS = {
    "thought.save", "todo.create", "todo.complete", "week.plan",
    "checklist.log", "progress.log", "query",
}

SYSTEM_PROMPT = """Du bist der Sortier-Assistent in Peters persönlichem Gedankenspeicher.
Du bekommst eine diktierte Eingabe (Deutsch, umgangssprachlich, evtl. mit Diktierfehlern).
Zerlege sie in eine oder mehrere Aktionen aus diesem abschließenden Katalog:

- thought.save   {text, category, project, tags[]}          Gedanke/Idee/Notiz
- todo.create    {title, project, priority(1-3), due_date}  Aufgabe (1 = hoch)
- todo.complete  {todo_id}                                  offene Aufgabe erledigt (nur IDs aus Kontext)
- week.plan      {date, title}                              Termin/Vorhaben an einem Tag
- checklist.log  {habit, amount, unit, date, note}          Gewohnheit erledigt (nur Namen aus Kontext)
- progress.log   {goal, value, note}                        Fortschritt zu Ziel (nur Ziele aus Kontext)
- query          {question}                                 Frage an die eigenen Notizen

Regeln:
- Jede Aktion hat "type" und "confidence" (0.0 bis 1.0).
- Relative Datumsangaben ("morgen", "Freitag") in YYYY-MM-DD umrechnen. Heute ist {today} ({weekday}).
- Erfinde keine IDs, Gewohnheiten oder Ziele. Passt nichts, senke die confidence.
- Fragen zu Geld, Depot oder Vermögen: type "query" mit question, sonst nichts.
- "reply": eine kurze deutsche Bestätigung, max. 12 Wörter.

Antworte NUR mit JSON, ohne Markdown:
{"actions": [ ... ], "reply": "..."}"""

WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

# Präfix-Regeln: funktionieren auch ohne API-Key und kosten nichts.
PREFIX_RULES = [
    (re.compile(r"^\s*(todo|to-do|to do|aufgabe)\s*[:,-]?\s*", re.I), "todo.create"),
    (re.compile(r"^\s*(gedanke|notiz|idee)\s*[:,-]?\s*", re.I), "thought.save"),
]


def rule_based(text: str) -> dict | None:
    for pattern, action in PREFIX_RULES:
        m = pattern.match(text)
        if m:
            body = text[m.end():].strip()
            if not body:
                return None
            payload = {"title": body} if action == "todo.create" else {"text": body}
            label = "ToDo" if action == "todo.create" else "Gedanke"
            return {
                "actions": [{"type": action, "confidence": 1.0, **payload}],
                "reply": f"{label} gespeichert.",
            }
    return None


def fts_query(text: str) -> str:
    words = [w for w in re.findall(r"\w{4,}", text.lower())][:8]
    return " OR ".join(f'"{w}"' for w in words)


def build_context(conn, text: str) -> dict:
    ctx = {
        "offene_todos": rows(conn.execute(
            "SELECT id, title, project, due_date FROM todos WHERE done = 0 "
            "ORDER BY created_at DESC LIMIT 25")),
        "gewohnheiten": [r["name"] for r in conn.execute(
            "SELECT name FROM habits WHERE active = 1")],
        "ziele": [r["title"] for r in conn.execute(
            "SELECT title FROM goals WHERE active = 1")],
        "projekte": [r["project"] for r in conn.execute(
            "SELECT DISTINCT project FROM todos WHERE project IS NOT NULL "
            "UNION SELECT DISTINCT project FROM thoughts WHERE project IS NOT NULL")],
        "aehnliche_eintraege": [],
    }
    q = fts_query(text)
    if q:
        ctx["aehnliche_eintraege"] = rows(conn.execute(
            "SELECT kind, ref_id, text FROM search_index WHERE search_index MATCH ? "
            "ORDER BY rank LIMIT 8", (q,)))
    return ctx


def call_claude(text: str, context: dict) -> dict:
    import anthropic

    today = date.today()
    system = (SYSTEM_PROMPT
              .replace("{today}", today.isoformat())
              .replace("{weekday}", WEEKDAYS[today.weekday()]))
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=config.CLAUDE_MODEL,
        max_tokens=1000,
        system=system,
        messages=[{
            "role": "user",
            "content": f"Kontext:\n{json.dumps(context, ensure_ascii=False)}\n\nEingabe:\n{text}",
        }],
    )
    raw = "".join(b.text for b in msg.content if b.type == "text")
    raw = re.sub(r"```(json)?", "", raw).strip()
    result = json.loads(raw)
    result["usage"] = {
        "input_tokens": msg.usage.input_tokens,
        "output_tokens": msg.usage.output_tokens,
    }
    return result


def classify(conn, text: str) -> dict:
    """Gibt {"actions": [...], "reply": str, "needs_review": bool} zurück."""
    ruled = rule_based(text)
    if ruled:
        return {**ruled, "needs_review": False}

    if not config.ANTHROPIC_API_KEY:
        return {"actions": [], "reply": "In der Inbox (kein API-Key gesetzt).",
                "needs_review": True}

    result = None
    try:
        result = call_claude(text, build_context(conn, text))
        actions, unsure = validate(result)
    except Exception as exc:  # Netz, JSON, API, kaputtes Format: nie Daten verlieren
        return {"actions": [], "reply": "In der Inbox (Sortierung fehlgeschlagen).",
                "needs_review": True, "error": str(exc),
                "usage": result.get("usage") if isinstance(result, dict) else None}

    reply = result.get("reply")
    return {
        "actions": actions,
        "reply": reply if isinstance(reply, str) and reply else "Gespeichert.",
        "needs_review": unsure,
        "usage": result.get("usage"),
    }


def validate(result) -> tuple[list[dict], bool]:
    """Prüft die Claude-Antwort. Wirft bei kaputtem Format, statt zu raten."""
    if not isinstance(result, dict) or not isinstance(result.get("actions", []), list):
        raise ValueError("Antwort hat kein gültiges Format")
    actions = [a for a in result.get("actions", [])
               if isinstance(a, dict) and a.get("type") in ACTIONS]
    confidences = [float(a.get("confidence", 0)) for a in actions]  # "hoch", None: Fehler
    unsure = (not actions) or any(c < config.CONFIDENCE_THRESHOLD for c in confidences)
    return actions, unsure
