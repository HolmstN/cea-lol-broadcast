import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Player, Team, CeaSettings, CeaMatchInfo, CeaImportPlayer, MatchPlayerInput, MatchEditGame, MatchEditInfo } from "../types";
import { ROLES } from "../types";
import ChampionInput from "../components/ChampionInput";
import { useChampions } from "../hooks/useChampions";

type Step = "config" | "syncing" | "roster" | "queue" | "entry" | "done" | "editMatches";

interface RosterResult {
  entryId: string;
  ceaPlayers: CeaImportPlayer[];
  matchInfos: CeaMatchInfo[];
  error: string | null;
}

interface QueuedMatch {
  matchId: string;
  entryId: string;
  date: string | null;
  status: string | null;
  imported: boolean;
  selected: boolean;
}

interface GameForm {
  team1Won: boolean;
  players: MatchPlayerInput[];
}

const EMPTY_PLAYER = (gameNumber: number): MatchPlayerInput => ({
  playerId: null, summonerName: "", role: "", champion: "",
  kills: 0, deaths: 0, assists: 0, gold: null, cs: null,
  won: false, team: 1, gameNumber,
});

function emptyGameForm(gameNumber: number): GameForm {
  return {
    team1Won: true,
    players: [
      ...Array(5).fill(null).map(() => ({ ...EMPTY_PLAYER(gameNumber), team: 1 as const })),
      ...Array(5).fill(null).map(() => ({ ...EMPTY_PLAYER(gameNumber), team: 2 as const, won: false })),
    ],
  };
}


