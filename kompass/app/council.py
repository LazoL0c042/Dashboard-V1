"""Council: Klären → Fachrunde (5, max. 4 Runden bis Konsens) → Synthese → Prüfrunde (3).

Alle Beiträge werden sofort ins Protokoll (council_messages) geschrieben, das nie
geändert wird. `chat_fn` ist austauschbar (Tests nutzen Fakes).
"""
import json
import re
import statistics
import traceback

from . import llm, profile, prompts
from .db import one, rows

FACH = ["geopolitik", "finanzen", "geschichte", "kritiker", "rendite"]
PRUEF = ["statistiker", "premortem", "produkt"]
MAX_RUNDEN = 4
MAX_SPANNE = 15


class CouncilFehler(RuntimeError):
    pass


# ---------- Hilfen ----------

def parse_json(text: str) -> dict | None:
    if not text:
        return None
    t = re.sub(r"```(?:json)?", "", text)
    a, b = t.find("{"), t.rfind("}")
    if a < 0 or b <= a:
        return None
    try:
        d = json.loads(t[a : b + 1])
    except json.JSONDecodeError:
        return None
    return d if isinstance(d, dict) else None


def konsens(beitraege: dict[str, dict]) -> tuple[bool, float]:
    """Einig = Spanne der Wahrscheinlichkeiten ≤ 15 Punkte UND Kritiker hat Einwand als widerlegt markiert."""
    probs = [b["wahrscheinlichkeit"] for b in beitraege.values()]
    spanne = max(probs) - min(probs)
    kritiker_ok = beitraege.get("kritiker", {}).get("einwand_widerlegt") is True
    return spanne <= MAX_SPANNE and kritiker_ok, spanne


def _wahrscheinlichkeit(d: dict) -> int | None:
    try:
        return max(0, min(100, int(round(float(d.get("wahrscheinlichkeit"))))))
    except (TypeError, ValueError):
        return None


def log(conn, session_id, phase, role, content, data=None, round_=0, provider=None, model=None) -> None:
    conn.execute(
        "INSERT INTO council_messages (session_id, phase, round, role, provider, model, content, data_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (session_id, phase, round_, role, provider, model, content,
         json.dumps(data, ensure_ascii=False) if data is not None else None),
    )
    conn.commit()


def _status(conn, session_id, status=None, progress=None, error=None, result=None) -> None:
    sets, params = [], []
    for col, val in (("status", status), ("progress", progress), ("error", error)):
        if val is not None:
            sets.append(f"{col} = ?")
            params.append(val)
    if result is not None:
        sets.append("result_json = ?")
        params.append(json.dumps(result, ensure_ascii=False))
    if status in ("fertig", "dissens", "fehler"):
        sets.append("finished_at = datetime('now')")
    conn.execute(f"UPDATE council_sessions SET {', '.join(sets)} WHERE id = ?", (*params, session_id))
    conn.commit()


def _ask_json(conn, chat_fn, rolle, messages, required: tuple = ()) -> tuple[dict, str, str, str]:
    """Fragt ein Modell, erzwingt JSON (1 Wiederholung). (daten, text, anbieter, modell)."""
    text, anbieter, modell = chat_fn(conn, rolle, messages)
    d = parse_json(text)
    if d is None or any(k not in d for k in required):
        retry = messages + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "Das war kein gültiges JSON im verlangten Schema. Antworte jetzt ausschließlich mit dem JSON."},
        ]
        text, anbieter, modell = chat_fn(conn, rolle, retry)
        d = parse_json(text)
    if d is None or any(k not in d for k in required):
        raise CouncilFehler(f"{prompts.titel(rolle)} hat zweimal kein gültiges JSON geliefert ({anbieter}/{modell}).")
    return d, text, anbieter, modell


# ---------- Kontext ----------

