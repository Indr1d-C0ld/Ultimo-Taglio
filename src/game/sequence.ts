import type { Difficulty } from "./types";

/**
 * Il piano sequenza: one long take. Scenes follow one another without a cut, each harder
 * and shorter than the last, and a third of the time saved on one is carried into the next.
 * The first explosion ends it.
 */
export interface Chain {
  /** Root of the seeds: every scene of one take derives from it. */
  id: string;
  /** Scene number within the take, from zero. */
  index: number;
  /** Seconds brought over from the scene before. */
  carry: number;
}

export const CARRY_CAP = 120;

/** Seconds a defused scene hands to the next one. */
export function carryOf(left: number): number {
  return Math.min(CARRY_CAP, Math.floor(Math.max(0, left) / 3));
}

export function chainDifficulty(index: number): Difficulty {
  return index < 2 ? "comparsa" : index < 5 ? "caratterista" : "protagonista";
}

/** Share of the ordinary clock a scene gets: five per cent less each time, never under sixty. */
export function chainClock(index: number): number {
  return Math.max(0.6, 1 - 0.05 * index);
}

export function chainSeed(id: string, index: number): string {
  return `${id.slice(0, 8)}${index + 1}`;
}

export function firstLink(id: string): Chain {
  return { id, index: 0, carry: 0 };
}

export function nextLink(chain: Chain, left: number): Chain {
  return { id: chain.id, index: chain.index + 1, carry: carryOf(left) };
}

interface Linked {
  outcome: string;
  score: number;
  chain?: { id: string; index: number } | null;
}

export interface ChainResult {
  id: string;
  scenes: number;
  score: number;
}

/** Every long take in a register, longest first: scenes defused and the points they made. */
export function chainResults(runs: Linked[]): ChainResult[] {
  const byId = new Map<string, ChainResult>();
  for (const r of runs) {
    if (!r.chain) continue;
    const row = byId.get(r.chain.id) ?? { id: r.chain.id, scenes: 0, score: 0 };
    if (r.outcome === "safe") {
      row.scenes += 1;
      row.score += r.score;
    }
    byId.set(r.chain.id, row);
  }
  return [...byId.values()].sort((a, b) => b.scenes - a.scenes || b.score - a.score);
}
