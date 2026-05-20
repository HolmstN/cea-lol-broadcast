import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import LiveView from "./views/LiveView";
import TeamsView from "./views/TeamsView";
import StreamerView from "./views/StreamerView";
import StatsView from "./views/StatsView";
import MatchView from "./views/MatchView";
import type { Team, Player } from "./types";
import "./App.css";

type Tab = "live" | "teams" | "stats" | "match" | "streamer";

export default function App() {
  const [tab, setTab] = useState<Tab>("live");

  // Shared match context — persists across tab switches
  const [teams, setTeams]           = useState<Team[]>([]);
  const [blueTeamId, setBlueTeamId] = useState<number | "">("");
  const [redTeamId, setRedTeamId]   = useState<number | "">("");
  const [bluePlayers, setBluePlayers] = useState<Player[]>([]);
  const [redPlayers, setRedPlayers]   = useState<Player[]>([]);

  useEffect(() => {
    invoke<Team[]>("get_teams").then(setTeams).catch(() => {});
  }, []);

  useEffect(() => {
    if (blueTeamId === "") { setBluePlayers([]); return; }
    invoke<Player[]>("get_players", { teamId: blueTeamId }).then(setBluePlayers).catch(() => {});
  }, [blueTeamId]);

  useEffect(() => {
    if (redTeamId === "") { setRedPlayers([]); return; }
    invoke<Player[]>("get_players", { teamId: redTeamId }).then(setRedPlayers).catch(() => {});
  }, [redTeamId]);

  const blueTeam = teams.find(t => t.id === blueTeamId) ?? null;
  const redTeam  = teams.find(t => t.id === redTeamId)  ?? null;

  const showCtx = tab === "live" || tab === "streamer";

  return (
    <main>
      <header>
        <h1>CEA LoL Broadcast</h1>
        <nav className="tabs">
          <button className={`tab ${tab === "live"     ? "active" : ""}`} onClick={() => setTab("live")}>Live</button>
          <button className={`tab ${tab === "teams"    ? "active" : ""}`} onClick={() => setTab("teams")}>Teams</button>
          <button className={`tab ${tab === "stats"    ? "active" : ""}`} onClick={() => setTab("stats")}>Stats</button>
          <button className={`tab ${tab === "match"    ? "active" : ""}`} onClick={() => setTab("match")}>Match</button>
          <button className={`tab ${tab === "streamer" ? "active" : ""}`} onClick={() => setTab("streamer")}>Streamer</button>
        </nav>

        {showCtx && teams.length > 0 && (
          <div className="match-ctx-bar">
            <span className="match-ctx-label">Match:</span>
            <select
              className="match-ctx-select match-ctx-blue"
              value={blueTeamId}
              onChange={e => setBlueTeamId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">— Blue Side —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <span className="match-ctx-vs">vs</span>
            <select
              className="match-ctx-select match-ctx-red"
              value={redTeamId}
              onChange={e => setRedTeamId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">— Red Side —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </header>

      <div className="view">
        {tab === "live"     && <LiveView blueTeam={blueTeam} redTeam={redTeam} />}
        {tab === "teams"    && <TeamsView />}
        {tab === "stats"    && <StatsView />}
        {tab === "match"    && <MatchView />}
        {tab === "streamer" && (
          <StreamerView
            blueTeam={blueTeam} redTeam={redTeam}
            bluePlayers={bluePlayers} redPlayers={redPlayers}
            teams={teams}
          />
        )}
      </div>
    </main>
  );
}
