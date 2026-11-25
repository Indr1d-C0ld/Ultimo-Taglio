import { describe, expect, test } from "vitest";
import { FILM, ciakOf, filmProgress, nextScene } from "./campaign";
import { edgeCarries, netEdges } from "./circuit";
import { generateBomb } from "./generate";
import { initialState, reduce } from "./logic";
import { recordOf } from "./stats";
import { clockNeeded, PACES, tuningFor } from "./tuning";
import type { Action, RunState } from "./types";

function shoot(sceneIndex: number): { s: RunState; act: (a: Action) => void } {
  const scene = FILM[sceneIndex]!;
  let s = reduce(initialState(), { type: "start", seed: scene.seed, difficulty: scene.difficulty, mode: "ripresa", mods: scene.mods, campaign: scene.id });
  const box = { s, act: (a: Action) => { box.s = reduce(box.s, a); } };
  return box;
}

function openUp(box: ReturnType<typeof shoot>) {
  const bomb = box.s.bomb!;
  box.act({ type: "tool", tool: "ponticello" });
  box.act({ type: "pointer-terminal", id: "sw-a" });
  box.act({ type: "pointer-terminal", id: "sw-b" });
  box.act({ type: "tool", tool: "cacciavite" });
  box.act({ type: "pointer-latch" });
  if (bomb.gates.cap) {
    box.act({ type: "tool", tool: "ponticello" });
    box.act({ type: "pointer-terminal", id: "cap-hot" });
    box.act({ type: "pointer-terminal", id: "cap-load" });
  }
}

function finish(box: ReturnType<typeof shoot>) {
  const bomb = box.s.bomb!;
  for (const key of bomb.code) box.act({ type: "keypad", key });
  box.act({ type: "keypad", key: "OK" });
  box.act({ type: "tool", tool: "tronchese" });
  for (const w of bomb.wires.filter((x) => x.role === "sicura" || x.role === "gemello").sort((a, b) => Number(b.role === "gemello") - Number(a.role === "gemello"))) {
    if (box.s.phase === "play") box.act({ type: "pointer-wire", id: w.id });
  }
}

describe("il film", () => {
  test("dodici scene, tutte risolvibili e dentro il tempo per chi ha la mano sicura", () => {
    expect(FILM).toHaveLength(12);
    expect(new Set(FILM.map((s) => s.id)).size).toBe(12);
    FILM.forEach((scene, i) => {
      const box = shoot(i);
      openUp(box);
      finish(box);
      expect(box.s.phase, scene.title).toBe("safe");
      const bomb = generateBomb(scene.seed, scene.difficulty);
      const budget = tuningFor(scene.difficulty, scene.mods).seconds;
      expect(box.s.bomb!.seconds).toBe(budget);
      const pace = scene.difficulty === "comparsa" ? PACES.novice : PACES.competent;
      expect(clockNeeded(bomb, pace, scene.mods), scene.title).toBeLessThan(budget);
    });
  });

  test("le scene promettono quello che c'è davvero nell'ordigno", () => {
    const bomb = (id: string) => {
      const scene = FILM.find((s) => s.id === id)!;
      return generateBomb(scene.seed, scene.difficulty);
    };
    expect(bomb("f02").wires.some((w) => w.color === "rosso" && w.role === "trappola")).toBe(true);
    expect(bomb("f06").wires.some((w) => w.open)).toBe(true);
    expect(bomb("f12").wires.some((w) => w.open)).toBe(true);
    for (const id of ["f10", "f12"]) {
      const b = bomb(id);
      const line = b.wires.filter((w) => w.role === "sicura");
      // No single cut opens the line: after any one, another wire still carries it.
      for (const w of line) {
        const rest = netEdges(b, { cutIds: [w.id], jumpers: [], codeUnlocked: true, capDumped: true });
        expect(line.some((o) => o.id !== w.id && edgeCarries(rest, "det-inhibit", "bat-neg", o.id)), id).toBe(true);
      }
    }
  });

  test("le regole di scena cambiano davvero la partita", () => {
    // Suggeritore gratis / muto
    const first = shoot(0);
    const before = first.s.secondsLeft;
    first.act({ type: "hint" });
    expect(first.s.hintsUsed).toBe(1);
    expect(first.s.secondsLeft).toBe(before);
    const mute = shoot(5);
    mute.act({ type: "hint" });
    expect(mute.s.hintsUsed).toBe(0);
    // Copione strappato
    mute.act({ type: "archive-denied" });
    expect(mute.s.log.at(-1)!.text).toMatch(/copione è strappato/);
    // Display rotto
    const dark = shoot(7);
    expect(dark.s.displayDead).toBe(true);
    expect(dark.s.cellSpare).toBe(false);
    // Tronchese spuntata
    const blunt = shoot(8);
    openUp(blunt);
    blunt.act({ type: "tool", tool: "tronchese" });
    const left = blunt.s.secondsLeft;
    blunt.act({ type: "pointer-wire", id: blunt.s.bomb!.wires.find((w) => w.role === "esca")!.id });
    expect(blunt.s.secondsLeft).toBe(left - 20);
    // Senza rete: one wrong code and the director calls stop
    const strict = shoot(10);
    for (const key of "0000") strict.act({ type: "keypad", key });
    strict.act({ type: "keypad", key: "OK" });
    expect(strict.s.phase).toBe("boom");
    expect(strict.s.endCause).toBe("regista");
  });

  test("le scene si sbloccano una dopo l'altra, dal registro", () => {
    expect(filmProgress([]).map((p) => p.unlocked)).toEqual([true, ...Array(11).fill(false)]);
    const box = shoot(0);
    openUp(box);
    finish(box);
    const run = recordOf(box.s, 1, "safe")!;
    expect(run.campaign).toBe("f01");
    expect(run.daily).toBeNull();
    const progress = filmProgress([run]);
    expect(progress[0]).toMatchObject({ done: true, attempts: 1, ciak: ciakOf(run.grade) });
    expect(progress[1]!.unlocked).toBe(true);
    expect(progress[2]!.unlocked).toBe(false);
    expect(nextScene("f01")!.id).toBe("f02");
    expect(nextScene("f12")).toBeUndefined();
  });
});
