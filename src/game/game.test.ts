import { describe, expect, test } from "vitest";
import { edgeCarries, lineClosed, netEdges, probeReading, wireClass, wireSeat } from "./circuit";
import { reduce, initialState, listenSpan, radioAnswer } from "./logic";
import type { Difficulty, RunState } from "./types";

function play(seed: string, difficulty: Difficulty): RunState {
  return reduce(initialState(), { type: "start", seed, difficulty, mode: "ripresa" });
}

function openUp(seed: string, difficulty: Difficulty): RunState {
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
  return reduce(s, { type: "tool", tool: "tronchese" });
}

/** Opens every guard, then cuts the inhibitor line one wire at a time. Returns the cuts it took. */
function solve(seed: string, difficulty: Difficulty): { state: RunState; cuts: number } {
  let s = openUp(seed, difficulty);
  let cuts = 0;
  // A careful player has read the TEST post and takes the twin's wire off first.
  const twin = s.bomb!.wires.find((w) => w.role === "gemello");
  if (twin) s = reduce(s, { type: "pointer-wire", id: twin.id });
  for (const wire of s.bomb!.wires.filter((w) => w.role === "sicura")) {
    if (s.phase !== "play") break;
    const view = { cutIds: s.cutIds, jumpers: s.jumpers, codeUnlocked: s.codeUnlocked, capDumped: s.capDumped };
    // A wire whose branch is already open no longer matters; skip it like a careful player would.
    if (!edgeCarries(netEdges(s.bomb!, view), "det-inhibit", "bat-neg", wire.id)) continue;
    s = reduce(s, { type: "pointer-wire", id: wire.id });
    cuts += 1;
    expect(s.phase === "safe").toBe(!lineClosed(s.bomb!, { ...view, cutIds: s.cutIds }));
  }
  return { state: s, cuts };
}

const DIFFS: Difficulty[] = ["comparsa", "caratterista", "protagonista"];
const SEEDS = Array.from({ length: 150 }, (_, i) => `S${i.toString(36).toUpperCase()}${i * 7}`);

