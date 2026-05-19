const fs = require('fs');
const path = 'C:/Users/Holms/repos/cea-lol-broadcast/src/views/StreamerView.tsx';

const content = `import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Team, Player, TeamRecord } from "../types";

// --- Scene definitions ---
type SceneId = "idle" | "starting-soon" | "match-intro" | "lower-third" | "break" | "match-result";

interface ParamDef {
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "select";
  options?: string[];
}

interface SceneDef {
  label: string;
  icon: string;
  description: string;
  params: Record<string, ParamDef>;
}

const SCENES: Record<SceneId, SceneDef> = {
  idle: {
    label: "Off / Idle",
    icon: "\u25CB",
    description: "Clear the overlay (transparent)",
    params: {},
  },
  "starting-soon": {
    label: "Starting Soon",
    icon: "\u25C6",
    description: "Pre-show waiting screen",
    params: {
      event: { label: "Event Name", placeholder: "Spring Season 2025" },
    },
  },
  "match-intro": {
    label: "Match Intro",
    icon: "\u2694",
    description: "Team vs Team matchup reveal",
    params: {
      team1:    { label: "Blue Side Team",   placeholder: "Team Alpha" },
      team2:    { label: "Red Side Team",    placeholder: "Team Bravo" },
      record1:  { label: "Blue Side Record", placeholder: "6W \u2013 2L" },
      record2:  { label: "Red Side Record",  placeholder: "5W \u2013 3L" },
      round:    { label: "Round",            placeholder: "Quarterfinals" },
      matchNum: { label: "Match Number",     placeholder: "Match 1 of 3" },
      format:   { label: "Format",           placeholder: "Best of 3" },
      event:    { label: "Event Name",       placeholder: "Spring Season 2025" },
    },
  },
  "lower-third": {
    label: "Lower Third",
    icon: "\u25AC",
    description: "Player or caster name bar",
    params: {
      mode:        { label: "Mode", type: "select", options: ["player", "caster"] },
      playerName:  { label: "Summoner Name",  placeholder: "SummonerName" },
      role:        { label: "Role", type: "select", options: ["Top", "Jungle", "Mid", "ADC", "Support"] },
      rank:        { label: "Rank",           placeholder: "Diamond I" },
      team:        { label: "Team Name",      placeholder: "Team Alpha" },
      casterName:  { label: "Caster Name",    placeholder: "CasterName", hint: "Shown in caster mode" },
      casterRole:  { label: "Caster Role",    placeholder: "Play-by-Play", hint: "Shown in caster mode" },
    },
  },
  break: {
    label: "Break",
    icon: "\u23F8",
    description: "Intermission / Be Right Back",
    params: {
      team1:     { label: "Blue Side Team",  placeholder: "Team Alpha" },
      team2:     { label: "Red Side Team",   placeholder: "Team Bravo" },
      score1:    { label: "Blue Side Score", placeholder: "1" },
      score2:    { label: "Red Side Score",  placeholder: "0" },
      sub:       { label: "Subtitle",        placeholder: "Game 2 Starting Shortly" },
      countdown: { label: "Countdown (sec)", placeholder: "0", hint: "0 = no countdown" },
      round:     { label: "Round",           placeholder: "Quarterfinals" },
      event:     { label: "Event Name",      placeholder: "Spring Season 2025" },
    },
  },
  "match-result": {
    label: "Match Result",
    icon: "\uD83C\uDFC6",
    description: "Series result announcement",
    params: {
      winner:      { label: "Winner Team",    placeholder: "Team Alpha" },
      loser:       { label: "Loser Team",     placeholder: "Team Bravo" },
      winnerScore: { label: "Winner Wins",    placeholder: "2" },
      loserScore:  { label: "Loser Wins",     placeholder: "1" },
      winnerSide:  { label: "Winner Side",    placeholder: "Blue Side" },
      loserSide:   { label: "Loser Side",     placeholder: "Red Side" },
      winsText:    { label: "Outcome Text",   placeholder: "Advances to Semifinals" },
      round:       { label: "Round",          placeholder: "Quarterfinals" },
      format:      { label: "Format",         placeholder: "Best of 3" },
      event:       { label: "Event Name",     placeholder: "Spring Season 2025" },
    },
  },
};

const SCENE_ORDER: SceneId[] = ["idle", "starting-soon", "match-intro", "lower-third", "break", "match-result"];

type AllParams = Record<SceneId, Record<string, string>>;

function defaultParams(): AllParams {
  const result = {} as AllParams;
  for (const [id, def] of Object.entries(SCENES) as [SceneId, SceneDef][]) {
    result[id] = {};
    for (const [key, p] of Object.entries(def.params)) {
      if (p.type === "select" && p.options) {
        result[id][key] = p.options[0];
      } else {
        result[id][key] = p.placeholder ?? "";
      }
    }
  }
  return result;
}

function formatRecord(r: TeamRecord): string {
  return \\`\\${r.wins}W \u2013 \\${r.losses}L\\`;
}
`;

fs.writeFileSync(path, content);
console.log('wrote part 1:', content.length, 'chars');
