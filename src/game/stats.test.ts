import { beforeEach, describe, expect, test } from "vitest";
import { causeOf, initialState, reduce } from "./logic";
import {
  activeProfile,
  addRun,
  createProfile,
  deleteProfile,
  exportProfile,
  hallOfFame,
  importProfile,
  loadSave,
  selectProfile,
  standings,
} from "./save";
import { careerOf, dailySeed, dayKey, earnedAwards, gradeOf, recordOf, scoreSheet, type RunRecord } from "./stats";
import type { Difficulty, Mode, RunState } from "./types";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
});

/** Plays a scene to a clean win, probing every wire first. */
function win(seed: string, difficulty: Difficulty, mode: Mode = "ripresa", seconds = 20): RunState {
  let s = reduce(initialState(), { type: "start", seed, difficulty, mode });
  const bomb = s.bomb!;
  const act = (a: Parameters<typeof reduce>[1]) => {
    s = reduce(s, a);
  };
  act({ type: "tool", tool: "ponticello" });
  act({ type: "pointer-terminal", id: "sw-a" });
  act({ type: "pointer-terminal", id: "sw-b" });
  act({ type: "tool", tool: "cacciavite" });
  act({ type: "pointer-latch" });
  if (bomb.gates.cap) {
    act({ type: "tool", tool: "ponticello" });
    act({ type: "pointer-terminal", id: "cap-hot" });
    act({ type: "pointer-terminal", id: "cap-load" });
  }
  act({ type: "tool", tool: "multimetro" });
  for (const w of bomb.wires) {
    act({ type: "pointer-terminal", id: w.a });
    act({ type: "pointer-terminal", id: w.b });
  }
  for (let i = 0; i < seconds * 4; i++) act({ type: "tick", dt: 0.25 });
  for (const key of bomb.code) act({ type: "keypad", key });
  act({ type: "keypad", key: "OK" });
  act({ type: "tool", tool: "tronchese" });
  for (const w of bomb.wires.filter((x) => x.role === "sicura" || x.role === "gemello").sort((a, b) => Number(b.role === "gemello") - Number(a.role === "gemello"))) {
    if (s.phase === "play") act({ type: "pointer-wire", id: w.id });
  }
  return s;
}

function lose(seed: string): RunState {
  let s = reduce(initialState(), { type: "start", seed, difficulty: "comparsa", mode: "ripresa" });
  s = reduce(s, { type: "tool", tool: "cacciavite" });
  return reduce(s, { type: "pointer-latch" });
}

const rec = (s: RunState, at = 1_700_000_000_000) => recordOf(s, at, s.phase === "safe" ? "safe" : "boom")!;

describe("scheda di scena", () => {
  test("un disinnesco pulito registra contatori, fasi e punteggio", () => {
    const s = win("STAT1", "caratterista");
    expect(s.phase).toBe("safe");
    const r = rec(s);
    expect(r.outcome).toBe("safe");
    expect(r.cause).toBe("disinnesco");
    expect(r.probes).toBe(s.bomb!.wires.length);
    expect(r.wiresRead).toBe(r.wires);
    expect(r.elapsed).toBe(20);
    expect(r.hints).toBe(0);
    expect(r.lineCuts).toBeGreaterThanOrEqual(1);
    expect(Object.keys(r.stageAt)).toEqual(expect.arrayContaining(["sw", "open", "cap", "code", "cut"]));
    expect(r.stageAt.cut).toBeGreaterThanOrEqual(r.stageAt.open!);
    const sheet = scoreSheet(r);
    expect(sheet.reduce((sum, l) => sum + l.points, 0)).toBe(r.score);
    expect(sheet.map((l) => l.label)).toEqual(expect.arrayContaining(["Lettura completa dei fili", "Buona la prima (+25%)"]));
    expect(r.grade).toBe("oscar");
  });

  test("i secondi persi sono le penalità, non il tempo trascorso", () => {
    let s = reduce(initialState(), { type: "start", seed: "PERSI", difficulty: "comparsa", mode: "ripresa" });
    for (let i = 0; i < 40; i++) s = reduce(s, { type: "tick", dt: 0.25 });
    s = reduce(s, { type: "hint" });
    s = reduce(s, { type: "tool", tool: "cacciavite" });
    s = reduce(s, { type: "pointer-latch" });
    const r = rec(s);
    expect(r.outcome).toBe("boom");
    expect(r.cause).toBe("microswitch");
    expect(r.lost).toBe(18);
    expect(r.score).toBe(0);
    expect(r.grade).toBe("tagliata");
  });

  test("la prova generale resta a registro ma non fa punteggio", () => {
    const r = rec(win("PROVA1", "comparsa", "prova"));
    expect(r.outcome).toBe("safe");
    expect(r.score).toBe(0);
    expect(careerOf([r]).played).toBe(0);
    expect(careerOf([r]).rehearsals).toBe(1);
  });

  test("suggerimenti ed errori abbassano voto e punti", () => {
    const clean = rec(win("VOTO", "comparsa"));
    const sloppy = { ...clean, hints: 3, mistakes: 2 };
    expect(gradeOf(sloppy)).toBe("rifare");
    const total = (r: RunRecord) => scoreSheet(r).reduce((sum, l) => sum + l.points, 0);
    expect(total(sloppy)).toBeLessThan(total(clean));
  });

  test("ogni frase di fine scena ha una causa", () => {
    const sentences = [
      "Il tempo di scena è finito. Sipario.",
      "Il ping ha spinto il ponte di scena fino a saturazione.",
      "Il ping di copione ha mangiato l'ultimo secondo.",
      "Il contatore secondario ha chiuso la scena.",
      "Il ponticello ha chiuso l'innesco di scena. Taglio sbagliato di montaggio.",
      "Il rosso stava sul percorso dalla cella all'innesco. Il colore non c'entra, il verso sì.",
      "Il taglio sul senso ha bruciato gli ultimi secondi.",
      "Alimentazione tagliata col condensatore carico: la scarica di scena finisce sull'innesco.",
      "Il microswitch sotto il coperchio ha chiuso il contatto. Andava ponticellato prima.",
      "Il grano di scena ha toccato il contatto. L'ordigno andava bloccato prima del maneggio.",
      "Ponticello tolto a copertura aperta. Il microswitch chiude il contatto.",
      "Il ponte di scena ha saturato. Il tubo chiude il copione da solo.",
      "Hai forzato due volte la linea tenuta dal relè del codice. Il copione chiude.",
      "Hai forzato la guardia due volte. L'innesco di scena chiude il piano.",
    ];
    for (const sentence of sentences) expect(causeOf(sentence), sentence).not.toBe("altro");
  });

  test("la scena del giorno ha un seme per data", () => {
    const date = new Date(2026, 10, 24, 15, 0);
    expect(dailySeed(date)).toBe("G20261124");
    expect(dayKey(date)).toBe("2026-11-24");
    const s = win(dailySeed(date), "caratterista");
    expect(recordOf(s, date.getTime(), "safe")!.daily).toBe("2026-11-24");
    expect(recordOf(s, date.getTime() + 86_400_000, "safe")!.daily).toBeNull();
  });
});

