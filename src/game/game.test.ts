import { describe, expect, test } from "vitest";
import { edgeCarries, netEdges, probeReading, wireSeat } from "./circuit";
import { reduce, initialState } from "./logic";
import type { Difficulty, RunState } from "./types";

function play(seed: string, difficulty: Difficulty): RunState {
  return reduce(initialState(), { type: "start", seed, difficulty, mode: "ripresa" });
}

function solve(seed: string, difficulty: Difficulty): RunState {
  let s = play(seed, difficulty);
  const bomb = s.bomb!;
  s = reduce(s, { type: "tool", tool: "ponticello" });
  s = reduce(s, { type: "pointer-terminal", id: "sw-a" });
  s = reduce(s, { type: "pointer-terminal", id: "sw-b" });
  s = reduce(s, { type: "tool", tool: "cacciavite" });
  s = reduce(s, { type: "pointer-latch" });
  if (bomb.gates.cap) {
    s = reduce(s, { type: "tool", tool: "ponticello" });
    s = reduce(s, { type: "pointer-terminal", id: "cap-hot" });
    s = reduce(s, { type: "pointer-terminal", id: "cap-load" });
  }
  for (const key of bomb.code) s = reduce(s, { type: "keypad", key });
  s = reduce(s, { type: "keypad", key: "OK" });
  const sicura = bomb.wires.find((w) => w.role === "sicura")!;
  s = reduce(s, { type: "tool", tool: "tronchese" });
  s = reduce(s, { type: "pointer-wire", id: sicura.id });
  return s;
}

function sceneChecks() {
  const diffs: Difficulty[] = ["comparsa", "caratterista", "protagonista"];
  for (let i = 0; i < 24; i++) {
    const seed = `S${i.toString(36).toUpperCase()}${i * 7}`;
    for (const difficulty of diffs) {
      const done = solve(seed, difficulty);
      if (done.phase !== "safe") {
        throw new Error(`unsolved ${seed} ${difficulty} ${done.phase} ${done.endReason} ${done.log.at(-1)?.text}`);
      }
      const bomb = done.bomb!;
      const traps = bomb.wires.filter((w) => w.role === "trappola");
      const expect = String(bomb.wires.length - traps.length);
      if (!bomb.code.endsWith(expect)) throw new Error(`digit ${seed} ${difficulty} ${bomb.code} ${expect}`);
      const view = { cutIds: [] as string[], jumpers: [], codeUnlocked: false, capDumped: false };
      const edges = netEdges(bomb, view);
      if (!edgeCarries(edges, "bat-pos", "det-in", traps[0]!.id) && traps.every((t) => !edgeCarries(edges, "bat-pos", "det-in", t.id))) {
        throw new Error(`no trap path ${seed} ${difficulty}`);
      }
      for (const trap of traps) {
        if (!edgeCarries(edges, "bat-pos", "det-in", trap.id)) throw new Error(`trap off path ${seed} ${trap.id} ${trap.a}-${trap.b}`);
      }
      for (const decoy of bomb.wires.filter((w) => w.role === "esca")) {
        if (edgeCarries(edges, "bat-pos", "det-in", decoy.id)) throw new Error(`esca on path ${seed} ${decoy.id}`);
      }
      const sicura = bomb.wires.find((w) => w.role === "sicura")!;
      if (edgeCarries(edges, "bat-pos", "det-in", sicura.id)) throw new Error(`sicura on firing path ${seed}`);
      const power = bomb.wires.find((w) => w.role === "alimentazione")!;
      if (!wireSeat(bomb, view, power.id).includes("TIMER")) throw new Error(`power misread ${seed} ${wireSeat(bomb, view, power.id)}`);
      const spur = bomb.wires.find((w) => w.role === "esca" && (w.a.startsWith("j") || w.b.startsWith("j")));
      if (spur && !wireSeat(bomb, view, spur.id).includes("cieco")) throw new Error(`spur misread ${seed} ${wireSeat(bomb, view, spur.id)}`);
      for (const diode of bomb.wires.filter((w) => w.diode === "a-b")) {
        const forward = probeReading(bomb, view, diode.a, diode.b).text;
        const back = probeReading(bomb, view, diode.b, diode.a).text;
        if (!forward.includes("solo da") || !back.includes("solo da")) {
          throw new Error(`diode mute ${seed} ${diode.id} ${forward} | ${back}`);
        }
      }
      let boom = play(seed, difficulty);
      boom = reduce(boom, { type: "tool", tool: "cacciavite" });
      boom = reduce(boom, { type: "pointer-latch" });
      if (boom.phase !== "boom") throw new Error(`pressure should boom ${seed} ${difficulty}`);
      const trap = boom.bomb!.wires.find((w) => w.role === "trappola")!;
      let cut = solve(seed, difficulty);
      // already safe; fresh and cut trap after open
      cut = play(seed, difficulty);
      cut = reduce(cut, { type: "tool", tool: "ponticello" });
      cut = reduce(cut, { type: "pointer-terminal", id: "sw-a" });
      cut = reduce(cut, { type: "pointer-terminal", id: "sw-b" });
      cut = reduce(cut, { type: "tool", tool: "cacciavite" });
      cut = reduce(cut, { type: "pointer-latch" });
      cut = reduce(cut, { type: "tool", tool: "tronchese" });
      cut = reduce(cut, { type: "pointer-wire", id: trap.id });
      if (cut.phase !== "boom") throw new Error(`trap should boom ${seed}`);
    }
  }
}

