import { describe, expect, test } from "vitest";
import { generateBomb } from "./generate";
import { clockNeeded, PACES, TUNING } from "./tuning";
import type { Difficulty } from "./types";

const scenes = (difficulty: Difficulty) => Array.from({ length: 300 }, (_, i) => generateBomb(`T${i}`, difficulty));

/** Share of the budget left over, per scene, for a player at this pace. */
function spare(difficulty: Difficulty, pace: keyof typeof PACES): number[] {
  const budget = TUNING[difficulty].seconds;
  return scenes(difficulty).map((bomb) => 1 - clockNeeded(bomb, PACES[pace]) / budget);
}

describe("bilanciamento del tempo", () => {
  test("comparsa: chi sta imparando arriva in fondo, con margine", () => {
    expect(Math.min(...spare("comparsa", "novice"))).toBeGreaterThan(0.1);
  });

  test("caratterista: alla mano sicura avanza tempo, al principiante no", () => {
    const competent = spare("caratterista", "competent");
    expect(Math.min(...competent)).toBeGreaterThan(0.25);
    expect(Math.max(...competent)).toBeLessThan(0.5);
    expect(Math.max(...spare("caratterista", "novice"))).toBeLessThan(0);
  });

  test("protagonista: si finisce a filo, e solo l'esperto prende l'Oscar", () => {
    const competent = spare("protagonista", "competent");
    expect(Math.min(...competent)).toBeGreaterThan(0.03);
    expect(Math.max(...competent)).toBeLessThan(0.2);
    // «Da Oscar» wants 40% of the clock left.
    const expert = spare("protagonista", "expert");
    expect(expert.filter((s) => s >= 0.4).length / expert.length).toBeGreaterThan(0.9);
    expect(Math.max(...competent)).toBeLessThan(0.4);
  });

  test("l'antenna pesa di più salendo di parte", () => {
    const rate = (d: Difficulty) => TUNING[d].pingCost / TUNING[d].pingEvery;
    expect(rate("comparsa")).toBeLessThan(rate("caratterista"));
    expect(rate("caratterista")).toBeLessThan(rate("protagonista"));
  });
});