export default function MatchView() {
  const champions = useChampions();
  const [step, setStep] = useState<Step>("config");
  const [settings, setSettings] = useState<CeaSettings>({ competitionId: "", entryIds: [], authToken: null });
  const [entryIdInput, setEntryIdInput] = useState("");
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1Filter, setTeam1Filter] = useState<number | null>(null);
  const [team2Filter, setTeam2Filter] = useState<number | null>(null);
  const [rosterResults, setRosterResults] = useState<RosterResult[]>([]);
  const [rosterIdx, setRosterIdx] = useState(0);
  const [queue, setQueue] = useState<QueuedMatch[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [games, setGames] = useState<GameForm[]>([emptyGameForm(1)]);
  const [activeGame, setActiveGame] = useState(0);
  const [matchDuration, setMatchDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [importLog, setImportLog] = useState<string[] | null>(null);

  // Edit Matches state
  interface GameEditState { duration: string; blueTeam: number | null; saved: boolean; }
  const [editMatches, setEditMatches]   = useState<MatchEditInfo[]>([]);
  const [editMatchIdx, setEditMatchIdx] = useState(0);
  const [editInputs, setEditInputs]     = useState<Record<string, GameEditState>>({});
  const [editLoading, setEditLoading]   = useState(false);
  const [editErr, setEditErr]           = useState<string | null>(null);

  useEffect(() => {
    invoke<CeaSettings>("get_cea_settings").then(s => setSettings(s)).catch(() => {});
    invoke<Player[]>("get_all_players").then(setAllPlayers).catch(() => {});
    invoke<Team[]>("get_teams").then(setTeams).catch(() => {});
  }, []);

  function parseMmSs(s: string): number | null {
    const m = s.trim().match(/^(\d{1,3}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1]) * 60 + parseInt(m[2]);
  }
  function fmtMmSs(sec: number): string {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }
  function editKey(matchId: number, gameNumber: number) { return `${matchId}-${gameNumber}`; }

  async function loadEditMatches() {
    if (!settings.competitionId) return;
    setEditLoading(true);
    setEditErr(null);
    try {
      const matches = await invoke<MatchEditInfo[]>("get_matches_for_edit", { competitionId: settings.competitionId });
      setEditMatches(matches);
      setEditMatchIdx(0);
      const inputs: Record<string, GameEditState> = {};
      for (const m of matches) {
        for (const g of m.games) {
          inputs[editKey(m.matchId, g.gameNumber)] = {
            duration: g.durationSec != null ? fmtMmSs(g.durationSec) : "",
            blueTeam: g.blueTeam,
            saved: false,
          };
        }
      }
      setEditInputs(inputs);
    } catch (e) {
      setEditErr(String(e));
    } finally {
      setEditLoading(false);
    }
  }

  async function saveGame(match: MatchEditInfo, game: MatchEditGame) {
    const key = editKey(match.matchId, game.gameNumber);
    const state = editInputs[key];
    if (!state) return;
    const raw = state.duration.trim();
    const durationSec = raw === "" ? null : parseMmSs(raw);
    if (raw !== "" && durationSec === null) return;
    try {
      await invoke("update_game_metadata", {
        matchId: match.matchId,
        gameNumber: game.gameNumber,
        durationSec,
        blueTeam: state.blueTeam,
      });
      setEditInputs(prev => ({ ...prev, [key]: { ...prev[key], saved: true } }));
    } catch (e) {
      setEditErr(String(e));
    }
  }

  function addEntryId() {
    const id = entryIdInput.trim();
    if (!id || settings.entryIds.includes(id)) return;
    const next = { ...settings, entryIds: [...settings.entryIds, id] };
    setSettings(next);
    setEntryIdInput("");
    invoke("save_cea_settings", { competitionId: next.competitionId, entryIds: next.entryIds }).catch(() => {});
  }

  function removeEntryId(id: string) {
    const next = { ...settings, entryIds: settings.entryIds.filter(x => x !== id) };
    setSettings(next);
    invoke("save_cea_settings", { competitionId: next.competitionId, entryIds: next.entryIds }).catch(() => {});
  }

  async function saveCompId(val: string) {
    const next = { ...settings, competitionId: val };
    setSettings(next);
    await invoke("save_cea_settings", { competitionId: val, entryIds: next.entryIds }).catch(() => {});
  }

  async function handleSync() {
    if (!settings.competitionId || settings.entryIds.length === 0) return;
    setStep("syncing");
    setSyncErr(null);
    invoke<Player[]>("get_all_players").then(setAllPlayers).catch(() => {});
    invoke<Team[]>("get_teams").then(setTeams).catch(() => {});
    try {
      const results: RosterResult[] = await Promise.all(
        settings.entryIds.map(async (entryId) => {
          try {
            const [ceaPlayers, matchInfos] = await Promise.all([
              invoke<CeaImportPlayer[]>("fetch_cea_roster", { ceaTeamId: parseInt(entryId) }),
              invoke<CeaMatchInfo[]>("fetch_cea_team_matches", { competitionId: settings.competitionId, ceaTeamId: entryId })
                .catch(() => [] as CeaMatchInfo[]),
            ]);
            return { entryId, ceaPlayers, matchInfos, error: null };
          } catch (e) {
            return { entryId, ceaPlayers: [], matchInfos: [], error: String(e) };
          }
        })
      );
      setRosterResults(results);
      setRosterIdx(0);
      setStep("roster");
    } catch (e) {
      setSyncErr(String(e));
      setStep("config");
    }
  }

  function handleRosterNext() {
    if (rosterIdx + 1 < rosterResults.length) {
      setRosterIdx(i => i + 1);
    } else {
      const imported = new Set<string>();
      invoke<string[]>("get_imported_match_ids", { competitionId: settings.competitionId })
        .then(ids => { ids.forEach(id => imported.add(id)); })
        .catch(() => {})
        .finally(() => {
          const seen = new Set<string>();
          const allMatches: QueuedMatch[] = [];
          for (const r of rosterResults) {
            for (const m of r.matchInfos) {
              if (!seen.has(m.matchId)) {
                seen.add(m.matchId);
                allMatches.push({
                  matchId: m.matchId,
                  entryId: r.entryId,
                  date: m.date,
                  status: m.status,
                  imported: imported.has(m.matchId),
                  selected: !imported.has(m.matchId),
                });
              }
            }
          }
          setQueue(allMatches.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")));
          setStep("queue");
        });
    }
  }

  function handleStartEntry() {
    const firstIdx = queue.findIndex(m => m.selected && !m.imported);
    if (firstIdx === -1) { setStep("done"); return; }
    setQueueIdx(firstIdx);
    setGames([emptyGameForm(1)]);
    setActiveGame(0);
    setMatchDuration("");
    setTeam1Filter(null);
    setTeam2Filter(null);
    setSaveErr(null);
    setStep("entry");
  }

  const currentMatch = queue[queueIdx] ?? null;
  const form = games[activeGame] ?? games[0];

  function updateCurrentGame(updater: (g: GameForm) => GameForm) {
    setGames(prev => prev.map((g, i) => i === activeGame ? updater(g) : g));
  }

  function addGame() {
    const next = games.length + 1;
    setGames(prev => [...prev, emptyGameForm(next)]);
    setActiveGame(games.length);
  }

  function removeGame() {
    if (games.length <= 1) return;
    setGames(prev => prev.slice(0, -1));
    setActiveGame(prev => Math.min(prev, games.length - 2));
  }

  function updatePlayer(idx: number, field: keyof MatchPlayerInput, value: unknown) {
    updateCurrentGame(g => {
      const players = [...g.players];
      players[idx] = { ...players[idx], [field]: value };
      if (field !== "won") {
        players[idx] = { ...players[idx], won: players[idx].team === 1 ? g.team1Won : !g.team1Won };
      }
      return { ...g, players };
    });
  }

  function setTeam1Won(val: boolean) {
    updateCurrentGame(g => ({
      ...g,
      team1Won: val,
      players: g.players.map(p => ({ ...p, won: p.team === 1 ? val : !val })),
    }));
  }

  function resolvePlayerId(name: string): number | null {
    const n = name.toLowerCase().trim();
    const p = allPlayers.find(p =>
      p.summonerName.toLowerCase() === n || p.displayName.toLowerCase() === n
    );
    return p ? p.id : null;
  }

  function handleSummonerChange(idx: number, val: string) {
    const pid = resolvePlayerId(val);
    updateCurrentGame(g => {
      const players = [...g.players];
      players[idx] = {
        ...players[idx],
        summonerName: val,
        playerId: pid,
        won: players[idx].team === 1 ? g.team1Won : !g.team1Won,
      };
      return { ...g, players };
    });
  }

  function parseDuration(s: string): number | null {
    s = s.trim();
    if (!s) return null;
    const mmsec = s.match(/^(\d+):(\d{2})$/);
    if (mmsec) return parseInt(mmsec[1]) * 60 + parseInt(mmsec[2]);
    const n = parseInt(s);
    return isNaN(n) ? null : n;
  }

  async function handleSaveMatch() {
    if (!currentMatch) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const allPlayers = games.flatMap((g, gi) =>
        g.players
          .filter(p => p.summonerName.trim() !== "")
          .map(p => ({ ...p, playerId: resolvePlayerId(p.summonerName), gameNumber: gi + 1 }))
      );
      await invoke("save_match", {
        competitionId: settings.competitionId,
        ceaMatchId: currentMatch.matchId,
        durationSec: parseDuration(matchDuration),
        playedAt: currentMatch.date ?? null,
        players: allPlayers,
      });
      setQueue(prev => prev.map((m, i) =>
        i === queueIdx ? { ...m, imported: true, selected: false } : m
      ));
      const nextIdx = queue.findIndex((m, i) => i > queueIdx && m.selected && !m.imported);
      if (nextIdx === -1) {
        setStep("done");
      } else {
        setQueueIdx(nextIdx);
        setGames([emptyGameForm(1)]);
        setActiveGame(0);
        setMatchDuration("");
        setTeam1Filter(null);
        setTeam2Filter(null);
        setSaveErr(null);
      }
    } catch (e) {
      setSaveErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleSkipMatch() {
    const nextIdx = queue.findIndex((m, i) => i > queueIdx && m.selected && !m.imported);
    if (nextIdx === -1) { setStep("done"); return; }
    setQueueIdx(nextIdx);
    setGames([emptyGameForm(1)]);
    setActiveGame(0);
    setMatchDuration("");
    setTeam1Filter(null);
    setTeam2Filter(null);
    setSaveErr(null);
  }

  const selectedCount = queue.filter(m => m.selected && !m.imported).length;

  async function downloadCsvTemplate() {
    const matchIds = queue.filter(m => m.selected && !m.imported).map(m => m.matchId);
    try {
      const path = await invoke<string>("export_csv_template", { matchIds });
      setImportLog([`Template saved to: ${path}`]);
    } catch (e) {
      setImportLog(["Export failed: " + String(e)]);
    }
  }

  async function handleExportData() {
    try {
      const path = await invoke<string>("export_matches_csv", { competitionId: settings.competitionId });
      setImportLog([`Data saved to: ${path}`]);
    } catch (e) {
      setImportLog(["Export failed: " + String(e)]);
    }
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    e.target.value = "";
    try {
      const log = await invoke<string[]>("import_matches_csv", {
        competitionId: settings.competitionId,
        csv,
      });
      setImportLog(log);
      const importedIds = new Set(
        log.filter(l => l.includes("imported")).map(l => l.split(":")[0].replace("Match ", "").trim())
      );
      setQueue(prev => prev.map(m => importedIds.has(m.matchId) ? { ...m, imported: true, selected: false } : m));
    } catch (e) {
      setImportLog(["Error: " + String(e)]);
    }
  }

  if (step === "config" || step === "syncing") {
    return (
      <div className="match-layout">
        <div className="match-header">
          <h2 className="match-title">Match Sync</h2>
          <p className="match-subtitle">Pull rosters and match list from CEA, then enter match results.</p>
        </div>
        <div className="match-config-section">
          <label className="match-config-label">Competition ID</label>
          <input className="match-config-input" placeholder="e.g. 2595" value={settings.competitionId} onChange={e => saveCompId(e.target.value)} />
        </div>
        <div className="match-config-section">
          <label className="match-config-label">Team Entry IDs</label>
          <div className="match-entry-id-row">
            <input className="match-config-input" placeholder="e.g. 43175" value={entryIdInput} onChange={e => setEntryIdInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addEntryId()} />
            <button onClick={addEntryId} disabled={!entryIdInput.trim()}>Add</button>
          </div>
          {settings.entryIds.length > 0 && (
            <div className="match-entry-id-list">
              {settings.entryIds.map(id => (
                <span key={id} className="match-entry-id-tag">{id}<button className="match-entry-id-remove" onClick={() => removeEntryId(id)}>x</button></span>
              ))}
            </div>
          )}
        </div>
        <div className="match-config-section">
          <label className="match-config-label">CEA Auth Token</label>
          <textarea
            className="match-config-input sync-auth-textarea"
            placeholder="Paste bearer token from browser dev tools"
            value={settings.authToken ?? ""}
            onChange={e => {
              const val = e.target.value;
              setSettings(prev => ({ ...prev, authToken: val || null }));
              invoke("save_cea_auth_token", { token: val || null }).catch(() => {});
            }}
          />
        </div>
        {syncErr && <code className="rank-error-text">{syncErr}</code>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSync} disabled={!settings.competitionId || settings.entryIds.length === 0 || step === "syncing"}>
            {step === "syncing" ? "Syncing..." : `Sync (${settings.entryIds.length} team${settings.entryIds.length !== 1 ? "s" : ""})`}
          </button>
          <button className="btn-secondary" disabled={!settings.competitionId} onClick={() => { loadEditMatches(); setStep("editMatches"); }}>Edit Matches</button>
        </div>
      </div>
    );
  }

  if (step === "roster") {
    const r = rosterResults[rosterIdx];
    return (
      <div className="match-layout">
        <div className="match-step-header"><span className="match-step-badge">Step 2 of 3 - Roster</span><span className="match-step-progress">{rosterIdx + 1} / {rosterResults.length}</span></div>
        <div className="match-header"><h2 className="match-title">Roster: Entry {r.entryId}</h2><p className="match-subtitle">Verify CEA roster matches your DB.</p></div>
        {r.error && <code className="rank-error-text">{r.error}</code>}
        <div className="match-roster-grid">
          <div className="match-roster-col">
            <div className="match-roster-col-header">CEA Roster ({r.ceaPlayers.length})</div>
            {r.ceaPlayers.map((p, i) => {
              const inDb = allPlayers.some(dp => dp.summonerName.toLowerCase() === p.name.toLowerCase() || dp.displayName.toLowerCase() === p.name.toLowerCase());
              return (
                <div key={i} className={`match-roster-row ${inDb ? "match-roster-ok" : "match-roster-missing"}`}>
                  <span>{p.name}</span><span className="muted">{p.isStarter ? "Starter" : "Sub"}</span>
                  {!inDb && <span className="match-roster-warn">not in DB</span>}
                </div>
              );
            })}
          </div>
          <div className="match-roster-col">
            <div className="match-roster-col-header">Matches found: {r.matchInfos.length}</div>
            {r.matchInfos.slice(0, 8).map((m, i) => (<div key={i} className="match-roster-row muted">#{m.matchId}{m.date ? ` - ${m.date.slice(0, 10)}` : ""}{m.status ? ` [${m.status}]` : ""}</div>))}
            {r.matchInfos.length > 8 && <div className="muted">...and {r.matchInfos.length - 8} more</div>}
            {r.matchInfos.length === 0 && !r.error && <div className="muted">No matches returned</div>}
          </div>
        </div>
        <div className="match-step-actions">
          <button onClick={() => setStep("config")} className="btn-secondary">Back</button>
          <button onClick={handleRosterNext}>{rosterIdx + 1 < rosterResults.length ? "Next Team" : "Build Match Queue"}</button>
        </div>
      </div>
    );
  }

  if (step === "queue") {
    return (
      <div className="match-layout">
        <div className="match-step-header"><span className="match-step-badge">Step 3 of 3 - Match Queue</span></div>
        <div className="match-header">
          <h2 className="match-title">Match Queue</h2>
          <p className="match-subtitle">{queue.length} unique match{queue.length !== 1 ? "es" : ""} found. {queue.filter(m => m.imported).length} already imported.{queue.length === 0 && " Add match IDs below."}</p>
        </div>
        {queue.length > 0 && (
          <table className="match-table match-queue-table">
            <thead><tr><th style={{ width: 32 }}></th><th>Match ID</th><th>Date</th><th>Status</th><th>State</th></tr></thead>
            <tbody>
              {queue.map((m, i) => (
                <tr key={m.matchId} className={m.imported ? "match-row-done" : ""}>
                  <td><input type="checkbox" checked={m.selected} disabled={m.imported} onChange={e => setQueue(prev => prev.map((q, j) => j === i ? { ...q, selected: e.target.checked } : q))} /></td>
                  <td className="match-ocr-name">{m.matchId}</td>
                  <td className="muted">{m.date?.slice(0, 10) ?? "--"}</td>
                  <td className="muted">{m.status ?? "--"}</td>
                  <td>{m.imported ? <span className="match-saved">done</span> : <span className="muted">pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="match-csv-row">
          <button className="btn-secondary" onClick={downloadCsvTemplate} disabled={selectedCount === 0}>Export Template</button>
          <button className="btn-secondary" onClick={handleExportData}>Export Data</button>
          <label className="btn-secondary match-csv-label">
            Import CSV
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={handleImportCsv} />
          </label>
        </div>
        {importLog && (
          <div className="match-import-log">
            {importLog.map((l, i) => <div key={i} className={l.startsWith("Error") ? "rank-error-text" : "muted"}>{l}</div>)}
          </div>
        )}
        <ManualMatchAdd competitionId={settings.competitionId} onAdd={(matchId) => { if (queue.some(m => m.matchId === matchId)) return; setQueue(prev => [...prev, { matchId, entryId: "", date: null, status: null, imported: false, selected: true }]); }} />
        <div className="match-step-actions">
          <button onClick={() => setStep("roster")} className="btn-secondary">Back</button>
          <button onClick={handleStartEntry} disabled={selectedCount === 0}>Enter Data ({selectedCount} match{selectedCount !== 1 ? "es" : ""})</button>
        </div>
      </div>
    );
  }

  if (step === "entry" && currentMatch) {
    const matchUrl = `https://app.playcea.com/competition/${settings.competitionId}/match/${currentMatch.matchId}`;
    const selectedMatches = queue.filter(m => m.selected && !m.imported);
    const currentPos = selectedMatches.findIndex(m => m.matchId === currentMatch.matchId) + 1;
    return (
      <div className="match-layout">
        <div className="match-entry-form-panel">
          <div className="match-entry-form-scroll">
            <div className="match-entry-header-row">
              <span className="match-title">Match #{currentMatch.matchId}</span>
              <span className="match-step-badge">{currentPos} of {selectedMatches.length}</span>
              <a href={matchUrl} target="_blank" rel="noreferrer" className="match-entry-open-link">Open in browser</a>
            </div>
            <div className="match-form-row">
              <label className="match-form-label">Duration (MM:SS)</label>
              <input className="match-form-input-sm" placeholder="e.g. 32:15" value={matchDuration} onChange={e => setMatchDuration(e.target.value)} />
            </div>
            <div className="match-game-tabs">
              {games.map((_, i) => (
                <button key={i} className={`match-game-tab${activeGame === i ? " active" : ""}`} onClick={() => setActiveGame(i)}>
                  Game {i + 1}
                </button>
              ))}
              {games.length < 5 && <button className="match-game-tab match-game-add" onClick={addGame}>+ Game</button>}
              {games.length > 1 && <button className="match-game-tab match-game-remove" onClick={removeGame}>- Game</button>}
            </div>
            <div className="match-winner-row">
              <span className="match-winner-label">Game {activeGame + 1} winner:</span>
              <label className={`match-winner-btn ${form.team1Won ? "active" : ""}`}><input type="radio" name="winner" checked={form.team1Won} onChange={() => setTeam1Won(true)} />Team 1</label>
              <label className={`match-winner-btn ${!form.team1Won ? "active" : ""}`}><input type="radio" name="winner" checked={!form.team1Won} onChange={() => setTeam1Won(false)} />Team 2</label>
            </div>
            {([1, 2] as const).map(team => {
              const filter = team === 1 ? team1Filter : team2Filter;
              const setFilter = team === 1 ? setTeam1Filter : setTeam2Filter;
              const visiblePlayers = filter === null ? allPlayers : allPlayers.filter(p => p.teamId === filter);
              return (
              <div key={team} className="match-team-section">
                <div className={`match-team-header ${(team === 1) === form.team1Won ? "match-team-win" : "match-team-loss"}`}>
                  <span>Team {team} - {(team === 1) === form.team1Won ? "Victory" : "Defeat"}</span>
                  <select className="match-team-filter" value={filter ?? ""} onChange={e => setFilter(e.target.value === "" ? null : Number(e.target.value))}>
                    <option value="">All players</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <table className="match-table match-entry-table">
                  <thead><tr>
                    <th style={{ width: "130px" }}>Summoner</th>
                    <th style={{ width: "72px" }}>Role</th>
                    <th style={{ width: "110px" }}>Champion</th>
                    <th style={{ width: "50px" }}>K</th>
                    <th style={{ width: "50px" }}>D</th>
                    <th style={{ width: "50px" }}>A</th>
                    <th style={{ width: "58px" }}>CS</th>
                    <th style={{ width: "66px" }}>Gold</th>
                  </tr></thead>
                  <tbody>
                    {form.players.map((p, i) => ({ p, i })).filter(({ p }) => p.team === team).map(({ p, i }) => (
                      <tr key={i}>
                        <td>
                          <select className="match-form-input" value={p.summonerName} onChange={e => handleSummonerChange(i, e.target.value)}>
                            <option value="">--</option>
                            {visiblePlayers.map(ap => <option key={ap.id} value={ap.summonerName}>{ap.summonerName}</option>)}
                          </select>
                        </td>
                        <td>
                          <select className="match-form-input" value={p.role} onChange={e => updatePlayer(i, "role", e.target.value)}>
                            <option value="">--</option>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td><ChampionInput className="match-form-input" value={p.champion} onChange={v => updatePlayer(i, "champion", v)} champions={champions} /></td>
                        {(["kills", "deaths", "assists"] as const).map(f => (<td key={f}><input type="number" min="0" max="99" className="match-form-input-num" value={p[f]} onChange={e => updatePlayer(i, f, parseInt(e.target.value) || 0)} /></td>))}
                        <td><input type="number" min="0" className="match-form-input-num match-form-input-cs" placeholder="--" value={p.cs ?? ""} onChange={e => updatePlayer(i, "cs", e.target.value === "" ? null : parseInt(e.target.value) || 0)} /></td>
                        <td><input type="number" min="0" className="match-form-input-num match-form-input-gold" placeholder="--" value={p.gold ?? ""} onChange={e => updatePlayer(i, "gold", e.target.value === "" ? null : parseInt(e.target.value) || 0)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              );
            })}
            {saveErr && <code className="rank-error-text">{saveErr}</code>}
            <div className="match-save-row">
              <button onClick={handleSaveMatch} disabled={saving}>{saving ? "Saving..." : "Save & Next"}</button>
              <button className="btn-secondary" onClick={handleSkipMatch} disabled={saving}>Skip</button>
              <button className="btn-secondary" onClick={() => setStep("queue")} disabled={saving}>Queue</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "editMatches") {
    const match = editMatches[editMatchIdx] ?? null;
    const t1 = match?.team1Name ?? "Team 1";
    const t2 = match?.team2Name ?? "Team 2";
    return (
      <div className="match-layout">
        <div className="match-step-header">
          <span className="match-step-badge">Edit Matches</span>
          {editMatches.length > 0 && (
            <span className="match-step-progress">{editMatchIdx + 1} / {editMatches.length}</span>
          )}
        </div>
        {editErr && <code className="rank-error-text">{editErr}</code>}
        {editLoading && <p className="muted">Loading...</p>}
        {!editLoading && editMatches.length === 0 && !editErr && (
          <p className="muted">No imported matches found for competition {settings.competitionId}.</p>
        )}
        {match && (
          <>
            <div className="match-config-section" style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span className="match-title" style={{ fontSize: 18 }}>Match #{match.ceaMatchId}</span>
                {match.playedAt && <span className="muted">{match.playedAt.slice(0, 10)}</span>}
                <a href={`https://app.playcea.com/competition/${settings.competitionId}/match/${match.ceaMatchId}`} target="_blank" rel="noreferrer" className="match-entry-open-link">Open in browser</a>
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>{t1}</span>
                <span className="muted" style={{ margin: "0 8px" }}>vs</span>
                <span style={{ fontWeight: 600 }}>{t2}</span>
              </div>
            </div>
            <table className="match-table" style={{ maxWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Game</th>
                  <th>Champions</th>
                  <th style={{ width: 110 }}>Duration (MM:SS)</th>
                  <th>Blue Side</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {match.games.map(game => {
                  const key = editKey(match.matchId, game.gameNumber);
                  const state = editInputs[key] ?? { duration: "", blueTeam: null, saved: false };
                  const raw = state.duration.trim();
                  const invalid = raw !== "" && parseMmSs(raw) === null;
                  return (
                    <tr key={key}>
                      <td className="muted" style={{ textAlign: "center" }}>G{game.gameNumber}</td>
                      <td className="muted" style={{ fontSize: 12 }}>
                        {game.team1Champ ?? "—"} <span style={{ opacity: 0.5 }}>vs</span> {game.team2Champ ?? "—"}
                      </td>
                      <td>
                        <input
                          style={{ width: 90 }}
                          placeholder="e.g. 32:15"
                          value={state.duration}
                          className={invalid ? "rank-error-text" : ""}
                          onChange={e => setEditInputs(prev => ({ ...prev, [key]: { ...prev[key], duration: e.target.value, saved: false } }))}
                          onKeyDown={e => { if (e.key === "Enter") saveGame(match, game); }}
                        />
                      </td>
                      <td>
                        <label style={{ marginRight: 16, cursor: "pointer", userSelect: "none" }}>
                          <input
                            type="radio"
                            name={`blue-${key}`}
                            style={{ marginRight: 4 }}
                            checked={state.blueTeam === 1}
                            onChange={() => setEditInputs(prev => ({ ...prev, [key]: { ...prev[key], blueTeam: 1, saved: false } }))}
                          />
                          {t1}
                        </label>
                        <label style={{ cursor: "pointer", userSelect: "none" }}>
                          <input
                            type="radio"
                            name={`blue-${key}`}
                            style={{ marginRight: 4 }}
                            checked={state.blueTeam === 2}
                            onChange={() => setEditInputs(prev => ({ ...prev, [key]: { ...prev[key], blueTeam: 2, saved: false } }))}
                          />
                          {t2}
                        </label>
                      </td>
                      <td>
                        {state.saved
                          ? <span className="match-saved">✓ saved</span>
                          : <button style={{ padding: "2px 10px", fontSize: 12 }} disabled={invalid} onClick={() => saveGame(match, game)}>Save</button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="match-step-actions" style={{ marginTop: 12 }}>
              <button className="btn-secondary" disabled={editMatchIdx === 0} onClick={() => setEditMatchIdx(i => i - 1)}>← Prev</button>
              <button className="btn-secondary" disabled={editMatchIdx >= editMatches.length - 1} onClick={() => setEditMatchIdx(i => i + 1)}>Next →</button>
            </div>
          </>
        )}
        <div className="match-step-actions">
          <button className="btn-secondary" onClick={() => setStep("config")}>Back</button>
          <button className="btn-secondary" onClick={loadEditMatches} disabled={editLoading}>Reload</button>
        </div>
      </div>
    );
  }

  return (
    <div className="match-layout">
      <div className="match-header">
        <h2 className="match-title">All Done</h2>
        <p className="match-subtitle">{queue.filter(m => m.imported).length} match{queue.filter(m => m.imported).length !== 1 ? "es" : ""} imported. Player stats have been updated.</p>
      </div>
      <div className="match-step-actions">
        <button onClick={() => { setStep("config"); setQueue([]); }}>Start Over</button>
        <button className="btn-secondary" onClick={() => setStep("queue")}>Back to Queue</button>
        <button className="btn-secondary" onClick={() => { loadEditMatches(); setStep("editMatches"); }}>Edit Matches</button>
      </div>
    </div>
  );
}

function ManualMatchAdd({ competitionId: _competitionId, onAdd }: { competitionId: string; onAdd: (id: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="match-manual-add">
      <span className="match-config-label">Add match ID manually:</span>
      <div className="match-entry-id-row">
        <input className="match-config-input" placeholder="e.g. 74529" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { onAdd(val.trim()); setVal(""); } }} />
        <button onClick={() => { onAdd(val.trim()); setVal(""); }} disabled={!val.trim()}>Add</button>
      </div>
    </div>
  );
}