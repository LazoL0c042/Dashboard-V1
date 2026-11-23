"""Login, Sitzungen, Einladungen. Passwörter mit scrypt (Standardbibliothek)."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from . import config
from .db import one

MAX_FEHLVERSUCHE = 5
SPERRE_MINUTEN = 10


def hash_pw(pw: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${h.hex()}"


def check_pw(pw: str, stored: str) -> bool:
    try:
        _, salt, h = stored.split("$")
    except ValueError:
        return False
    test = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(test.hex(), h)


def user_count(conn) -> int:
    return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def create_user(conn, name: str, pw: str, is_admin: bool = False, invite: str | None = None) -> int:
    name = name.strip()
    if len(name) < 2 or len(pw) < 8:
        raise ValueError("Name mind. 2 Zeichen, Passwort mind. 8 Zeichen")
    if one(conn, "SELECT id FROM users WHERE name = ?", (name,)):
        raise ValueError("Name ist vergeben")
    if invite is not None:
        inv = one(conn, "SELECT * FROM invites WHERE code = ? AND used_by IS NULL", (invite.strip(),))
        if not inv:
            raise ValueError("Einladungscode ungültig oder schon benutzt")
    cur = conn.execute(
        "INSERT INTO users (name, pw_hash, is_admin) VALUES (?, ?, ?)", (name, hash_pw(pw), int(is_admin))
    )
    uid = cur.lastrowid
    if invite is not None:
        conn.execute("UPDATE invites SET used_by = ? WHERE code = ?", (uid, invite.strip()))
    conn.commit()
    return uid


def login(conn, name: str, pw: str) -> str | None:
    u = one(conn, "SELECT * FROM users WHERE name = ?", (name.strip(),))
    if not u:
        return None
    now = datetime.now()
    if u["locked_until"] and datetime.fromisoformat(u["locked_until"]) > now:
        return None
    if not check_pw(pw, u["pw_hash"]):
        fails = u["failed_logins"] + 1
        locked = (now + timedelta(minutes=SPERRE_MINUTEN)).isoformat() if fails >= MAX_FEHLVERSUCHE else None
        conn.execute(
            "UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?",
            (0 if locked else fails, locked, u["id"]),
        )
        conn.commit()
        return None
    conn.execute("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?", (u["id"],))
    token = secrets.token_urlsafe(32)
    expires = (now + timedelta(days=config.SESSION_DAYS)).isoformat()
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, u["id"], expires))
    conn.commit()
    return token


def logout(conn, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()


def user_for_token(conn, token: str | None) -> dict | None:
    if not token:
        return None
    u = one(
        conn,
        "SELECT u.id, u.name, u.is_admin, u.notice_accepted_at, s.expires_at FROM sessions s "
        "JOIN users u ON u.id = s.user_id WHERE s.token = ?",
        (token,),
    )
    if not u or datetime.fromisoformat(u["expires_at"]) < datetime.now():
        return None
    return u


def create_invite(conn, admin_id: int) -> str:
    code = secrets.token_urlsafe(9)
    conn.execute("INSERT INTO invites (code, created_by) VALUES (?, ?)", (code, admin_id))
    conn.commit()
    return code


def accept_notice(conn, user_id: int) -> None:
    conn.execute("UPDATE users SET notice_accepted_at = datetime('now') WHERE id = ?", (user_id,))
    conn.commit()


def change_password(conn, user_id: int, old: str, new: str) -> None:
    u = one(conn, "SELECT pw_hash FROM users WHERE id = ?", (user_id,))
    if not u or not check_pw(old, u["pw_hash"]):
        raise ValueError("Altes Passwort falsch")
    if len(new) < 8:
        raise ValueError("Passwort mind. 8 Zeichen")
    conn.execute("UPDATE users SET pw_hash = ? WHERE id = ?", (hash_pw(new), user_id))
    conn.commit()
