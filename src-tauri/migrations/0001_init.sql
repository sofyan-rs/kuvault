CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('steam', 'epic', 'manual', 'emulator')),
    executable_path TEXT NOT NULL,
    launch_args TEXT,
    install_dir TEXT,
    source_id TEXT,
    cover_url TEXT,
    genres TEXT,
    description TEXT,
    playtime_seconds INTEGER NOT NULL DEFAULT 0,
    last_played_at TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    installed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_games_source ON games (platform, source_id) WHERE source_id IS NOT NULL;

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
