"""Profil pro Nutzer: Fakten aus Council-Gesprächen, erst nach Bestätigung gültig."""
from .db import one, rows

# Bekannte Schlüssel mit Anzeigenamen. Andere Schlüssel sind erlaubt.
LABELS = {
    "alter": "Alter",
    "zielalter": "Zielalter",
    "horizont_jahre": "Anlagehorizont (Jahre)",
    "kapital": "Verfügbares Kapital (€)",
    "sparrate": "Monatliche Sparrate (€)",
    "zielbetrag": "Zielbetrag (€)",
    "ziel": "Ziel",
    "risiko": "Risikobereitschaft",
    "max_verlust": "Maximal tragbarer Verlust",
    "wissen": "Wissensstand",
    "einkommen": "Nettoeinkommen (€/Monat)",
    "ruecklage": "Notgroschen (€)",
    "schulden": "Schulden",
    "familienstand": "Familienstand",
    "kirchensteuer": "Kirchensteuer",
    "bestehende_anlagen": "Bestehende Anlagen",
}


def propose(conn, user_id: int, key: str, value: str, status: str = "angegeben", session_id: int | None = None) -> int:
    if status not in ("angegeben", "geschaetzt"):
        status = "geschaetzt"
    key = key.strip().lower().replace(" ", "_")[:40]
    # Gleicher Vorschlag schon offen? Dann nicht doppeln.
    dup = one(
        conn,
        "SELECT id FROM profile_facts WHERE user_id = ? AND key = ? AND value = ? AND confirmed = 0 "
        "AND superseded_at IS NULL",
        (user_id, key, str(value)),
    )
    if dup:
        return dup["id"]
    cur = conn.execute(
        "INSERT INTO profile_facts (user_id, key, value, status, session_id) VALUES (?, ?, ?, ?, ?)",
        (user_id, key, str(value)[:500], status, session_id),
    )
    conn.commit()
    return cur.lastrowid


def confirm(conn, user_id: int, fact_id: int, value: str | None = None) -> bool:
    f = one(conn, "SELECT * FROM profile_facts WHERE id = ? AND user_id = ?", (fact_id, user_id))
    if not f:
        return False
    conn.execute(
        "UPDATE profile_facts SET superseded_at = datetime('now') "
        "WHERE user_id = ? AND key = ? AND confirmed = 1 AND superseded_at IS NULL",
        (user_id, f["key"]),
    )
    if value is not None and value != f["value"]:
        conn.execute(
            "UPDATE profile_facts SET value = ?, status = 'angegeben' WHERE id = ?", (str(value)[:500], fact_id)
        )
    conn.execute("UPDATE profile_facts SET confirmed = 1 WHERE id = ?", (fact_id,))
    conn.commit()
    return True


def reject(conn, user_id: int, fact_id: int) -> bool:
    cur = conn.execute(
        "UPDATE profile_facts SET superseded_at = datetime('now') WHERE id = ? AND user_id = ? AND confirmed = 0",
        (fact_id, user_id),
    )
    conn.commit()
    return cur.rowcount > 0


def set_value(conn, user_id: int, key: str, value: str, status: str = "angegeben") -> int:
    fid = propose(conn, user_id, key, value, status)
    confirm(conn, user_id, fid)
    return fid


def current(conn, user_id: int) -> dict[str, dict]:
    out = {}
    for f in rows(
        conn,
        "SELECT * FROM profile_facts WHERE user_id = ? AND confirmed = 1 AND superseded_at IS NULL ORDER BY id",
        (user_id,),
    ):
        out[f["key"]] = {"value": f["value"], "status": f["status"], "seit": f["created_at"], "id": f["id"],
                         "label": LABELS.get(f["key"], f["key"])}
    return out


def pending(conn, user_id: int) -> list[dict]:
    return [
        {**f, "label": LABELS.get(f["key"], f["key"])}
        for f in rows(
            conn,
            "SELECT * FROM profile_facts WHERE user_id = ? AND confirmed = 0 AND superseded_at IS NULL ORDER BY id",
            (user_id,),
        )
    ]


def as_text(conn, user_id: int) -> str:
    """Profil als Text für die Modelle. Schätzungen werden markiert."""
    p = current(conn, user_id)
    if not p:
        return "Noch keine Profildaten bekannt."
    return "\n".join(
        f"- {v['label']}: {v['value']}" + (" (geschätzt)" if v["status"] == "geschaetzt" else "") for v in p.values()
    )
