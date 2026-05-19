use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Team {
    pub id: i64,
    pub name: String,
    pub cea_entry_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Player {
    pub id: i64,
    pub team_id: i64,
    pub summoner_name: String,
    pub display_name: String,
    pub rank: Option<String>,
    pub notes: Option<String>,
    pub is_starter: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentStats {
    pub player_id: i64,
    pub wins: i64,
    pub losses: i64,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamRecord {
    pub wins: i64,
    pub losses: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerExtendedStats {
    pub player_id: i64,
    pub game_wins: i64,
    pub game_losses: i64,
    pub total_kills: i64,
    pub total_deaths: i64,
    pub total_assists: i64,
    pub total_cs: i64,
    pub cs_duration_sec: i64,
    pub total_gold: i64,
    pub gold_duration_sec: i64,
    pub match_wins: i64,
    pub match_losses: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionStat {
    pub champion: String,
    pub games: i64,
    pub wins: i64,
    pub losses: i64,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchEditGame {
    pub game_number: i64,
    pub duration_sec: Option<i64>,
    pub blue_team: Option<i64>,
    pub team1_champ: Option<String>,
    pub team2_champ: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchEditInfo {
    pub match_id: i64,
    pub cea_match_id: String,
    pub played_at: Option<String>,
    pub team1_name: Option<String>,
    pub team2_name: Option<String>,
    pub games: Vec<MatchEditGame>,
}
