# CEA LoL Broadcast Overlays

All overlays are 1920×1080, designed for OBS Browser Source.
Gold/Blue Hextech LoL aesthetic. Fully animated entrance sequences.

---

## Files

| File | Scene | Background |
|---|---|---|
| `starting-soon.html` | Pre-show waiting screen | Solid dark |
| `match-intro.html` | Team vs Team matchup reveal | Solid dark |
| `lower-third.html` | Player / caster name bar | **Transparent** |
| `break.html` | Intermission / BRB screen | Solid dark |
| `match-result.html` | Series result announcement | Solid dark |

---

## OBS Setup

1. Add a **Browser Source** to your scene
2. Set Width: `1920`, Height: `1080`
3. Point it to the local file: `file:///C:/Users/Holms/repos/cea-lol-broadcast/overlays/<file>.html`
4. For `lower-third.html`: check **"Transparent background"** in OBS Browser Source settings

---

## Configuring via URL Parameters

Each overlay reads URL parameters so you can configure them without editing code.
In OBS Browser Source, append `?param=value` to the URL.

### starting-soon.html
| Param | Default | Example |
|---|---|---|
| `event` | `Spring Season 2025` | `?event=Fall+Season+2025` |

### match-intro.html
| Param | Default |
|---|---|
| `team1` | `Team Alpha` |
| `team2` | `Team Bravo` |
| `record1` | `6W – 2L` |
| `record2` | `5W – 3L` |
| `event` | `Spring Season 2025` |
| `round` | `Quarterfinals` |
| `matchNum` | `Match 1 of 3` |
| `format` | `Best of 3` |

### lower-third.html
| Param | Default |
|---|---|
| `mode` | `player` (or `caster`) |
| `playerName` | `SummonerName` |
| `role` | `Top` (Top/Jungle/Mid/ADC/Support) |
| `rank` | `Diamond I` |
| `team` | `Team Alpha` |
| `casterName` | `CasterName` |
| `casterRole` | `Play-by-Play` |
| `duration` | `0` (seconds, 0 = stays forever) |

### break.html
| Param | Default |
|---|---|
| `team1` | `Team Alpha` |
| `team2` | `Team Bravo` |
| `score1` | `1` |
| `score2` | `0` |
| `sub` | `Game 2 Starting Shortly` |
| `event` | `Spring Season 2025` |
| `round` | `Quarterfinals` |
| `countdown` | `0` (seconds, 0 = hidden) |

### match-result.html
| Param | Default |
|---|---|
| `winner` | `Team Alpha` |
| `loser` | `Team Bravo` |
| `winnerScore` | `2` |
| `loserScore` | `1` |
| `winnerSide` | `Blue Side` |
| `loserSide` | `Red Side` |
| `winsText` | `Advances to Semifinals` |
| `event` | `Spring Season 2025` |
| `round` | `Quarterfinals` |

---

## Quick Edit (without URL params)

Each file has a `CONFIG` object near the bottom `<script>` tag.
Edit those values directly to change defaults.
