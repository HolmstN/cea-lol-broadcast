export interface Team {
  id: number;
  name: string;
  ceaEntryId: string | null;
}

export interface Player {
  id: number;
  teamId: number;
  summonerName: string;
  displayName: string;
  rank: string | null;
  notes: string | null;
  isStarter: boolean;
}

export interface TournamentStats {
  playerId: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
}

export const ROLES = ["Top", "Jungle", "Mid", "ADC", "Support"] as const;
export type Role = typeof ROLES[number];

export type RoleKey = "top" | "jg" | "mid" | "adc" | "sup";
export const ROLE_KEYS: RoleKey[] = ["top", "jg", "mid", "adc", "sup"];

export interface TeamRecord {
  wins: number;
  losses: number;
}

export interface OcrPlayerRow {
  nameRaw:  string;
  kills:    number;
  deaths:   number;
  assists:  number;
  cs:       number | null;
}

export interface OcrScoreboard {
  team1:   OcrPlayerRow[];
  team2:   OcrPlayerRow[];
  rawText: string;
}

export interface PlayerRankInfo {
  gameName:   string;
  tagLine:    string;
  soloRank:   string | null;
  soloLp:     number | null;
  soloWins:   number | null;
  soloLosses: number | null;
  flexRank:   string | null;
}

export interface CeaSettings {
  competitionId: string;
  entryIds: string[];
  authToken: string | null;
}

export interface CeaMatchInfo {
  matchId: string;
  date: string | null;
  status: string | null;
}

export interface CeaEntryInfo {
  entryId:  string;
  teamName: string;
  company:  string;
  seed:     number | null;
}

export interface CeaImportPlayer {
  name: string;
  summonerName: string | null;
  isStarter: boolean;
}

export interface PlayerExtendedStats {
  playerId: number;
  gameWins: number;
  gameLosses: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalCs: number;
  csDurationSec: number;
  totalGold: number;
  goldDurationSec: number;
  matchWins: number;
  matchLosses: number;
}

export interface ChampionStat {
  champion: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
}

export interface MatchEditGame {
  gameNumber: number;
  durationSec: number | null;
  blueTeam: number | null;
  team1Champ: string | null;
  team2Champ: string | null;
}

export interface MatchEditInfo {
  matchId: number;
  ceaMatchId: string;
  playedAt: string | null;
  team1Name: string | null;
  team2Name: string | null;
  games: MatchEditGame[];
}

export interface MatchPlayerInput {
  playerId:     number | null;
  summonerName: string;
  role:         string;
  champion:     string;
  kills:        number;
  deaths:       number;
  assists:      number;
  gold:         number | null;
  cs:           number | null;
  won:          boolean;
  team:         1 | 2;
  gameNumber:   number;
}
