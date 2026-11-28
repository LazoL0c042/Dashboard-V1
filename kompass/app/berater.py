"""Portfolio-Council: im Gespräch Produkte und Gewichtungen auswählen.

Pro Nachricht antworten zwei Rollen: der Portfolio-Berater (Vorschlag, Antwort,
Rückfragen) und der Kritiker (Bewertung der Gewichtungen und des Risikos).
Auf Wunsch sucht der Berater aktuelle Quellen (Recherche) und bezieht sie ein.
"""
import json

from . import entwurf, glossar, llm, profile, prompts, research
from .council import _marktlage, parse_json
from .db import one, rows


def anlegen(conn, user_id: int, titel: str, entwurf_id: int | None = None, seite: str | None = None) -> int:
    cur = conn.execute("INSERT INTO berater_chats (user_id, titel, entwurf_id, seite) VALUES (?, ?, ?, ?)",
                       (user_id, (titel or "Gespräch mit dem Council")[:200], entwurf_id, (seite or "")[:300]))
    conn.commit()
    return cur.lastrowid


def chat_for(conn, user_id: int, cid: int) -> dict | None:
    c = one(conn, "SELECT * FROM berater_chats WHERE id = ? AND user_id = ?", (cid, user_id))
    if c:
        c["research_ids"] = json.loads(c["research_ids"])
    return c


def nachrichten(conn, cid: int) -> list[dict]:
    out = rows(conn, "SELECT * FROM berater_nachrichten WHERE chat_id = ? ORDER BY id", (cid,))
    for m in out:
        m["data"] = json.loads(m.pop("data_json")) if m["data_json"] else None
    return out


def liste(conn, user_id: int) -> list[dict]:
    return rows(conn, "SELECT id, titel, status, created_at FROM berater_chats WHERE user_id = ? ORDER BY id DESC", (user_id,))


def _log(conn, cid, rolle, inhalt, data=None, provider=None, model=None):
    conn.execute("INSERT INTO berater_nachrichten (chat_id, rolle, inhalt, data_json, provider, model) VALUES (?, ?, ?, ?, ?, ?)",
                 (cid, rolle, inhalt, json.dumps(data, ensure_ascii=False) if data is not None else None, provider, model))
    conn.commit()


def _status(conn, cid, status, error=None):
    conn.execute("UPDATE berater_chats SET status = ?, error = ? WHERE id = ?", (status, error, cid))
    conn.commit()


def _katalog_text() -> str:
    g = glossar.daten()
    return "\n".join(
        f"- {a['id']}: {a['name']} (Risiko {a['risiko']}/5, erwartet ~{a['erwartung']['rendite']} % p.a., Schwankung ~{a['erwartung']['schwankung']} %)"
        + (f" Produkte: {', '.join(p['name'] + ' ' + p['isin'] for p in a['katalog'])}" if a["katalog"] else "")
        for a in g["assets"]
    )


def kontext_setzen(conn, user_id: int, cid: int, entwurf_id: int | None, seite: str | None) -> None:
    conn.execute("UPDATE berater_chats SET entwurf_id = COALESCE(?, entwurf_id), seite = COALESCE(?, seite) WHERE id = ? AND user_id = ?",
                 (entwurf_id, (seite or None) and seite[:300], cid, user_id))
    conn.commit()


def _entwurf(conn, c: dict) -> dict:
    try:
        return entwurf.get(conn, c["user_id"], c.get("entwurf_id"))
    except LookupError:
        return entwurf.get(conn, c["user_id"])


def _kontext(conn, c: dict) -> str:
    e = _entwurf(conn, c)
    stufe = next(s for s in glossar.daten()["risikostufen"] if s["stufe"] == e["risiko"])
    verlauf = "\n".join(
        f"{'Nutzer' if m['rolle'] == 'nutzer' else 'Berater' if m['rolle'] == 'berater' else 'Kritiker' if m['rolle'] == 'kritiker' else 'System'}: {m['inhalt']}"
        for m in nachrichten(conn, c["id"])[-14:]
    )
    material = ""
    for rid in c["research_ids"][-3:]:
        r = research.get(conn, c["user_id"], rid)
        if r and r["answer"]:
            material += f"\nRecherche „{r['query']}“ ({r['created_at']}):\n{r['answer'][:3000]}\n"
    return (
        f"DER NUTZER SIEHT GERADE: {c.get('seite') or 'Startseite'}\n\n"
        f"PROFIL:\n{profile.as_text(conn, c['user_id'])}\n\n"
        f"RAHMEN DES ENTWURFS: Risiko {e['risiko']}/5 ({stufe['name']}: {stufe['text']}), Einmalbetrag {e['einmalbetrag']:.0f} €, "
        f"Sparrate {e['sparrate']:.0f} €/Monat, Horizont {e['horizont_jahre']} Jahre.\n"
        f"AKTUELLE POSITIONEN IM ENTWURF:\n"
        + ("\n".join(f"- {p['name']} ({p.get('asset_id') or p.get('ticker')}): {p['anteil']:.0f} %" for p in e["positionen"]) or "- noch keine")
        + f"\n\nGLOSSAR (asset_id, Risiko, Annahmen):\n{_katalog_text()}\n\n"
        f"RECHERCHE-MATERIAL:{material or ' keins'}\n\n{_marktlage(conn)}\n\nGESPRÄCH BISHER:\n{verlauf}"
    )


