import { describe, expect, test } from "vitest";
import { initialState, reduce } from "./logic";
import { carryOf, chainClock, chainDifficulty, chainResults, chainSeed, firstLink, nextLink } from "./sequence";
import { recordOf } from "./stats";
import { TUNING } from "./tuning";

describe("piano sequenza", () => {
  test("sale di parte, accorcia il tempo e non scende sotto il sessanta per cento", () => {
    expect([0, 1, 2, 4, 5, 9].map(chainDifficulty)).toEqual(["comparsa", "comparsa", "caratterista", "caratterista", "protagonista", "protagonista"]);
    expect(chainClock(0)).toBe(1);
    expect(chainClock(4)).toBeCloseTo(0.8);
    expect(chainClock(30)).toBe(0.6);
  });

  test("un terzo del tempo avanzato passa alla scena dopo, fino a centoventi secondi", () => {
    expect(carryOf(90)).toBe(30);
    expect(carryOf(1000)).toBe(120);
    expect(carryOf(-5)).toBe(0);
    const second = nextLink(firstLink("ABCDEF"), 150);
    expect(second).toEqual({ id: "ABCDEF", index: 1, carry: 50 });
    expect(chainSeed("ABCDEF", 1)).toBe("ABCDEF2");
  });

  test("la scena parte con l'orologio accorciato più il riporto, e finisce in registro col suo anello", () => {
    const chain = { id: "ABCDEF", index: 3, carry: 40 };
    const s = reduce(initialState(), { type: "start", seed: chainSeed(chain.id, 3), difficulty: chainDifficulty(3), mode: "ripresa", chain });
    expect(s.bomb!.seconds).toBe(Math.round(TUNING.caratterista.seconds * 0.85) + 40);
    expect(s.secondsLeft).toBe(s.bomb!.seconds);
    expect(s.chain).toEqual(chain);
    const run = recordOf({ ...s, phase: "boom", endCause: "tempo", tally: { ...s.tally, elapsed: 30 } }, Date.now(), "boom")!;
    expect(run.chain).toEqual({ id: "ABCDEF", index: 3 });
    expect(run.daily).toBeNull();
  });

  test("la classifica conta le scene disinnescate per ogni piano, il più lungo in testa", () => {
    const run = (id: string, index: number, outcome: string, score: number) => ({ outcome, score, chain: { id, index } });
    const rows = chainResults([
      run("A", 0, "safe", 100), run("A", 1, "safe", 200), run("A", 2, "boom", 0),
      run("B", 0, "boom", 0),
      run("C", 0, "safe", 900), run("C", 1, "safe", 50), run("C", 2, "safe", 50),
      { outcome: "safe", score: 5000 },
    ]);
    expect(rows).toEqual([{ id: "C", scenes: 3, score: 1000 }, { id: "A", scenes: 2, score: 300 }, { id: "B", scenes: 0, score: 0 }]);
  });
});
