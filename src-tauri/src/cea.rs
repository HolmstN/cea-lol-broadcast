use reqwest::Client;
use std::sync::OnceLock;

fn authed(url: &str, token: &Option<String>) -> reqwest::RequestBuilder {
    let req = client().get(url);
    match token.as_deref().filter(|t| !t.is_empty()) {
        Some(t) => req.bearer_auth(t),
        None    => req,
    }
}

fn client() -> &'static Client {
    static C: OnceLock<Client> = OnceLock::new();
    C.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap()
    })
}

async fn decode_json<T: serde::de::DeserializeOwned>(resp: reqwest::Response) -> Result<T, String> {
    let status = resp.status();
    let bytes  = resp.bytes().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, String::from_utf8_lossy(&bytes)));
    }
    serde_json::from_slice(&bytes).map_err(|e| {
        format!("{e}\nRaw: {}", String::from_utf8_lossy(&bytes))
    })
}

// ── Settings ──────────────────────────────────────────────────────────────────

fn cea_config_path() -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("cea-lol-broadcast")
        .join("cea_config.json")
}

#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CeaSettings {
    pub competition_id: String,
    #[serde(default)]
    pub entry_ids: Vec<String>,
    #[serde(default)]
    pub auth_token: Option<String>,
}

fn load_settings() -> CeaSettings {
    std::fs::read_to_string(cea_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_settings(s: &CeaSettings) -> Result<(), String> {
    let json = serde_json::to_string(s).map_err(|e| e.to_string())?;
    std::fs::write(cea_config_path(), json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_cea_settings() -> Result<CeaSettings, String> {
    Ok(load_settings())
}

#[tauri::command]
pub async fn save_cea_settings(competition_id: String, entry_ids: Vec<String>) -> Result<(), String> {
    let mut s = load_settings();
    s.competition_id = competition_id;
    s.entry_ids = entry_ids;
    save_settings(&s)
}

#[tauri::command]
pub async fn save_cea_auth_token(token: Option<String>) -> Result<(), String> {
    let mut s = load_settings();
    s.auth_token = token.filter(|t| !t.trim().is_empty());
    save_settings(&s)
}

// ── Roster ────────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct RosterResp  { content: Vec<serde_json::Value> }
#[derive(serde::Deserialize)]
struct UserProfile { name: String }

// For the /user/{uid}/contact-accounts response: {"content": [...]}
fn find_summoner_in_accounts(val: &serde_json::Value) -> Option<String> {
    let arr = val["content"].as_array()?;
    find_summoner_in_array(arr)
}

// For inline contactAccounts arrays in roster entries: [...]
fn find_summoner_in_array(arr: &[serde_json::Value]) -> Option<String> {
    arr.iter()
        .filter(|e| e["network"].as_str().map(|n| n.starts_with("RIOT")).unwrap_or(false))
        .find_map(|e| e["handle"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string()))
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CeaImportPlayer {
    pub name:          String,
    pub summoner_name: Option<String>,
    pub is_starter:    bool,
}

struct RosterPlayerFull {
    cea_name:      String,
    summoner_name: String,
    is_starter:    bool,
}

async fn fetch_roster_full(entry_id: u64, token: &Option<String>) -> Result<Vec<RosterPlayerFull>, String> {
    let roster: RosterResp = decode_json(
        authed(&format!("https://api.app.playcea.com/competition/entry/{}/_view/roster", entry_id), token)
            .send().await.map_err(|e| format!("Request failed: {e}"))?
    ).await?;

    // Extract uid, starter flag, and any inline Riot handle from the roster entry itself.
    // The roster endpoint returns contactAccounts as a plain array when fetched with auth.
    let entries: Vec<(u64, bool, Option<String>)> = roster.content.iter()
        .filter(|e| e["player"].as_bool().unwrap_or(false))
        .filter_map(|e| {
            let uid      = e["user"]["id"].as_u64()?;
            let starter  = !e["substitute"].as_bool().unwrap_or(false);
            let inline   = e["contactAccounts"].as_array().and_then(|a| find_summoner_in_array(a));
            Some((uid, starter, inline))
        })
        .collect();

    if entries.is_empty() {
        return Err("No players found on this roster.".into());
    }

    let futs = entries.into_iter().map(|(uid, starter, inline_summoner)| async move {
        let profile: UserProfile = decode_json(
            authed(&format!("https://api.app.playcea.com/user/{uid}"), token)
                .send().await.map_err(|e| format!("user {uid}: {e}"))?
        ).await.map_err(|e| format!("parse user {uid}: {e}"))?;

        let summoner_name = if let Some(s) = inline_summoner {
            // Roster already included the Riot handle — no extra round-trip needed.
            s
        } else {
            // Fall back to the separate contact-accounts endpoint.
            let contacts: Option<serde_json::Value> = async {
                let resp = authed(&format!("https://api.app.playcea.com/user/{uid}/contact-accounts"), token)
                    .send().await.ok()?;
                decode_json(resp).await.ok()
            }.await;
            contacts.as_ref()
                .and_then(find_summoner_in_accounts)
                .unwrap_or_else(|| profile.name.clone())
        };

        Ok::<RosterPlayerFull, String>(
            RosterPlayerFull { cea_name: profile.name, summoner_name, is_starter: starter }
        )
    });

    let results: Vec<_> = futures_util::future::join_all(futs).await;
    let mut players = Vec::new();
    let mut errors  = Vec::new();
    for r in results {
        match r { Ok(p) => players.push(p), Err(e) => errors.push(e) }
    }
    if players.is_empty() { return Err(errors.join("; ")); }
    if !errors.is_empty() { eprintln!("[CEA] Partial errors: {}", errors.join("; ")); }
    Ok(players)
}

#[tauri::command]
pub async fn fetch_cea_roster(cea_team_id: u64) -> Result<Vec<CeaImportPlayer>, String> {
    let token = load_settings().auth_token;
    let players = fetch_roster_full(cea_team_id, &token).await?;
    Ok(players.into_iter().map(|p| CeaImportPlayer {
        name:          p.cea_name,
        summoner_name: if p.summoner_name.is_empty() { None } else { Some(p.summoner_name) },
        is_starter:    p.is_starter,
    }).collect())
}

#[tauri::command]
pub async fn sync_competition_rosters(
    db: tauri::State<'_, crate::db::Db>,
    competition_id: String,
) -> Result<Vec<String>, String> {
    let settings = load_settings();
    let token = &settings.auth_token;
    let resp: EntryListResp = decode_json(
        authed(&format!(
            "https://api.app.playcea.com/competition/entry/document?competitionId={}&page=0&size=100&sort=seed",
            competition_id
        ), token)
        .send().await.map_err(|e| format!("Request failed: {e}"))?
    ).await.map_err(|e| format!("Entry list: {e}"))?;

    let mut log = Vec::new();

    for entry in &resp.content {
        let entry_id_str = entry.id.to_string();
        let team_name    = &entry.alternate_name;

        // Find matching team by cea_entry_id (already linked) or name (legacy)
        let team_id: Option<i64> = {
            use rusqlite::OptionalExtension;
            let conn = db.0.lock().unwrap();
            conn.query_row(
                "SELECT id FROM teams WHERE cea_entry_id = ?1 OR name = ?2 LIMIT 1",
                rusqlite::params![entry_id_str, team_name],
                |row| row.get(0),
            ).optional().unwrap_or(None)
        };

        let Some(team_id) = team_id else {
            log.push(format!("Skipped: {} (not in DB)", team_name));
            continue;
        };

        let roster = match fetch_roster_full(entry.id, token).await {
            Ok(r)  => r,
            Err(e) => { log.push(format!("{}: fetch error — {}", team_name, e)); continue; }
        };

        let mut updated = 0usize;
        {
            let conn = db.0.lock().unwrap();
            // Stamp cea_entry_id on team if missing
            let _ = conn.execute(
                "UPDATE teams SET cea_entry_id = ?1 WHERE id = ?2 AND cea_entry_id IS NULL",
                rusqlite::params![entry_id_str, team_id],
            );
            for p in &roster {
                // Only write when we actually resolved a Riot name (different from CEA name).
                // If we got nothing from contact-accounts we fell back to the CEA name,
                // and overwriting with that would erase any manually-entered summoner name.
                if p.summoner_name == p.cea_name {
                    log.push(format!("  {} — no Riot account linked (manual entry needed)", p.cea_name));
                    continue;
                }
                let rows = conn.execute(
                    "UPDATE players SET summoner_name = ?1 WHERE team_id = ?2 AND display_name = ?3",
                    rusqlite::params![p.summoner_name, team_id, p.cea_name],
                ).unwrap_or(0);
                if rows > 0 {
                    log.push(format!("  {} → {}", p.cea_name, p.summoner_name));
                    updated += rows;
                } else {
                    log.push(format!("  {} → {} (not found in DB)", p.cea_name, p.summoner_name));
                }
            }
        }

        log.push(format!("{}: {} / {} updated", team_name, updated, roster.len()));
    }

    Ok(log)
}

// ── Competition entries ────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct EntryListResp { content: Vec<EntryListItem> }

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntryListItem {
    id:             u64,
    alternate_name: String,
    representing:   EntryOrg,
    seed:           Option<u32>,
}

#[derive(serde::Deserialize)]
struct EntryOrg { name: String }

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CeaEntryInfo {
    pub entry_id:   String,
    pub team_name:  String,
    pub company:    String,
    pub seed:       Option<u32>,
}

#[tauri::command]
pub async fn fetch_cea_competition_entries(competition_id: String) -> Result<Vec<CeaEntryInfo>, String> {
    let c = client();
    let resp: EntryListResp = decode_json(
        c.get(format!(
            "https://api.app.playcea.com/competition/entry/document?competitionId={}&page=0&size=100&sort=seed",
            competition_id
        ))
        .send().await.map_err(|e| format!("Request failed: {e}"))?
    ).await.map_err(|e| format!("Entry list parse: {e}"))?;

    Ok(resp.content.into_iter().map(|e| CeaEntryInfo {
        entry_id:  e.id.to_string(),
        team_name: e.alternate_name,
        company:   e.representing.name,
        seed:      e.seed,
    }).collect())
}

// ── Match list ────────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct MatchListResp { content: Vec<MatchListItem> }

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchListItem {
    id:           u64,
    date:         Option<String>,
    scheduled_at: Option<String>,
    played_at:    Option<String>,
    status:       Option<String>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CeaMatchInfo {
    pub match_id: String,
    pub date:     Option<String>,
    pub status:   Option<String>,
}

#[tauri::command]
pub async fn fetch_cea_team_matches(competition_id: String, cea_team_id: String) -> Result<Vec<CeaMatchInfo>, String> {
    let token = load_settings().auth_token;
    let resp: MatchListResp = decode_json(
        authed(&format!(
            "https://api.app.playcea.com/competition/{}/_view/matches?entry={}&page=0&size=100",
            competition_id, cea_team_id
        ), &token)
        .send().await.map_err(|e| format!("Request failed: {e}"))?
    ).await.map_err(|e| format!("Match list parse: {e}"))?;

    Ok(resp.content.iter().map(|m| CeaMatchInfo {
        match_id: m.id.to_string(),
        date:     m.date.clone().or_else(|| m.scheduled_at.clone()).or_else(|| m.played_at.clone()),
        status:   m.status.clone(),
    }).collect())
}
