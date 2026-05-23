import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Team, Player, PlayerRankInfo } from "../types";

const REGIONS = ["na1", "euw1", "eun1", "kr", "jp1", "br1", "la1", "la2", "tr1", "ru"];

type FetchStatus = "idle" | "loading" | "ok" | "error";

export default function StatsView() {
  const [hasKey, setHasKey]       = useState(false);
  const [region, setRegion]       = useState("na1");
  const [configOpen, setConfigOpen] = useState(false);
  const [keyInput, setKeyInput]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [teams, setTeams]               = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [players, setPlayers]           = useState<Player[]>([]);

  const [status,  setStatus]  = useState<Record<number, FetchStatus>>({});
  const [results, setResults] = useState<Record<number, PlayerRankInfo>>({});
  const [errors,  setErrors]  = useState<Record<number, string>>({});

  const [refreshingAll, setRefreshingAll] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  async function runBackfill() {
    try {
      const msg = await invoke<string>("backfill_player_links");
      setBackfillMsg(msg);
    } catch (e) {
      setBackfillMsg("Error: " + String(e));
    }
  }

  useEffect(() => {
    invoke<{ hasKey: boolean; region: string }>("riot_get_config").then((cfg) => {
      setHasKey(cfg.hasKey);
      setRegion(cfg.region);
      if (!cfg.hasKey) setConfigOpen(true);
    });
    invoke<Team[]>("get_teams").then((ts) => {
      setTeams(ts);
      if (ts.length > 0) setSelectedTeam(ts[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    invoke<Player[]>("get_players", { teamId: selectedTeam.id }).then((ps) => {
      setPlayers(ps);
      setStatus({});
      setResults({});
      setErrors({});
    });
  }, [selectedTeam]);

  async function saveConfig() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await invoke("riot_set_config", { key: keyInput.trim(), region });
      setHasKey(true);
      setConfigOpen(false);
      setKeyInput("");
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const refreshOne = useCallback(async (player: Player) => {
    setStatus((prev) => ({ ...prev, [player.id]: "loading" }));
    try {
      const info = await invoke<PlayerRankInfo>("riot_fetch_rank", {
        summonerName: player.summonerName,
      });
      setResults((prev) => ({ ...prev, [player.id]: info }));
      setStatus((prev)  => ({ ...prev, [player.id]: "ok" }));
      // Persist the solo rank (fall back to flex) back to the DB
      await invoke("update_player_rank", {
        id:   player.id,
        rank: info.soloRank ?? info.flexRank ?? null,
      });
    } catch (e) {
      setErrors((prev)  => ({ ...prev, [player.id]: String(e) }));
      setStatus((prev)  => ({ ...prev, [player.id]: "error" }));
    }
  }, []);

  async function refreshAll() {
    setRefreshingAll(true);
    // Fire all in parallel — the backend rate-limiter queues them safely.
    await Promise.all(players.map((p) => refreshOne(p)));
    setRefreshingAll(false);
  }

  const starters = players.filter((p) => p.isStarter);
  const subs     = players.filter((p) => !p.isStarter);

  return (
    <div className="stats-layout">

      {/* ── Config bar ── */}
      <div className="stats-config-bar">
        <span className="stats-config-label">
          Riot API
          {hasKey
            ? <span className="stats-key-ok">● Connected</span>
            : <span className="stats-key-missing">● No API key</span>}
        </span>
        <span className="stats-limits">20 req/s · 100 req/2 min</span>
        <button className="btn-secondary stats-config-btn" onClick={runBackfill}>
          Relink Players
        </button>
        {backfillMsg && <span className="muted" style={{ fontSize: 12 }}>{backfillMsg}</span>}
        <button
          className="btn-secondary stats-config-btn"
          onClick={() => { setConfigOpen((v) => !v); setSaveError(null); }}
        >
          {configOpen ? "Close" : hasKey ? "Change Key" : "Set Up Key"}
        </button>
      </div>

      {configOpen && (
        <div className="stats-config-panel">
          <label>
            API Key
            <input
              type="password"
              placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveConfig()}
              autoFocus
            />
          </label>
          <label>
            Region
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          {saveError && <p className="error">{saveError}</p>}
          <div className="modal-actions">
            <button onClick={saveConfig} disabled={!keyInput.trim() || saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn-secondary" onClick={() => { setConfigOpen(false); setSaveError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Team tabs ── */}
      <div className="stats-team-tabs">
        {teams.map((t) => (
          <button
            key={t.id}
            className={`stats-team-tab ${selectedTeam?.id === t.id ? "active" : ""}`}
            onClick={() => setSelectedTeam(t)}
          >
            {t.name}
          </button>
        ))}
        {teams.length === 0 && (
          <span className="muted" style={{ padding: "8px 12px" }}>No teams yet — add them in the Teams tab.</span>
        )}
      </div>

      {/* ── Roster tables ── */}
      {selectedTeam && (
        <div className="stats-roster">
          <div className="stats-roster-header">
            <span className="stats-roster-title">{selectedTeam.name}</span>
            <button
              className="btn-secondary"
              onClick={refreshAll}
              disabled={refreshingAll || !hasKey || players.length === 0}
            >
              {refreshingAll ? "Refreshing…" : "Refresh All Ranks"}
            </button>
          </div>

          {starters.length > 0 && (
            <>
              <div className="roster-section-label">Starters</div>
              <RankTable
                players={starters}
                status={status}
                results={results}
                errors={errors}
                hasKey={hasKey}
                onRefresh={refreshOne}
              />
            </>
          )}

          {subs.length > 0 && (
            <>
              <div className="roster-section-label">Subs</div>
              <RankTable
                players={subs}
                status={status}
                results={results}
                errors={errors}
                hasKey={hasKey}
                onRefresh={refreshOne}
              />
            </>
          )}

          {players.length === 0 && (
            <p className="empty">No players on this roster yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function RankTable({
  players,
  status,
  results,
  errors,
  hasKey,
  onRefresh,
}: {
  players:   Player[];
  status:    Record<number, FetchStatus>;
  results:   Record<number, PlayerRankInfo>;
  errors:    Record<number, string>;
  hasKey:    boolean;
  onRefresh: (p: Player) => void;
}) {
  return (
    <table className="rank-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Summoner</th>
          <th>Solo Rank</th>
          <th>LP</th>
          <th>Solo W/L</th>
          <th>Flex Rank</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const st  = status[p.id]  ?? "idle";
          const res = results[p.id];
          const err = errors[p.id];

          const soloRank = res?.soloRank ?? (st === "idle" ? (p.rank ?? "—") : "—");
          const soloLp   = res?.soloLp   != null ? `${res.soloLp} LP` : "";
          const soloWL   = res?.soloWins != null
            ? `${res.soloWins}W / ${res.soloLosses}L`
            : "—";
          const flexRank = res?.flexRank ?? "—";

          return (
            <>
              <tr key={p.id}>
                <td className="player-name">{p.displayName}</td>
                <td className="muted">{p.summonerName}</td>
                <td className={st === "ok" ? "rank-cell-fresh" : ""}>
                  {st === "loading" ? <span className="rank-loading">…</span> : soloRank}
                </td>
                <td className="muted">{st === "loading" ? "" : soloLp}</td>
                <td className="muted">{st === "loading" ? "" : soloWL}</td>
                <td className="muted">{st === "loading" ? "" : flexRank}</td>
                <td className="row-actions">
                  <button
                    className="btn-secondary"
                    disabled={st === "loading" || !hasKey}
                    onClick={() => onRefresh(p)}
                  >
                    {st === "loading" ? "…" : "Refresh"}
                  </button>
                </td>
              </tr>
              {st === "error" && err && (
                <tr className="rank-error-row">
                  <td colSpan={8}>
                    <code className="rank-error-text">{err}</code>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );
}
