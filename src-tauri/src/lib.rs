mod cea;
mod db;
mod lcu;
mod ocr;
mod overlay;
mod riot;

use cea::*;
use db::commands::*;
use db::Db;
use lcu::{LcuClient, LcuCredentials};
use overlay::OverlayServer;
use riot::RiotGateway;
use std::collections::HashMap;
use std::sync::Arc;

#[tauri::command]
async fn connect_lcu(app: tauri::AppHandle) -> Result<bool, String> {
    let Some(creds) = LcuCredentials::discover() else {
        return Ok(false);
    };
    LcuClient::new(app)
        .connect(creds)
        .await
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn set_overlay_scene(
    overlay: tauri::State<'_, Arc<OverlayServer>>,
    scene: String,
    params: HashMap<String, String>,
) -> Result<(), String> {
    overlay.set_scene(scene, params).await;
    Ok(())
}

#[tauri::command]
async fn get_overlay_state(
    overlay: tauri::State<'_, Arc<OverlayServer>>,
) -> Result<overlay::SceneState, String> {
    Ok(overlay.get_state().await)
}

// ── OCR scoreboard ────────────────────────────────────────────────────────────

#[tauri::command]
async fn ocr_scoreboard(url: String) -> Result<ocr::OcrScoreboard, String> {
    ocr::process_url(&url).await
}

// ── Riot API gateway commands ─────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct RiotConfig {
    api_key: Option<String>,
    region:  String,
}

fn riot_config_path() -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("cea-lol-broadcast")
        .join("riot_config.json")
}

fn load_riot_config() -> RiotConfig {
    std::fs::read_to_string(riot_config_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| RiotConfig { api_key: None, region: "na1".into() })
}

fn save_riot_config(cfg: &RiotConfig) {
    if let Ok(json) = serde_json::to_string(cfg) {
        let _ = std::fs::write(riot_config_path(), json);
    }
}

#[tauri::command]
async fn riot_set_config(
    gateway: tauri::State<'_, Arc<RiotGateway>>,
    key: String,
    region: String,
) -> Result<(), String> {
    gateway.configure(key.clone(), region.clone());
    save_riot_config(&RiotConfig { api_key: Some(key), region });
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RiotConfigPublic {
    has_key: bool,
    region:  String,
}

#[tauri::command]
async fn riot_get_config(
    gateway: tauri::State<'_, Arc<RiotGateway>>,
) -> Result<RiotConfigPublic, String> {
    Ok(RiotConfigPublic {
        has_key: gateway.has_key(),
        region:  gateway.current_region(),
    })
}

#[tauri::command]
async fn riot_fetch_rank(
    gateway: tauri::State<'_, Arc<RiotGateway>>,
    summoner_name: String,
) -> Result<riot::PlayerRankInfo, String> {
    gateway.fetch_player_rank(&summoner_name).await
}

// ─────────────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("cea-lol-broadcast")
        .join("data.db");
    std::fs::create_dir_all(db_path.parent().unwrap()).expect("failed to create data dir");
    let db = Db::open(&db_path).expect("failed to open database");

    let overlay = OverlayServer::new();
    overlay.clone().start();

    let riot_cfg = load_riot_config();
    let gateway = RiotGateway::new(
        riot_cfg.api_key,
        if riot_cfg.region.is_empty() { "na1".into() } else { riot_cfg.region },
    );

    // Serve overlay HTML files over HTTP on port 7234 for the in-app preview.
    // In debug builds use the compile-time manifest dir for a reliable absolute
    // path; in release builds the overlays folder sits next to the executable.
    let overlays_path = {
        #[cfg(debug_assertions)]
        {
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../overlays")
        }
        #[cfg(not(debug_assertions))]
        {
            let beside_exe = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join("overlays")))
                .unwrap_or_default();
            if beside_exe.exists() { beside_exe } else { std::path::PathBuf::from("overlays") }
        }
    };
    overlay::start_file_server(overlays_path);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(db)
        .manage(overlay)
        .manage(gateway)
        .invoke_handler(tauri::generate_handler![
            connect_lcu,
            get_teams,
            create_team,
            update_team,
            delete_team,
            get_players,
            get_all_players,
            create_player,
            update_player,
            delete_player,
            get_player_stats,
            get_team_stats,
            update_player_stats,
            reset_player_stats,
            get_team_record,
            set_overlay_scene,
            get_overlay_state,
            update_player_rank,
            ocr_scoreboard,
            import_competition_team,
            fetch_cea_roster,
            fetch_cea_team_matches,
            fetch_cea_competition_entries,
            sync_competition_rosters,
            get_cea_settings,
            save_cea_settings,
            save_cea_auth_token,
            get_imported_match_ids,
            save_match,
            export_matches_csv,
            export_csv_template,
            import_matches_csv,
            get_player_extended_stats,
            get_player_champion_stats,
            get_matches_for_edit,
            update_game_metadata,
            riot_set_config,
            riot_get_config,
            riot_fetch_rank,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
