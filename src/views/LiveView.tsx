import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type { Player } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

type LcuStatus  = "idle" | "connecting" | "connected" | "not_found" | "error";
type LiveStatus = "off" | "polling" | "in-game" | "ended";

interface EogStats { CHAMPIONS_KILLED?: number; NUM_DEATHS?: number; ASSISTS?: number; [key: string]: number | undefined; }
interface EogPlayer { summonerName: string; championName?: string; stats: EogStats; }
interface EogTeam { teamId: number; win: string; players: EogPlayer[]; }
interface EogStatsBlock { teams?: EogTeam[]; }
interface MatchedPlayer {
  player: Player; wins: number; losses: number;
  kills: number; deaths: number; assists: number; include: boolean;
}

interface KillPayload {
  badge: string; killer: string; killer_champ: string;
  victim: string; victim_champ: string; assists: string[];
}
interface PlayerSummary {
  name: string; champion: string; team: string;
  kills: number; deaths: number; assists: number; cs: number; effective_gold: number;
  items: number[];
}
interface LiveTickPayload {
  game_time: number; blue_kills: number; red_kills: number;
  blue_gold: number; red_gold: number; players: PlayerSummary[];
}
interface ObjectiveEvent {
  event_type: string; // "Dragon", "Baron", "Herald", "Tower", "Inhibitor"
  team: string;       // "ORDER" or "CHAOS"
  name: string;
  stolen: boolean;
  game_time: number;
}
interface KillEntry extends KillPayload { id: number; }
interface ReplayClip { id: number; startTime: number; endTime: number; label: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}
function fmtGold(g: number) { return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(g); }
function lcuLabel(s: LcuStatus) {
  return { idle: "Not connected", connecting: "Connecting…", connected: "Connected",
           not_found: "League client not found", error: "Error" }[s];
}
function badgeClass(b: string) {
  if (b === "First Blood") return "live-kill-badge live-kill-badge-fb";
  if (["Ace", "Quadra Kill", "Penta Kill"].includes(b)) return "live-kill-badge live-kill-badge-ace";
  if (b) return "live-kill-badge live-kill-badge-multi";
  return "";
}

function dragonInfo(name: string): { abbr: string; color: string } {
  const n = name.toLowerCase();
  if (n === "fire"  || n.includes("infernal"))  return { abbr: "IF", color: "#ef5350" };
  if (n === "earth" || n.includes("mountain"))  return { abbr: "MT", color: "#a1887f" };
  if (n === "water" || n.includes("ocean"))     return { abbr: "OC", color: "#42a5f5" };
  if (n === "air"   || n.includes("cloud"))     return { abbr: "CL", color: "#90a4ae" };
  if (n.includes("hextech"))                    return { abbr: "HX", color: "#ab47bc" };
  if (n.includes("chemtech"))                   return { abbr: "CH", color: "#66bb6a" };
  if (n.includes("elder"))                      return { abbr: "EL", color: "#ffca28" };
  return { abbr: name.slice(0, 2).toUpperCase() || "DR", color: "#888888" };
}

