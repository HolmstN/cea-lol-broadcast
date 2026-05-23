use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};

// ── Live Client API response shapes ──────────────────────────────────────────

#[derive(serde::Deserialize)]
struct AllGameData {
    #[serde(rename = "gameData")]
    game_data: GameMeta,
    #[serde(rename = "allPlayers", default)]
    all_players: Vec<LivePlayer>,
    events: Events,
}

#[derive(serde::Deserialize)]
struct GameMeta {
    #[serde(rename = "gameTime")]
    game_time: f64,
}

#[derive(serde::Deserialize)]
struct LiveItem {
    #[serde(rename = "itemID")]
    item_id: u32,
    price: u32,
    count: u32,
}

#[derive(serde::Deserialize)]
struct LivePlayer {
    #[serde(rename = "summonerName", default)]
    summoner_name: String,
    #[serde(rename = "riotIdGameName", default)]
    riot_id_game_name: String,
    #[serde(rename = "championName", default)]
    champion_name: String,
    #[serde(default)]
    team: String,
    scores: Scores,
    #[serde(default)]
    items: Vec<LiveItem>,
    #[serde(rename = "isBot", default)]
    is_bot: bool,
}

impl LivePlayer {
    fn display_name(&self) -> &str {
        if !self.riot_id_game_name.is_empty() {
            &self.riot_id_game_name
        } else {
            &self.summoner_name
        }
    }
}

#[derive(serde::Deserialize)]
struct Scores {
    kills: u32,
    deaths: u32,
    assists: u32,
    #[serde(rename = "creepScore")]
    creep_score: u32,
}

#[derive(serde::Deserialize)]
struct Events {
    #[serde(rename = "Events", default)]
    events: Vec<GameEvent>,
}

#[derive(serde::Deserialize)]
struct GameEvent {
    #[serde(rename = "EventID")]
    event_id: u32,
    #[serde(rename = "EventName")]
    event_name: String,
    #[serde(rename = "EventTime", default)]
    event_time: f64,
    #[serde(rename = "KillerName", default)]
    killer_name: String,
    #[serde(rename = "VictimName", default)]
    victim_name: String,
    #[serde(rename = "Assisters", default)]
    assisters: Vec<String>,
    #[serde(rename = "KillStreak", default)]
    kill_streak: u32,
    #[serde(rename = "Acer", default)]
    acer: String,
    #[serde(rename = "Recipient", default)]
    recipient: String,
    #[serde(rename = "DragonType", default)]
    dragon_type: String,
    #[serde(rename = "Stolen", default)]
    stolen: String,
}

// ── Events emitted to frontend ────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
pub struct LiveTick {
    pub game_time: f64,
    pub blue_kills: u32,
    pub red_kills: u32,
    pub blue_gold: u32,
    pub red_gold: u32,
    pub players: Vec<PlayerSummary>,
}

#[derive(serde::Serialize, Clone)]
pub struct PlayerSummary {
    pub name: String,
    pub champion: String,
    pub team: String,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub cs: u32,
    pub effective_gold: u32,
    pub items: Vec<u32>,
}

