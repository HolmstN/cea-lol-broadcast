use super::{ChampionStat, Db, MatchEditGame, MatchEditInfo, Player, PlayerExtendedStats, Team, TeamRecord, TournamentStats};
use std::collections::HashMap;
use tauri::State;

// --- Teams ---

#[tauri::command]
pub fn get_teams(db: State<Db>) -> Result<Vec<Team>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, cea_entry_id FROM teams ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok(Team {
        id: row.get(0)?,
        name: row.get(1)?,
        cea_entry_id: row.get(2)?,
    }))
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string());
    rows
}

#[tauri::command]
pub fn create_team(db: State<Db>, name: String) -> Result<Team, String> {
    let conn = db.0.lock().unwrap();
    conn.execute("INSERT INTO teams (name) VALUES (?1)", [&name])
        .map_err(|e| e.to_string())?;
    Ok(Team { id: conn.last_insert_rowid(), name, cea_entry_id: None })
}

/// Upsert a team from a competition import — creates if not exists, always sets cea_entry_id.
#[tauri::command]
pub fn import_competition_team(db: State<Db>, name: String, cea_entry_id: String) -> Result<Team, String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO teams (name, cea_entry_id) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET cea_entry_id = excluded.cea_entry_id",
        rusqlite::params![name, cea_entry_id],
    ).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, cea_entry_id FROM teams WHERE name = ?1",
        [&name],
        |row| Ok(Team { id: row.get(0)?, name: row.get(1)?, cea_entry_id: row.get(2)? }),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_team(db: State<Db>, id: i64, name: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("UPDATE teams SET name = ?1 WHERE id = ?2", rusqlite::params![name, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_team(db: State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM teams WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Players ---

#[tauri::command]
pub fn get_players(db: State<Db>, team_id: i64) -> Result<Vec<Player>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, team_id, summoner_name, display_name, rank, notes, is_starter
             FROM players WHERE team_id = ?1 ORDER BY is_starter DESC, display_name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([team_id], |row| {
        Ok(Player {
            id: row.get(0)?,
            team_id: row.get(1)?,
            summoner_name: row.get(2)?,
            display_name: row.get(3)?,
            rank: row.get(4)?,
            notes: row.get(5)?,
            is_starter: row.get::<_, i64>(6)? != 0,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string());
    rows
}

#[tauri::command]
pub fn create_player(
    db: State<Db>,
    team_id: i64,
    summoner_name: String,
    display_name: String,
    rank: Option<String>,
    notes: Option<String>,
    is_starter: bool,
) -> Result<Player, String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO players (team_id, summoner_name, display_name, rank, notes, is_starter)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![team_id, summoner_name, display_name, rank, notes, is_starter as i64],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.execute("INSERT INTO tournament_stats (player_id) VALUES (?1)", [id])
        .map_err(|e| e.to_string())?;
    Ok(Player { id, team_id, summoner_name, display_name, rank, notes, is_starter })
}

#[tauri::command]
pub fn update_player(
    db: State<Db>,
    id: i64,
    summoner_name: String,
    display_name: String,
    rank: Option<String>,
    notes: Option<String>,
    is_starter: bool,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE players
         SET summoner_name=?1, display_name=?2, rank=?3, notes=?4, is_starter=?5
         WHERE id=?6",
        rusqlite::params![summoner_name, display_name, rank, notes, is_starter as i64, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_player(db: State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM players WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Stats ---

#[tauri::command]
pub fn get_player_stats(db: State<Db>, player_id: i64) -> Result<TournamentStats, String> {
    let conn = db.0.lock().unwrap();
    conn.query_row(
        "SELECT player_id, wins, losses, kills, deaths, assists
         FROM tournament_stats WHERE player_id = ?1",
        [player_id],
        |row| Ok(TournamentStats {
            player_id: row.get(0)?,
            wins: row.get(1)?,
            losses: row.get(2)?,
            kills: row.get(3)?,
            deaths: row.get(4)?,
            assists: row.get(5)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_team_stats(db: State<Db>, team_id: i64) -> Result<Vec<TournamentStats>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT ts.player_id, ts.wins, ts.losses, ts.kills, ts.deaths, ts.assists
             FROM tournament_stats ts
             JOIN players p ON p.id = ts.player_id
             WHERE p.team_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([team_id], |row| {
        Ok(TournamentStats {
            player_id: row.get(0)?,
            wins: row.get(1)?,
            losses: row.get(2)?,
            kills: row.get(3)?,
            deaths: row.get(4)?,
            assists: row.get(5)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string());
    rows
}

// --- All players (for LCU roster matching) ---

#[tauri::command]
pub fn get_all_players(db: State<Db>) -> Result<Vec<Player>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, team_id, summoner_name, display_name, rank, notes, is_starter
             FROM players ORDER BY team_id, is_starter DESC, display_name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(Player {
            id: row.get(0)?,
            team_id: row.get(1)?,
            summoner_name: row.get(2)?,
            display_name: row.get(3)?,
            rank: row.get(4)?,
            notes: row.get(5)?,
            is_starter: row.get::<_, i64>(6)? != 0,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string());
    rows
}

// --- Stats mutations ---

#[tauri::command]
pub fn update_player_stats(
    db: State<Db>,
    player_id: i64,
    wins: i64,
    losses: i64,
    kills: i64,
    deaths: i64,
    assists: i64,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE tournament_stats SET wins=?1, losses=?2, kills=?3, deaths=?4, assists=?5 WHERE player_id=?6",
        rusqlite::params![wins, losses, kills, deaths, assists, player_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reset_player_stats(db: State<Db>, player_id: i64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE tournament_stats SET wins=0, losses=0, kills=0, deaths=0, assists=0 WHERE player_id=?1",
        [player_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Rank update (from Riot API) ---

#[tauri::command]
pub fn update_player_rank(db: State<Db>, id: i64, rank: Option<String>) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute("UPDATE players SET rank = ?1 WHERE id = ?2", rusqlite::params![rank, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Team Record (aggregate) ---

#[tauri::command]
pub fn get_team_record(db: State<Db>, team_id: i64) -> Result<TeamRecord, String> {
    let conn = db.0.lock().unwrap();
    conn.query_row(
        "SELECT COALESCE(SUM(ts.wins), 0), COALESCE(SUM(ts.losses), 0)
         FROM tournament_stats ts
         JOIN players p ON p.id = ts.player_id
         WHERE p.team_id = ?1 AND p.is_starter = 1",
        [team_id],
        |row| Ok(TeamRecord { wins: row.get(0)?, losses: row.get(1)? }),
    )
    .map_err(|e| e.to_string())
}

// --- CSV helpers ---

fn csv_field(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn csv_export_path(filename: &str) -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("cea-lol-broadcast")
        .join(filename)
}

fn reveal_in_explorer(path: &std::path::Path) {
    let dir = path.parent().unwrap_or(path);
    #[cfg(target_os = "windows")]
    { let _ = std::process::Command::new("explorer").arg(dir).spawn(); }
    #[cfg(target_os = "macos")]
    { let _ = std::process::Command::new("open").arg(dir).spawn(); }
    #[cfg(target_os = "linux")]
    { let _ = std::process::Command::new("xdg-open").arg(dir).spawn(); }
}

fn parse_csv_row(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in line.chars() {
        match ch {
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => { fields.push(std::mem::take(&mut current)); }
            _ => current.push(ch),
        }
    }
    fields.push(current);
    fields.into_iter().map(|s| s.trim().to_string()).collect()
}

// --- Match import/export ---

fn default_game_number() -> i64 { 1 }

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchPlayerInput {
    pub player_id:     Option<i64>,
    pub summoner_name: String,
    pub role:          Option<String>,
    pub champion:      Option<String>,
    pub kills:         i64,
    pub deaths:        i64,
    pub assists:       i64,
    pub gold:          Option<i64>,
    pub cs:            Option<i64>,
    pub won:           bool,
    pub team:          i64,
    #[serde(default = "default_game_number")]
    pub game_number:   i64,
}

#[tauri::command]
pub fn get_imported_match_ids(
    db: State<Db>,
    competition_id: String,
) -> Result<Vec<String>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT cea_match_id FROM matches WHERE competition_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([&competition_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

#[tauri::command]
pub fn save_match(
    db: State<Db>,
    competition_id: String,
    cea_match_id:   String,
    duration_sec:   Option<i64>,
    played_at:      Option<String>,
    players:        Vec<MatchPlayerInput>,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO matches (competition_id, cea_match_id, duration_sec, played_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![competition_id, cea_match_id, duration_sec, played_at],
    )
    .map_err(|e| e.to_string())?;
    let match_id = conn.last_insert_rowid();

    for p in &players {
        conn.execute(
            "INSERT INTO match_players
             (match_id, player_id, summoner_name, role, champion, kills, deaths, assists, gold, cs, won, team, game_number)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
            rusqlite::params![
                match_id, p.player_id, p.summoner_name, p.role, p.champion,
                p.kills, p.deaths, p.assists, p.gold, p.cs,
                p.won as i64, p.team, p.game_number
            ],
        )
        .map_err(|e| e.to_string())?;

        if let Some(pid) = p.player_id {
            conn.execute(
                "UPDATE tournament_stats SET
                    wins    = wins    + ?1,
                    losses  = losses  + ?2,
                    kills   = kills   + ?3,
                    deaths  = deaths  + ?4,
                    assists = assists + ?5
                 WHERE player_id = ?6",
                rusqlite::params![
                    p.won as i64,
                    (!p.won) as i64,
                    p.kills, p.deaths, p.assists,
                    pid
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn export_matches_csv(db: State<Db>, competition_id: String) -> Result<String, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT m.cea_match_id, mp.game_number, mp.team, mp.summoner_name,
                mp.champion, mp.role, mp.kills, mp.deaths, mp.assists, mp.cs, mp.gold, mp.won
         FROM match_players mp
         JOIN matches m ON m.id = mp.match_id
         WHERE m.competition_id = ?1
         ORDER BY CAST(m.cea_match_id AS INTEGER), mp.game_number, mp.team, mp.id",
    ).map_err(|e| e.to_string())?;

    let mut out = String::from("match_id,game_number,team,summoner_name,champion,role,kills,deaths,assists,cs,gold,won\n");
    let rows = stmt.query_map([&competition_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, i64>(8)?,
            row.get::<_, Option<i64>>(9)?,
            row.get::<_, Option<i64>>(10)?,
            row.get::<_, i64>(11)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in rows {
        let (mid, gn, team, summoner, champion, role, k, d, a, cs, gold, won) =
            row.map_err(|e| e.to_string())?;
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{},{},{}\n",
            mid, gn, team,
            csv_field(&summoner),
            csv_field(champion.as_deref().unwrap_or("")),
            csv_field(role.as_deref().unwrap_or("")),
            k, d, a,
            cs.map(|c| c.to_string()).unwrap_or_default(),
            gold.map(|g| g.to_string()).unwrap_or_default(),
            won,
        ));
    }
    let path = csv_export_path(&format!("matches_{}.csv", competition_id));
    std::fs::write(&path, &out).map_err(|e| e.to_string())?;
    reveal_in_explorer(&path);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_csv_template(match_ids: Vec<String>) -> Result<String, String> {
    let mut rows = vec![
        "match_id,game_number,team,summoner_name,champion,role,kills,deaths,assists,cs,gold,won".to_string(),
    ];
    for mid in &match_ids {
        for team in 1..=2i64 {
            for _ in 0..5 {
                rows.push(format!("{},1,{},,,,,,,,,", mid, team));
            }
        }
    }
    let path = csv_export_path("matches_template.csv");
    std::fs::write(&path, rows.join("\n")).map_err(|e| e.to_string())?;
    reveal_in_explorer(&path);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_matches_csv(
    db: State<Db>,
    competition_id: String,
    csv: String,
    overwrite: bool,
) -> Result<Vec<String>, String> {
    #[allow(dead_code)]
    struct Row {
        match_id: String, game_number: i64, team: i64, summoner_name: String,
        champion: Option<String>, role: Option<String>,
        kills: i64, deaths: i64, assists: i64, cs: Option<i64>, gold: Option<i64>, won: bool,
    }

    let mut lines = csv.lines();
    let header = lines.next().ok_or("Empty CSV")?;
    let cols: Vec<String> = header.split(',').map(|s| s.trim().to_lowercase()).collect();
    let col = |name: &str| -> Result<usize, String> {
        cols.iter().position(|c| c == name)
            .ok_or_else(|| format!("Missing column '{name}'"))
    };
    let (im, ig, it, is_, ic, ir, ik, id, ia, ics, igo, iw) = (
        col("match_id")?, col("game_number")?, col("team")?, col("summoner_name")?,
        col("champion")?, col("role")?,
        col("kills")?, col("deaths")?, col("assists")?, col("cs")?, col("gold")?, col("won")?,
    );

    let mut match_map: std::collections::HashMap<String, Vec<Row>> = std::collections::HashMap::new();
    for line in lines {
        let line = line.trim();
        if line.is_empty() { continue; }
        let f = parse_csv_row(line);
        let g = |i: usize| f.get(i).map(|s| s.as_str()).unwrap_or("").to_string();
        let summoner = g(is_);
        let match_id = g(im);
        if summoner.is_empty() || match_id.is_empty() { continue; }
        let won_s = g(iw).to_lowercase();
        match_map.entry(match_id.clone()).or_default().push(Row {
            match_id,
            game_number: g(ig).parse().unwrap_or(1),
            team:        g(it).parse().unwrap_or(1),
            summoner_name: summoner,
            champion: { let s = g(ic); if s.is_empty() { None } else { Some(s) } },
            role:     { let s = g(ir); if s.is_empty() { None } else { Some(s) } },
            kills:   g(ik).parse().unwrap_or(0),
            deaths:  g(id).parse().unwrap_or(0),
            assists: g(ia).parse().unwrap_or(0),
            cs:      g(ics).parse().ok(),
            gold:    g(igo).parse().ok(),
            won: won_s == "1" || won_s == "true" || won_s == "yes",
        });
    }

    if match_map.is_empty() {
        return Err("No valid rows found".into());
    }

    let conn = db.0.lock().unwrap();
    let mut log = Vec::new();
    let mut ids: Vec<String> = match_map.keys().cloned().collect();
    ids.sort_by(|a, b| a.parse::<i64>().unwrap_or(0).cmp(&b.parse::<i64>().unwrap_or(0)));

    for match_id in ids {
        let rows = &match_map[&match_id];
        let existing_id: Option<i64> = conn.query_row(
            "SELECT id FROM matches WHERE competition_id=?1 AND cea_match_id=?2",
            rusqlite::params![competition_id, match_id],
            |r| r.get(0),
        ).ok();

        if let Some(old_db_id) = existing_id {
            if !overwrite {
                log.push(format!("Match {match_id}: skipped (already imported)"));
                continue;
            }
            // Reverse tournament_stats for every linked player, then delete the match
            struct OldRow { pid: i64, won: bool, k: i64, d: i64, a: i64 }
            let mut s = conn.prepare(
                "SELECT player_id, won, kills, deaths, assists
                 FROM match_players WHERE match_id = ?1 AND player_id IS NOT NULL"
            ).map_err(|e| format!("Match {match_id}: {e}"))?;
            let old_rows: Vec<OldRow> = s.query_map([old_db_id], |r| Ok(OldRow {
                pid: r.get(0)?,
                won: r.get::<_, i64>(1)? != 0,
                k: r.get(2)?, d: r.get(3)?, a: r.get(4)?,
            })).map_err(|e| format!("Match {match_id}: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Match {match_id}: {e}"))?;

            for r in &old_rows {
                conn.execute(
                    "UPDATE tournament_stats SET
                        wins=wins-?1, losses=losses-?2,
                        kills=kills-?3, deaths=deaths-?4, assists=assists-?5
                     WHERE player_id=?6",
                    rusqlite::params![r.won as i64, (!r.won) as i64, r.k, r.d, r.a, r.pid],
                ).map_err(|e| format!("Match {match_id} stat reversal: {e}"))?;
            }
            conn.execute("DELETE FROM matches WHERE id=?1", [old_db_id])
                .map_err(|e| format!("Match {match_id}: {e}"))?;
        }

        conn.execute(
            "INSERT INTO matches (competition_id, cea_match_id) VALUES (?1, ?2)",
            rusqlite::params![competition_id, match_id],
        ).map_err(|e| format!("Match {match_id}: {e}"))?;
        let db_match_id = conn.last_insert_rowid();

        for row in rows {
            let pid: Option<i64> = conn.query_row(
                "SELECT id FROM players WHERE LOWER(summoner_name)=LOWER(?1) LIMIT 1",
                [&row.summoner_name], |r| r.get(0),
            ).ok();

            conn.execute(
                "INSERT INTO match_players
                 (match_id, player_id, summoner_name, role, champion, kills, deaths, assists, cs, gold, won, team, game_number)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
                rusqlite::params![
                    db_match_id, pid, row.summoner_name, row.role, row.champion,
                    row.kills, row.deaths, row.assists, row.cs, row.gold,
                    row.won as i64, row.team, row.game_number
                ],
            ).map_err(|e| format!("Match {match_id} row: {e}"))?;

            if let Some(pid) = pid {
                conn.execute(
                    "UPDATE tournament_stats SET wins=wins+?1, losses=losses+?2, kills=kills+?3, deaths=deaths+?4, assists=assists+?5 WHERE player_id=?6",
                    rusqlite::params![row.won as i64, (!row.won) as i64, row.kills, row.deaths, row.assists, pid],
                ).map_err(|e| format!("Stats {match_id}: {e}"))?;
            }
        }
        let action = if existing_id.is_some() { "overwritten" } else { "imported" };
        log.push(format!("Match {match_id}: {action} {} rows", rows.len()));
    }
    Ok(log)
}

// --- Extended per-player stats from match_players ---

#[tauri::command]
pub fn get_player_extended_stats(db: State<Db>, player_id: i64) -> Result<PlayerExtendedStats, String> {
    let conn = db.0.lock().unwrap();

    let (game_wins, game_losses, total_kills, total_deaths, total_assists,
         total_cs, cs_duration_sec, total_gold, gold_duration_sec): (i64,i64,i64,i64,i64,i64,i64,i64,i64) =
    conn.query_row(
        "SELECT
            COALESCE(SUM(mp.won), 0),
            COALESCE(SUM(1 - mp.won), 0),
            COALESCE(SUM(mp.kills), 0),
            COALESCE(SUM(mp.deaths), 0),
            COALESCE(SUM(mp.assists), 0),
            COALESCE(SUM(CASE WHEN gd.duration_sec IS NOT NULL AND mp.cs IS NOT NULL THEN mp.cs ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN gd.duration_sec IS NOT NULL AND mp.cs IS NOT NULL THEN gd.duration_sec ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN gd.duration_sec IS NOT NULL AND mp.gold IS NOT NULL THEN mp.gold ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN gd.duration_sec IS NOT NULL AND mp.gold IS NOT NULL THEN gd.duration_sec ELSE 0 END), 0)
         FROM match_players mp
         LEFT JOIN game_durations gd ON gd.match_id = mp.match_id AND gd.game_number = mp.game_number
         WHERE mp.player_id = ?1",
        [player_id],
        |row| Ok((
            row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?,
            row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
        )),
    ).map_err(|e| e.to_string())?;

    let (match_wins, match_losses): (i64, i64) = conn.query_row(
        "SELECT
            COALESCE(SUM(CASE WHEN gw > gl THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN gw <= gl THEN 1 ELSE 0 END), 0)
         FROM (
            SELECT SUM(won) as gw, SUM(1-won) as gl
            FROM match_players WHERE player_id = ?1 GROUP BY match_id
         )",
        [player_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    Ok(PlayerExtendedStats {
        player_id, game_wins, game_losses,
        total_kills, total_deaths, total_assists,
        total_cs, cs_duration_sec, total_gold, gold_duration_sec,
        match_wins, match_losses,
    })
}

#[tauri::command]
pub fn get_player_champion_stats(
    db: State<Db>,
    player_id: i64,
    limit: Option<i64>,
    role: Option<String>,
) -> Result<Vec<ChampionStat>, String> {
    let conn = db.0.lock().unwrap();
    let lim = limit.unwrap_or(5);
    // ?3 IS NULL → no role filter; otherwise case-insensitive match on stored role
    let mut stmt = conn.prepare(
        "SELECT champion,
                COUNT(*) as games,
                COALESCE(SUM(won), 0) as wins,
                COALESCE(SUM(1-won), 0) as losses,
                COALESCE(SUM(kills), 0) as kills,
                COALESCE(SUM(deaths), 0) as deaths,
                COALESCE(SUM(assists), 0) as assists
         FROM match_players
         WHERE player_id = ?1 AND champion IS NOT NULL AND champion != ''
         AND (?3 IS NULL OR LOWER(role) = LOWER(?3))
         GROUP BY champion
         ORDER BY games DESC, wins DESC
         LIMIT ?2",
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(rusqlite::params![player_id, lim, role], |row| {
        Ok(ChampionStat {
            champion: row.get(0)?,
            games:    row.get(1)?,
            wins:     row.get(2)?,
            losses:   row.get(3)?,
            kills:    row.get(4)?,
            deaths:   row.get(5)?,
            assists:  row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string());
    rows
}

#[tauri::command]
pub fn get_matches_for_edit(db: State<Db>, competition_id: String) -> Result<Vec<MatchEditInfo>, String> {
    struct FlatRow {
        match_id: i64,
        cea_match_id: String,
        played_at: Option<String>,
        game_number: i64,
        duration_sec: Option<i64>,
        blue_team: Option<i64>,
        team1_name: Option<String>,
        team2_name: Option<String>,
        team1_champ: Option<String>,
        team2_champ: Option<String>,
    }

    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT m.id, m.cea_match_id, m.played_at,
                games.game_number,
                gd.duration_sec, gd.blue_team,
                (SELECT t.name FROM match_players mp2
                 JOIN players p2 ON p2.id = mp2.player_id
                 JOIN teams t ON t.id = p2.team_id
                 WHERE mp2.match_id = m.id AND mp2.team = 1 AND mp2.player_id IS NOT NULL
                 LIMIT 1) as team1_name,
                (SELECT t.name FROM match_players mp2
                 JOIN players p2 ON p2.id = mp2.player_id
                 JOIN teams t ON t.id = p2.team_id
                 WHERE mp2.match_id = m.id AND mp2.team = 2 AND mp2.player_id IS NOT NULL
                 LIMIT 1) as team2_name,
                (SELECT champion FROM match_players
                 WHERE match_id = m.id AND game_number = games.game_number AND team = 1
                 AND champion IS NOT NULL AND champion != ''
                 LIMIT 1) as team1_champ,
                (SELECT champion FROM match_players
                 WHERE match_id = m.id AND game_number = games.game_number AND team = 2
                 AND champion IS NOT NULL AND champion != ''
                 LIMIT 1) as team2_champ
         FROM matches m
         JOIN (SELECT DISTINCT match_id, game_number FROM match_players) games ON games.match_id = m.id
         LEFT JOIN game_durations gd ON gd.match_id = m.id AND gd.game_number = games.game_number
         WHERE m.competition_id = ?1
         ORDER BY CAST(m.cea_match_id AS INTEGER), games.game_number",
    ).map_err(|e| e.to_string())?;

    let flat_rows: Vec<FlatRow> = stmt.query_map([&competition_id], |row| {
        Ok(FlatRow {
            match_id:     row.get(0)?,
            cea_match_id: row.get(1)?,
            played_at:    row.get(2)?,
            game_number:  row.get(3)?,
            duration_sec: row.get(4)?,
            blue_team:    row.get(5)?,
            team1_name:   row.get(6)?,
            team2_name:   row.get(7)?,
            team1_champ:  row.get(8)?,
            team2_champ:  row.get(9)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    let mut result: Vec<MatchEditInfo> = Vec::new();
    let mut match_indices: HashMap<i64, usize> = HashMap::new();
    for flat in flat_rows {
        let game = MatchEditGame {
            game_number:  flat.game_number,
            duration_sec: flat.duration_sec,
            blue_team:    flat.blue_team,
            team1_champ:  flat.team1_champ,
            team2_champ:  flat.team2_champ,
        };
        if let Some(&idx) = match_indices.get(&flat.match_id) {
            result[idx].games.push(game);
        } else {
            let idx = result.len();
            match_indices.insert(flat.match_id, idx);
            result.push(MatchEditInfo {
                match_id:     flat.match_id,
                cea_match_id: flat.cea_match_id,
                played_at:    flat.played_at,
                team1_name:   flat.team1_name,
                team2_name:   flat.team2_name,
                games:        vec![game],
            });
        }
    }
    Ok(result)
}

// --- Backfill unlinked match_players rows ---

#[tauri::command]
pub fn backfill_player_links(db: State<Db>) -> Result<String, String> {
    let conn = db.0.lock().unwrap();

    // Find all distinct summoner names that have unlinked rows
    let mut unlinked_stmt = conn.prepare(
        "SELECT DISTINCT summoner_name FROM match_players WHERE player_id IS NULL"
    ).map_err(|e| e.to_string())?;

    let names: Vec<String> = unlinked_stmt.query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut linked = 0usize;
    let mut skipped = 0usize;

    for name in &names {
        let pid: Option<i64> = conn.query_row(
            "SELECT id FROM players WHERE LOWER(summoner_name) = LOWER(?1) LIMIT 1",
            [name], |r| r.get(0),
        ).ok();

        match pid {
            Some(pid) => {
                let rows = conn.execute(
                    "UPDATE match_players SET player_id = ?1 WHERE player_id IS NULL AND LOWER(summoner_name) = LOWER(?2)",
                    rusqlite::params![pid, name],
                ).map_err(|e| e.to_string())?;
                linked += rows;
            }
            None => { skipped += 1; }
        }
    }

    Ok(format!("Linked {linked} row(s) across {} name(s); {skipped} name(s) not found in roster", names.len() - skipped))
}

// --- Game metadata CSV (separate from player CSV) ---

#[tauri::command]
pub fn export_game_metadata_csv(db: State<Db>, competition_id: String) -> Result<String, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT DISTINCT m.cea_match_id, mp.game_number,
                gd.duration_sec, gd.blue_team
         FROM matches m
         JOIN match_players mp ON mp.match_id = m.id
         LEFT JOIN game_durations gd ON gd.match_id = m.id AND gd.game_number = mp.game_number
         WHERE m.competition_id = ?1
         ORDER BY CAST(m.cea_match_id AS INTEGER), mp.game_number",
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([&competition_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, Option<i64>>(2)?,
            row.get::<_, Option<i64>>(3)?,
        ))
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        return Err("No imported matches found for this competition".into());
    }

    let mut out = String::from("match_id,game_number,duration_sec,blue_team\n");
    for (mid, gn, dur, blue) in &rows {
        out.push_str(&format!(
            "{},{},{},{}\n",
            mid, gn,
            dur.map(|d| d.to_string()).unwrap_or_default(),
            blue.map(|b| b.to_string()).unwrap_or_default(),
        ));
    }

    let path = csv_export_path(&format!("game_metadata_{}.csv", competition_id));
    std::fs::write(&path, &out).map_err(|e| e.to_string())?;
    reveal_in_explorer(&path);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_game_metadata_csv(
    db: State<Db>,
    competition_id: String,
    csv: String,
) -> Result<Vec<String>, String> {
    let mut lines = csv.lines();
    let header = lines.next().ok_or("Empty CSV")?;
    let cols: Vec<String> = header.split(',').map(|s| s.trim().to_lowercase()).collect();
    let col = |name: &str| -> Result<usize, String> {
        cols.iter().position(|c| c == name)
            .ok_or_else(|| format!("Missing column '{name}'"))
    };
    let (im, ig, id, ib) = (
        col("match_id")?, col("game_number")?, col("duration_sec")?, col("blue_team")?,
    );

    let conn = db.0.lock().unwrap();
    let mut log = Vec::new();

    for line in lines {
        let line = line.trim();
        if line.is_empty() { continue; }
        let f = parse_csv_row(line);
        let g = |i: usize| f.get(i).map(|s| s.as_str()).unwrap_or("").to_string();

        let match_id = g(im);
        let game_number: i64 = g(ig).parse().unwrap_or(1);
        if match_id.is_empty() { continue; }

        let dur_raw = g(id);
        let duration_sec: Option<i64> = if dur_raw.is_empty() {
            None
        } else if let Ok(n) = dur_raw.parse::<i64>() {
            Some(n)
        } else {
            let parts: Vec<&str> = dur_raw.splitn(2, ':').collect();
            if parts.len() == 2 {
                match (parts[0].parse::<i64>(), parts[1].parse::<i64>()) {
                    (Ok(m), Ok(s)) => Some(m * 60 + s),
                    _ => {
                        log.push(format!("Match {match_id} G{game_number}: invalid duration '{dur_raw}', skipped"));
                        continue;
                    }
                }
            } else {
                log.push(format!("Match {match_id} G{game_number}: invalid duration '{dur_raw}', skipped"));
                continue;
            }
        };

        let blue_raw = g(ib);
        let blue_team: Option<i64> = if blue_raw.is_empty() { None } else { blue_raw.parse().ok() };

        let db_match_id: Option<i64> = conn.query_row(
            "SELECT id FROM matches WHERE competition_id=?1 AND cea_match_id=?2",
            rusqlite::params![competition_id, match_id],
            |r| r.get(0),
        ).ok();

        let Some(db_match_id) = db_match_id else {
            log.push(format!("Match {match_id}: not in DB, skipped"));
            continue;
        };

        conn.execute(
            "INSERT INTO game_durations (match_id, game_number, duration_sec, blue_team)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(match_id, game_number) DO UPDATE SET
                 duration_sec = excluded.duration_sec,
                 blue_team    = excluded.blue_team",
            rusqlite::params![db_match_id, game_number, duration_sec, blue_team],
        ).map_err(|e| format!("Match {match_id} G{game_number}: {e}"))?;

        log.push(format!("Match {match_id} G{game_number}: updated"));
    }

    if log.is_empty() {
        return Err("No valid rows found".into());
    }
    Ok(log)
}

// --- update_game_metadata ---

#[tauri::command]
pub fn update_game_metadata(
    db: State<Db>,
    match_id: i64,
    game_number: i64,
    duration_sec: Option<i64>,
    blue_team: Option<i64>,
) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO game_durations (match_id, game_number, duration_sec, blue_team)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(match_id, game_number) DO UPDATE SET
             duration_sec = excluded.duration_sec,
             blue_team    = excluded.blue_team",
        rusqlite::params![match_id, game_number, duration_sec, blue_team],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
