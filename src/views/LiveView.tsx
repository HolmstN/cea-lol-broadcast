import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type { Player } from "../types";

type Status = "idle" | "connecting" | "connected" | "not_found" | "error";

// ─── EOG types ───────────────────────────────────────
interface EogStats {
  CHAMPIONS_KILLED?: number;
  NUM_DEATHS?: number;
  ASSISTS?: number;
  [key: string]: number | undefined;
}
interface EogPlayer {
  summonerName: string;
  championName?: string;
  stats: EogStats;
}
interface EogTeam {
  teamId: number;
  win: string; // "Win" | "Fail"
  players: EogPlayer[];
}
interface EogStatsBlock {
  teams?: EogTeam[];
}

interface MatchedPlayer {
  player: Player;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  include: boolean;
}

export default function LiveView() {
  const [status, setStatus]       = useState<Status>("idle");
  const [events, setEvents]       = useState<string[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [eogModal, setEogModal]   = useState<MatchedPlayer[] | null>(null);
  const [saving, setSaving]       = useState(false);
  const logRef                    = useRef<HTMLDivElement>(null);
  const unlistenRef               = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    return () => { unlistenRef.current?.(); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  async function handleEogEvent(data: unknown) {
    const block = data as EogStatsBlock;
    if (!block?.teams?.length) return;

    const allPlayers = await invoke<Player[]>("get_all_players").catch(() => []);
    if (!allPlayers.length) return;

    // Build summoner name → roster player map (case-insensitive)
    const rosterMap = new Map<string, Player>();
    for (const p of allPlayers) rosterMap.set(p.summonerName.toLowerCase(), p);

    const matched: MatchedPlayer[] = [];
    for (const team of block.teams) {
      const won = team.win === "Win";
      for (const ep of team.players ?? []) {
        const roster = rosterMap.get(ep.summonerName.toLowerCase());
        if (!roster) continue;
        matched.push({
          player: roster,
          wins:    won ? 1 : 0,
          losses:  won ? 0 : 1,
          kills:   ep.stats?.CHAMPIONS_KILLED ?? 0,
          deaths:  ep.stats?.NUM_DEATHS ?? 0,
          assists: ep.stats?.ASSISTS ?? 0,
          include: true,
        });
      }
    }

    if (matched.length > 0) setEogModal(matched);
  }

  async function connect() {
    setStatus("connecting");
    setError(null);

    unlistenRef.current?.();
    unlistenRef.current = await listen<{ uri?: string; data?: unknown }>("lcu-event", (e) => {
      const payload = e.payload;
      setEvents((prev) => [...prev.slice(-199), JSON.stringify(payload, null, 2)]);

      // Watch for end-of-game stats block
      if (payload?.uri === "/lol-end-of-game/v1/eog-stats-block") {
        handleEogEvent(payload.data);
      }
    });

    await listen("lcu-disconnected", () => setStatus("idle"));

    try {
      const found = await invoke<boolean>("connect_lcu");
      setStatus(found ? "connected" : "not_found");
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  function updateRow(idx: number, patch: Partial<MatchedPlayer>) {
    setEogModal(prev => prev ? prev.map((r, i) => i === idx ? { ...r, ...patch } : r) : null);
  }

  async function confirmEog() {
    if (!eogModal) return;
    setSaving(true);
    try {
      for (const row of eogModal) {
        if (!row.include) continue;
        // Get current stats and add delta
        const current = await invoke<{ wins: number; losses: number; kills: number; deaths: number; assists: number }>(
          "get_player_stats", { playerId: row.player.id }
        ).catch(() => ({ wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 }));
        await invoke("update_player_stats", {
          playerId: row.player.id,
          wins:    current.wins    + row.wins,
          losses:  current.losses  + row.losses,
          kills:   current.kills   + row.kills,
          deaths:  current.deaths  + row.deaths,
          assists: current.assists + row.assists,
        });
      }
      setEogModal(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <span className={`dot ${status}`} />
        <span className="status-label">{statusLabel(status)}</span>
        <button onClick={connect} disabled={status === "connecting" || status === "connected"}>
          {status === "connecting" ? "Connecting…" : "Connect to LCU"}
        </button>
        {error && <span className="error">{error}</span>}
      </div>

      <div className="log" ref={logRef}>
        {events.length === 0 ? (
          <p className="empty">No events yet — connect and interact with the League client.</p>
        ) : (
          events.map((ev, i) => <pre key={i} className="event">{ev}</pre>)
        )}
      </div>

      {/* ─── EOG Record Modal ─── */}
      {eogModal && (
        <div className="modal-backdrop" onClick={() => setEogModal(null)}>
          <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Record Game Result</div>
            <p className="modal-subtitle">
              {eogModal.filter(r => r.include).length} roster players detected. Adjust and confirm to save stats.
            </p>
            <table className="eog-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Player</th>
                  <th>Result</th>
                  <th>K</th>
                  <th>D</th>
                  <th>A</th>
                </tr>
              </thead>
              <tbody>
                {eogModal.map((row, i) => (
                  <tr key={row.player.id} className={row.include ? "" : "eog-excluded"}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={e => updateRow(i, { include: e.target.checked })}
                      />
                    </td>
                    <td className="eog-name">
                      <span>{row.player.displayName}</span>
                      <span className="muted eog-summoner">{row.player.summonerName}</span>
                    </td>
                    <td>
                      <select
                        value={row.wins === 1 ? "win" : "loss"}
                        onChange={e => updateRow(i, e.target.value === "win"
                          ? { wins: 1, losses: 0 }
                          : { wins: 0, losses: 1 }
                        )}
                      >
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                      </select>
                    </td>
                    {(["kills", "deaths", "assists"] as const).map(field => (
                      <td key={field}>
                        <input
                          className="eog-num"
                          type="number"
                          min={0}
                          value={row[field]}
                          onChange={e => updateRow(i, { [field]: Math.max(0, parseInt(e.target.value) || 0) })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button onClick={confirmEog} disabled={saving || eogModal.every(r => !r.include)}>
                {saving ? "Saving…" : "Confirm & Save"}
              </button>
              <button className="btn-secondary" onClick={() => setEogModal(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function statusLabel(s: Status) {
  return {
    idle: "Not connected",
    connecting: "Connecting…",
    connected: "Connected",
    not_found: "League client not found",
    error: "Error",
  }[s];
}