function sceneChecks() {
  for (const seed of SEEDS) {
    for (const difficulty of DIFFS) {
      const tag = `${seed}/${difficulty}`;
      const { state: done } = solve(seed, difficulty);
      if (done.phase !== "safe") {
        throw new Error(`unsolved ${tag} ${done.phase} ${done.endReason} ${done.log.at(-1)?.text}`);
      }
      const bomb = done.bomb!;
      if (!/^\d{4}$/.test(bomb.code)) throw new Error(`code shape ${tag} ${bomb.code}`);
      const traps = bomb.wires.filter((w) => w.role === "trappola");
      if (!bomb.code.endsWith(String((bomb.wires.length - traps.length) % 10))) throw new Error(`digit ${tag}`);
      if (bomb.wires.length > 14) throw new Error(`too many wires ${tag} ${bomb.wires.length}`);
      const pairs = new Set(bomb.wires.map((w) => [w.a, w.b].sort().join("|")));
      if (pairs.size !== bomb.wires.length) throw new Error(`two wires share both ends ${tag}`);

      const view = { cutIds: [] as string[], jumpers: [], codeUnlocked: true, capDumped: true };
      const edges = netEdges(bomb, view);
      const fires = (id: string) => edgeCarries(edges, "bat-pos", "det-in", id);
      const holds = (id: string) => edgeCarries(edges, "det-inhibit", "bat-neg", id);
      for (const w of bomb.wires) {
        const seat = wireSeat(bomb, view, w.id);
        if (fires(w.id) !== (w.role === "trappola")) throw new Error(`trap role ${tag} ${w.id}`);
        if (holds(w.id) !== (w.role === "sicura")) throw new Error(`line role ${tag} ${w.id}`);
        if (fires(w.id) && holds(w.id)) throw new Error(`nets touch ${tag} ${w.id}`);
        // The tag on the notebook and the sentence from the meter must tell the same story.
        const cls = wireClass(bomb, view, w.id);
        const agree =
          (cls === "trappola") === seat.includes("segmento di trappola") &&
          (cls === "linea") === seat.includes("INIBITORE → BAT −") &&
          (cls === "timer") === seat.includes("Fra cella e TIMER") &&
          (cls === "cluster") === seat.includes("CLUSTER") &&
          (cls === "quarzo") === seat.includes("Filo del quarzo") &&
          (cls === "gemello") === seat.includes("Filo del gemello") &&
          (cls === "cieco") === seat.includes("Ramo cieco") &&
          (cls === "morto") === seat.includes("Ritorno morto") &&
          (cls === "rotto") === seat.includes("Anima interrotta");
        if (!agree) throw new Error(`class and seat disagree ${tag} ${cls} / ${seat}`);
        if (w.role === "trappola" && !seat.includes("trappola")) throw new Error(`trap misread ${tag} ${seat}`);
        if (w.role === "sicura" && !seat.includes("INIBITORE → BAT −")) throw new Error(`line misread ${tag} ${seat}`);
        if (w.role === "alimentazione" && !seat.includes("TIMER")) throw new Error(`power misread ${tag} ${seat}`);
        if (w.role === "esca" && w.open && !seat.includes("Anima interrotta")) throw new Error(`open misread ${tag} ${seat}`);
        if (w.role === "esca" && !w.open && !/cieco|morto/.test(seat)) throw new Error(`decoy misread ${tag} ${seat}`);
        if (w.open) {
          const reading = probeReading(bomb, view, w.a, w.b);
          if (reading.wireId !== w.id || !reading.text.startsWith("Aperto")) throw new Error(`open probe ${tag}`);
        } else if (w.diode) {
          const forward = probeReading(bomb, view, w.a, w.b).text;
          const back = probeReading(bomb, view, w.b, w.a).text;
          if (!/solo da/i.test(forward) || !/solo da/i.test(back)) throw new Error(`diode mute ${tag} ${w.id}`);
        }
      }

      let boom = play(seed, difficulty);
      boom = reduce(boom, { type: "tool", tool: "cacciavite" });
      boom = reduce(boom, { type: "pointer-latch" });
      if (boom.phase !== "boom") throw new Error(`pressure should boom ${tag}`);

      for (const trap of traps) {
        const cut = reduce(openUp(seed, difficulty), { type: "pointer-wire", id: trap.id });
        if (cut.phase !== "boom") throw new Error(`trap should boom ${tag} ${trap.id}`);
      }

      // Cutting every decoy is harmless and never wins by itself.
      let idle = openUp(seed, difficulty);
      for (const decoy of bomb.wires.filter((w) => w.role === "esca")) {
        idle = reduce(idle, { type: "pointer-wire", id: decoy.id });
      }
      if (idle.phase !== "play") throw new Error(`decoys should be inert ${tag} ${idle.phase} ${idle.endReason}`);
    }
  }
}

function varietyChecks() {
  for (const difficulty of DIFFS) {
    const bombs = SEEDS.map((seed) => play(seed, difficulty).bomb!);
    const lastDigits = new Set(bombs.map((b) => b.code[3]));
    const shapes = new Set(bombs.map((b) => b.wires.map((w) => `${w.a}>${w.b}`).sort().join(",")));
    expect(lastDigits.size, `quarta cifra ${difficulty}`).toBeGreaterThanOrEqual(3);
    expect(shapes.size, `topologie ${difficulty}`).toBeGreaterThanOrEqual(difficulty === "comparsa" ? 6 : 20);
    // The wire that wins is not always hung on the same pair of terminals.
    const lineEnds = new Set(
      bombs.flatMap((b) => b.wires.filter((w) => w.role === "sicura").map((w) => [w.a, w.b].sort().join("|"))),
    );
    expect(lineEnds.size, `capi della linea ${difficulty}`).toBeGreaterThanOrEqual(4);
  }
  const cuts = new Set(SEEDS.map((seed) => solve(seed, "protagonista").cuts));
  expect([...cuts].sort()).toEqual([1, 2]);
  const hidden = SEEDS.filter((seed) => play(seed, "caratterista").bomb!.wires.some((w) => w.open));
  expect(hidden.length).toBeGreaterThan(10);
  expect(hidden.length).toBeLessThan(SEEDS.length);
}

