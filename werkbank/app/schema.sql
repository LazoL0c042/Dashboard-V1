-- Rohdaten: jede Eingabe (Sprache oder Text). Wird nie gelöscht.
CREATE TABLE IF NOT EXISTS entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    source      TEXT NOT NULL DEFAULT 'text',      -- shortcut | text
    raw_text    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'processed', -- processed | inbox | dismissed
    suggestion  TEXT                                -- JSON: vorgeschlagene Aktionen (Inbox)
);

CREATE TABLE IF NOT EXISTS thoughts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER REFERENCES entries(id),
    text        TEXT NOT NULL,
    category    TEXT,
    project     TEXT,
    tags        TEXT,                               -- kommagetrennt
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER REFERENCES entries(id),
    title       TEXT NOT NULL,
    project     TEXT,
    priority    INTEGER NOT NULL DEFAULT 2,         -- 1 hoch, 2 normal, 3 niedrig
    due_date    TEXT,                               -- YYYY-MM-DD
    done        INTEGER NOT NULL DEFAULT 0,
    done_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS week_plan (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER REFERENCES entries(id),
    date        TEXT NOT NULL,                      -- YYYY-MM-DD
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Checklisten: Definition (z. B. "Laufen", Kategorie Sport, 3x pro Woche)
CREATE TABLE IF NOT EXISTS habits (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL,                  -- Sport | Lernen | Arbeit | ...
    target_per_week INTEGER NOT NULL DEFAULT 3,
    active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS habit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER REFERENCES entries(id),
    habit_id    INTEGER NOT NULL REFERENCES habits(id),
    date        TEXT NOT NULL,
    amount      REAL,
    unit        TEXT,
    note        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS goals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL UNIQUE,
    target      REAL,
    unit        TEXT,
    deadline    TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS progress_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER REFERENCES entries(id),
    goal_id     INTEGER NOT NULL REFERENCES goals(id),
    value       REAL,
    note        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Protokoll jeder ausgeführten Aktion, Grundlage für "Rückgängig"
CREATE TABLE IF NOT EXISTS action_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id    INTEGER REFERENCES entries(id),
    action      TEXT NOT NULL,
    table_name  TEXT,
    row_id      INTEGER,
    summary     TEXT,
    undone      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Volltextsuche über Gedanken und ToDos (Kontext + Abfragen)
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    kind UNINDEXED, ref_id UNINDEXED, text, tokenize = 'unicode61 remove_diacritics 2'
);

-- ======================= VERMÖGEN =======================
-- Diese Tabellen verlassen NIE den Server (kein Versand an die Claude API).
CREATE TABLE IF NOT EXISTS portfolios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    broker      TEXT,
    note        TEXT
);

CREATE TABLE IF NOT EXISTS positions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id),
    name         TEXT NOT NULL,
    ticker       TEXT,                              -- Yahoo-Symbol, z. B. SAP.DE, BTC-EUR
    isin         TEXT,
    quantity     REAL NOT NULL,
    entry_price  REAL NOT NULL,                     -- in Positionswährung
    currency     TEXT NOT NULL DEFAULT 'EUR',
    asset_class  TEXT,                              -- Aktie | ETF | Krypto | Cash | Anleihe | Immobilie ...
    region       TEXT,
    bought_at    TEXT,
    manual_price REAL                               -- für Positionen ohne Kursquelle (Cash, Immobilie)
);

CREATE TABLE IF NOT EXISTS price_cache (
    symbol      TEXT PRIMARY KEY,                   -- Ticker oder FX-Paar wie USDEUR=X
    price       REAL NOT NULL,
    currency    TEXT,
    fetched_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    date        TEXT PRIMARY KEY,
    total       REAL NOT NULL,
    invested    REAL NOT NULL
);

-- Kostenkontrolle für die Claude API
CREATE TABLE IF NOT EXISTS llm_usage (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    model         TEXT,
    input_tokens  INTEGER,
    output_tokens INTEGER
);