describe("carriera", () => {
  test("somma vittorie, serie, cause e fasce", () => {
    const runs = [
      rec(win("C1", "comparsa"), 1),
      rec(win("C2", "protagonista"), 2),
      rec(lose("C3"), 3),
      rec(win("C4", "comparsa"), 4),
    ];
    const c = careerOf(runs);
    expect(c.played).toBe(4);
    expect(c.won).toBe(3);
    expect(c.lost).toBe(1);
    expect(c.winRate).toBeCloseTo(0.75);
    expect(c.bestStreak).toBe(2);
    expect(c.streak).toBe(1);
    expect(c.byDifficulty.comparsa).toMatchObject({ played: 3, won: 2 });
    expect(c.byDifficulty.protagonista.won).toBe(1);
    expect(c.causes).toEqual([{ cause: "microswitch", count: 1 }]);
    expect(c.totalScore).toBe(runs.reduce((sum, r) => sum + r.score, 0));
    expect(c.cleanWins).toBe(3);
    expect(earnedAwards(runs)).toEqual(expect.arrayContaining(["prima", "protagonista", "metodo"]));
    expect(earnedAwards(runs)).not.toContain("veterano");
  });
});

describe("profili", () => {
  test("ogni interprete ha il suo registro", () => {
    expect(activeProfile().name).toBe("Ospite");
    addRun(rec(win("P1", "comparsa")));
    createProfile("  Lucia   Bosè ");
    expect(activeProfile().name).toBe("Lucia Bosè");
    expect(activeProfile().runs).toHaveLength(0);
    addRun(rec(win("P2", "protagonista")));
    const save = loadSave();
    expect(save.profiles.map((p) => p.runs.length)).toEqual([1, 1]);
    expect(standings(save)[0]!.profile.name).toBe("Lucia Bosè");
    expect(hallOfFame(save)[0]!.name).toBe("Lucia Bosè");
    // A name already taken re-enters that profile instead of making a twin.
    createProfile("ospite");
    expect(loadSave().profiles).toHaveLength(2);
    expect(activeProfile().name).toBe("Ospite");
  });

  test("esportazione e importazione riportano il registro, e lo uniscono senza doppioni", () => {
    createProfile("Anna");
    addRun(rec(win("E1", "comparsa"), 10));
    const code = exportProfile(activeProfile());
    addRun(rec(win("E2", "comparsa"), 20));
    expect(importProfile(code).error).toBeUndefined();
    expect(activeProfile().runs).toHaveLength(2);

    (globalThis as { localStorage?: unknown }).localStorage = memoryStorage();
    expect(importProfile(code).error).toBeUndefined();
    expect(activeProfile().name).toBe("Anna");
    expect(activeProfile().runs).toHaveLength(1);
    expect(importProfile("non-un-codice").error).toBeTruthy();
  });

  test("eliminare l'ultimo profilo lascia comunque un ospite", () => {
    const only = activeProfile();
    const save = deleteProfile(only.id);
    expect(save.profiles).toHaveLength(1);
    expect(selectProfile("inesistente").activeId).toBe(save.activeId);
  });
});
