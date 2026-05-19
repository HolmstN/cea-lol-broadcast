import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Team, Player, TournamentStats, PlayerRankInfo, CeaEntryInfo, CeaImportPlayer } from "../types";

const EMPTY_FORM = {
  displayName: "",
  summonerName: "",
  rank: "",
  notes: "",
  isStarter: true,
};

type PlayerForm = typeof EMPTY_FORM;

export default function TeamsView() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<Record<number, TournamentStats>>({});

  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);

  const [playerModal, setPlayerModal] = useState<"new" | Player | null>(null);
  const [form, setForm] = useState<PlayerForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [statsModal, setStatsModal] = useState<Player | null>(null);
  const [statsForm, setStatsForm] = useState({ wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 });

  const [refreshingRanks, setRefreshingRanks] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);
  const [hasRiotKey, setHasRiotKey] = useState(false);

  // CEA roster import (per team)
  type CeaRow = { name: string; displayName: string; summonerName: string; isStarter: boolean };
  const [ceaOpen, setCeaOpen]       = useState(false);
  const [ceaTeamId, setCeaTeamId]   = useState("");
  const [ceaLoading, setCeaLoading] = useState(false);
  const [ceaError, setCeaError]     = useState<string | null>(null);
  const [ceaRows, setCeaRows]       = useState<CeaRow[]>([]);
  const [ceaSaving, setCeaSaving]   = useState(false);

  // CEA competition import (bulk teams)
  const [compImportOpen, setCompImportOpen]       = useState(false);
  const [compImportId, setCompImportId]           = useState("");
  const [compImportLoading, setCompImportLoading] = useState(false);
  const [compImportError, setCompImportError]     = useState<string | null>(null);
  const [compEntries, setCompEntries]             = useState<CeaEntryInfo[]>([]);
  const [compSelected, setCompSelected]           = useState<Set<string>>(new Set());
  const [compImporting, setCompImporting]         = useState(false);

  // Roster sync
  const [syncOpen, setSyncOpen]         = useState(false);
  const [syncCompId, setSyncCompId]     = useState("");
  const [syncAuthToken, setSyncAuthToken] = useState("");
  const [syncing, setSyncing]           = useState(false);
  const [syncLog, setSyncLog]           = useState<string[]>([]);

  useEffect(() => {
    loadTeams();
    invoke<{ hasKey: boolean; region: string }>("riot_get_config")
      .then((cfg) => setHasRiotKey(cfg.hasKey))
      .catch(() => {});
    invoke<{ authToken: string | null }>("get_cea_settings")
      .then((s) => { if (s.authToken) setSyncAuthToken(s.authToken); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTeam) loadPlayers(selectedTeam.id);
    else setPlayers([]);
  }, [selectedTeam]);

  async function loadTeams() {
    const result = await invoke<Team[]>("get_teams");
    setTeams(result);
  }

  async function loadPlayers(teamId: number) {
    const result = await invoke<Player[]>("get_players", { teamId });
    setPlayers(result);
    const statsResult = await invoke<TournamentStats[]>("get_team_stats", { teamId });
    const statsMap: Record<number, TournamentStats> = {};
    for (const s of statsResult) statsMap[s.playerId] = s;
    setStats(statsMap);
  }

  async function handleAddTeam() {
    const name = newTeamName.trim();
    if (!name) return;
    const team = await invoke<Team>("create_team", { name });
    setTeams((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTeamName("");
    setSelectedTeam(team);
  }

  async function handleRenameTeam() {
    if (!selectedTeam || editingTeamName === null) return;
    const name = editingTeamName.trim();
    if (!name || name === selectedTeam.name) { setEditingTeamName(null); return; }
    await invoke("update_team", { id: selectedTeam.id, name });
    const updated = { ...selectedTeam, name };
    setSelectedTeam(updated);
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingTeamName(null);
  }

  async function handleDeleteTeam(team: Team) {
    if (!confirm(`Delete "${team.name}" and all its players?`)) return;
    await invoke("delete_team", { id: team.id });
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    if (selectedTeam?.id === team.id) setSelectedTeam(null);
  }

  function openNewPlayer() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setPlayerModal("new");
  }

  function openEditPlayer(p: Player) {
    setForm({
      displayName: p.displayName,
      summonerName: p.summonerName,
      rank: p.rank ?? "",
      notes: p.notes ?? "",
      isStarter: p.isStarter,
    });
    setFormError(null);
    setPlayerModal(p);
  }

  async function handleSavePlayer() {
    if (!selectedTeam) return;
    setFormError(null);
    if (!form.displayName.trim()) { setFormError("Display name is required."); return; }
    if (!form.summonerName.trim()) { setFormError("Summoner name is required."); return; }

    try {
      if (playerModal === "new") {
        await invoke("create_player", {
          teamId: selectedTeam.id,
          summonerName: form.summonerName.trim(),
          displayName: form.displayName.trim(),
          rank: form.rank.trim() || null,
          notes: form.notes.trim() || null,
          isStarter: form.isStarter,
        });
      } else if (playerModal) {
        await invoke("update_player", {
          id: playerModal.id,
          summonerName: form.summonerName.trim(),
          displayName: form.displayName.trim(),
          rank: form.rank.trim() || null,
          notes: form.notes.trim() || null,
          isStarter: form.isStarter,
        });
      }
      setPlayerModal(null);
      loadPlayers(selectedTeam.id);
    } catch (e) {
      setFormError(String(e));
    }
  }

  async function handleDeletePlayer(p: Player) {
    if (!confirm(`Remove "${p.displayName}" from the roster?`)) return;
    await invoke("delete_player", { id: p.id });
    setPlayers((prev) => prev.filter((x) => x.id !== p.id));
  }

  function openStatsModal(p: Player) {
    const s = stats[p.id];
    setStatsForm({
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      kills: s?.kills ?? 0,
      deaths: s?.deaths ?? 0,
      assists: s?.assists ?? 0,
    });
    setStatsModal(p);
  }

  async function handleSaveStats() {
    if (!statsModal || !selectedTeam) return;
    await invoke("update_player_stats", { playerId: statsModal.id, ...statsForm });
    await loadPlayers(selectedTeam.id);
    setStatsModal(null);
  }

  async function handleFetchCompEntries() {
    const id = compImportId.trim();
    if (!id) return;
    setCompImportLoading(true);
    setCompImportError(null);
    setCompEntries([]);
    setCompSelected(new Set());
    try {
      const entries = await invoke<CeaEntryInfo[]>("fetch_cea_competition_entries", { competitionId: id });
      setCompEntries(entries);
      setCompSelected(new Set(entries.map(e => e.entryId)));
    } catch (e) {
      setCompImportError(String(e));
    } finally {
      setCompImportLoading(false);
    }
  }

  async function handleImportCompTeams() {
    setCompImporting(true);
    setCompImportError(null);
    const toImport = compEntries.filter(e => compSelected.has(e.entryId));
    const errors: string[] = [];
    for (const entry of toImport) {
      try {
        const team = await invoke<Team>("import_competition_team", { name: entry.teamName, ceaEntryId: entry.entryId });
        const rosterPlayers = await invoke<CeaImportPlayer[]>(
          "fetch_cea_roster", { ceaTeamId: parseInt(entry.entryId, 10) }
        ).catch(() => [] as CeaImportPlayer[]);
        for (const p of rosterPlayers) {
          await invoke("create_player", {
            teamId: team.id, summonerName: p.summonerName ?? p.name, displayName: p.name,
            rank: null, notes: null, isStarter: p.isStarter,
          }).catch(() => {});
        }
      } catch (e) {
        errors.push(`${entry.teamName}: ${String(e)}`);
      }
    }
    await loadTeams();
    setCompImporting(false);
    if (errors.length > 0) {
      setCompImportError(errors.join("; "));
    } else {
      setCompImportOpen(false);
      setCompEntries([]);
      setCompSelected(new Set());
      setCompImportId("");
    }
  }

  async function handleSyncRosters() {
    const id = syncCompId.trim();
    if (!id) return;
    setSyncing(true);
    setSyncLog([]);
    try {
      await invoke("save_cea_auth_token", { token: syncAuthToken.trim() || null });
      const log = await invoke<string[]>("sync_competition_rosters", { competitionId: id });
      setSyncLog(log);
      await loadTeams();
      if (selectedTeam) await loadPlayers(selectedTeam.id);
    } catch (e) {
      setSyncLog([String(e)]);
    } finally {
      setSyncing(false);
    }
  }

  async function handleResetStats(p: Player) {
    if (!confirm(`Reset all stats for "${p.displayName}"?`)) return;
    await invoke("reset_player_stats", { playerId: p.id });
    if (selectedTeam) await loadPlayers(selectedTeam.id);
  }

  async function handleQuickStat(p: Player, field: "wins" | "losses") {
    const s = stats[p.id];
    if (!s) return;
    const updated = { ...s, [field]: s[field] + 1 };
    await invoke("update_player_stats", {
      playerId: p.id,
      wins: updated.wins,
      losses: updated.losses,
      kills: updated.kills,
      deaths: updated.deaths,
      assists: updated.assists,
    });
    if (selectedTeam) await loadPlayers(selectedTeam.id);
  }

  function closeCea() {
    setCeaOpen(false);
    setCeaTeamId("");
    setCeaRows([]);
    setCeaError(null);
  }

  async function handleFetchCea() {
    const id = ceaTeamId.trim();
    if (!id) return;
    setCeaLoading(true);
    setCeaError(null);
    setCeaRows([]);
    try {
      const result = await invoke<CeaImportPlayer[]>(
        "fetch_cea_roster", { ceaTeamId: parseInt(id, 10) }
      );
      setCeaRows(result.map(p => ({
        name:         p.name,
        displayName:  p.name,
        summonerName: p.summonerName ?? p.name,
        isStarter:    p.isStarter,
      })));
    } catch (e) {
      setCeaError(String(e));
    } finally {
      setCeaLoading(false);
    }
  }

  async function handleImportCea() {
    if (!selectedTeam) return;
    setCeaSaving(true);
    setCeaError(null);
    try {
      for (const row of ceaRows) {
        await invoke("create_player", {
          teamId:       selectedTeam.id,
          summonerName: row.summonerName.trim() || row.name,
          displayName:  row.displayName.trim()  || row.name,
          rank:         null,
          notes:        null,
          isStarter:    row.isStarter,
        });
      }
      closeCea();
      await loadPlayers(selectedTeam.id);
    } catch (e) {
      setCeaError(String(e));
    } finally {
      setCeaSaving(false);
    }
  }

  async function handleRefreshRanks() {
    if (!selectedTeam || players.length === 0) return;
    setRefreshingRanks(true);
    setRankError(null);
    const errors: string[] = [];
    await Promise.all(
      players.map(async (p) => {
        try {
          const info = await invoke<PlayerRankInfo>("riot_fetch_rank", { summonerName: p.summonerName });
          await invoke("update_player_rank", { id: p.id, rank: info.soloRank ?? info.flexRank ?? null });
        } catch (e) {
          errors.push(`${p.displayName}: ${String(e)}`);
        }
      })
    );
    if (errors.length > 0) setRankError(errors.join(" · "));
    await loadPlayers(selectedTeam.id);
    setRefreshingRanks(false);
  }

  const starters = players.filter((p) => p.isStarter);
  const subs = players.filter((p) => !p.isStarter);

  return (
    <div className="teams-layout">
      {/* Left panel — team list */}
      <aside className="team-list">
        <div className="panel-header">Teams ({teams.length}/16)</div>
        <div className="team-entries">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`team-entry ${selectedTeam?.id === team.id ? "selected" : ""}`}
              onClick={() => setSelectedTeam(team)}
            >
              <span className="team-entry-name">{team.name}</span>
              <button
                className="btn-icon"
                onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team); }}
                title="Delete team"
              >✕</button>
            </div>
          ))}
        </div>
        <div className="add-team-row">
          <input
            placeholder="New team name…"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTeam()}
          />
          <button onClick={handleAddTeam} disabled={!newTeamName.trim()}>Add</button>
        </div>
        <div className="add-team-row">
          <button className="btn-secondary" style={{ width: "100%" }} onClick={() => setCompImportOpen(true)}>↓ Import from CEA</button>
        </div>
        <div className="add-team-row">
          <button className="btn-secondary" style={{ width: "100%" }} onClick={() => { setSyncLog([]); setSyncOpen(true); }}>↻ Sync Rosters</button>
        </div>
      </aside>

      {/* Right panel — roster */}
      <section className="roster-panel">
        {!selectedTeam ? (
          <p className="empty">Select a team to manage its roster.</p>
        ) : (
          <>
            <div className="panel-header roster-header">
              {editingTeamName === null ? (
                <>
                  <span className="team-title">{selectedTeam.name}</span>
                  <button className="btn-secondary" onClick={() => setEditingTeamName(selectedTeam.name)}>Rename</button>
                </>
              ) : (
                <>
                  <input
                    className="team-name-input"
                    value={editingTeamName}
                    onChange={(e) => setEditingTeamName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRenameTeam(); if (e.key === "Escape") setEditingTeamName(null); }}
                    autoFocus
                  />
                  <button onClick={handleRenameTeam}>Save</button>
                  <button className="btn-secondary" onClick={() => setEditingTeamName(null)}>Cancel</button>
                </>
              )}
              <button
                className="btn-secondary"
                onClick={handleRefreshRanks}
                disabled={refreshingRanks || !hasRiotKey || players.length === 0}
                title={!hasRiotKey ? "Add a Riot API key in the Stats tab first" : ""}
              >
                {refreshingRanks ? "Refreshing…" : "↻ Refresh Ranks"}
              </button>
              <button className="btn-secondary" onClick={() => setCeaOpen(true)} disabled={players.length >= 7}>↓ Import from CEA</button>
              <button onClick={openNewPlayer} disabled={players.length >= 7}>+ Add Player</button>
            </div>

            {rankError && (
              <div style={{ padding: "6px 20px" }}>
                <code className="rank-error-text">{rankError}</code>
              </div>
            )}

            <div className="roster-section-label">Starters ({starters.length}/5)</div>
            <PlayerTable players={starters} stats={stats} onEdit={openEditPlayer} onDelete={handleDeletePlayer} onEditStats={openStatsModal} onQuickStat={handleQuickStat} />

            <div className="roster-section-label">Subs ({subs.length}/2)</div>
            <PlayerTable players={subs} stats={stats} onEdit={openEditPlayer} onDelete={handleDeletePlayer} onEditStats={openStatsModal} onQuickStat={handleQuickStat} />
          </>
        )}
      </section>

      {/* Stats modal */}
      {statsModal !== null && (
        <div className="modal-backdrop" onClick={() => setStatsModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Edit Stats — {statsModal.displayName}</div>
            {(["wins", "losses", "kills", "deaths", "assists"] as const).map((field) => (
              <label key={field}>
                {field.charAt(0).toUpperCase() + field.slice(1)}
                <input
                  type="number"
                  min={0}
                  value={statsForm[field]}
                  onChange={(e) => setStatsForm({ ...statsForm, [field]: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </label>
            ))}
            <div className="modal-actions">
              <button onClick={handleSaveStats}>Save</button>
              <button className="btn-secondary" onClick={() => setStatsModal(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { setStatsModal(null); handleResetStats(statsModal); }}>Reset All</button>
            </div>
          </div>
        </div>
      )}

      {/* CEA competition import modal */}
      {compImportOpen && (
        <div className="modal-backdrop" onClick={() => { if (!compImporting) { setCompImportOpen(false); setCompEntries([]); setCompSelected(new Set()); setCompImportId(""); setCompImportError(null); } }}>
          <div className="modal modal--import" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Import Teams from CEA Competition</div>
            <div className="import-url-row">
              <input
                placeholder="Competition ID (e.g. 2595)"
                value={compImportId}
                onChange={e => setCompImportId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetchCompEntries()}
                autoFocus
              />
              <button onClick={handleFetchCompEntries} disabled={!compImportId.trim() || compImportLoading} style={{ flexShrink: 0 }}>
                {compImportLoading ? "Fetching…" : "Fetch"}
              </button>
            </div>
            {compImportError && <p className="error">{compImportError}</p>}
            {compEntries.length > 0 && (
              <>
                <div className="import-select-all-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={compSelected.size === compEntries.length}
                      onChange={e => setCompSelected(e.target.checked ? new Set(compEntries.map(e => e.entryId)) : new Set())}
                    />
                    {" "}Select all ({compEntries.length})
                  </label>
                </div>
                <table className="import-table">
                  <thead><tr><th></th><th>#</th><th>Team Name</th><th>Company</th></tr></thead>
                  <tbody>
                    {compEntries.map(entry => (
                      <tr key={entry.entryId}>
                        <td><input type="checkbox" checked={compSelected.has(entry.entryId)} onChange={e => setCompSelected(prev => { const next = new Set(prev); e.target.checked ? next.add(entry.entryId) : next.delete(entry.entryId); return next; })} /></td>
                        <td className="muted">{entry.seed ?? "—"}</td>
                        <td>{entry.teamName}</td>
                        <td className="muted">{entry.company}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="modal-actions">
                  <button onClick={handleImportCompTeams} disabled={compImporting || compSelected.size === 0}>
                    {compImporting ? "Importing…" : `Import ${compSelected.size} team${compSelected.size !== 1 ? "s" : ""}`}
                  </button>
                  <button className="btn-secondary" onClick={() => { setCompImportOpen(false); setCompEntries([]); setCompSelected(new Set()); setCompImportId(""); setCompImportError(null); }}>Cancel</button>
                </div>
              </>
            )}
            {compEntries.length === 0 && !compImportLoading && (
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => { setCompImportOpen(false); setCompImportError(null); }}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CEA roster import modal */}
      {ceaOpen && (
        <div className="modal-backdrop" onClick={closeCea}>
          <div className="modal modal--import" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Import from CEA</div>
            <p className="modal-subtitle">Enter the CEA Team ID to fetch the roster.</p>

            <div className="import-url-row">
              <input
                placeholder="CEA Team ID (e.g. 43175)"
                value={ceaTeamId}
                onChange={e => setCeaTeamId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetchCea()}
                autoFocus
              />
              <button onClick={handleFetchCea} disabled={!ceaTeamId.trim() || ceaLoading} style={{ flexShrink: 0 }}>
                {ceaLoading ? "Fetching…" : "Fetch"}
              </button>
            </div>

            {ceaError && <p className="error">{ceaError}</p>}

            {ceaRows.length > 0 && (
              <>
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>CEA Name</th>
                      <th>Display Name</th>
                      <th>Summoner Name</th>
                      <th>Starter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ceaRows.map((row, i) => (
                      <tr key={i}>
                        <td className="muted import-summoner">{row.name}</td>
                        <td>
                          <input
                            value={row.displayName}
                            onChange={e => setCeaRows(prev => prev.map((r, j) => j === i ? { ...r, displayName: e.target.value } : r))}
                          />
                        </td>
                        <td>
                          <input
                            value={row.summonerName}
                            placeholder="gameName#TAG"
                            onChange={e => setCeaRows(prev => prev.map((r, j) => j === i ? { ...r, summonerName: e.target.value } : r))}
                          />
                        </td>
                        <td className="import-starter-cell">
                          <input
                            type="checkbox"
                            checked={row.isStarter}
                            onChange={e => setCeaRows(prev => prev.map((r, j) => j === i ? { ...r, isStarter: e.target.checked } : r))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="modal-actions">
                  <button onClick={handleImportCea} disabled={ceaSaving}>
                    {ceaSaving ? "Importing…" : `Import ${ceaRows.length} Player${ceaRows.length !== 1 ? "s" : ""}`}
                  </button>
                  <button className="btn-secondary" onClick={closeCea}>Cancel</button>
                </div>
              </>
            )}

            {ceaRows.length === 0 && !ceaLoading && (
              <div className="modal-actions">
                <button className="btn-secondary" onClick={closeCea}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync rosters modal */}
      {syncOpen && (
        <div className="modal-backdrop" onClick={() => !syncing && setSyncOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Sync Rosters from CEA</div>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px" }}>
              Re-fetches every team's roster for this competition and updates player Summoner Names.
            </p>
            <label>Competition ID
              <input
                value={syncCompId}
                onChange={e => setSyncCompId(e.target.value)}
                placeholder="e.g. 2595"
                disabled={syncing}
                autoFocus
              />
            </label>
            <label>CEA Auth Token
              <textarea
                rows={3}
                value={syncAuthToken}
                onChange={e => setSyncAuthToken(e.target.value)}
                placeholder="Paste your CEA Bearer token here…"
                disabled={syncing}
                style={{ fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
              />
            </label>
            {syncLog.length > 0 && (
              <ul style={{ fontSize: 12, margin: "10px 0", padding: "0 0 0 16px", color: "#ccc" }}>
                {syncLog.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            )}
            <div className="modal-actions">
              <button onClick={handleSyncRosters} disabled={syncing || !syncCompId.trim()}>
                {syncing ? "Syncing…" : "Sync"}
              </button>
              <button className="btn-secondary" onClick={() => setSyncOpen(false)} disabled={syncing}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Player modal */}
      {playerModal !== null && (
        <div className="modal-backdrop" onClick={() => setPlayerModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{playerModal === "new" ? "Add Player" : "Edit Player"}</div>
            <label>Display Name *
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} autoFocus />
            </label>
            <label>Summoner Name *
              <input value={form.summonerName} onChange={(e) => setForm({ ...form, summonerName: e.target.value })} />
            </label>
            <label>Rank
              <input placeholder="e.g. Diamond 2" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.isStarter} onChange={(e) => setForm({ ...form, isStarter: e.target.checked })} />
              Starter (uncheck for sub)
            </label>
            <label>Notes
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {formError && <p className="error">{formError}</p>}
            <div className="modal-actions">
              <button onClick={handleSavePlayer}>Save</button>
              <button className="btn-secondary" onClick={() => setPlayerModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerTable({
  players,
  stats,
  onEdit,
  onDelete,
  onEditStats,
  onQuickStat,
}: {
  players: Player[];
  stats: Record<number, TournamentStats>;
  onEdit: (p: Player) => void;
  onDelete: (p: Player) => void;
  onEditStats: (p: Player) => void;
  onQuickStat: (p: Player, field: "wins" | "losses") => void;
}) {
  if (players.length === 0) return <p className="empty-roster">None yet.</p>;
  return (
    <table className="player-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Summoner</th>
          <th>Rank</th>
          <th>W/L</th>
          <th>KDA</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const s = stats[p.id];
          const kda = s && s.deaths > 0
            ? ((s.kills + s.assists) / s.deaths).toFixed(2)
            : s ? "Perfect" : "—";
          return (
            <tr key={p.id}>
              <td className="player-name">{p.displayName}</td>
              <td className="muted">{p.summonerName}</td>
              <td className="muted">{p.rank ?? "—"}</td>
              <td className="stat-cell">
                <span className="muted">{s ? `${s.wins}/${s.losses}` : "—"}</span>
                <button className="btn-stat" title="+1 Win" onClick={() => onQuickStat(p, "wins")}>+W</button>
                <button className="btn-stat" title="+1 Loss" onClick={() => onQuickStat(p, "losses")}>+L</button>
              </td>
              <td className="muted">{kda}</td>
              <td className="row-actions">
                <button className="btn-secondary" onClick={() => onEdit(p)}>Edit</button>
                <button className="btn-secondary" onClick={() => onEditStats(p)}>Stats</button>
                <button className="btn-danger" onClick={() => onDelete(p)}>✕</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
