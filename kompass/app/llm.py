"""Modell-Schicht: mehrere kostenlose Anbieter über OpenAI-kompatible Schnittstellen.

Jede Rolle hat eine Kette (Anbieter, Modell, Familie). Fällt ein Eintrag aus
(fehlender Schlüssel, Limit 429, Fehler), wird der nächste versucht. Im Protokoll
steht immer, welches Modell tatsächlich geantwortet hat.
"""
import json
from datetime import date
from pathlib import Path

import httpx

from . import config
from .db import get_setting

DEFAULTS = Path(__file__).resolve().parent.parent / "data" / "modelle.json"
TIMEOUT = 120


class LLMFehler(RuntimeError):
    pass


def defaults() -> dict:
    return json.loads(DEFAULTS.read_text(encoding="utf-8"))


def zuordnung(conn) -> dict:
    """Aktuelle Zuordnung: Admin-Einstellung, sonst Standard."""
    d = defaults()
    eigene = get_setting(conn, "modelle") or {}
    return {"anbieter": d["anbieter"], "rollen": {**d["rollen"], **eigene.get("rollen", {})}}


def verfuegbare_anbieter(conn) -> dict[str, bool]:
    return {k: bool(config.key(v["key_env"])) for k, v in zuordnung(conn)["anbieter"].items()}


def familien_warnung(conn, rollen: list[str]) -> str | None:
    """Warnt, wenn die erste verfügbare Wahl aller Rollen dieselbe Modellfamilie ist."""
    z, ok = zuordnung(conn), verfuegbare_anbieter(conn)
    fam = set()
    for r in rollen:
        for anbieter, _, familie in z["rollen"].get(r, []):
            if ok.get(anbieter):
                fam.add(familie)
                break
    if len(fam) == 1:
        return f"Alle Mitglieder laufen auf derselben Modellfamilie ({fam.pop()}). Die Diskussion ist dann weniger unabhängig."
    if not fam:
        return "Kein Modell-Schlüssel eingetragen. Der Admin muss in der .env mindestens einen Anbieter hinterlegen."
    return None


def _zaehle(conn, anbieter: str, fehler: bool = False) -> None:
    conn.execute(
        "INSERT INTO llm_usage (day, provider, calls, errors) VALUES (?, ?, 1, ?) "
        "ON CONFLICT(day, provider) DO UPDATE SET calls = calls + 1, errors = errors + excluded.errors",
        (date.today().isoformat(), anbieter, int(fehler)),
    )
    conn.commit()


def _post(base_url: str, api_key: str, model: str, messages: list[dict], max_tokens: int) -> str:
    r = httpx.post(
        f"{base_url.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "messages": messages, "temperature": 0.4, "max_tokens": max_tokens},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise LLMFehler(f"HTTP {r.status_code}: {r.text[:200]}")
    text = r.json()["choices"][0]["message"]["content"] or ""
    if not text.strip():
        raise LLMFehler("leere Antwort")
    return text


def chat(conn, rolle: str, messages: list[dict], max_tokens: int = 2000) -> tuple[str, str, str]:
    """(Antworttext, Anbieter, Modell). Wirft LLMFehler, wenn alle Einträge scheitern."""
    z = zuordnung(conn)
    gruende = []
    for anbieter, modell, _familie in z["rollen"].get(rolle, []):
        info = z["anbieter"].get(anbieter)
        if not info:
            continue
        api_key = config.key(info["key_env"])
        if not api_key:
            gruende.append(f"{anbieter}: kein Schlüssel")
            continue
        try:
            text = _post(info["base_url"], api_key, modell, messages, max_tokens)
            _zaehle(conn, anbieter)
            return text, anbieter, modell
        except (httpx.HTTPError, LLMFehler, KeyError, ValueError) as e:
            _zaehle(conn, anbieter, fehler=True)
            # Nur Statuscode/Kurzinfo, nie Schlüssel loggen
            gruende.append(f"{anbieter}/{modell}: {str(e)[:120]}")
    raise LLMFehler(f"Kein Modell für Rolle '{rolle}' erreichbar. " + " | ".join(gruende))


def verbrauch_heute(conn) -> list[dict]:
    return [
        dict(r)
        for r in conn.execute(
            "SELECT provider, calls, errors FROM llm_usage WHERE day = ? ORDER BY provider", (date.today().isoformat(),)
        )
    ]
