# CEA LoL Broadcast — Roadmap

> Draft overlays (pick/ban interaction) are handled externally via **drafter.lol** — not in scope here. The **Draft Review scene** (displaying completed picks/bans after draft) is in scope as part of feature 5.

---

## What's Built

| Area | Status |
|---|---|
| Teams & roster management (CRUD, starters/subs) | ✅ Done |
| Tournament stats display (W/L/KDA in Teams view) | ✅ Done |
| LCU WebSocket connection (raw event log) | ✅ Done |
| Streamer scene switcher (hotswap overlay scenes) | ✅ Done |
| 5 standalone overlay HTML files + `overlay-live.html` | ✅ Done |
| SQLite DB: `teams`, `players`, `tournament_stats` | ✅ Done |
| Streamer ↔ Roster Integration (team/player DB pickers) | ✅ Done |

---

## Remaining Work

### ~~1 — Streamer ↔ Roster Integration~~ ✅ Done

---

### 1 — Streamer ↔ Roster Integration
**What:** Streamer params (team names, player names, records, ranks) are typed manually. They should pull from the DB.

**Scope:**
- Match Intro scene: dropdowns to pick Blue Side / Red Side team from the teams table; auto-fills team name and record
- Lower Third scene: pick a player from a team → auto-fills summoner name, role, rank, team
- Break scene: pick both teams + scores from DB / current series state
- Match Result scene: pick winner/loser teams, pull records from DB

---

### 2 — Stats Entry UI
**What:** The `tournament_stats` table exists and its data is displayed, but there are no commands or UI to write to it. After a game, there's no way to record results.

**Scope:**
- Tauri commands: `update_player_stats`, `reset_player_stats`
- UI on the Teams view (or a dedicated Stats tab): per-player stat editing, bulk game result entry (e.g. "record a win for all starters with these K/D/A")
- Nice-to-have: quick "+1 Win / +1 Loss" buttons per player

---

### ~~3 — LCU Event Parsing → Auto-Stats~~ ✅ Done

---

### 3 — LCU Event Parsing → Auto-Stats
**What:** The Live tab currently dumps raw LCU JSON. The intent is to parse meaningful events and act on them.

**Scope:**
- Parse `end-of-game` event from LCU → show a "Record this game?" prompt with pre-filled K/D/A for each player
- Detect which players in the LCU game match the app roster (by summoner name)
- Auto-populate stats entry form from the LCU end-of-game data so the caster just hits confirm
- Stretch: detect game start event to auto-switch Streamer to a relevant scene

**Note:** The heavy lifting is mapping LCU `end-of-game` payload → roster players. The LCU event URI to watch is `/lol-end-of-game/v1/eog-stats-block`.

---

### 4 — Series / Match History
**What:** Stats are cumulative totals with no game-by-game history. No concept of a "series" exists.

**Scope:**
- New DB tables: `series` (team1_id, team2_id, date, format) and `games` (series_id, winner_team_id, date)
- Standings view: aggregate W/L per team across series
- Series detail: which games were played, which team won each
- Streamer integration: active series drives the Break/Result scene defaults (score, round, teams)

---

### 5 — In-Game Broadcast HUD

**What:** A live overlay (`overlays/hud-live.html`) that sits in OBS on top of game capture and displays real-time game state. Driven by polling the League game client API (port 2999) every 2s, with data emitted over the existing WS server (`ws://127.0.0.1:7233`).

#### Key technical decisions (researched, confirmed)

- **Data source:** `GET https://127.0.0.1:2999/liveclientdata/allgamedata?eventID=N` — REST poll, no push. `eventID` param enables delta event fetching (only new events since last poll).
- **Lifecycle:** Subscribe to `/lol-gameflow/v1/gameflow-phase` on the existing LCU WS to auto-start/stop polling.
- **Player identity:** Players use `riotId` format `Name#TAG`. DB needs a `riot_id` column on `players`.
- **Gold:** Per-player wallet gold is NOT available for all players (active player only). Replaced with **Effective Gold** = `Σ(item.price × item.count)` — `price` is confirmed buy price, embedded in item data, no Data Dragon lookup needed.
- **Objectives:** Derived from `eventdata` events: `ChampionKill`, `DragonKill`, `BaronKill`, `TurretKilled`.

#### HUD layout