function kitChecks() {
  let s = play("KIT", "caratterista");
  s = reduce(s, { type: "tool", tool: "ponticello" });
  s = reduce(s, { type: "pointer-terminal", id: "sw-a" });
  s = reduce(s, { type: "pointer-terminal", id: "sw-b" });
  s = reduce(s, { type: "tool", tool: "pinzette" });
  s = reduce(s, { type: "pointer-terminal", id: "sw-a" });
  if (s.phase !== "play" || s.pressureShunted) throw new Error("tweezers should unshunt");
  s = reduce(s, { type: "tool", tool: "ponticello" });
  s = reduce(s, { type: "pointer-terminal", id: "sw-a" });
  s = reduce(s, { type: "pointer-terminal", id: "sw-b" });
  s = reduce(s, { type: "tool", tool: "cacciavite" });
  s = reduce(s, { type: "pointer-latch" });
  const pulled = reduce(reduce(s, { type: "tool", tool: "pinzette" }), { type: "pointer-terminal", id: "sw-b" });
  if (pulled.phase !== "boom") throw new Error("pulling the shunt with the lid open should boom");

  let cell = s;
  if (cell.bomb?.gates.cap) {
    cell = reduce(cell, { type: "tool", tool: "ponticello" });
    cell = reduce(cell, { type: "pointer-terminal", id: "cap-hot" });
    cell = reduce(cell, { type: "pointer-terminal", id: "cap-load" });
  }
  const power = cell.bomb!.wires.find((w) => w.role === "alimentazione")!;
  cell = reduce(cell, { type: "tool", tool: "nastro" });
  cell = reduce(cell, { type: "pointer-wire", id: power.id });
  if (!cell.markedIds.includes(power.id)) throw new Error("tape should mark");
  cell = reduce(cell, { type: "tool", tool: "tronchese" });
  cell = reduce(cell, { type: "pointer-wire", id: power.id });
  if (!cell.displayDead || cell.phase !== "play") throw new Error(`power cut ${cell.phase} ${cell.endReason}`);
  cell = reduce(cell, { type: "tool", tool: "pila" });
  cell = reduce(cell, { type: "pointer-part", id: "battery" });
  if (cell.displayDead || cell.cellSpare) throw new Error("spare cell should relight the display once");
}

function bridgeChecks() {
  const open = (seed: string) => {
    let s = play(seed, "caratterista");
    s = reduce(s, { type: "tool", tool: "ponticello" });
    s = reduce(s, { type: "pointer-terminal", id: "sw-a" });
    s = reduce(s, { type: "pointer-terminal", id: "sw-b" });
    s = reduce(s, { type: "tool", tool: "cacciavite" });
    return reduce(s, { type: "pointer-latch" });
  };
  let cook = open("PONTE");
  const sicura = cook.bomb!.wires.find((w) => w.role === "sicura")!;
  cook = reduce(cook, { type: "tool", tool: "tronchese" });
  cook = reduce(cook, { type: "pointer-wire", id: sicura.id });
  if (!cook.bridgeHot || cook.bridgeCause !== "cap" || cook.phase !== "play") {
    throw new Error(`bruise ${cook.phase} ${cook.bridgeCause} ${cook.endReason}`);
  }
  for (let i = 0; i < 24; i++) cook = reduce(cook, { type: "tick", dt: 0.5 });
  if (cook.phase !== "boom" || !cook.endReason.includes("ponte")) {
    throw new Error(`bridge should saturate ${cook.phase} ${cook.bridge} ${cook.endReason}`);
  }

  let heal = open("PONTE");
  heal = reduce(heal, { type: "tool", tool: "tronchese" });
  heal = reduce(heal, { type: "pointer-wire", id: sicura.id });
  heal = reduce(heal, { type: "tool", tool: "ponticello" });
  heal = reduce(heal, { type: "pointer-terminal", id: "cap-hot" });
  heal = reduce(heal, { type: "pointer-terminal", id: "cap-load" });
  for (let i = 0; i < 20; i++) heal = reduce(heal, { type: "tick", dt: 0.5 });
  if (heal.phase !== "play" || heal.bridgeHot || heal.bridge > 0.45) {
    throw new Error(`bridge should cool ${heal.phase} hot=${heal.bridgeHot} ${heal.bridge} ${heal.endReason}`);
  }
}

describe("ultimo taglio", () => {
  test("ogni scena è risolvibile e i ruoli dei fili sono coerenti", sceneChecks);
  test("strumenti di banco", kitChecks);
  test("ponte dell'innesco", bridgeChecks);

  test("il timer scorre in tempo reale con tick da un quarto di secondo", () => {
    let s = play("TEMPO", "comparsa");
    const start = s.secondsLeft;
    // The scene clock dispatches a tick roughly every 0.25 s of real time.
    for (let i = 0; i < 40; i++) s = reduce(s, { type: "tick", dt: 0.25 });
    const pings = s.pingCount * 7;
    expect(start - s.secondsLeft - pings).toBe(10);
  });

  test("un tick anomalo non brucia più di mezzo secondo", () => {
    let s = play("TEMPO", "comparsa");
    const start = s.secondsLeft;
    s = reduce(s, { type: "tick", dt: 30 });
    expect(start - s.secondsLeft).toBeLessThanOrEqual(1);
  });

  test("in prova generale il tempo resta fermo", () => {
    let s = reduce(initialState(), { type: "start", seed: "TEMPO", difficulty: "comparsa", mode: "prova" });
    const start = s.secondsLeft;
    for (let i = 0; i < 40; i++) s = reduce(s, { type: "tick", dt: 0.25 });
    expect(s.secondsLeft).toBe(start);
  });
});
