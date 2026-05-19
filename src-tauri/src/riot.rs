use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

// ── Sliding-window rate limiter ───────────────────────────────────────────────

struct Window {
    limit:  usize,
    period: Duration,
    slots:  VecDeque<Instant>,
}

impl Window {
    fn new(limit: usize, period: Duration) -> Self {
        Self { limit, period, slots: VecDeque::new() }
    }

    fn prune(&mut self) {
        let now = Instant::now();
        while let Some(&front) = self.slots.front() {
            if now.duration_since(front) >= self.period {
                self.slots.pop_front();
            } else {
                break;
            }
        }
    }

    // How long until this window allows another request, or None if available now.
    fn wait_needed(&mut self) -> Option<Duration> {
        self.prune();
        if self.slots.len() < self.limit {
            None
        } else {
            let oldest  = self.slots.front().unwrap();
            let elapsed = Instant::now().duration_since(*oldest);
            // +50 ms buffer to avoid re-checking right at the boundary.
            Some(self.period.saturating_sub(elapsed) + Duration::from_millis(50))
        }
    }

    fn record(&mut self) {
        self.slots.push_back(Instant::now());
    }
}

// ── Gateway ───────────────────────────────────────────────────────────────────

pub struct RiotGateway {
    api_key: std::sync::Mutex<Option<String>>,
    region:  std::sync::Mutex<String>,
    http:    Client,
    // Both windows are checked+updated atomically so no request can slip between them.
    windows: Mutex<(Window, Window)>,
}

impl RiotGateway {
    pub fn new(initial_key: Option<String>, initial_region: String) -> Arc<Self> {
        Arc::new(Self {
            api_key: std::sync::Mutex::new(initial_key),
            region:  std::sync::Mutex::new(initial_region),
            http:    Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap(),
            windows: Mutex::new((
                Window::new(20,  Duration::from_millis(1000)),
                Window::new(100, Duration::from_secs(120)),
            )),
        })
    }

    pub fn configure(&self, key: String, region: String) {
        *self.api_key.lock().unwrap() = Some(key);
        *self.region.lock().unwrap()  = region;
    }

    pub fn has_key(&self) -> bool {
        self.api_key.lock().unwrap().is_some()
    }

    pub fn current_region(&self) -> String {
        self.region.lock().unwrap().clone()
    }

    // Wait until both rate-limit windows allow a request, then record the slot.
    // Releases the windows lock before sleeping so other tasks can make progress.
    async fn acquire_slot(&self) {
        loop {
            let wait = {
                let mut w = self.windows.lock().await;
                let t1 = w.0.wait_needed();
                let t2 = w.1.wait_needed();
                match (t1, t2) {
                    (None, None) => {
                        w.0.record();
                        w.1.record();
                        return;
                    }
                    (a, b) => a.unwrap_or_default().max(b.unwrap_or_default()),
                }
            }; // mutex released here
            tokio::time::sleep(wait).await;
        }
    }

    async fn get(&self, url: &str) -> Result<reqwest::Response, String> {
        let key = self.api_key.lock().unwrap().clone()
            .ok_or("Riot API key not configured. Open the Stats tab to add your key.")?;
        self.acquire_slot().await;
        self.http
            .get(url)
            .header("X-Riot-Token", key)
            .send()
            .await
            .map_err(|e| e.to_string())
    }
}

// ── Riot API data types ───────────────────────────────────────────────────────

#[derive(Deserialize)]
struct RiotAccount {
    puuid: String,
    #[serde(rename = "gameName")]
    game_name: String,
    #[serde(rename = "tagLine")]
    tag_line: String,
}

#[derive(Deserialize)]
struct LeagueEntry {
    #[serde(rename = "queueType")]
    queue_type: String,
    tier: String,
    rank: String,
    #[serde(rename = "leaguePoints")]
    league_points: i32,
    wins: i32,
    losses: i32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlayerRankInfo {
    pub game_name:   String,
    pub tag_line:    String,
    pub solo_rank:   Option<String>,
    pub solo_lp:     Option<i32>,
    pub solo_wins:   Option<i32>,
    pub solo_losses: Option<i32>,
    pub flex_rank:   Option<String>,
}

fn routing(region: &str) -> &'static str {
    match region {
        "euw1" | "eun1" | "tr1" | "ru" => "europe",
        "kr"   | "jp1"                  => "asia",
        _                               => "americas",
    }
}

