import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Team, Player, TeamRecord, PlayerExtendedStats, ChampionStat } from "../types";

// ─── Scene definitions ──────────────────────────────
type SceneId =
  | "idle" | "starting-soon" | "match-intro" | "lower-third" | "break" | "match-result"
  | "player-stats" | "matchup-stats" | "player-spotlight";

interface ParamDef {
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "select";
  options?: string[];
  hidden?: boolean;
}

interface SceneDef {
  label: string;
  icon: string;
  description: string;
  params: Record<string, ParamDef>;
}

type RoleKey = "top" | "jg" | "mid" | "adc" | "sup";
const ROLE_KEYS: RoleKey[] = ["top", "jg", "mid", "adc", "sup"];
const ROLE_LABELS: Record<RoleKey, string> = { top: "Top", jg: "Jungle", mid: "Mid", adc: "ADC", sup: "Support" };

function makeRoleParams(prefix: string): Record<string, ParamDef> {
  const result: Record<string, ParamDef> = {};
  for (const k of ROLE_KEYS) {
    const p = (s: string) => `${prefix}${k}_${s}`;
    for (const key of [
      "name", "rank",
      "game_wins", "game_losses", "game_wr",
      "match_wins", "match_losses", "match_wr",
      "avg_k", "avg_d", "avg_a", "kda",
      "cs_min", "gold_min",
      "fav_champ", "champ_wins", "champ_losses", "champ_kda",
    ]) {
      result[p(key)] = { label: `${k} ${key}`, hidden: true };
    }
  }
  return result;
}

