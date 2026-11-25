import { careerOf, type RunRecord } from "./stats";
import type { Mode } from "./types";

const KEY = "ultimo-taglio-v2";
const OLD_KEY = "ultimo-taglio-v1";
const MAX_RUNS = 500;

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  runs: RunRecord[];
  read: string[];
}

export interface Save {
  version: 2;
  activeId: string;
  profiles: Profile[];
}

function newProfile(name: string, at: number): Profile {
  return { id: `p${at.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, name, createdAt: at, runs: [], read: [] };
}

function fresh(): Save {
  const guest = newProfile("Ospite", Date.now());
  return { version: 2, activeId: guest.id, profiles: [guest] };
}

function valid(value: unknown): value is Save {
  const s = value as Save;
  return !!s && s.version === 2 && Array.isArray(s.profiles) && s.profiles.length > 0 && typeof s.activeId === "string";
}

export function loadSave(): Save {
  if (typeof localStorage === "undefined") return fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (valid(parsed)) return parsed;
    }
    // First launch after the single-score save: keep which archive pages were read.
    const save = fresh();
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const read = (JSON.parse(old) as { read?: unknown }).read;
      if (Array.isArray(read)) save.profiles[0]!.read = read.filter((x): x is string => typeof x === "string");
    }
    return save;
  } catch {
    return fresh();
  }
}

function write(save: Save) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked: the scene still plays, it just is not remembered.
  }
}

export function activeProfile(save: Save = loadSave()): Profile {
  return save.profiles.find((p) => p.id === save.activeId) ?? save.profiles[0]!;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 18);
}

export function createProfile(name: string): Save {
  const save = loadSave();
  const clean = cleanName(name);
  if (!clean) return save;
  const existing = save.profiles.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (existing) save.activeId = existing.id;
  else {
    const profile = newProfile(clean, Date.now());
    save.profiles.push(profile);
    save.activeId = profile.id;
  }
  write(save);
  return save;
}

export function selectProfile(id: string): Save {
  const save = loadSave();
  if (save.profiles.some((p) => p.id === id)) {
    save.activeId = id;
    write(save);
  }
  return save;
}

export function deleteProfile(id: string): Save {
  const save = loadSave();
  save.profiles = save.profiles.filter((p) => p.id !== id);
  if (!save.profiles.length) save.profiles.push(newProfile("Ospite", Date.now()));
  if (!save.profiles.some((p) => p.id === save.activeId)) save.activeId = save.profiles[0]!.id;
  write(save);
  return save;
}

export function addRun(run: RunRecord): Save {
  const save = loadSave();
  const profile = activeProfile(save);
  profile.runs = [...profile.runs, run].slice(-MAX_RUNS);
  write(save);
  return save;
}

export function markRead(id: string) {
  const save = loadSave();
  const profile = activeProfile(save);
  if (!profile.read.includes(id)) {
    profile.read.push(id);
    write(save);
  }
}

/** A profile as a line of text, to carry it to another browser or device. */
export function exportProfile(profile: Profile): string {
  const json = JSON.stringify({ kind: "ultimo-taglio-profilo", version: 2, profile });
  return btoa(unescape(encodeURIComponent(json)));
}

export function importProfile(code: string): { save: Save; error?: string } {
  const save = loadSave();
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as { kind?: string; profile?: Profile };
    const p = data.profile;
    if (data.kind !== "ultimo-taglio-profilo" || !p || typeof p.name !== "string" || !Array.isArray(p.runs)) {
      return { save, error: "Questo non è un profilo di Ultimo Taglio." };
    }
    const runs = p.runs.filter((r) => r && typeof r.id === "string" && typeof r.at === "number").slice(-MAX_RUNS);
    const name = cleanName(p.name) || "Importato";
    const existing = save.profiles.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Same performer on two devices: merge the registers, one entry per scene id.
      const byId = new Map([...existing.runs, ...runs].map((r) => [r.id, r]));
      existing.runs = [...byId.values()].sort((a, b) => a.at - b.at).slice(-MAX_RUNS);
      save.activeId = existing.id;
    } else {
      const profile = { ...newProfile(name, Date.now()), runs, read: Array.isArray(p.read) ? p.read : [] };
      save.profiles.push(profile);
      save.activeId = profile.id;
    }
    write(save);
    return { save };
  } catch {
    return { save, error: "Codice illeggibile. Copialo per intero." };
  }
}

export interface Standing {
  profile: Profile;
  played: number;
  won: number;
  winRate: number;
  totalScore: number;
  bestScore: number;
  bestStreak: number;
  bestChain: number;
}

/** Performers on this device, ranked by career score. */
export function standings(save: Save): Standing[] {
  return save.profiles
    .map((profile) => {
      const c = careerOf(profile.runs);
      return { profile, played: c.played, won: c.won, winRate: c.winRate, totalScore: c.totalScore, bestScore: c.bestScore, bestStreak: c.bestStreak, bestChain: c.bestChain };
    })
    .sort((a, b) => b.totalScore - a.totalScore || b.won - a.won);
}

export interface FameEntry {
  run: RunRecord;
  name: string;
}

/** Best scoring takes across every performer on this device. */
export function hallOfFame(save: Save, limit = 10): FameEntry[] {
  return save.profiles
    .flatMap((p) => p.runs.filter((r) => r.mode === "ripresa" && r.outcome === "safe").map((run) => ({ run, name: p.name })))
    .sort((a, b) => b.run.score - a.run.score || a.run.elapsed - b.run.elapsed)
    .slice(0, limit);
}

export function modeLabel(mode: Mode): string {
  return mode === "prova" ? "Prova generale" : "Ripresa";
}
