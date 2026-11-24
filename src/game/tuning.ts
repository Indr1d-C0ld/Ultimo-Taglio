import type { Bomb, Difficulty, Modifier } from "./types";

/** Clock and antenna figures per difficulty. The pace model below is what they are sized against. */
export const TUNING: Record<Difficulty, { seconds: number; pingEvery: number; pingCost: number }> = {
  comparsa: { seconds: 420, pingEvery: 40, pingCost: 5 },
  caratterista: { seconds: 360, pingEvery: 30, pingCost: 6 },
  protagonista: { seconds: 300, pingEvery: 25, pingCost: 7 },
};

/** Seconds a blunt cutter costs for every cut that was not needed. */
export const BLUNT_CUT_COST = 20;

/** Clock and antenna figures once a scene's own rules are applied. */
export function tuningFor(difficulty: Difficulty, mods: readonly Modifier[] = []) {
  const base = TUNING[difficulty];
  return {
    seconds: Math.round(base.seconds * (mods.includes("tempo-stretto") ? 0.8 : 1)),
    pingEvery: Math.round(base.pingEvery * (mods.includes("radio-disturbata") ? 0.7 : 1)),
    pingCost: base.pingCost,
  };
}

export interface Pace {
  /** Seconds to trace, probe and read one wire. */
  perWire: number;
  /** Multiplier on every step that is thinking and clicking rather than waiting. */
  hands: number;
}

export const PACES = {
  novice: { perWire: 12, hands: 1.6 },
  competent: { perWire: 8, hands: 1 },
  expert: { perWire: 5, hands: 0.75 },
} satisfies Record<string, Pace>;

/**
 * Clock a player at a given pace needs to defuse this scene by the book: every guard,
 * every digit found by hand, every wire measured. Returns seconds of countdown used,
 * antenna pings included. A rough model, there to keep budgets honest when scenes change.
 */
export function clockNeeded(bomb: Bomb, pace: Pace, mods: readonly Modifier[] = []): number {
  const { pingEvery, pingCost } = tuningFor(bomb.difficulty, mods);
  const third = Number(bomb.code[2] ?? 3);
  const watching = 2 * (0.18 * bomb.ledBlink + 0.45) + (bomb.gates.receiver ? 2 * (third * 0.34 + 1.1) + 0.3 : 0);
  const untilCode =
    pace.hands *
      (15 + // take in the scene
        13 + // shunt the cover switch, open
        (bomb.gates.cap ? 8 : 0) +
        20 + // UV: lamp on, walk around, read
        6 + // get close to the lamps
        6 + // stethoscope on the antenna, or read the plate
        12) + // fourth digit, type the code
    bomb.wires.length * pace.perWire * pace.hands +
    watching;
  const after = pace.hands * ((bomb.gates.dial ? 10 : 0) + (bomb.gates.tilt ? 5 : 0) + 10);
  // Pings fall on countdown used, which they themselves push forward.
  let used = untilCode;
  if (bomb.gates.receiver) {
    for (let i = 0; i < 6; i++) used = untilCode + Math.floor(used / pingEvery) * pingCost;
  }
  return used + after;
}