def _frage(conn, chat_fn, rolle_llm, system, inhalt, pflicht):
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": inhalt}]
    text, anbieter, modell = chat_fn(conn, rolle_llm, msgs)
    d = parse_json(text)
    if d is None or any(k not in d for k in pflicht):
        text, anbieter, modell = chat_fn(conn, rolle_llm, msgs + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "Antworte ausschließlich mit dem JSON im verlangten Schema."}])
        d = parse_json(text)
    if d is None or any(k not in d for k in pflicht):
        raise ValueError("Das Modell hat keine gültige Antwort geliefert.")
    return d, anbieter, modell


def recherchieren(conn, c: dict, query: str, chat_fn=llm.chat, fetch=research.fetch_text) -> int:
    rid = research.start(conn, c["user_id"], "frage", query)
    research.run(conn, rid, "alles", chat_fn, fetch)
    ids = c["research_ids"] + [rid]
    conn.execute("UPDATE berater_chats SET research_ids = ? WHERE id = ?", (json.dumps(ids), c["id"]))
    conn.commit()
    c["research_ids"] = ids
    r = research.get(conn, c["user_id"], rid)
    _log(conn, c["id"], "system", f"Aktuelle Quellen gesucht: „{query}“ ({len(r['quellen'])} Treffer)", {"research_id": rid})
    return rid


def antworten(conn, cid: int, text: str | None, chat_fn=llm.chat, fetch=research.fetch_text, leser=None) -> None:
    """Nutzernachricht verarbeiten: Berater (ggf. mit Suche), danach Kritiker. Fehler → Status 'fehler'."""
    c = one(conn, "SELECT * FROM berater_chats WHERE id = ?", (cid,))
    c["research_ids"] = json.loads(c["research_ids"])
    if leser is None:
        from .links import lesen as leser
    try:
        if text:
            _log(conn, cid, "nutzer", text.strip())
            # Links im Text: lesen und einordnen, bevor der Berater antwortet
            from . import links
            for url in links.finde_urls(text):
                try:
                    d = links.verstehen(conn, c["user_id"], url, chat_fn, leser)
                    _log(conn, cid, "system", links.als_text(d), {"link": d})
                except Exception as ex:
                    _log(conn, cid, "system", f"Link konnte nicht gelesen werden ({url}): {str(ex)[:160]}", {"link_fehler": url})
        d, anbieter, modell = _frage(conn, chat_fn, "moderator", prompts.PORTFOLIO_BERATER, _kontext(conn, c), ("antwort",))
        if (d.get("recherche") or "").strip():
            recherchieren(conn, c, d["recherche"].strip(), chat_fn, fetch)
            d, anbieter, modell = _frage(conn, chat_fn, "moderator", prompts.PORTFOLIO_BERATER,
                                         _kontext(conn, c) + "\n\nDie Recherche ist jetzt im Material. Beziehe sie ein und starte keine neue Suche.",
                                         ("antwort",))
            d["recherche"] = ""
        if d.get("vorschlag") and d["vorschlag"].get("positionen"):
            pos = [entwurf.position_aus(p) for p in d["vorschlag"]["positionen"]]
            d["vorschlag"]["aufgeloest"] = [p for p in pos if p]
        for f in d.get("profil") or []:
            if isinstance(f, dict) and f.get("key") and f.get("value") not in (None, ""):
                profile.propose(conn, c["user_id"], f["key"], f["value"], f.get("status", "geschaetzt"))
        _log(conn, cid, "berater", d.get("antwort", ""), d, anbieter, modell)
        e = _entwurf(conn, c)
        if d.get("vorschlag") or e["positionen"]:
            k, anbieter, modell = _frage(conn, chat_fn, "kritiker", prompts.PORTFOLIO_KRITIKER,
                                         _kontext(conn, c) + f"\n\nNEUER VORSCHLAG DES BERATERS:\n{json.dumps(d.get('vorschlag'), ensure_ascii=False)}",
                                         ("kommentar",))
            _log(conn, cid, "kritiker", k.get("kommentar", ""), k, anbieter, modell)
        _status(conn, cid, "bereit")
    except Exception as ex:
        _status(conn, cid, "fehler", str(ex))
