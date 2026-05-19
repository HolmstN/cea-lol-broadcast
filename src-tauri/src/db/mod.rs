pub mod commands;
mod models;
pub use models::*;

use rusqlite::{Connection, Result};
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn open(path: &std::path::Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        let _ = conn.execute("ALTER TABLE match_players ADD COLUMN role TEXT", []);
        let _ = conn.execute("ALTER TABLE players DROP COLUMN role", []);
        let _ = conn.execute("ALTER TABLE teams ADD COLUMN cea_entry_id TEXT", []);
        let _ = conn.execute("ALTER TABLE match_players ADD COLUMN game_number INTEGER NOT NULL DEFAULT 1", []);
        let _ = conn.execute("ALTER TABLE match_players ADD COLUMN cs INTEGER", []);
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS game_durations (
                match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                game_number  INTEGER NOT NULL DEFAULT 1,
                duration_sec INTEGER,
                PRIMARY KEY (match_id, game_number)
            );"
        );
        let _ = conn.execute("ALTER TABLE game_durations ADD COLUMN blue_team INTEGER", []);
        Ok(Self(Mutex::new(conn)))
    }
}

const SCHEMA: &str = "
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL UNIQUE,
    cea_entry_id TEXT
);

CREATE TABLE IF NOT EXISTS players (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    summoner_name TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    rank          TEXT,
    notes         TEXT,
    is_starter    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tournament_stats (
    player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    wins      INTEGER NOT NULL DEFAULT 0,
    losses    INTEGER NOT NULL DEFAULT 0,
    kills     INTEGER NOT NULL DEFAULT 0,
    deaths    INTEGER NOT NULL DEFAULT 0,
    assists   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS matches (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id TEXT    NOT NULL,
    cea_match_id   TEXT    NOT NULL,
    duration_sec   INTEGER,
    played_at      TEXT,
    UNIQUE(competition_id, cea_match_id)
);

CREATE TABLE IF NOT EXISTS match_players (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id      INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id     INTEGER REFERENCES players(id),
    summoner_name TEXT    NOT NULL,
    champion      TEXT,
    kills         INTEGER NOT NULL DEFAULT 0,
    deaths        INTEGER NOT NULL DEFAULT 0,
    assists       INTEGER NOT NULL DEFAULT 0,
    gold          INTEGER,
    cs            INTEGER,
    won           INTEGER NOT NULL DEFAULT 0,
    team          INTEGER NOT NULL DEFAULT 1,
    role          TEXT,
    game_number   INTEGER NOT NULL DEFAULT 1
);
";