const SCENES: Record<SceneId, SceneDef> = {
  idle: {
    label: "Off / Idle",
    icon: "○",
    description: "Clear the overlay (transparent)",
    params: {},
  },
  "starting-soon": {
    label: "Starting Soon",
    icon: "◆",
    description: "Pre-show waiting screen",
    params: {
      event: { label: "Event Name", placeholder: "Spring Season 2025" },
    },
  },
  "match-intro": {
    label: "Match Intro",
    icon: "⚔",
    description: "Team vs Team matchup reveal",
    params: {
      team1:    { label: "Blue Side Team",   placeholder: "Team Alpha" },
      team2:    { label: "Red Side Team",    placeholder: "Team Bravo" },
      record1:  { label: "Blue Side Record", placeholder: "6W – 2L" },
      record2:  { label: "Red Side Record",  placeholder: "5W – 3L" },
      round:    { label: "Round",            placeholder: "Quarterfinals" },
      matchNum: { label: "Match Number",     placeholder: "Match 1 of 3" },
      format:   { label: "Format",           placeholder: "Best of 3" },
      event:    { label: "Event Name",       placeholder: "Spring Season 2025" },
    },
  },
  "lower-third": {
    label: "Lower Third",
    icon: "▬",
    description: "Player or caster name bar",
    params: {
      mode:        { label: "Mode", type: "select", options: ["player", "caster"] },
      playerName:  { label: "Summoner Name",  placeholder: "SummonerName" },
      role:        { label: "Role", type: "select", options: ["Top", "Jungle", "Mid", "ADC", "Support"] },
      rank:        { label: "Rank",           placeholder: "Diamond I" },
      team:        { label: "Team Name",      placeholder: "Team Alpha" },
      casterName:  { label: "Caster Name",    placeholder: "CasterName", hint: "Shown in caster mode" },
      casterRole:  { label: "Caster Role",    placeholder: "Play-by-Play", hint: "Shown in caster mode" },
    },
  },
  break: {
    label: "Break",
    icon: "⏸",
    description: "Intermission / Be Right Back",
    params: {
      team1:     { label: "Blue Side Team",  placeholder: "Team Alpha" },
      team2:     { label: "Red Side Team",   placeholder: "Team Bravo" },
      score1:    { label: "Blue Side Score", placeholder: "1" },
      score2:    { label: "Red Side Score",  placeholder: "0" },
      sub:       { label: "Subtitle",        placeholder: "Game 2 Starting Shortly" },
      countdown: { label: "Countdown (sec)", placeholder: "0", hint: "0 = no countdown" },
      round:     { label: "Round",           placeholder: "Quarterfinals" },
      event:     { label: "Event Name",      placeholder: "Spring Season 2025" },
    },
  },
  "match-result": {
    label: "Match Result",
    icon: "🏆",
    description: "Series result announcement",
    params: {
      winner:      { label: "Winner Team",    placeholder: "Team Alpha" },
      loser:       { label: "Loser Team",     placeholder: "Team Bravo" },
      winnerScore: { label: "Winner Wins",    placeholder: "2" },
      loserScore:  { label: "Loser Wins",     placeholder: "1" },
      winnerSide:  { label: "Winner Side",    placeholder: "Blue Side" },
      loserSide:   { label: "Loser Side",     placeholder: "Red Side" },
      winsText:    { label: "Outcome Text",   placeholder: "Advances to Semifinals" },
      round:       { label: "Round",          placeholder: "Quarterfinals" },
      format:      { label: "Format",         placeholder: "Best of 3" },
      event:       { label: "Event Name",     placeholder: "Spring Season 2025" },
    },
  },
  "player-stats": {
    label: "Player Stats",
    icon: "📊",
    description: "Team roster stats by role",
    params: {
      teamName: { label: "Team Name", placeholder: "Team Alpha" },
      event:    { label: "Event Name", placeholder: "Spring Season 2025" },
      ...makeRoleParams(""),
    },
  },
  "matchup-stats": {
    label: "Matchup Stats",
    icon: "⚔",
    description: "Head-to-head role comparison",
    params: {
      team1: { label: "Blue Side Team", placeholder: "Team Alpha" },
      team2: { label: "Red Side Team",  placeholder: "Team Bravo" },
      event: { label: "Event Name",     placeholder: "Spring Season 2025" },
      ...makeRoleParams("b_"),
      ...makeRoleParams("r_"),
    },
  },
  "player-spotlight": {
    label: "Player Spotlight",
    icon: "★",
    description: "Single player feature card",
    params: {
      name:  { label: "Player Name", placeholder: "Player" },
      team:  { label: "Team",        placeholder: "Team Alpha" },
      role:  { label: "Role", type: "select", options: ["Top", "Jungle", "Mid", "ADC", "Support"] },
      rank:  { label: "Rank",        placeholder: "Diamond I" },
      event: { label: "Event Name",  placeholder: "Spring Season 2025" },
      game_wins:    { label: "Game Wins",    hidden: true },
      game_losses:  { label: "Game Losses",  hidden: true },
      game_wr:      { label: "Game WR",      hidden: true },
      match_wins:   { label: "Match Wins",   hidden: true },
      match_losses: { label: "Match Losses", hidden: true },
      match_wr:     { label: "Match WR",     hidden: true },
      avg_k:        { label: "Avg Kills",    hidden: true },
      avg_d:        { label: "Avg Deaths",   hidden: true },
      avg_a:        { label: "Avg Assists",  hidden: true },
      kda:          { label: "KDA Ratio",    hidden: true },
      cs_min:       { label: "CS/min",       hidden: true },
      gold_min:     { label: "Gold/min",     hidden: true },
      champ1_name:   { label: "Champ1 Name",   hidden: true }, champ1_wins: { label: "Champ1 W", hidden: true }, champ1_losses: { label: "Champ1 L", hidden: true }, champ1_kda: { label: "Champ1 KDA", hidden: true },
      champ2_name:   { label: "Champ2 Name",   hidden: true }, champ2_wins: { label: "Champ2 W", hidden: true }, champ2_losses: { label: "Champ2 L", hidden: true }, champ2_kda: { label: "Champ2 KDA", hidden: true },
      champ3_name:   { label: "Champ3 Name",   hidden: true }, champ3_wins: { label: "Champ3 W", hidden: true }, champ3_losses: { label: "Champ3 L", hidden: true }, champ3_kda: { label: "Champ3 KDA", hidden: true },
      champ4_name:   { label: "Champ4 Name",   hidden: true }, champ4_wins: { label: "Champ4 W", hidden: true }, champ4_losses: { label: "Champ4 L", hidden: true }, champ4_kda: { label: "Champ4 KDA", hidden: true },
      champ5_name:   { label: "Champ5 Name",   hidden: true }, champ5_wins: { label: "Champ5 W", hidden: true }, champ5_losses: { label: "Champ5 L", hidden: true }, champ5_kda: { label: "Champ5 KDA", hidden: true },
    },
  },
};

const SCENE_ORDER: SceneId[] = [
  "idle", "starting-soon", "match-intro", "lower-third", "break", "match-result",
  "player-stats", "matchup-stats", "player-spotlight",
];

