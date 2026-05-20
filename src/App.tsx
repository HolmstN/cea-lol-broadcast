import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import LiveView from "./views/LiveView";
import TeamsView from "./views/TeamsView";
import StreamerView from "./views/StreamerView";
import StatsView from "./views/StatsView";
import MatchView from "./views/MatchView";
import type { Team, Player, RoleKey } from "./types";
import { ROLE_KEYS } from "./types";
import "./App.css";

const EMPTY_ROLES: Record<RoleKey, number | ""> = { top: "", jg: "", mid: "", adc: "", sup: "" };
const ROLE_LABELS_SHORT: Record<RoleKey, string> = { top: "Top", jg: "Jg", mid: "Mid", adc: "ADC", sup: "Sup" };

type Tab = "live" | "teams" | "stats" | "match" | "streamer";

export default function App() {
  const [tab, setTab] = useState<Tab>("live");

  // Shared match context — persists across tab switches
  const [teams, setTeams]           = useState<Team[]>([]);
  const [blueTeamId, setBlueTeamId] = useState<number | "">("");
  const [redTeamId, setRedTeamId]   = useState<number | "">("");
  const [bluePlayers, setBluePlayers] = useState<Player[]>([]);
  const [redPlayers, setRedPlayers]   = useState<Player[]>([]);
  const [blueRoles, setBlueRoles]   = useState<Record<RoleKey, number | "">>(EMPTY_ROLES);
  const [redRoles,  setRedRoles]    = useState<Record<RoleKey, number | "">>(EMPTY_ROLES);

  useEffect(() => {
    invoke<Team[]>("get_teams").then(setTeams).catch(() => {});
  }, []);

  useEffect(() => {
    if (blueTeamId === "") { setBluePlayers([]); return; }
    invoke<Player[]>("get_players", { teamId: blueTeamId }).then(setBluePlayers).catch(() => {});
    setBlueRoles(EMPTY_ROLES);
  }, [blueTeamId]);

  useEffect(() => {
    if (redTeamId === "") { setRedPlayers([]); return; }
    invoke<Player[]>("get_players", { teamId: redTeamId }).then(setRedPlayers).catch(() => {});
    setRedRoles(EMPTY_ROLES);
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

      {/* Match players — role assignments, visible below header on Live/Streamer tabs */}
      {showCtx && (bluePlayers.length > 0 || redPlayers.length > 0) && (
        <div className="match-players-bar">
          {bluePlayers.length > 0 && (
            <div className="match-players-row match-players-blue">
              <span className="match-players-team">{blueTeam?.name ?? "Blue"}</span>
              {ROLE_KEYS.map(rk => (
                <label key={rk} className="match-players-role">
                  <span className="match-players-role-label">{ROLE_LABELS_SHORT[rk]}</span>
                  <select
                    className="match-players-select"
                    value={blueRoles[rk]}
                    onChange={e => setBlueRoles(prev => ({ ...prev, [rk]: e.target.value === "" ? "" : Number(e.target.value) }))}
                  >
                    <option value="">—</option>
                    {bluePlayers.map(p => <option key={p.id} value={p.id}>{p.summonerName}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          {redPlayers.length > 0 && (
            <div className="match-players-row match-players-red">
              <span className="match-players-team">{redTeam?.name ?? "Red"}</span>
              {ROLE_KEYS.map(rk => (
                <label key={rk} className="match-players-role">
                  <span className="match-players-role-label">{ROLE_LABELS_SHORT[rk]}</span>
                  <select
                    className="match-players-select"
                    value={redRoles[rk]}
                    onChange={e => setRedRoles(prev => ({ ...prev, [rk]: e.target.value === "" ? "" : Number(e.target.value) }))}
                  >
                    <option value="">—</option>
                    {redPlayers.map(p => <option key={p.id} value={p.id}>{p.summonerName}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="view">
        {tab === "live"     && <LiveView blueTeam={blueTeam} redTeam={redTeam} />}
        {tab === "teams"    && <TeamsView />}
        {tab === "stats"    && <StatsView />}
        {tab === "match"    && <MatchView />}
        {tab === "streamer" && (
          <StreamerView
            blueTeam={blueTeam} redTeam={redTeam}
            bluePlayers={bluePlayers} redPlayers={redPlayers}
            blueRoles={blueRoles} redRoles={redRoles}
            teams={teams}
          />
        )}
      </div>
    </main>
  );
}