function knowledgeChecks() {
  let s = openUp("CAPI", "caratterista");
  const wire = s.bomb!.wires.find((w) => w.role === "esca")!;
  s = reduce(s, { type: "tool", tool: "nastro" });
  s = reduce(s, { type: "pointer-wire", id: wire.id });
  s = reduce(s, { type: "tool", tool: "pinzette" });
  s = reduce(s, { type: "pointer-wire", id: wire.id });
  expect(s.knownWireIds).not.toContain(wire.id);
  s = reduce(s, { type: "tool", tool: "multimetro" });
  s = reduce(s, { type: "pointer-terminal", id: wire.a });
  s = reduce(s, { type: "pointer-terminal", id: wire.b });
  expect(s.knownWireIds).toContain(wire.id);
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
  test("le scene cambiano davvero da un seme all'altro", varietyChecks);
  test("i capi di un filo si conoscono solo misurando", knowledgeChecks);
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

describe("decodifiche manuali", () => {
  const digitNote = (s: RunState) => s.notes.some((n) => /cifra/i.test(n));

  test("la lampada UV non scrive la cifra negli appunti", () => {
    let s = play("UV1", "caratterista");
    s = reduce(s, { type: "toggle", key: "uv" });
    expect(s.uv).toBe(true);
    expect(digitNote(s)).toBe(false);
    expect(s.log.at(-1)!.text).not.toContain(s.bomb!.uvDigit + ".");
    expect(s.decoded).toEqual({ uv: false, blinks: false, morse: false });
  });

  test("la cifra UV non sta sempre sulla stessa faccia", () => {
    const spots = new Set(SEEDS.map((seed) => play(seed, "caratterista").bomb!.uvSpot));
    expect(spots.size).toBe(5);
  });

  test("sotto la base la cifra sta solo in valigetta, l'unica che si solleva", () => {
    const under = SEEDS.map((seed) => play(seed, "caratterista").bomb!).filter((b) => b.uvSpot === 4);
    expect(under.length).toBeGreaterThan(0);
    expect(under.every((b) => b.archetype === "valigetta")).toBe(true);
  });

  test("il maneggio solleva oltre la tacca solo a grano bloccato o assente", () => {
    const free = SEEDS.map((seed) => play(seed, "comparsa")).find((s) => !s.bomb!.gates.tilt)!;
    let s = reduce(free, { type: "tool", tool: "maneggio" });
    s = reduce(s, { type: "rotate", dx: -3, dz: 0 });
    expect(s.phase).toBe("play");
    expect(s.attitude.x).toBeCloseTo(-1.1);
    s = reduce(s, { type: "reset-attitude" });
    expect(s.attitude).toEqual({ x: 0, z: 0 });

    const armed = SEEDS.map((seed) => play(seed, "caratterista")).find((s) => s.bomb!.gates.tilt)!;
    let t = reduce(armed, { type: "tool", tool: "maneggio" });
    t = reduce(t, { type: "rotate", dx: -0.2, dz: 0 });
    expect(t.phase).toBe("play");
    t = reduce(t, { type: "rotate", dx: -0.3, dz: 0 });
    expect(t.phase).toBe("boom");
  });

  test("lo stetoscopio fa ascoltare l'antenna per due giri e non rivela nulla", () => {
    let s = openUp("ASCOLTO", "caratterista");
    s = reduce(s, { type: "tool", tool: "occhio" });
    s = reduce(s, { type: "pointer-part", id: "receiver" });
    s = reduce(s, { type: "listen" });
    expect(s.listenLeft).toBe(0);
    s = reduce(s, { type: "tool", tool: "stetoscopio" });
    s = reduce(s, { type: "pointer-part", id: "receiver" });
    expect(s.listenKind).toBe("receiver");
    expect(s.listenLeft).toBeCloseTo(listenSpan(s.bomb!));
    for (let i = 0; i < 80 && s.listenLeft > 0; i++) s = reduce(s, { type: "tick", dt: 0.25 });
    expect(s.listenLeft).toBe(0);
    expect(digitNote(s)).toBe(false);
  });

  test("il cluster non si ascolta: si conta a occhio", () => {
    let s = openUp("LAMPI", "caratterista");
    s = reduce(s, { type: "tool", tool: "stetoscopio" });
    s = reduce(s, { type: "pointer-part", id: "leds" });
    expect(s.listenLeft).toBe(0);
    expect(s.log.at(-1)!.text).toMatch(/a occhio/);
  });

  test("il suggeritore regala una cifra per volta, poi il codice", () => {
    let s = play("CIFRE", "caratterista");
    const bomb = s.bomb!;
    s = reduce(s, { type: "tool", tool: "ponticello" });
    s = reduce(s, { type: "pointer-terminal", id: "sw-a" });
    s = reduce(s, { type: "pointer-terminal", id: "sw-b" });
    s = reduce(s, { type: "tool", tool: "cacciavite" });
    s = reduce(s, { type: "pointer-latch" });
    s = reduce(s, { type: "tool", tool: "ponticello" });
    s = reduce(s, { type: "pointer-terminal", id: "cap-hot" });
    s = reduce(s, { type: "pointer-terminal", id: "cap-load" });
    const said: string[] = [];
    for (let i = 0; i < 4; i++) {
      s = reduce(s, { type: "hint" });
      said.push(s.log.at(-1)!.text);
    }
    expect(said[0]).toContain(`Prima cifra: ${bomb.code[0]}`);
    expect(said[1]).toContain(`Seconda cifra: ${bomb.code[1]}`);
    expect(said[2]).toContain(`Terza cifra: ${bomb.code[2]}`);
    expect(said[3]).toContain(`Codice: ${bomb.code}`);
    expect(s.decoded).toEqual({ uv: true, blinks: true, morse: true });
  });
});

describe("complice alla radio", () => {
  test("dice fatti veri sulla scena e mai quale filo", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const s = play(seed, "protagonista");
      const b = s.bomb!;
      expect(radioAnswer(b, "tagli").includes("due")).toBe(solve(seed, "protagonista").cuts === 2);
      expect(radioAnswer(b, "gemello").startsWith("Sì")).toBe(b.twin !== null);
      expect(radioAnswer(b, "rotti").startsWith("Nessuno")).toBe(!b.wires.some((w) => w.open));
      for (const ask of ["trappole", "tagli", "gemello", "rotti", "uv"] as const) {
        expect(radioAnswer(b, ask)).not.toMatch(/rosso|blu|verde|giallo|nero|bianco|viola|grigio|marrone|arancio/i);
      }
    }
  });

  test("costa secondi una volta sola, e con l'antenna in ascolto anche un ping", () => {
    const quiet = SEEDS.map((seed) => play(seed, "comparsa")).find((s) => !s.bomb!.gates.receiver)!;
    let s = reduce(quiet, { type: "radio", ask: "trappole" });
    expect(quiet.secondsLeft - s.secondsLeft).toBe(8);
    expect(s.asked).toEqual(["trappole"]);
    const again = reduce(s, { type: "radio", ask: "trappole" });
    expect(again.secondsLeft).toBe(s.secondsLeft);
    expect(again.asked).toEqual(["trappole"]);

    const loud = SEEDS.map((seed) => play(seed, "protagonista")).find((x) => x.bomb!.gates.receiver)!;
    s = reduce(loud, { type: "radio", ask: "gemello" });
    expect(loud.secondsLeft - s.secondsLeft).toBe(8 + 7);
    expect(s.log.at(-1)!.text).toContain("sveglia l'antenna");
  });

  test("in prova non costa, e senza suggeritore la radio è muta", () => {
    let s = reduce(initialState(), { type: "start", seed: "RADIO1", difficulty: "caratterista", mode: "prova" });
    const before = s.secondsLeft;
    s = reduce(s, { type: "radio", ask: "uv" });
    expect(s.secondsLeft).toBe(before);
    let m = reduce(initialState(), { type: "start", seed: "RADIO1", difficulty: "caratterista", mode: "ripresa", mods: ["suggeritore-muto"] });
    m = reduce(m, { type: "radio", ask: "uv" });
    expect(m.asked).toEqual([]);
    expect(m.log.at(-1)!.text).toContain("fruscio");
  });
});