#[derive(serde::Serialize, Clone)]
pub struct KillEvent {
    pub badge: String,
    pub killer: String,
    pub killer_champ: String,
    pub victim: String,
    pub victim_champ: String,
    pub assists: Vec<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct ObjectiveEvent {
    pub event_type: String,
    pub team: String,
    pub name: String,
    pub stolen: bool,
    pub game_time: f64,
}

// ── Poller ────────────────────────────────────────────────────────────────────

pub struct LiveClientPoller {
    running: Arc<AtomicBool>,
    next_event_id: Arc<AtomicU32>,
}

impl LiveClientPoller {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            running: Arc::new(AtomicBool::new(false)),
            next_event_id: Arc::new(AtomicU32::new(0)),
        })
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Start polling the Live Client API. Returns false if already running.
    pub fn start(self: &Arc<Self>, app: AppHandle) -> bool {
        if self.running.swap(true, Ordering::SeqCst) {
            return false;
        }
        self.next_event_id.store(0, Ordering::Relaxed);

        let running = self.running.clone();
        let next_event_id = self.next_event_id.clone();

        tokio::spawn(async move {
            let client = match reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .timeout(Duration::from_secs(3))
                .build()
            {
                Ok(c) => c,
                Err(_) => {
                    running.store(false, Ordering::Relaxed);
                    return;
                }
            };

            // On the first successful response we skip historic events — only track from now.
            let mut initialized = false;

            loop {
                if !running.load(Ordering::Relaxed) {
                    break;
                }

                let ev_id = next_event_id.load(Ordering::Relaxed);
                let url = "https://127.0.0.1:2999/liveclientdata/allgamedata";

                match client.get(url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        match resp.json::<AllGameData>().await {
                            Ok(data) => {
                                // Champion name lookup (summoner name → champion)
                                let champ_map: std::collections::HashMap<String, String> =
                                    data.all_players
                                        .iter()
                                        .flat_map(|p| {
                                            let champ = p.champion_name.clone();
                                            let mut pairs = vec![(
                                                p.summoner_name.to_lowercase(),
                                                champ.clone(),
                                            )];
                                            if !p.riot_id_game_name.is_empty() {
                                                pairs.push((
                                                    p.riot_id_game_name.to_lowercase(),
                                                    champ,
                                                ));
                                            }
                                            pairs
                                        })
                                        .collect();

                                // Player name → team lookup (for objective attribution)
                                let team_map: std::collections::HashMap<String, String> =
                                    data.all_players
                                        .iter()
                                        .flat_map(|p| {
                                            let team = p.team.clone();
                                            let mut pairs = vec![(
                                                p.summoner_name.to_lowercase(),
                                                team.clone(),
                                            )];
                                            if !p.riot_id_game_name.is_empty() {
                                                pairs.push((
                                                    p.riot_id_game_name.to_lowercase(),
                                                    team,
                                                ));
                                            }
                                            pairs
                                        })
                                        .collect();

                                // Emit current game state tick
                                let player_gold = |p: &LivePlayer| -> u32 {
                                    p.items.iter().map(|i| i.price * i.count).sum()
                                };
                                let blue_kills = data.all_players.iter().filter(|p| p.team == "ORDER").map(|p| p.scores.kills).sum();
                                let red_kills  = data.all_players.iter().filter(|p| p.team == "CHAOS").map(|p| p.scores.kills).sum();
                                let blue_gold  = data.all_players.iter().filter(|p| p.team == "ORDER" && !p.is_bot).map(player_gold).sum();
                                let red_gold   = data.all_players.iter().filter(|p| p.team == "CHAOS" && !p.is_bot).map(player_gold).sum();
                                let players = data
                                    .all_players
                                    .iter()
                                    .filter(|p| !p.is_bot)
                                    .map(|p| PlayerSummary {
                                        name: p.display_name().to_string(),
                                        champion: p.champion_name.clone(),
                                        team: p.team.clone(),
                                        kills: p.scores.kills,
                                        deaths: p.scores.deaths,
                                        assists: p.scores.assists,
                                        cs: p.scores.creep_score,
                                        effective_gold: player_gold(p),
                                        items: p.items.iter().filter(|i| i.item_id > 0).map(|i| i.item_id).collect(),
                                    })
                                    .collect();

                                let _ = app.emit(
                                    "live-tick",
                                    LiveTick {
                                        game_time: data.game_data.game_time,
                                        blue_kills,
                                        red_kills,
                                        blue_gold,
                                        red_gold,
                                        players,
                                    },
                                );

                                // Advance event cursor past new events (client-side dedup —
                                // we no longer pass eventID in the URL so the response always
                                // contains all events; we filter here to avoid re-processing).
                                let max_new_id = data
                                    .events
                                    .events
                                    .iter()
                                    .filter(|e| e.event_id >= ev_id)
                                    .map(|e| e.event_id)
                                    .max();
                                if let Some(m) = max_new_id {
                                    next_event_id.store(m + 1, Ordering::Relaxed);
                                }

                                // On first tick: replay historic objectives but skip kills.
                                let is_first = !initialized;
                                initialized = true;

                                // Find first-blood recipient for badge override (search all events).
                                let fb_recipient = data
                                    .events
                                    .events
                                    .iter()
                                    .find(|e| e.event_name == "FirstBlood")
                                    .map(|e| e.recipient.to_lowercase());

                                let mut game_ended = false;
                                for ev in data.events.events.iter().filter(|e| e.event_id >= ev_id) {
                                    match ev.event_name.as_str() {
                                        "ChampionKill" if !is_first => {
                                            let is_fb = fb_recipient
                                                .as_deref()
                                                .map(|r| r == ev.killer_name.to_lowercase())
                                                .unwrap_or(false);
                                            let badge =
                                                if is_fb { "First Blood" } else { "" };
                                            let killer_champ = champ_map
                                                .get(&ev.killer_name.to_lowercase())
                                                .cloned()
                                                .unwrap_or_default();
                                            let victim_champ = champ_map
                                                .get(&ev.victim_name.to_lowercase())
                                                .cloned()
                                                .unwrap_or_default();
                                            let _ = app.emit(
                                                "live-kill",
                                                KillEvent {
                                                    badge: badge.to_string(),
                                                    killer: ev.killer_name.clone(),
                                                    killer_champ,
                                                    victim: ev.victim_name.clone(),
                                                    victim_champ,
                                                    assists: ev.assisters.clone(),
                                                },
                                            );
                                        }
                                        "Multikill" if !is_first => {
                                            let badge = match ev.kill_streak {
                                                2 => "Double Kill",
                                                3 => "Triple Kill",
                                                4 => "Quadra Kill",
                                                _ => "Penta Kill",
                                            };
                                            let killer_champ = champ_map
                                                .get(&ev.killer_name.to_lowercase())
                                                .cloned()
                                                .unwrap_or_default();
                                            let _ = app.emit(
                                                "live-kill",
                                                KillEvent {
                                                    badge: badge.to_string(),
                                                    killer: ev.killer_name.clone(),
                                                    killer_champ,
                                                    victim: String::new(),
                                                    victim_champ: String::new(),
                                                    assists: vec![],
                                                },
                                            );
                                        }
                                        "Ace" if !is_first => {
                                            let killer_champ = champ_map
                                                .get(&ev.acer.to_lowercase())
                                                .cloned()
                                                .unwrap_or_default();
                                            let _ = app.emit(
                                                "live-kill",
                                                KillEvent {
                                                    badge: "Ace".to_string(),
                                                    killer: ev.acer.clone(),
                                                    killer_champ,
                                                    victim: String::new(),
                                                    victim_champ: String::new(),
                                                    assists: vec![],
                                                },
                                            );
                                        }
                                        "DragonKill" => {
                                            let team = team_map.get(&ev.killer_name.to_lowercase()).cloned().unwrap_or_default();
                                            let name = if ev.dragon_type.is_empty() { "Dragon".to_string() } else { ev.dragon_type.clone() };
                                            let _ = app.emit("live-objective", ObjectiveEvent {
                                                event_type: "Dragon".into(),
                                                team,
                                                name,
                                                stolen: ev.stolen.eq_ignore_ascii_case("true"),
                                                game_time: ev.event_time,
                                            });
                                        }
                                        "BaronKill" => {
                                            let team = team_map.get(&ev.killer_name.to_lowercase()).cloned().unwrap_or_default();
                                            let _ = app.emit("live-objective", ObjectiveEvent {
                                                event_type: "Baron".into(),
                                                team,
                                                name: "Baron".into(),
                                                stolen: ev.stolen.eq_ignore_ascii_case("true"),
                                                game_time: ev.event_time,
                                            });
                                        }
                                        "HeraldKill" => {
                                            let team = team_map.get(&ev.killer_name.to_lowercase()).cloned().unwrap_or_default();
                                            let _ = app.emit("live-objective", ObjectiveEvent {
                                                event_type: "Herald".into(),
                                                team,
                                                name: "Herald".into(),
                                                stolen: ev.stolen.eq_ignore_ascii_case("true"),
                                                game_time: ev.event_time,
                                            });
                                        }
                                        "VoidGrubKill" | "VoidMonsterKill" => {
                                            let team = team_map.get(&ev.killer_name.to_lowercase()).cloned().unwrap_or_default();
                                            let _ = app.emit("live-objective", ObjectiveEvent {
                                                event_type: "VoidGrub".into(),
                                                team,
                                                name: "VoidGrub".into(),
                                                stolen: false,
                                                game_time: ev.event_time,
                                            });
                                        }
                                        "TurretKilled" => {
                                            let team = team_map.get(&ev.killer_name.to_lowercase()).cloned().unwrap_or_default();
                                            let _ = app.emit("live-objective", ObjectiveEvent {
                                                event_type: "Tower".into(),
                                                team,
                                                name: ev.victim_name.clone(),
                                                stolen: false,
                                                game_time: ev.event_time,
                                            });
                                        }
                                        "InhibKilled" => {
                                            let team = team_map.get(&ev.killer_name.to_lowercase()).cloned().unwrap_or_default();
                                            let _ = app.emit("live-objective", ObjectiveEvent {
                                                event_type: "Inhibitor".into(),
                                                team,
                                                name: ev.victim_name.clone(),
                                                stolen: false,
                                                game_time: ev.event_time,
                                            });
                                        }
                                        "GameEnd" => {
                                            game_ended = true;
                                        }
                                        _ => {}
                                    }
                                }

                                if game_ended {
                                    let _ = app.emit("live-ended", ());
                                    running.store(false, Ordering::Relaxed);
                                    break;
                                }
                            }
                            Err(_) => {
                                let _ = app.emit("live-not-found", ());
                            }
                        }
                    }
                    _ => {
                        let _ = app.emit("live-not-found", ());
                    }
                }

                sleep(Duration::from_secs(2)).await;
            }

            running.store(false, Ordering::Relaxed);
        });

        true
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
        self.next_event_id.store(0, Ordering::Relaxed);
    }
}