const OVERLAY_URL = "http://localhost:5174";
const HAS_PREVIEW: Set<SceneId> = new Set([
  "starting-soon", "match-intro", "lower-third", "break", "match-result",
  "player-stats", "matchup-stats", "player-spotlight",
]);

type AllParams = Record<SceneId, Record<string, string>>;

function defaultParams(): AllParams {
  const result = {} as AllParams;
  for (const [id, def] of Object.entries(SCENES) as [SceneId, SceneDef][]) {
    result[id] = {};
    for (const [key, p] of Object.entries(def.params)) {
      if (p.type === "select" && p.options) {
        result[id][key] = p.options[0];
      } else {
        result[id][key] = p.placeholder ?? "";
      }
    }
  }
  return result;
}

export default function StreamerView() {
  const [liveScene, setLiveScene] = useState<SceneId>("idle");
  const [selected, setSelected]   = useState<SceneId>("idle");
  const [params, setParams]       = useState<AllParams>(defaultParams);
  const [sending, setSending]     = useState(false);

  // DB-driven state
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ltTeamId, setLtTeamId]   = useState<number | "">("");
  const [ltPlayers, setLtPlayers] = useState<Player[]>([]);

  // player-stats pickers
  const [psTeamId, setPsTeamId]     = useState<number | "">("");
  const [psPlayers, setPsPlayers]   = useState<Player[]>([]);
  const [psRolePicks, setPsRolePicks] = useState<Record<RoleKey, number | "">>({ top: "", jg: "", mid: "", adc: "", sup: "" });

  // matchup-stats pickers
  const [ms1TeamId, setMs1TeamId]   = useState<number | "">("");
  const [ms2TeamId, setMs2TeamId]   = useState<number | "">("");
  const [ms1Players, setMs1Players] = useState<Player[]>([]);
  const [ms2Players, setMs2Players] = useState<Player[]>([]);
  const [ms1Picks, setMs1Picks]     = useState<Record<RoleKey, number | "">>({ top: "", jg: "", mid: "", adc: "", sup: "" });
  const [ms2Picks, setMs2Picks]     = useState<Record<RoleKey, number | "">>({ top: "", jg: "", mid: "", adc: "", sup: "" });

  // player-spotlight pickers
  const [spTeamId, setSpTeamId]   = useState<number | "">("");
  const [spPlayers, setSpPlayers] = useState<Player[]>([]);

  useEffect(() => {
    invoke<Team[]>("get_teams").then(setTeams).catch(() => {});
    invoke<{ scene: string; params: Record<string, string> }>("get_overlay_state")
      .then(({ scene, params: p }) => {
        const s = scene as SceneId;
        if (s && SCENES[s]) {
          setLiveScene(s);
          setSelected(s);
          if (p && Object.keys(p).length > 0) {
            setParams(prev => ({ ...prev, [s]: { ...prev[s], ...p } }));
          }
        }
      })
      .catch(() => {});
  }, []);

  // When Lower Third team picker changes, load that team's players
  useEffect(() => {
    if (ltTeamId === "") { setLtPlayers([]); return; }
    invoke<Player[]>("get_players", { teamId: ltTeamId }).then(setLtPlayers).catch(() => {});
  }, [ltTeamId]);

  useEffect(() => {
    if (psTeamId === "") { setPsPlayers([]); return; }
    invoke<Player[]>("get_players", { teamId: psTeamId }).then(setPsPlayers).catch(() => {});
    const team = teams.find(t => t.id === psTeamId);
    if (team) setParams(prev => ({ ...prev, "player-stats": { ...prev["player-stats"], teamName: team.name } }));
  }, [psTeamId, teams]);

  useEffect(() => {
    if (ms1TeamId === "") { setMs1Players([]); return; }
    invoke<Player[]>("get_players", { teamId: ms1TeamId }).then(setMs1Players).catch(() => {});
    const team = teams.find(t => t.id === ms1TeamId);
    if (team) setParams(prev => ({ ...prev, "matchup-stats": { ...prev["matchup-stats"], team1: team.name } }));
  }, [ms1TeamId, teams]);

  useEffect(() => {
    if (ms2TeamId === "") { setMs2Players([]); return; }
    invoke<Player[]>("get_players", { teamId: ms2TeamId }).then(setMs2Players).catch(() => {});
    const team = teams.find(t => t.id === ms2TeamId);
    if (team) setParams(prev => ({ ...prev, "matchup-stats": { ...prev["matchup-stats"], team2: team.name } }));
  }, [ms2TeamId, teams]);

  useEffect(() => {
    if (spTeamId === "") { setSpPlayers([]); return; }
    invoke<Player[]>("get_players", { teamId: spTeamId }).then(setSpPlayers).catch(() => {});
  }, [spTeamId]);

  async function pickTeamWithRecord(sceneId: SceneId, teamKey: string, recordKey: string, teamId: number) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    setParams(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], [teamKey]: team.name } }));
    try {
      const rec = await invoke<TeamRecord>("get_team_record", { teamId });
      setParams(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], [recordKey]: `${rec.wins}W – ${rec.losses}L` } }));
    } catch {}
  }

  function pickTeamName(sceneId: SceneId, teamKey: string, teamId: number) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    setParams(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], [teamKey]: team.name } }));
  }

  function fmtKda(k: number, d: number, a: number): string {
    return d === 0 ? "Perf" : ((k + a) / d).toFixed(2);
  }
  function fmtWr(w: number, l: number): string {
    return (w + l) === 0 ? "—" : Math.round(w / (w + l) * 100) + "%";
  }
  function fmtRate(total: number, durSec: number): string {
    return durSec > 0 ? (total / (durSec / 60)).toFixed(1) : "—";
  }

  async function pickRolePlayer(
    sceneId: SceneId,
    prefix: string,
    roleKey: RoleKey,
    playerId: number,
    players: Player[],
  ) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const base = `${prefix}${roleKey}`;
    setParams(prev => ({
      ...prev,
      [sceneId]: { ...prev[sceneId], [`${base}_name`]: player.summonerName, [`${base}_rank`]: player.rank ?? "—" },
    }));
    try {
      const [ext, champs] = await Promise.all([
        invoke<PlayerExtendedStats>("get_player_extended_stats", { playerId }),
        invoke<ChampionStat[]>("get_player_champion_stats", { playerId, limit: 1 }),
      ]);
      const fav = champs[0];
      const avgK = ext.gameWins + ext.gameLosses > 0 ? (ext.totalKills / (ext.gameWins + ext.gameLosses)).toFixed(1) : "—";
      const avgD = ext.gameWins + ext.gameLosses > 0 ? (ext.totalDeaths / (ext.gameWins + ext.gameLosses)).toFixed(1) : "—";
      const avgA = ext.gameWins + ext.gameLosses > 0 ? (ext.totalAssists / (ext.gameWins + ext.gameLosses)).toFixed(1) : "—";
      setParams(prev => ({
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          [`${base}_game_wins`]:    String(ext.gameWins),
          [`${base}_game_losses`]:  String(ext.gameLosses),
          [`${base}_game_wr`]:      fmtWr(ext.gameWins, ext.gameLosses),
          [`${base}_match_wins`]:   String(ext.matchWins),
          [`${base}_match_losses`]: String(ext.matchLosses),
          [`${base}_match_wr`]:     fmtWr(ext.matchWins, ext.matchLosses),
          [`${base}_avg_k`]:        avgK,
          [`${base}_avg_d`]:        avgD,
          [`${base}_avg_a`]:        avgA,
          [`${base}_kda`]:          fmtKda(ext.totalKills, ext.totalDeaths, ext.totalAssists),
          [`${base}_cs_min`]:       fmtRate(ext.totalCs, ext.csDurationSec),
          [`${base}_gold_min`]:     fmtRate(ext.totalGold, ext.goldDurationSec),
          [`${base}_fav_champ`]:    fav?.champion ?? "—",
          [`${base}_champ_wins`]:   fav ? String(fav.wins) : "0",
          [`${base}_champ_losses`]: fav ? String(fav.losses) : "0",
          [`${base}_champ_kda`]:    fav ? fmtKda(fav.kills, fav.deaths, fav.assists) : "—",
        },
      }));
    } catch {}
  }

  async function pickSpotlightPlayer(playerId: number, players: Player[]) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const team = teams.find(t => t.id === player.teamId);
    setParams(prev => ({
      ...prev,
      "player-spotlight": {
        ...prev["player-spotlight"],
        name: player.summonerName,
        rank: player.rank ?? "—",
        team: team?.name ?? "",
      },
    }));
    try {
      const [ext, champs] = await Promise.all([
        invoke<PlayerExtendedStats>("get_player_extended_stats", { playerId }),
        invoke<ChampionStat[]>("get_player_champion_stats", { playerId, limit: 5 }),
      ]);
      const avgK = ext.gameWins + ext.gameLosses > 0 ? (ext.totalKills / (ext.gameWins + ext.gameLosses)).toFixed(1) : "—";
      const avgD = ext.gameWins + ext.gameLosses > 0 ? (ext.totalDeaths / (ext.gameWins + ext.gameLosses)).toFixed(1) : "—";
      const avgA = ext.gameWins + ext.gameLosses > 0 ? (ext.totalAssists / (ext.gameWins + ext.gameLosses)).toFixed(1) : "—";
      const champParams: Record<string, string> = {};
      for (let i = 1; i <= 5; i++) {
        const c = champs[i - 1];
        champParams[`champ${i}_name`]   = c?.champion ?? "";
        champParams[`champ${i}_wins`]   = c ? String(c.wins) : "0";
        champParams[`champ${i}_losses`] = c ? String(c.losses) : "0";
        champParams[`champ${i}_kda`]    = c ? fmtKda(c.kills, c.deaths, c.assists) : "—";
      }
      setParams(prev => ({
        ...prev,
        "player-spotlight": {
          ...prev["player-spotlight"],
          game_wins:    String(ext.gameWins),
          game_losses:  String(ext.gameLosses),
          game_wr:      fmtWr(ext.gameWins, ext.gameLosses),
          match_wins:   String(ext.matchWins),
          match_losses: String(ext.matchLosses),
          match_wr:     fmtWr(ext.matchWins, ext.matchLosses),
          avg_k:        avgK,
          avg_d:        avgD,
          avg_a:        avgA,
          kda:          fmtKda(ext.totalKills, ext.totalDeaths, ext.totalAssists),
          cs_min:       fmtRate(ext.totalCs, ext.csDurationSec),
          gold_min:     fmtRate(ext.totalGold, ext.goldDurationSec),
          ...champParams,
        },
      }));
    } catch {}
  }

  function pickPlayer(player: Player) {
    const team = teams.find(t => t.id === player.teamId);
    setParams(prev => ({
      ...prev,
      "lower-third": {
        ...prev["lower-third"],
        playerName: player.summonerName,
        rank: player.rank ?? "",
        team: team?.name ?? "",
      },
    }));
  }

  async function goLive() {
    setSending(true);
    try {
      await invoke("set_overlay_scene", { scene: selected, params: params[selected] });
      setLiveScene(selected);
    } finally {
      setSending(false);
    }
  }

  function setParam(key: string, value: string) {
    setParams(prev => ({ ...prev, [selected]: { ...prev[selected], [key]: value } }));
  }

  const previewRef = useRef<HTMLDivElement>(null);

  const sceneDef = SCENES[selected];
  const paramEntries = (Object.entries(sceneDef.params) as [string, ParamDef][]).filter(([, def]) => !def.hidden);
  const isLive = liveScene === selected;

  return (
    <div className="streamer-layout">

      {/* ── Left: Scene selector ── */}
      <div className="scene-list">
        <div className="panel-header">Scenes</div>
        {SCENE_ORDER.map((id) => {
          const def = SCENES[id];
          const live = liveScene === id;
          const sel  = selected === id;
          return (
            <div
              key={id}
              className={`scene-card ${sel ? "selected" : ""} ${live ? "live" : ""}`}
              onClick={() => setSelected(id)}
            >
              <span className="scene-card-icon">{def.icon}</span>
              <div className="scene-card-text">
                <div className="scene-card-name">{def.label}</div>
                <div className="scene-card-desc">{def.description}</div>
              </div>
              {live && <span className="live-badge">LIVE</span>}
            </div>
          );
        })}

        <div className="obs-instructions">
          <div className="obs-title">OBS Setup</div>
          <div className="obs-step">1. Add Browser Source</div>
          <div className="obs-step">2. Point to <code>http://localhost:5174</code></div>
          <div className="obs-step">3. Set 1920 × 1080</div>
          <div className="obs-ws">WS: <code>ws://127.0.0.1:7233</code></div>
        </div>
      </div>

      {/* ── Right: Params + Go Live ── */}
      <div className="scene-config">
        <div className="config-header">
          <div>
            <div className="config-title">
              <span className="config-icon">{sceneDef.icon}</span>
              {sceneDef.label}
            </div>
            <div className="config-desc">{sceneDef.description}</div>
          </div>
          <button
            className={`go-live-btn ${isLive ? "is-live" : ""}`}
            onClick={goLive}
            disabled={sending}
          >
            {sending ? "Sending…" : isLive ? "● LIVE" : "Go Live"}
          </button>
        </div>

        {/* ── Preview ── */}
        <div className="scene-preview" ref={previewRef}>
          {HAS_PREVIEW.has(selected) ? (
            <iframe
              src={OVERLAY_URL}
              className="preview-iframe"
              title="Overlay Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="preview-idle">Overlay Off</div>
          )}
        </div>

        <div className="params-form">
          {/* ── Match Intro: team pickers ── */}
          {selected === "match-intro" && teams.length > 0 && (
            <>
              <label className="param-row">
                <span className="param-label param-label--db">Blue Side Team (DB)</span>
                <select
                  defaultValue=""
                  onChange={e => e.target.value && pickTeamWithRecord("match-intro", "team1", "record1", Number(e.target.value))}
                >
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="param-row">
                <span className="param-label param-label--db">Red Side Team (DB)</span>
                <select
                  defaultValue=""
                  onChange={e => e.target.value && pickTeamWithRecord("match-intro", "team2", "record2", Number(e.target.value))}
                >
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </>
          )}

          {/* ── Break: team pickers ── */}
          {selected === "break" && teams.length > 0 && (
            <>
              <label className="param-row">
                <span className="param-label param-label--db">Blue Side Team (DB)</span>
                <select
                  defaultValue=""
                  onChange={e => e.target.value && pickTeamName("break", "team1", Number(e.target.value))}
                >
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="param-row">
                <span className="param-label param-label--db">Red Side Team (DB)</span>
                <select
                  defaultValue=""
                  onChange={e => e.target.value && pickTeamName("break", "team2", Number(e.target.value))}
                >
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </>
          )}

          {/* ── Match Result: team pickers ── */}
          {selected === "match-result" && teams.length > 0 && (
            <>
              <label className="param-row">
                <span className="param-label param-label--db">Winner Team (DB)</span>
                <select
                  defaultValue=""
                  onChange={e => e.target.value && pickTeamName("match-result", "winner", Number(e.target.value))}
                >
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="param-row">
                <span className="param-label param-label--db">Loser Team (DB)</span>
                <select
                  defaultValue=""
                  onChange={e => e.target.value && pickTeamName("match-result", "loser", Number(e.target.value))}
                >
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </>
          )}

          {/* ── Lower Third: player picker ── */}
          {selected === "lower-third" && teams.length > 0 && (
            <>
              <label className="param-row">
                <span className="param-label param-label--db">Team (DB)</span>
                <select
                  value={ltTeamId}
                  onChange={e => setLtTeamId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {ltPlayers.length > 0 && (
                <label className="param-row">
                  <span className="param-label param-label--db">Player (DB)</span>
                  <select
                    defaultValue=""
                    onChange={e => {
                      const p = ltPlayers.find(p => p.id === Number(e.target.value));
                      if (p) pickPlayer(p);
                    }}
                  >
                    <option value="">— pick player —</option>
                    {ltPlayers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.summonerName}{p.isStarter ? "" : " (sub)"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {/* ── Player Stats: team + per-role pickers ── */}
          {selected === "player-stats" && teams.length > 0 && (
            <>
              <label className="param-row">
                <span className="param-label param-label--db">Team (DB)</span>
                <select value={psTeamId} onChange={e => setPsTeamId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {psPlayers.length > 0 && ROLE_KEYS.map(rk => (
                <label key={rk} className="param-row">
                  <span className="param-label param-label--db">{ROLE_LABELS[rk]} Player (DB)</span>
                  <select
                    value={psRolePicks[rk]}
                    onChange={e => {
                      const id = Number(e.target.value);
                      setPsRolePicks(prev => ({ ...prev, [rk]: id }));
                      pickRolePlayer("player-stats", "", rk, id, psPlayers);
                    }}
                  >
                    <option value="">— pick player —</option>
                    {psPlayers.map(p => <option key={p.id} value={p.id}>{p.summonerName}{p.isStarter ? "" : " (sub)"}</option>)}
                  </select>
                </label>
              ))}
            </>
          )}

          {/* ── Matchup Stats: two team pickers + per-role pickers ── */}
          {selected === "matchup-stats" && teams.length > 0 && (
            <>
              <label className="param-row">
                <span className="param-label param-label--db">Blue Side Team (DB)</span>
                <select value={ms1TeamId} onChange={e => setMs1TeamId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {ms1Players.length > 0 && ROLE_KEYS.map(rk => (
                <label key={"b-"+rk} className="param-row">
                  <span className="param-label param-label--db">Blue {ROLE_LABELS[rk]} (DB)</span>
                  <select
                    value={ms1Picks[rk]}
                    onChange={e => {
                      const id = Number(e.target.value);
                      setMs1Picks(prev => ({ ...prev, [rk]: id }));
                      pickRolePlayer("matchup-stats", "b_", rk, id, ms1Players);
                    }}
                  >
                    <option value="">— pick player —</option>
                    {ms1Players.map(p => <option key={p.id} value={p.id}>{p.summonerName}{p.isStarter ? "" : " (sub)"}</option>)}
                  </select>
                </label>
              ))}
              <label className="param-row">
                <span className="param-label param-label--db">Red Side Team (DB)</span>
                <select value={ms2TeamId} onChange={e => setMs2TeamId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {ms2Players.length > 0 && ROLE_KEYS.map(rk => (
                <label key={"r-"+rk} className="param-row">
                  <span className="param-label param-label--db">Red {ROLE_LABELS[rk]} (DB)</span>
                  <select
                    value={ms2Picks[rk]}
                    onChange={e => {
                      const id = Number(e.target.value);
                      setMs2Picks(prev => ({ ...prev, [rk]: id }));
                      pickRolePlayer("matchup-stats", "r_", rk, id, ms2Players);
                    }}
                  >
                    <option value="">— pick player —</option>
                    {ms2Players.map(p => <option key={p.id} value={p.id}>{p.summonerName}{p.isStarter ? "" : " (sub)"}</option>)}
                  </select>
                </label>
              ))}
            </>
          )}

          {/* ── Player Spotlight: team + player picker ── */}
          {selected === "player-spotlight" && teams.length > 0 && (
            <>
              <label className="param-row">
                <span className="param-label param-label--db">Team (DB)</span>
                <select value={spTeamId} onChange={e => setSpTeamId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">— pick team —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {spPlayers.length > 0 && (
                <label className="param-row">
                  <span className="param-label param-label--db">Player (DB)</span>
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) pickSpotlightPlayer(Number(e.target.value), spPlayers); }}
                  >
                    <option value="">— pick player —</option>
                    {spPlayers.map(p => <option key={p.id} value={p.id}>{p.summonerName}{p.isStarter ? "" : " (sub)"}</option>)}
                  </select>
                </label>
              )}
            </>
          )}

          {/* ── Standard params ── */}
          {paramEntries.length === 0 ? (
            <div className="params-empty">No configuration needed — just hit Go Live.</div>
          ) : (
            paramEntries.map(([key, def]) => (
              <label key={key} className="param-row">
                <span className="param-label">
                  {def.label}
                  {def.hint && <span className="param-hint"> — {def.hint}</span>}
                </span>
                {def.type === "select" ? (
                  <select
                    value={params[selected][key] ?? def.options![0]}
                    onChange={e => setParam(key, e.target.value)}
                  >
                    {def.options!.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={params[selected][key] ?? ""}
                    placeholder={def.placeholder}
                    onChange={e => setParam(key, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") goLive(); }}
                  />
                )}
              </label>
            ))
          )}

          {paramEntries.length > 0 && (
            <div className="params-actions">
              <button className="btn-secondary" onClick={goLive} disabled={sending}>
                {sending ? "Sending…" : isLive ? "Update Live" : "Go Live"}
              </button>
            </div>
          )}
        </div>

        {/* Live status bar */}
        <div className="live-status-bar">
          <span className={`live-dot ${liveScene !== "idle" ? "on" : ""}`} />
          <span className="live-status-text">
            {liveScene === "idle"
              ? "Overlay is off"
              : `Live: ${SCENES[liveScene].label}`}
          </span>
        </div>
      </div>
    </div>
  );
}
