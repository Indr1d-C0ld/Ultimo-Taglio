import type { Difficulty, Mode } from "./types";

const KEY = "ultimo-taglio-v1";

export interface Score {
  seed: string;
  difficulty: Difficulty;
  left: number;
  hints: number;
  at: number;
}

interface Save {
  version: 1;
  best: Score[];
  read: string[];
}

const empty = (): Save => ({ version: 1, best: [], read: [] });

export function loadSave(): Save {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Save;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.best)) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(save: Save) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function recordWin(score: Omit<Score, "at">) {
  const save = loadSave();
  save.best = [{ ...score, at: Date.now() }, ...save.best].slice(0, 8);
  write(save);
}

export function markRead(id: string) {
  const save = loadSave();
  if (!save.read.includes(id)) {
    save.read.push(id);
    write(save);
  }
}

export function modeLabel(mode: Mode): string {
  return mode === "prova" ? "Prova generale" : "Ripresa";
}