fn format_rank(e: &LeagueEntry) -> String {
    let mut chars = e.tier.chars();
    let cap = match chars.next() {
        None    => return e.tier.clone(),
        Some(f) => f.to_uppercase().to_string() + &chars.as_str().to_lowercase(),
    };
    match e.tier.as_str() {
        "MASTER" | "GRANDMASTER" | "CHALLENGER" => cap,
        _                                        => format!("{} {}", cap, e.rank),
    }
}

// Read the body as bytes so that on a JSON parse failure we can include both
// the serde error detail and the raw response text in the error message.
async fn decode_json<T: serde::de::DeserializeOwned>(
    resp: reqwest::Response,
    step: &str,
) -> Result<T, String> {
    let status = resp.status().as_u16();
    let bytes  = resp.bytes().await
        .map_err(|e| format!("[{step}] HTTP {status}: failed to read body: {e}"))?;
    serde_json::from_slice::<T>(&bytes).map_err(|e| {
        let body = String::from_utf8_lossy(&bytes);
        // Always log the full body to stderr so it appears in the dev console.
        eprintln!("[Riot:{step}] HTTP {status} — parse error: {e}\n  body: {body}");
        format!("[{step}] HTTP {status}: {e} — body: {body}")
    })
}

impl RiotGateway {
    /// Resolve `gameName#tagLine` → PUUID → summoner ID → ranked entries.
    /// The three API calls are metered through the shared rate-limit windows.
    pub async fn fetch_player_rank(&self, summoner_name: &str) -> Result<PlayerRankInfo, String> {
        let region  = self.region.lock().unwrap().clone();
        let routing = routing(&region);

        let (game_name, tag_line) = summoner_name.split_once('#').ok_or_else(|| {
            format!("Summoner name must be 'gameName#tagLine', got: {summoner_name}")
        })?;

        // 1. Account V1 — get PUUID
        let url = format!(
            "https://{routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{}/{}",
            urlencoding::encode(game_name),
            urlencoding::encode(tag_line),
        );
        let resp = self.get(&url).await?;
        match resp.status().as_u16() {
            404 => return Err(format!("Account not found: {summoner_name}")),
            429 => return Err("Rate limited by Riot API — try again shortly.".into()),
            s if s != 200 => {
                let body = resp.text().await.unwrap_or_default();
                eprintln!("[Riot:account-v1] HTTP {s} — body: {body}");
                return Err(format!("[account-v1] HTTP {s}: {body}"));
            }
            _ => {}
        }
        let account: RiotAccount = decode_json(resp, "account-v1").await?;

        // 2. League V4 — get ranked entries directly by PUUID (no summoner ID needed)
        let url = format!(
            "https://{region}.api.riotgames.com/lol/league/v4/entries/by-puuid/{}",
            account.puuid,
        );
        let resp = self.get(&url).await?;
        if !resp.status().is_success() {
            let s    = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            eprintln!("[Riot:league-v4-puuid] HTTP {s} — body: {body}");
            return Err(format!("[league-v4-puuid] HTTP {s}: {body}"));
        }
        let entries: Vec<LeagueEntry> = decode_json(resp, "league-v4-puuid").await?;

        let solo = entries.iter().find(|e| e.queue_type == "RANKED_SOLO_5x5");
        let flex = entries.iter().find(|e| e.queue_type == "RANKED_FLEX_SR");

        Ok(PlayerRankInfo {
            game_name:   account.game_name,
            tag_line:    account.tag_line,
            solo_rank:   solo.map(format_rank),
            solo_lp:     solo.map(|e| e.league_points),
            solo_wins:   solo.map(|e| e.wins),
            solo_losses: solo.map(|e| e.losses),
            flex_rank:   flex.map(format_rank),
        })
    }
}
