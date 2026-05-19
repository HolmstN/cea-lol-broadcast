import { useState, useEffect } from "react";

const CACHE_KEY = "ddragon_champions";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

interface CacheEntry {
  champions: string[];
  timestamp: number;
}

// Module-level promise so parallel mounts share one fetch
let fetchPromise: Promise<string[]> | null = null;

function loadCache(): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) return null;
    return entry.champions;
  } catch {
    return null;
  }
}

async function fetchChampions(): Promise<string[]> {
  const versionsRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions: string[] = await versionsRes.json();
  const version = versions[0];

  const champRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );
  const champData = await champRes.json();
  const champions: string[] = Object.values(champData.data as Record<string, { name: string }>)
    .map((c) => c.name)
    .sort();

  localStorage.setItem(CACHE_KEY, JSON.stringify({ champions, timestamp: Date.now() }));
  return champions;
}

export function useChampions(): string[] {
  const [champions, setChampions] = useState<string[]>(() => loadCache() ?? []);

  useEffect(() => {
    if (champions.length > 0) return;
    if (!fetchPromise) {
      fetchPromise = fetchChampions().catch(() => []);
    }
    fetchPromise.then(setChampions);
  }, []);

  return champions;
}