**Top bar:** `[Blue team name] [kills] [effective gold] | [MM:SS] | [effective gold] [kills] [Red team name]`

**Objective row:** Dragon stacks (Blue/Red) | Baron buff indicator | Tower count (Blue/Red)

**Bottom scoreboard (10 players):** Summoner name | Champion | K/D/A | CS | Effective gold

#### Decisions made

1. **Pre-game / Draft Review scene:** A dedicated overlay (`overlays/draft-review.html`) shown after champ select ends, before the game goes live. Displays both teams' 5 champion picks with icons and names, 10 bans, and player assignments. Champion data sourced from **Data Dragon** (loaded once daily on app launch, manual refresh button in app). LCU champ select data captured from `/lol-champ-select/v1/session` events on the existing LCU WS.
2. **Color scheme:** Hextech aesthetic (`#C8AA6E` / `#0BC4E3` / `#010A13`) — matches existing overlays.
3. **Baron timer:** 3-minute countdown from kill event (hardcoded buff duration). Show active countdown when buff is live, inactive otherwise.
4. **`riot_id` migration:** Auto-discover on first HUD activation — match LCU `riotId` to roster players, then confirm with caster.

#### Engineering todos

**Rust backend:**
- [ ] Data Dragon fetch on app launch (once daily, cached to disk); `refresh_ddragon` Tauri command; store version + champion map in app state
- [ ] LCU champ select listener: subscribe to `/lol-champ-select/v1/session`; capture completed picks/bans; emit `champ_select_update` Tauri event to frontend
- [ ] Port 2999 polling loop (tokio, 2s interval, cert validation disabled — matches existing LCU pattern)
- [ ] Delta event tracking (`last_event_id` state → `?eventID=N` query param)
- [ ] Event parser: `ChampionKill` → team kills; `DragonKill`, `BaronKill`, `TurretKilled` → objective counts; `BaronKill` → start 3min countdown
- [ ] Effective gold calculator per player and per team
- [ ] Roster match: `riotId` → DB player lookup (auto-discover on first HUD activation, confirm with caster)
- [ ] Emit `hud_update` WS message to `ws://127.0.0.1:7233`
- [ ] Emit `draft_review_update` WS message (picks, bans, champion icon URLs from cached DDragon)
- [ ] Emit `hud_show` / `hud_hide` on scene switch
- [ ] DB migration: add `riot_id` column to `players`

**React frontend:**
- [ ] HUD Setup panel in Streamer tab (Blue/Red team dropdowns, Activate button)
- [ ] "Draft Review" scene + "In-Game HUD" scene in scene switcher
- [ ] DDragon refresh button in app (calls `refresh_ddragon`, shows last-updated timestamp)
- [ ] Tauri commands: `activate_hud(blue_team_id, red_team_id)`, `set_hud_visibility(bool)`, `refresh_ddragon`

**Overlay (`overlays/draft-review.html`):**
- [ ] Two-team layout: Blue side (left) vs Red side (right)
- [ ] 5 champion picks per side with icon + name + player name
- [ ] 5 bans per side (smaller, greyed out)
- [ ] WS client consuming `draft_review_update` message type
- [ ] Champion icons loaded from local DDragon cache path (served via Tauri asset protocol or data URL)

**Overlay (`overlays/hud-live.html`):**
- [ ] 3-zone layout (top bar, objectives row, scoreboard)
- [ ] Baron buff: active 3-minute countdown timer, inactive indicator
- [ ] WS client consuming `hud_update` message type
- [ ] `hud_show` / `hud_hide` handlers
- [ ] Hold last-known values on WS disconnect (no blank-out)

**Design needed:**
- [ ] Draft Review overlay layout spec (picks, bans, team names, player assignments)
- [ ] Full HUD layout spec — all 3 zones
- [ ] Objective indicator treatment (dragon stacks, baron countdown, tower count)
- [ ] DDragon refresh UI placement in app

---

## Suggested Build Order

```
1. Streamer ↔ Roster       — highest immediate broadcast value, no new backend needed
2. Stats Entry UI          — unblocks data that's already half-built
3. LCU Auto-Stats          — requires 2 to be done first
4. Series / Match History  — most complex, builds on everything above
5. In-Game HUD             — largest feature; items 1-3 should be done first so roster/stats are solid
```