describe("secondo timer", () => {
  const withTwin = (d: Difficulty) => SEEDS.find((seed) => play(seed, d).bomb!.twin !== null)!;

  test("mai in comparsa, a volte più su, e il suo filo non tocca le due reti", () => {
    const has = (d: Difficulty) => SEEDS.filter((seed) => play(seed, d).bomb!.twin !== null).length;
    expect(has("comparsa")).toBe(0);
    expect(has("caratterista")).toBeGreaterThan(20);
    expect(has("caratterista")).toBeLessThan(has("protagonista"));
    expect(has("protagonista")).toBeLessThan(SEEDS.length);
    const bomb = play(withTwin("protagonista"), "protagonista").bomb!;
    const wire = bomb.wires.find((w) => w.role === "gemello")!;
    const view = { cutIds: [], jumpers: [], codeUnlocked: true, capDumped: true };
    expect(wireClass(bomb, view, wire.id)).toBe("gemello");
    expect(bomb.modules.find((m) => m.id === "detonator")!.terminals.some((t) => t.id === "det-aux")).toBe(true);
  });

  const openLine = (seed: string) => {
    let s = openUp(seed, "protagonista");
    for (const wire of s.bomb!.wires.filter((w) => w.role === "sicura")) {
      if (s.twinLeft !== null) break;
      const view = { cutIds: s.cutIds, jumpers: s.jumpers, codeUnlocked: s.codeUnlocked, capDumped: s.capDumped };
      if (!edgeCarries(netEdges(s.bomb!, view), "det-inhibit", "bat-neg", wire.id)) continue;
      s = reduce(s, { type: "pointer-wire", id: wire.id });
    }
    return s;
  };

  test("aprire la linea col gemello intatto ferma il display e sveglia l'altro", () => {
    let s = openLine(withTwin("protagonista"));
    expect(s.phase).toBe("play");
    expect(s.twinLeft).toBe(14);
    expect(s.mistakes).toBe(1);
    const frozen = s.secondsLeft;
    for (let i = 0; i < 6; i++) s = reduce(s, { type: "tick", dt: 0.5 });
    expect(s.secondsLeft).toBe(frozen);
    expect(s.twinLeft).toBe(11);
    const wire = s.bomb!.wires.find((w) => w.role === "gemello")!;
    s = reduce(s, { type: "pointer-wire", id: wire.id });
    expect(s.phase).toBe("safe");
    expect(s.endReason).toContain("Gemello fermato a 11 secondi");
  });

  test("se nessuno lo trova, il gemello arriva a zero", () => {
    let s = openLine(withTwin("protagonista"));
    for (let i = 0; i < 40 && s.phase === "play"; i++) s = reduce(s, { type: "tick", dt: 0.5 });
    expect(s.phase).toBe("boom");
    expect(s.endCause).toBe("gemello");
  });

  test("tagliato prima, il finale è quello vero", () => {
    const { state } = solve(withTwin("protagonista"), "protagonista");
    expect(state.phase).toBe("safe");
    expect(state.twinLeft).toBeNull();
  });
});

