-- Kompass Datenbankschema. Wird bei jedem Start idempotent angelegt.

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pw_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    notice_accepted_at TEXT,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    created_by INTEGER NOT NULL REFERENCES users(id),
    used_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Profil: jeder Fakt einzeln, mit Herkunft und Status. Alte Werte bleiben (superseded_at).
CREATE TABLE IF NOT EXISTS profile_facts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('angegeben', 'geschaetzt')),
    session_id INTEGER,
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    superseded_at TEXT
);

CREATE TABLE IF NOT EXISTS council_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idea TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'klaeren'
        CHECK (status IN ('klaeren', 'laeuft', 'fertig', 'dissens', 'fehler')),
    progress TEXT,
    error TEXT,
    result_json TEXT,
    research_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
);

-- Protokoll: nur anhängen, nie ändern.
CREATE TABLE IF NOT EXISTS council_messages (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    round INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    content TEXT NOT NULL,
    data_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS council_messages_no_update
BEFORE UPDATE ON council_messages
BEGIN SELECT RAISE(ABORT, 'Council-Protokoll ist unveränderlich'); END;

-- Pläne: eingefroren. Nur Nachträge in plan_addenda.
CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES council_sessions(id),
    title TEXT NOT NULL,
    frozen_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS plans_no_update
BEFORE UPDATE ON plans
BEGIN SELECT RAISE(ABORT, 'Pläne sind eingefroren'); END;

CREATE TABLE IF NOT EXISTS plan_addenda (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('auswertung', 'nachbesprechung', 'notiz', 'szenario')),
    content_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS research (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('frage', 'briefing', 'analyse')),
    query TEXT NOT NULL,
    answer TEXT,
    sources_json TEXT NOT NULL DEFAULT '[]',
    provider TEXT,
    model TEXT,
    status TEXT NOT NULL DEFAULT 'laeuft',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_cache (
    ticker TEXT NOT NULL,
    day TEXT NOT NULL,
    close REAL NOT NULL,
    PRIMARY KEY (ticker, day)
);

CREATE TABLE IF NOT EXISTS price_fetch_log (
    ticker TEXT PRIMARY KEY,
    fetched_at TEXT NOT NULL
);

-- Produkt-Stammdaten (TER, Top-10 ...) mit Quelle und Datum.
CREATE TABLE IF NOT EXISTS product_facts (
    isin TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (isin, key)
);

CREATE TABLE IF NOT EXISTS llm_usage (
    day TEXT NOT NULL,
    provider TEXT NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, provider)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Hypothetische Portfolios: frei änderbar (im Gegensatz zu Plänen).
CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    startdatum TEXT NOT NULL,
    einmalbetrag REAL NOT NULL DEFAULT 0,
    sparrate REAL NOT NULL DEFAULT 0,
    positionen_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- KI-Begründungen zu Szenarien (und eigene Szenarien aus Freitext).
CREATE TABLE IF NOT EXISTS szenario_ki (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    eingabe_json TEXT NOT NULL,
    ergebnis_json TEXT,
    status TEXT NOT NULL DEFAULT 'laeuft',
    provider TEXT,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