const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn/16.10.1';
function itemImgUrl(id: number) { return `${DDRAGON}/img/item/${id}.png`; }
function fmtCountdown(secs: number) {
  if (secs <= 0) return 'UP';
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildHudParams(t: LiveTickPayload, team1: string, team2: string): Record<string, string> {
  const params: Record<string, string> = {
    timer:      fmtTime(t.game_time),
    game_time:  String(t.game_time),
    team1, team2,
    blue_kills: String(t.blue_kills),
    red_kills:  String(t.red_kills),
    blue_gold:  String(t.blue_gold),
    red_gold:   String(t.red_gold),
  };
  const blue = t.players.filter(p => p.team === "ORDER");
  const red  = t.players.filter(p => p.team === "CHAOS");
  const fill = (prefix: string, list: PlayerSummary[]) =>
    list.forEach((p, i) => Object.assign(params, {
      [`${prefix}${i}_name`]: p.name, [`${prefix}${i}_champ`]: p.champion,
      [`${prefix}${i}_k`]: String(p.kills), [`${prefix}${i}_d`]: String(p.deaths),
      [`${prefix}${i}_a`]: String(p.assists), [`${prefix}${i}_cs`]: String(p.cs),
      [`${prefix}${i}_gold`]: String(p.effective_gold),
      [`${prefix}${i}_items`]: p.items.filter(id => id > 0).join(","),
    }));
  fill("b", blue);
  fill("r", red);
  return params;
}

function buildObjectiveParams(objs: ObjectiveEvent[]): Record<string, string> {
  const byTeam = (team: string) => objs.filter(o => o.team === team);
  const ofType = (arr: ObjectiveEvent[], type: string) => arr.filter(o => o.event_type === type);
  const dragons = objs.filter(o => o.event_type === "Dragon").sort((a, b) => a.game_time - b.game_time);
  const lastDragon = dragons[dragons.length - 1];
  const nextDragonAt = lastDragon
    ? lastDragon.game_time + (lastDragon.name.toLowerCase().includes("elder") ? 360 : 300)
    : 300;
  const barons = objs.filter(o => o.event_type === "Baron").sort((a, b) => a.game_time - b.game_time);
  const lastBaron = barons[barons.length - 1];
  const nextBaronAt = lastBaron ? lastBaron.game_time + 360 : 1200;
  const blueO = byTeam("ORDER");
  const redO  = byTeam("CHAOS");
  return {
    dragon_names:   dragons.map(d => d.name).join(","),
    next_dragon_at: String(nextDragonAt),
    next_baron_at:  String(nextBaronAt),
    grub_blue:      String(ofType(blueO, "VoidGrub").length),
    grub_red:       String(ofType(redO,  "VoidGrub").length),
    tower_blue:     String(ofType(blueO, "Tower").length),
    tower_red:      String(ofType(redO,  "Tower").length),
    _dbg_obj_total: String(objs.length),
    _dbg_dragon_ct: String(dragons.length),
    _dbg_obj_types: objs.map(o => `${o.event_type}:${o.name}`).join("|"),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveView() {
  // LCU
  const [lcuStatus, setLcuStatus] = useState<LcuStatus>("idle");
  const [lcuError, setLcuError]   = useState<string | null>(null);
  const [events, setEvents]       = useState<string[]>([]);
  const [eogModal, setEogModal]   = useState<MatchedPlayer[] | null>(null);
  const [saving, setSaving]       = useState(false);
  const logRef         = useRef<HTMLDivElement>(null);
  const lcuUnlistenRef = useRef<UnlistenFn | null>(null);

  // Live tracking
  const [liveStatus, setLiveStatus]   = useState<LiveStatus>("off");
  const [gameTime, setGameTime]       = useState(0);
  const [blueKills, setBlueKills]     = useState(0);
  const [redKills, setRedKills]       = useState(0);
  const [blueGold, setBlueGold]       = useState(0);
  const [redGold, setRedGold]         = useState(0);
  const [players, setPlayers]         = useState<PlayerSummary[]>([]);
  const [recentKills, setRecentKills] = useState<KillEntry[]>([]);
  const [objectives, setObjectives]   = useState<ObjectiveEvent[]>([]);
  const [autoOverlay, setAutoOverlay] = useState(false);
  const killIdRef         = useRef(0);
  const killQueueRef      = useRef<KillPayload[]>([]);
  const displayingRef     = useRef(false);
  const autoOverlayRef    = useRef(false);
  const gameTimeRef       = useRef(0);
  const liveUnlistensRef  = useRef<UnlistenFn[]>([]);

  // Live HUD
  const [hudActive, setHudActive] = useState(false);
  const [hudTeam1, setHudTeam1]   = useState("Blue");
  const [hudTeam2, setHudTeam2]   = useState("Red");
  const hudActiveRef   = useRef(false);
  const hudParamsRef   = useRef<Record<string, string>>({});
  const hudTeam1Ref    = useRef("Blue");
  const hudTeam2Ref    = useRef("Red");
  const objectivesRef  = useRef<ObjectiveEvent[]>([]);

  // Champion name → ddragon key map
  const [champMap, setChampMap] = useState<Record<string, string>>({});

  // Replay clips
  const [clips, setClips]               = useState<ReplayClip[]>([]);
  const [clipState, setClipState]       = useState<"idle" | "recording">("idle");
  const [clipStart, setClipStart]       = useState(0);
  const [replayActive, setReplayActive] = useState(false);
  const clipIdRef        = useRef(0);
  const replayEndRef     = useRef<number | null>(null);
  const preReplayTimeRef = useRef(0);

  // Sync refs
  useEffect(() => { autoOverlayRef.current = autoOverlay; }, [autoOverlay]);
  useEffect(() => { hudActiveRef.current = hudActive; }, [hudActive]);
  useEffect(() => { hudTeam1Ref.current = hudTeam1; }, [hudTeam1]);
  useEffect(() => { hudTeam2Ref.current = hudTeam2; }, [hudTeam2]);
  useEffect(() => { objectivesRef.current = objectives; }, [objectives]);

  useEffect(() => {
    fetch(`${DDRAGON}/data/en_US/champion.json`)
      .then(r => r.json())
      .then((data: { data: Record<string, { name: string }> }) => {
        const m: Record<string, string> = {};
        for (const [id, c] of Object.entries(data.data)) m[c.name.toLowerCase()] = id;
        setChampMap(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  useEffect(() => {
    return () => { lcuUnlistenRef.current?.(); liveUnlistensRef.current.forEach(f => f()); };
  }, []);

  // ── Revert overlay after lower-third queue drains ────────────────────────────
  const revertOverlay = useCallback(() => {
    if (hudActiveRef.current) {
      invoke("set_overlay_scene", { scene: "live-hud", params: hudParamsRef.current }).catch(() => {});
    } else {
      invoke("set_overlay_scene", { scene: "idle", params: {} }).catch(() => {});
    }
  }, []);

  // ── Kill overlay queue ───────────────────────────────────────────────────────
  const processKillQueue = useCallback(() => {
    if (killQueueRef.current.length === 0) {
      displayingRef.current = false;
      revertOverlay();
      return;
    }
    displayingRef.current = true;
    const kill = killQueueRef.current.shift()!;
    invoke("set_overlay_scene", {
      scene: "lower-third",
      params: {
        badge: kill.badge, killer: kill.killer, killer_champ: kill.killer_champ,
        victim: kill.victim, victim_champ: kill.victim_champ, assists: kill.assists.join(","),
      },
    }).catch(() => {});
    setTimeout(processKillQueue, 4500);
  }, [revertOverlay]);

  const enqueueKill = useCallback((kill: KillPayload) => {
    if (!autoOverlayRef.current) return;
    if (killQueueRef.current.length >= 3) killQueueRef.current.shift();
    killQueueRef.current.push(kill);
    if (!displayingRef.current) processKillQueue();
  }, [processKillQueue]);

  // ── LCU ──────────────────────────────────────────────────────────────────────
  async function handleEogEvent(data: unknown) {
    const block = data as EogStatsBlock;
    if (!block?.teams?.length) return;
    const allPlayers = await invoke<Player[]>("get_all_players").catch(() => []);
    if (!allPlayers.length) return;
    const rosterMap = new Map<string, Player>();
    for (const p of allPlayers) rosterMap.set(p.summonerName.toLowerCase(), p);
    const matched: MatchedPlayer[] = [];
    for (const team of block.teams) {
      const won = team.win === "Win";
      for (const ep of team.players ?? []) {
        const roster = rosterMap.get(ep.summonerName.toLowerCase());
        if (!roster) continue;
        matched.push({
          player: roster, wins: won ? 1 : 0, losses: won ? 0 : 1,
          kills: ep.stats?.CHAMPIONS_KILLED ?? 0, deaths: ep.stats?.NUM_DEATHS ?? 0,
          assists: ep.stats?.ASSISTS ?? 0, include: true,
        });
      }
    }
    if (matched.length > 0) setEogModal(matched);
  }

  async function connectLcu() {
    setLcuStatus("connecting"); setLcuError(null);
    lcuUnlistenRef.current?.();
    lcuUnlistenRef.current = await listen<{ uri?: string; data?: unknown }>("lcu-event", (e) => {
      const pl = e.payload;
      setEvents(prev => [...prev.slice(-199), JSON.stringify(pl, null, 2)]);
      if (pl?.uri === "/lol-end-of-game/v1/eog-stats-block") handleEogEvent(pl.data);
    });
    await listen("lcu-disconnected", () => setLcuStatus("idle"));
    try {
      const found = await invoke<boolean>("connect_lcu");
      setLcuStatus(found ? "connected" : "not_found");
    } catch (e) { setLcuStatus("error"); setLcuError(String(e)); }
  }

  // ── Live tracking ────────────────────────────────────────────────────────────
  async function startLiveTracking() {
    const unlistens: UnlistenFn[] = [];

    unlistens.push(await listen<LiveTickPayload>("live-tick", (e) => {
      const t = e.payload;
      setLiveStatus("in-game");
      setGameTime(t.game_time); gameTimeRef.current = t.game_time;
      setBlueKills(t.blue_kills); setRedKills(t.red_kills);
      setBlueGold(t.blue_gold);  setRedGold(t.red_gold);
      setPlayers(t.players);

      if (replayEndRef.current !== null && t.game_time >= replayEndRef.current) {
        const returnTo = preReplayTimeRef.current;
        replayEndRef.current = null;
        setReplayActive(false);
        invoke("seek_replay", { time: returnTo }).catch(() => {});
      }

      console.log("[live-tick] objs:", objectivesRef.current.length, objectivesRef.current.map(o => o.event_type + ":" + o.name));
      if (hudActiveRef.current && !displayingRef.current) {
        const hp = { ...buildHudParams(t, hudTeam1Ref.current, hudTeam2Ref.current), ...buildObjectiveParams(objectivesRef.current) };
        hudParamsRef.current = hp;
        invoke("set_overlay_scene", { scene: "live-hud", params: hp }).catch(() => {});
      } else if (hudActiveRef.current) {
        hudParamsRef.current = { ...buildHudParams(t, hudTeam1Ref.current, hudTeam2Ref.current), ...buildObjectiveParams(objectivesRef.current) };
      }
    }));

    unlistens.push(await listen<KillPayload>("live-kill", (e) => {
      const kill = e.payload;
      setRecentKills(prev => [{ ...kill, id: ++killIdRef.current }, ...prev.slice(0, 9)]);
      enqueueKill(kill);
    }));

    unlistens.push(await listen<ObjectiveEvent>("live-objective", (e) => {
      console.log("[live-objective]", e.payload);
      objectivesRef.current = [...objectivesRef.current, e.payload];
      setObjectives(prev => [...prev, e.payload]);
    }));

    unlistens.push(await listen<string>("live-debug-event", (e) => {
      console.log("[live-debug-event]", e.payload);
    }));

    unlistens.push(await listen("live-not-found", () => {
      setLiveStatus(s => s === "in-game" ? "in-game" : "polling");
    }));

    unlistens.push(await listen("live-ended", () => {
      setLiveStatus("ended");
      killQueueRef.current = [];
      displayingRef.current = false;
      replayEndRef.current = null;
      setReplayActive(false);
      if (hudActiveRef.current) { hudActiveRef.current = false; setHudActive(false); }
      invoke("set_overlay_scene", { scene: "idle", params: {} }).catch(() => {});
    }));

    liveUnlistensRef.current.forEach(f => f());
    liveUnlistensRef.current = unlistens;

    setLiveStatus("polling");
    setRecentKills([]); setPlayers([]); setObjectives([]);
    setGameTime(0); setBlueGold(0); setRedGold(0);
    await invoke("start_live_poll");
  }

  async function stopLiveTracking() {
    await invoke("stop_live_poll");
    liveUnlistensRef.current.forEach(f => f());
    liveUnlistensRef.current = [];
    killQueueRef.current = [];
    displayingRef.current = false;
    replayEndRef.current = null;
    setReplayActive(false);
    setClipState("idle");
    setObjectives([]);
    setLiveStatus("off");
    if (hudActiveRef.current) { hudActiveRef.current = false; setHudActive(false); }
    invoke("set_overlay_scene", { scene: "idle", params: {} }).catch(() => {});
  }

  // ── HUD toggle ───────────────────────────────────────────────────────────────
  function enableHud() {
    hudActiveRef.current = true;
    setHudActive(true);
    if (players.length > 0) {
      const tick: LiveTickPayload = { game_time: gameTime, blue_kills: blueKills, red_kills: redKills, blue_gold: blueGold, red_gold: redGold, players };
      const hp = { ...buildHudParams(tick, hudTeam1Ref.current, hudTeam2Ref.current), ...buildObjectiveParams(objectives) };
      hudParamsRef.current = hp;
      invoke("set_overlay_scene", { scene: "live-hud", params: hp }).catch(() => {});
    }
  }
  function disableHud() {
    hudActiveRef.current = false;
    setHudActive(false);
    invoke("set_overlay_scene", { scene: "idle", params: {} }).catch(() => {});
  }

  // ── Replay clips ─────────────────────────────────────────────────────────────
  function handleRecordClick() {
    if (clipState === "idle") {
      setClipStart(Math.max(0, gameTimeRef.current - 5));
      setClipState("recording");
    } else {
      const end = gameTimeRef.current;
      if (end > clipStart) {
        setClips(prev => [
          ...prev,
          { id: ++clipIdRef.current, startTime: clipStart, endTime: end, label: `${fmtTime(clipStart)} – ${fmtTime(end)}` },
        ]);
      }
      setClipState("idle");
    }
  }
  async function playClip(clip: ReplayClip) {
    if (replayActive) return;
    preReplayTimeRef.current = gameTimeRef.current;
    replayEndRef.current = clip.endTime;
    setReplayActive(true);
    await invoke("seek_replay", { time: clip.startTime }).catch(() => {});
  }
  function cancelReplay() {
    replayEndRef.current = null;
    setReplayActive(false);
    invoke("seek_replay", { time: preReplayTimeRef.current }).catch(() => {});
  }
  function deleteClip(id: number) { setClips(prev => prev.filter(c => c.id !== id)); }

  // ── EOG ──────────────────────────────────────────────────────────────────────
  function updateRow(idx: number, patch: Partial<MatchedPlayer>) {
    setEogModal(prev => prev ? prev.map((r, i) => i === idx ? { ...r, ...patch } : r) : null);
  }
  async function confirmEog() {
    if (!eogModal) return;
    setSaving(true);
    try {
      for (const row of eogModal) {
        if (!row.include) continue;
        const cur = await invoke<{ wins: number; losses: number; kills: number; deaths: number; assists: number }>(
          "get_player_stats", { playerId: row.player.id }
        ).catch(() => ({ wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 }));
        await invoke("update_player_stats", {
          playerId: row.player.id,
          wins: cur.wins + row.wins, losses: cur.losses + row.losses,
          kills: cur.kills + row.kills, deaths: cur.deaths + row.deaths, assists: cur.assists + row.assists,
        });
      }
      setEogModal(null);
    } finally { setSaving(false); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const champImgUrl = (name: string) => {
    const key = champMap[name.toLowerCase()] ?? name.replace(/[\s'\.&]/g, "");
    return `${DDRAGON}/img/champion/${key}.png`;
  };

  const blue        = players.filter(p => p.team === "ORDER");
  const red         = players.filter(p => p.team === "CHAOS");
  const totalGold   = blueGold + redGold || 1;
  const blueGoldPct = (blueGold / totalGold) * 100;
  const goldDiff    = blueGold - redGold;
  const isTracking  = liveStatus !== "off";
  const isInGame    = liveStatus === "in-game";
  const liveLabel   = { off: "Off", polling: "Waiting for game…", "in-game": "In Game", ended: "Game Over" }[liveStatus];

  const blueObjs    = objectives.filter(o => o.team === "ORDER");
  const redObjs     = objectives.filter(o => o.team === "CHAOS");
  const blueDragons = blueObjs.filter(o => o.event_type === "Dragon");
  const redDragons  = redObjs.filter(o => o.event_type === "Dragon");
  const blueBarons  = blueObjs.filter(o => o.event_type === "Baron").length;
  const redBarons   = redObjs.filter(o => o.event_type === "Baron").length;
  const blueHeralds = blueObjs.filter(o => o.event_type === "Herald").length;
  const redHeralds  = redObjs.filter(o => o.event_type === "Herald").length;
  const blueTowers  = blueObjs.filter(o => o.event_type === "Tower").length;
  const redTowers   = redObjs.filter(o => o.event_type === "Tower").length;
  const blueInhibs  = blueObjs.filter(o => o.event_type === "Inhibitor").length;
  const redInhibs   = redObjs.filter(o => o.event_type === "Inhibitor").length;
  const showObjectives = isInGame || objectives.length > 0;

  // Voidgrubs
  const blueVoidgrubs  = blueObjs.filter(o => o.event_type === "VoidGrub").length;
  const redVoidgrubs   = redObjs.filter(o => o.event_type === "VoidGrub").length;
  const totalVoidgrubs = blueVoidgrubs + redVoidgrubs;

  // Dragon & baron timers
  const allDragons   = objectives.filter(o => o.event_type === "Dragon").sort((a, b) => a.game_time - b.game_time);
  const lastDragon   = allDragons[allDragons.length - 1];
  const nextDragonAt = lastDragon
    ? lastDragon.game_time + (lastDragon.name.toLowerCase().includes("elder") ? 360 : 300)
    : 300;
  const dragonCountdown = isInGame ? fmtCountdown(nextDragonAt - gameTime) : "";

  const _barons        = objectives.filter(o => o.event_type === "Baron").sort((a, b) => a.game_time - b.game_time);
  const lastBaron      = _barons[_barons.length - 1];
  const nextBaronAt    = lastBaron ? lastBaron.game_time + 360 : 1200;
  const baronCountdown = isInGame ? fmtCountdown(nextBaronAt - gameTime) : "";
  const showBaron      = isInGame && (gameTime >= 900 || lastBaron !== undefined);

  const objRows = [
    { label: hudTeam1 || "Blue", side: "ORDER", cls: "live-obj-row-blue",
      dragons: blueDragons, barons: blueBarons, heralds: blueHeralds, towers: blueTowers, inhibs: blueInhibs },
    { label: hudTeam2 || "Red",  side: "CHAOS", cls: "live-obj-row-red",
      dragons: redDragons,  barons: redBarons,  heralds: redHeralds,  towers: redTowers,  inhibs: redInhibs  },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── LCU ── */}
      <div className="toolbar">
        <span className={`dot ${lcuStatus}`} />
        <span className="status-label">{lcuLabel(lcuStatus)}</span>
        <button onClick={connectLcu} disabled={lcuStatus === "connecting" || lcuStatus === "connected"}>
          {lcuStatus === "connecting" ? "Connecting…" : "Connect to LCU"}
        </button>
        {lcuError && <span className="error">{lcuError}</span>}
      </div>

      {/* ── Live tracking ── */}
      <div className="live-section">

        {/* Tracking toolbar — game time anchored at top */}
        <div className="live-toolbar">
          <span className={`dot ${isInGame ? "connected" : liveStatus === "polling" ? "connecting" : liveStatus === "ended" ? "not_found" : ""}`} />
          <span className="status-label">{liveLabel}</span>
          {isInGame && <span className="live-game-timer">{fmtTime(gameTime)}</span>}
          {isInGame && (
            <span className="live-score">
              <span className="live-score-blue">{blueKills}</span>
              <span className="live-score-sep">–</span>
              <span className="live-score-red">{redKills}</span>
            </span>
          )}
          {!isTracking
            ? <button onClick={startLiveTracking}>Start Live Tracking</button>
            : <button className="btn-secondary" onClick={stopLiveTracking}>Stop</button>
          }
          <label className={`live-auto-toggle${autoOverlay ? " active" : ""}`}>
            <input type="checkbox" checked={autoOverlay} onChange={e => setAutoOverlay(e.target.checked)} />
            Auto Lower-Third
          </label>
        </div>

        {/* Objective timer bar */}
        {isInGame && (
          <div className="live-timer-bar">
            <div className="live-timer-item">
              <span className="live-timer-label">Dragon</span>
              <span className="live-timer-chips">
                {allDragons.map((d, i) => {
                  const { abbr, color } = dragonInfo(d.name);
                  return <span key={i} className="live-timer-dragon" style={{ background: color + "22", color, borderColor: color + "55" }}>{abbr}</span>;
                })}
                {allDragons.length === 0 && <span className="live-timer-dim">—</span>}
              </span>
              <span className={`live-timer-val${dragonCountdown === "UP" ? " live-timer-up" : ""}`}>{dragonCountdown}</span>
            </div>
            {showBaron && (
              <div className="live-timer-item">
                <span className="live-timer-label">Baron</span>
                <span className={`live-timer-val${baronCountdown === "UP" ? " live-timer-up" : ""}`}>{baronCountdown}</span>
              </div>
            )}
            {(totalVoidgrubs > 0 || gameTime < 480) && (
              <div className="live-timer-item">
                <span className="live-timer-label">Grubs</span>
                <span className="live-timer-val live-timer-blue">{blueVoidgrubs}</span>
                <span className="live-timer-sep">–</span>
                <span className="live-timer-val live-timer-red">{redVoidgrubs}</span>
              </div>
            )}
            <div className="live-timer-item">
              <span className="live-timer-label">Towers</span>
              <span className="live-timer-val live-timer-blue">{blueTowers}</span>
              <span className="live-timer-sep">–</span>
              <span className="live-timer-val live-timer-red">{redTowers}</span>
            </div>
          </div>
        )}

        {/* HUD control */}
        <div className="hud-toolbar">
          <span className="hud-label">Live HUD</span>
          <input
            className="hud-team-input"
            value={hudTeam1} onChange={e => setHudTeam1(e.target.value)}
            placeholder="Blue team name"
            disabled={hudActive}
          />
          <span className="hud-vs">vs</span>
          <input
            className="hud-team-input"
            value={hudTeam2} onChange={e => setHudTeam2(e.target.value)}
            placeholder="Red team name"
            disabled={hudActive}
          />
          {!hudActive
            ? <button className="hud-enable-btn" disabled={!isInGame} onClick={enableHud}>Enable HUD</button>
            : <button className="hud-disable-btn" onClick={disableHud}>Disable HUD</button>
          }
          {hudActive && <span className="hud-live-badge">LIVE</span>}
        </div>

        {/* Gold graph */}
        {isInGame && (
          <div className="live-gold-section">
            <div className="live-gold-labels">
              <span className="live-gold-label-blue">
                {hudTeam1 || "Blue"}&nbsp;
                <span className="live-gold-amount">{fmtGold(blueGold)}g</span>
              </span>
              <span className="live-gold-diff-badge">
                {goldDiff !== 0 && (
                  <span className={goldDiff > 0 ? "live-gold-diff-pos" : "live-gold-diff-neg"}>
                    {goldDiff > 0 ? "+" : ""}{fmtGold(Math.abs(goldDiff))}g
                  </span>
                )}
              </span>
              <span className="live-gold-label-red">
                <span className="live-gold-amount">{fmtGold(redGold)}g</span>&nbsp;
                {hudTeam2 || "Red"}
              </span>
            </div>
            <div className="live-gold-bar-wrap">
              <div className="live-gold-bar-fill" style={{ width: `${blueGoldPct}%` }} />
            </div>
          </div>
        )}

        {/* Objectives */}
        {showObjectives && (
          <div className="live-obj-section">
            <div className="live-obj-header-row">
              <span className="live-obj-team-col" />
              <span className="live-obj-col-label live-obj-dragons-col">Dragons</span>
              <span className="live-obj-col-label live-obj-stat-col">Baron</span>
              <span className="live-obj-col-label live-obj-stat-col">Herald</span>
              <span className="live-obj-col-label live-obj-stat-col">Towers</span>
              <span className="live-obj-col-label live-obj-stat-col">Inhibs</span>
            </div>
            {objRows.map(row => (
              <div key={row.side} className={`live-obj-row ${row.cls}`}>
                <span className="live-obj-team-col">{row.label}</span>
                <span className="live-obj-dragons-col">
                  {row.dragons.length === 0
                    ? <span className="live-obj-none">—</span>
                    : row.dragons.map((d, i) => {
                        const { abbr, color } = dragonInfo(d.name);
                        return (
                          <span
                            key={i}
                            className="live-obj-dragon-chip"
                            style={{ background: color + "22", color, borderColor: color + "55" }}
                            title={d.stolen ? `${d.name} (stolen)` : d.name}
                          >
                            {abbr}{d.stolen ? "!" : ""}
                          </span>
                        );
                      })
                  }
                </span>
                <span className={`live-obj-stat-col${row.barons > 0 ? " live-obj-stat-lit" : ""}`}>{row.barons}</span>
                <span className={`live-obj-stat-col${row.heralds > 0 ? " live-obj-stat-lit" : ""}`}>{row.heralds}</span>
                <span className={`live-obj-stat-col${row.towers > 0 ? " live-obj-stat-lit" : ""}`}>{row.towers}</span>
                <span className={`live-obj-stat-col${row.inhibs > 0 ? " live-obj-stat-lit live-obj-inhib" : ""}`}>{row.inhibs}</span>
              </div>
            ))}
          </div>
        )}

        {/* Kill feed */}
        {recentKills.length > 0 && (
          <div className="live-kill-log">
            {recentKills.slice(0, 5).map(k => (
              <div key={k.id} className="live-kill-entry">
                {k.badge && <span className={badgeClass(k.badge)}>{k.badge}</span>}
                <span>{k.killer}{k.killer_champ ? ` (${k.killer_champ})` : ""}</span>
                {k.victim && <><span style={{ color: "#555" }}>→</span><span style={{ color: "#e57373" }}>{k.victim}</span></>}
                {k.assists.length > 0 && <span style={{ color: "#555", fontSize: 11 }}>+{k.assists.join(", ")}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Spacer pushes scoreboard to the bottom */}
        <div style={{ flex: 1 }} />

        {/* Scoreboard — at the bottom */}
        {isInGame && players.length > 0 && (
          <div className="live-game-state">
            <div className="live-team-col live-team-blue">
              <div className="live-team-header">
                {hudTeam1 || "Blue"} (ORDER) &nbsp;·&nbsp; <span className="live-team-gold">{fmtGold(blueGold)}g</span>
              </div>
              {blue.map(p => (
                <div key={p.name} className="live-player-row">
                  <img className="live-player-champ-icon" src={champImgUrl(p.champion)} alt={p.champion} title={p.champion}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="live-player-name">{p.name}</span>
                  <span className="live-player-kda">{p.kills}/{p.deaths}/{p.assists}</span>
                  <span className="live-player-cs">{p.cs}cs</span>
                  <span className="live-player-gold">{fmtGold(p.effective_gold)}g</span>
                  <div className="live-player-items">
                    {p.items.filter(id => id > 0).map((id, i) => (
                      <img key={i} className="live-item-icon" src={itemImgUrl(id)} alt="" title={String(id)}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="live-team-col live-team-red">
              <div className="live-team-header">
                {hudTeam2 || "Red"} (CHAOS) &nbsp;·&nbsp; <span className="live-team-gold">{fmtGold(redGold)}g</span>
              </div>
              {red.map(p => (
                <div key={p.name} className="live-player-row">
                  <img className="live-player-champ-icon" src={champImgUrl(p.champion)} alt={p.champion} title={p.champion}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="live-player-name">{p.name}</span>
                  <span className="live-player-kda">{p.kills}/{p.deaths}/{p.assists}</span>
                  <span className="live-player-cs">{p.cs}cs</span>
                  <span className="live-player-gold">{fmtGold(p.effective_gold)}g</span>
                  <div className="live-player-items">
                    {p.items.filter(id => id > 0).map((id, i) => (
                      <img key={i} className="live-item-icon" src={itemImgUrl(id)} alt="" title={String(id)}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Replay clips ── */}
      <div className="replay-section">
        <div className="replay-header">
          <span className="replay-title">Replay Clips</span>
          {isTracking && (
            <button
              className={clipState === "recording" ? "replay-record-btn recording" : "replay-record-btn"}
              onClick={handleRecordClick}
              title={clipState === "idle" ? "Mark clip start (records current time − 5s)" : "Mark clip end"}
            >
              {clipState === "idle" ? "● Mark" : `■ End  ${fmtTime(clipStart)} → ${fmtTime(gameTime)}`}
            </button>
          )}
          {replayActive && (
            <button className="btn-secondary" style={{ marginLeft: 8 }} onClick={cancelReplay}>Cancel Replay</button>
          )}
        </div>
        {clips.length === 0 ? (
          <p className="replay-empty">No clips yet — start live tracking and click Mark during an interesting moment.</p>
        ) : (
          <div className="replay-clip-list">
            {clips.map(c => (
              <div key={c.id} className="replay-clip-row">
                <span className="replay-clip-label">{c.label}</span>
                <span className="replay-clip-dur">{fmtTime(c.endTime - c.startTime)}</span>
                <button className="replay-play-btn" disabled={replayActive} onClick={() => playClip(c)}>▶ Play</button>
                <button className="btn-icon" onClick={() => deleteClip(c.id)} title="Delete clip">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── LCU event log ── */}
      <div className="log" ref={logRef}>
        {events.length === 0
          ? <p className="empty">No events yet — connect and interact with the League client.</p>
          : events.map((ev, i) => <pre key={i} className="event">{ev}</pre>)
        }
      </div>

      {/* ── EOG Modal ── */}
      {eogModal && (
        <div className="modal-backdrop" onClick={() => setEogModal(null)}>
          <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Record Game Result</div>
            <p className="modal-subtitle">{eogModal.filter(r => r.include).length} roster players detected. Adjust and confirm to save stats.</p>
            <table className="eog-table">
              <thead><tr><th></th><th>Player</th><th>Result</th><th>K</th><th>D</th><th>A</th></tr></thead>
              <tbody>
                {eogModal.map((row, i) => (
                  <tr key={row.player.id} className={row.include ? "" : "eog-excluded"}>
                    <td><input type="checkbox" checked={row.include} onChange={e => updateRow(i, { include: e.target.checked })} /></td>
                    <td className="eog-name">
                      <span>{row.player.displayName}</span>
                      <span className="muted eog-summoner">{row.player.summonerName}</span>
                    </td>
                    <td>
                      <select value={row.wins === 1 ? "win" : "loss"} onChange={e => updateRow(i, e.target.value === "win" ? { wins: 1, losses: 0 } : { wins: 0, losses: 1 })}>
                        <option value="win">Win</option><option value="loss">Loss</option>
                      </select>
                    </td>
                    {(["kills", "deaths", "assists"] as const).map(f => (
                      <td key={f}><input className="eog-num" type="number" min={0} value={row[f]} onChange={e => updateRow(i, { [f]: Math.max(0, parseInt(e.target.value) || 0) })} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button onClick={confirmEog} disabled={saving || eogModal.every(r => !r.include)}>{saving ? "Saving…" : "Confirm & Save"}</button>
              <button className="btn-secondary" onClick={() => setEogModal(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