def session_for(conn, user_id: int, session_id: int) -> dict | None:
    return one(conn, "SELECT * FROM council_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))


def messages_for(conn, session_id: int) -> list[dict]:
    out = rows(conn, "SELECT * FROM council_messages WHERE session_id = ? ORDER BY id", (session_id,))
    for m in out:
        m["data"] = json.loads(m["data_json"]) if m["data_json"] else None
        m["titel"] = prompts.titel(m["role"])
        del m["data_json"]
    return out


def _recherche_text(conn, s: dict) -> str:
    ids = json.loads(s["research_ids"] or "[]")
    if not ids:
        return "Kein Recherche-Material angehängt. Aktuelle Ereignisse daher nur unter Vorbehalt und als (geschätzt) bewerten."
    teile = []
    for rid in ids:
        r = one(conn, "SELECT * FROM research WHERE id = ? AND user_id = ?", (rid, s["user_id"]))
        if r and r["answer"]:
            quellen = json.loads(r["sources_json"])
            qtext = "\n".join(f"[{i + 1}] {q.get('titel', '')} – {q.get('quelle', '')}, {q.get('datum', '')} {q.get('url', '')}"
                              for i, q in enumerate(quellen))
            teile.append(f"Recherche vom {r['created_at']} zu „{r['query']}“:\n{r['answer']}\nQuellen:\n{qtext}")
    return "\n\n".join(teile) or "Kein Recherche-Material."


def _klaer_verlauf(msgs: list[dict]) -> str:
    out = []
    for m in msgs:
        if m["phase"] != "klaeren":
            continue
        if m["role"] == "nutzer":
            out.append(f"Nutzer: {m['content']}")
        elif m["data"]:
            out.append(f"Moderator: {m['data'].get('verstaendnis', '')} Fragen: {'; '.join(m['data'].get('fragen', []))}")
    return "\n".join(out)


def _kontext(conn, s: dict, msgs: list[dict]) -> str:
    return (
        f"IDEE DES NUTZERS:\n{s['idea']}\n\n"
        f"PROFIL DES NUTZERS:\n{profile.as_text(conn, s['user_id'])}\n\n"
        f"KLÄRUNGSGESPRÄCH:\n{_klaer_verlauf(msgs) or '-'}\n\n"
        f"RECHERCHE-MATERIAL:\n{_recherche_text(conn, s)}"
    )


# ---------- Phase 0: Klären ----------

def create(conn, user_id: int, idea: str, research_ids: list[int] | None = None) -> int:
    idea = idea.strip()
    if len(idea) < 10:
        raise ValueError("Beschreibe deine Idee in mindestens einem Satz.")
    cur = conn.execute(
        "INSERT INTO council_sessions (user_id, idea, research_ids) VALUES (?, ?, ?)",
        (user_id, idea, json.dumps(research_ids or [])),
    )
    conn.commit()
    return cur.lastrowid


def klaeren(conn, session_id: int, user_text: str | None = None, chat_fn=llm.chat) -> dict:
    s = one(conn, "SELECT * FROM council_sessions WHERE id = ?", (session_id,))
    if s["status"] != "klaeren":
        raise ValueError("Die Diskussion läuft bereits.")
    if user_text:
        log(conn, session_id, "klaeren", "nutzer", user_text.strip())
    msgs = messages_for(conn, session_id)
    messages = [
        {"role": "system", "content": prompts.MODERATOR_KLAEREN},
        {"role": "user", "content": _kontext(conn, s, msgs)},
    ]
    d, text, anbieter, modell = _ask_json(conn, chat_fn, "moderator", messages, ("fragen",))
    for f in d.get("profil", []) or []:
        if isinstance(f, dict) and f.get("key") and f.get("value") not in (None, ""):
            profile.propose(conn, s["user_id"], f["key"], f["value"], f.get("status", "geschaetzt"), session_id)
    log(conn, session_id, "klaeren", "moderator", d.get("verstaendnis", ""), d, provider=anbieter, model=modell)
    return d


# ---------- Phase 1-3: Diskussion ----------

def _runde_text(beitraege: dict[str, dict]) -> str:
    teile = []
    for rolle, b in beitraege.items():
        teile.append(
            f"{prompts.titel(rolle)} – {b['wahrscheinlichkeit']} %: {b.get('position', '')}\n"
            f"  Argumente: {'; '.join(map(str, b.get('argumente', [])))}\n"
            f"  Stärkster Einwand: {b.get('staerkster_einwand', '')}"
            + (f"\n  Einwand widerlegt: {b.get('einwand_widerlegt')}" if rolle == "kritiker" else "")
        )
    return "\n\n".join(teile)


def run(conn, session_id: int, chat_fn=llm.chat) -> None:
    """Komplette Diskussion. Fehler landen als Status 'fehler' mit Meldung, Protokoll bleibt."""
    try:
        _run(conn, session_id, chat_fn)
    except (CouncilFehler, llm.LLMFehler) as e:
        _status(conn, session_id, status="fehler", error=str(e), progress="Abgebrochen")
    except Exception as e:  # unerwartet: trotzdem sauber beenden
        traceback.print_exc()
        _status(conn, session_id, status="fehler", error=f"Interner Fehler: {e}", progress="Abgebrochen")


def _run(conn, session_id: int, chat_fn) -> None:
    s = one(conn, "SELECT * FROM council_sessions WHERE id = ?", (session_id,))
    _status(conn, session_id, status="laeuft", progress="Fachrunde startet")
    kontext = _kontext(conn, s, messages_for(conn, session_id))
    letzte: dict[str, dict] = {}
    einig, spanne, runde = False, 100.0, 0

    for runde in range(1, MAX_RUNDEN + 1):
        aktuell = {}
        for rolle in FACH:
            _status(conn, session_id, progress=f"Runde {runde}: {prompts.titel(rolle)} denkt nach")
            inhalt = kontext
            if letzte:
                inhalt += f"\n\nBEITRÄGE DER RUNDE {runde - 1}:\n{_runde_text(letzte)}\n\nGeh auf die Argumente der anderen ein. Ändere deine Wahrscheinlichkeit nur mit Begründung."
            d, _, anbieter, modell = _ask_json(
                conn, chat_fn, rolle,
                [{"role": "system", "content": prompts.mitglied_system(rolle)}, {"role": "user", "content": inhalt}],
                ("position", "wahrscheinlichkeit"),
            )
            p = _wahrscheinlichkeit(d)
            if p is None:
                raise CouncilFehler(f"{prompts.titel(rolle)} hat keine gültige Wahrscheinlichkeit genannt.")
            d["wahrscheinlichkeit"] = p
            if rolle != "kritiker":
                d["einwand_widerlegt"] = False
            aktuell[rolle] = d
            log(conn, session_id, "fach", rolle, d.get("position", ""), d, runde, anbieter, modell)
        letzte = aktuell
        einig, spanne = konsens(aktuell)
        log(conn, session_id, "fach", "moderator",
            f"Runde {runde}: Spanne {spanne:.0f} Punkte, Kritiker-Einwand widerlegt: "
            f"{'ja' if aktuell['kritiker'].get('einwand_widerlegt') is True else 'nein'} → "
            + ("Konsens." if einig else ("Weiter." if runde < MAX_RUNDEN else "Kein Konsens nach 4 Runden.")),
            {"spanne": spanne, "einig": einig}, runde)
        if einig:
            break

    median = statistics.median(b["wahrscheinlichkeit"] for b in letzte.values())

    # Synthese
    _status(conn, session_id, progress="Moderator fasst zusammen")
    syn_in = (
        f"{kontext}\n\nLETZTE RUNDE ({runde}):\n{_runde_text(letzte)}\n\n"
        + (f"ERGEBNIS: Konsens. Median-Wahrscheinlichkeit {median:.0f} %."
           if einig else f"ERGEBNIS: KEIN Konsens nach {runde} Runden (Spanne {spanne:.0f} Punkte). Stelle den Dissens dar.")
    )
    syn, _, anbieter, modell = _ask_json(
        conn, chat_fn, "moderator",
        [{"role": "system", "content": prompts.MODERATOR_SYNTHESE}, {"role": "user", "content": syn_in}],
        ("bewertung", "richtung"),
    )
    syn["wahrscheinlichkeit"] = median  # berechnet, nicht vom Modell übernommen
    syn["konsens"] = einig
    syn["runden"] = runde
    syn["spanne"] = spanne
    syn["mitglieder"] = {r: b["wahrscheinlichkeit"] for r, b in letzte.items()}
    log(conn, session_id, "synthese", "moderator", syn.get("zusammenfassung", ""), syn, runde, anbieter, modell)

    if not einig:
        _status(conn, session_id, status="dissens", progress="Fertig – kein Konsens", result={"synthese": syn})
        return

    # Prüfrunde
    from . import products  # spät importieren: vermeidet Zyklen

    pruef = {}
    pruef_in = f"{kontext}\n\nCOUNCIL-ERGEBNIS:\n{json.dumps(syn, ensure_ascii=False)}"
    for rolle in PRUEF:
        _status(conn, session_id, progress=f"Prüfrunde: {prompts.titel(rolle)}")
        inhalt = pruef_in
        if rolle == "produkt":
            inhalt += f"\n\nPRODUKT-KATALOG:\n{json.dumps(products.katalog_fuer_modell(conn), ensure_ascii=False)}"
        d, _, anbieter, modell = _ask_json(
            conn, chat_fn, rolle,
            [{"role": "system", "content": f"Du bist {prompts.PRUEFER[rolle][0]}.\n{prompts.PRUEFER[rolle][1]}"},
             {"role": "user", "content": inhalt}],
        )
        if rolle == "produkt":
            d["produkte"] = products.markiere_verifiziert(d.get("produkte", []))
        pruef[rolle] = d
        log(conn, session_id, "pruef", rolle, json.dumps(d, ensure_ascii=False)[:4000], d, 0, anbieter, modell)

    _status(conn, session_id, status="fertig", progress="Fertig", result={"synthese": syn, "pruefung": pruef})


def nachbesprechung(conn, plan: dict, auswertung: dict, chat_fn=llm.chat) -> tuple[dict, str, str]:
    frozen = plan["frozen"]
    inhalt = (
        f"ENTSCHEIDUNG VOM {plan['created_at']}:\n{json.dumps(frozen.get('ergebnis', {}), ensure_ascii=False)[:6000]}\n\n"
        f"EINGABEN DES NUTZERS:\n{json.dumps(frozen.get('entscheidung', {}), ensure_ascii=False)}\n\n"
        f"AUSWERTUNG HEUTE:\n{json.dumps(auswertung, ensure_ascii=False)}"
    )
    d, _, anbieter, modell = _ask_json(
        conn, chat_fn, "moderator",
        [{"role": "system", "content": prompts.NACHBESPRECHUNG}, {"role": "user", "content": inhalt}],
        ("lehren",),
    )
    return d, anbieter, modell