describe("filo del quarzo", () => {
  test("mai in comparsa, sempre in protagonista, a volte in caratterista, e mai più di uno", () => {
    const count = (d: Difficulty) => SEEDS.map((seed) => play(seed, d).bomb!.wires.filter((w) => w.role === "quarzo").length);
    expect(Math.max(...count("comparsa"))).toBe(0);
    expect(new Set(count("protagonista"))).toEqual(new Set([1]));
    const mid = count("caratterista");
    expect(Math.max(...mid)).toBe(1);
    expect(mid.filter((n) => n === 1).length).toBeGreaterThan(40);
    expect(mid.filter((n) => n === 0).length).toBeGreaterThan(40);
  });

  test("sta sul morsetto CLOCK, fuori da ogni percorso, e non sempre nello stesso posto dell'elenco", () => {
    const places = new Set<number>();
    for (const seed of SEEDS) {
      const bomb = play(seed, "protagonista").bomb!;
      const i = bomb.wires.findIndex((w) => w.role === "quarzo");
      places.add(i);
      const quartz = bomb.wires[i]!;
      expect(quartz.a).toBe("timer-clk");
      expect(bomb.modules.find((m) => m.id === "timer")!.terminals.map((t) => t.id)).toContain("timer-clk");
      const view = { cutIds: [] as string[], jumpers: [], codeUnlocked: true, capDumped: true };
      const edges = netEdges(bomb, view);
      expect(edgeCarries(edges, "bat-pos", "det-in", quartz.id)).toBe(false);
      expect(edgeCarries(edges, "det-inhibit", "bat-neg", quartz.id)).toBe(false);
      expect(wireClass(bomb, view, quartz.id)).toBe("quarzo");
    }
    expect(places.size).toBeGreaterThan(5);
  });

  test("tagliarlo non ferma il timer: lo fa correre al doppio", () => {
    let s = openUp("QUARZO", "protagonista");
    const quartz = s.bomb!.wires.find((w) => w.role === "quarzo")!;
    const run = (state: RunState) => {
      let n = state;
      const from = n.secondsLeft;
      for (let i = 0; i < 16; i++) n = reduce(n, { type: "tick", dt: 0.25 });
      return from - n.secondsLeft;
    };
    expect(run(s)).toBe(4);
    s = reduce(s, { type: "pointer-wire", id: quartz.id });
    expect(s.phase).toBe("play");
    expect(s.rush).toBe(true);
    expect(s.mistakes).toBe(1);
    expect(run(s)).toBe(8);
  });
});

