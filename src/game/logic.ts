import { cutsNeeded, lineClosed, probeReading, wireSeat, type NetView } from "./circuit";
import { bruiseHealed, bruiseOf, bridgeRest, bridgeSentence, firingPath, stepBridge, BRIDGE_BRUISE } from "./detonator";
import { generateBomb, UV_SPOTS } from "./generate";
import { fitLine } from "./kit";
import { BLUNT_CUT_COST, tuningFor } from "./tuning";
import { colorName, terminalLabel } from "./palette";
import type { Action, Bomb, RadioAsk, Difficulty, EndCause, LogLine, Mode, Modifier, RunState, Wire } from "./types";

const TILT_LIMIT = 0.32;
/** How far the hand can tip the prop: enough to show its underside to a low camera. */
export const TILT_REACH = 1.1;
const MAX_TICK = 0.5;

export function initialState(): RunState {
  return {
    phase: "boot",
    mode: "ripresa",
    difficulty: "caratterista",
    seed: "",
    bomb: null,
    secondsLeft: 0,
    timeAcc: 0,
    lidOpen: false,
    pressureShunted: false,
    tiltLocked: false,
    capDumped: false,
    codeUnlocked: false,
    dialMatched: false,
    dialDigits: [0, 0, 0],
    keypad: "",
    displayDead: false,
    ledsBlind: false,
    uv: false,
    xray: false,
    exploded: false,
    tool: "occhio",
    selectedId: null,
    probeA: null,
    pendingJumper: null,
    jumpers: [],
    cutIds: [],
    knownWireIds: [],
    notes: [],
    log: [],
    logSeq: 1,
    hintsUsed: 0,
    asked: [],
    mistakes: 0,
    attitude: { x: 0, z: 0 },
    listenLeft: 0,
    listenKind: null,
    decoded: { uv: false, blinks: false, morse: false },
    dialPenalty: false,
    pingCount: 0,
    forceNicks: 0,
    endReason: "",
    markedIds: [],
    cellSpare: true,
    warned30: false,
    bridge: 0,
    bridgeHot: false,
    bridgeCause: null,
    bridgeWarned: false,
    rush: false,
    twinLeft: null,
    mods: [],
    campaign: null,
    endCause: null,
    tally: { elapsed: 0, probes: 0, wrongCodes: 0, decoyCuts: 0, lineCuts: 0, stageAt: {} },
  };
}

function say(s: RunState, text: string, tone: LogLine["tone"]): RunState {
  const line: LogLine = { id: s.logSeq, text, tone };
  return { ...s, logSeq: s.logSeq + 1, log: [...s.log, line].slice(-32) };
}

function note(s: RunState, text: string): RunState {
  if (s.notes.includes(text)) return s;
  return { ...s, notes: [...s.notes, text] };
}

function boom(s: RunState, reason: string): RunState {
  return { ...say(s, reason, "bad"), phase: "boom", endReason: reason, endCause: causeOf(reason), listenLeft: 0 };
}

const CAUSES: [RegExp, EndCause][] = [
  [/secondo conteggio/i, "gemello"],
  [/tempo di scena è finito/i, "tempo"],
  [/percorso dalla cella all'innesco/i, "trappola"],
  [/microswitch/i, "microswitch"],
  [/ping/i, "antenna"],
  [/ponte di scena ha saturato/i, "ponte"],
  [/ponticello ha chiuso/i, "ponticello"],
  [/grano di scena/i, "grano"],
  [/forzat/i, "forzatura"],
  [/condensatore carico/i, "condensatore"],
  [/contatore secondario/i, "contatore"],
  [/taglio sul senso/i, "tempo"],
  [/taglio a vuoto/i, "tempo"],
  [/buona la prima/i, "regista"],
];

/** Files an ending sentence under a cause. Every sentence passed to boom() must match one. */
export function causeOf(reason: string): EndCause {
  return CAUSES.find(([pattern]) => pattern.test(reason))?.[1] ?? "altro";
}

function bump(s: RunState, key: "probes" | "wrongCodes" | "decoyCuts" | "lineCuts"): RunState {
  return { ...s, tally: { ...s.tally, [key]: s.tally[key] + 1 } };
}

/** Stamps the moment a stage first reads as done. */
function stamp(s: RunState): RunState {
  if (!s.bomb || (s.phase !== "play" && s.phase !== "safe")) return s;
  let stageAt = s.tally.stageAt;
  for (const stage of stages(s)) {
    if (stage.done && stageAt[stage.id] === undefined) {
      stageAt = { ...stageAt, [stage.id]: Math.round(s.tally.elapsed * 10) / 10 };
    }
  }
  return stageAt === s.tally.stageAt ? s : { ...s, tally: { ...s.tally, stageAt } };
}

function ownerOf(bomb: Bomb, terminalId: string): string {
  if (terminalId.startsWith("sw-")) return "chassis";
  for (const m of bomb.modules) {
    if (m.terminals.some((t) => t.id === terminalId)) return m.id;
  }
  return "chassis";
}

function interior(terminalId: string): boolean {
  return !terminalId.startsWith("sw-");
}

function viewOf(s: RunState): NetView {
  return {
    cutIds: s.cutIds,
    jumpers: s.jumpers,
    codeUnlocked: s.codeUnlocked,
    capDumped: s.capDumped,
  };
}

function describePair(s: RunState, a: string, b: string): { text: string; wireId?: string } {
  const bomb = s.bomb!;
  const pair = new Set([a, b]);
  if (pair.has("cap-hot") && pair.has("cap-load")) {
    return {
      text: s.capDumped
        ? "Condensatore di scena inerte. Il carico fittizio ha già assorbito la scarica di copione."
        : "Condensatore carico. Il morsetto CARICO FITTIZIO è l'unico ponticello sicuro: non passa dal percorso dell'innesco.",
    };
  }
  if (pair.has("cap-hot") && pair.has("bat-pos")) {
    return {
      text: s.capDumped
        ? "Scaricato. COND + non è più vincolato alla cella."
        : "Vincolo interno: COND + e BAT + sono lo stesso nodo finché non scarichi sul carico fittizio. Tagliare l'alimentazione adesso lascia la scarica sull'innesco.",
    };
  }
  if (pair.has("sw-a") && pair.has("sw-b")) {
    return {
      text: s.pressureShunted
        ? "Microswitch di copertura già tenuto aperto dal ponticello."
        : "Microswitch del coperchio. Va ponticellato prima del cacciavite. Non è sul percorso dell'innesco.",
    };
  }
  const reading = probeReading(bomb, viewOf(s), a, b);
  const bridge =
    pair.has("det-in") || pair.has("det-inhibit")
      ? ` ${bridgeSentence(s.bridge, s.bridgeHot, !!(s.bomb?.gates.cap && !s.capDumped))}`
      : "";
  if (pair.has("cap-hot") && pair.has("det-in")) {
    return { text: `Un ponticello diretto fra COND + e INNESCO chiude il copione. ${reading.text}${bridge}` };
  }
  if (pair.has("bat-pos") && pair.has("det-in") && !reading.wireId) {
    return { text: `${reading.text} Un ponticello diretto, invece, sarebbe l'innesco stesso.${bridge}` };
  }
  if (pair.has("det-in") && pair.has("det-inhibit")) {
    return { text: `I due morsetti del tubo non si parlano. L'inibitore non è il ritorno dell'innesco.${bridge}` };
  }
  return bridge ? { ...reading, text: `${reading.text}${bridge}` } : reading;
}

function guards(s: RunState): { ok: boolean; reason: string } {
  const bomb = s.bomb!;
  if (!s.lidOpen) return { ok: false, reason: `${bomb.cover} ancora chiuso` };
  if (bomb.gates.cap && !s.capDumped) return { ok: false, reason: "condensatore di scena ancora carico" };
  if (bomb.gates.keypad && !s.codeUnlocked) return { ok: false, reason: "sportello del codice ancora chiuso" };
  return { ok: true, reason: "" };
}

function requirePlay(s: RunState): RunState | null {
  if (!s.bomb || (s.phase !== "play" && s.phase !== "boot")) return s;
  return null;
}

function live(s: RunState): boolean {
  return s.phase === "play" && !!s.bomb;
}

export function reduce(state: RunState, action: Action): RunState {
  return stamp(oneTake(step(state, action)));
}

/** «Senza rete»: the director wants it right the first time, so the first slip ends the scene. */
function oneTake(s: RunState): RunState {
  if (s.phase !== "play" || !s.mods.includes("senza-rete") || s.mistakes === 0) return s;
  return boom(s, "Un errore, e il regista voleva buona la prima. Stop.");
}

function step(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "abort":
      return { ...initialState(), difficulty: state.difficulty, mode: state.mode, seed: state.seed };
    case "start":
      return start(action.seed, action.difficulty, action.mode, action.mods ?? [], action.campaign ?? null);
    case "archive-denied":
      return state.phase === "play" ? say(state, "Il copione è strappato: l'archivio resta chiuso fino a fine scena.", "warn") : state;
    case "tool":
      return { ...state, tool: action.tool, probeA: null, pendingJumper: null };
    case "select":
      return { ...state, selectedId: action.id };
    case "toggle":
      return toggle(state, action.key);
    case "tick":
      return tick(state, action.dt);
    case "pointer-part":
      return onPart(state, action.id);
    case "pointer-terminal":
      return onTerminal(state, action.id);
    case "pointer-wire":
      return onWire(state, action.id);
    case "pointer-latch":
      return onLatch(state);
    case "pointer-tilt":
      return onTilt(state);
    case "keypad":
      return onKeypad(state, action.key);
    case "dial":
      return onDial(state, action.index, action.dir);
    case "rotate":
      return onRotate(state, action.dx, action.dz);
    case "reset-attitude":
      return { ...state, attitude: { x: 0, z: 0 } };
    case "listen":
      return onListen(state);
    case "hint":
      return onHint(state);
    case "radio":
      return onRadio(state, action.ask);
    default:
      return state;
  }
}

function start(seed: string, difficulty: Difficulty, mode: Mode, mods: Modifier[], campaign: string | null): RunState {
  const clean = seed.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "CIAK01";
  const made = generateBomb(clean, difficulty);
  const bomb = { ...made, seconds: tuningFor(difficulty, mods).seconds };
  let s = say(initialState(), `${bomb.title}. Seme ${clean}. Il tempo ${mode === "prova" ? "è in prova generale." : "è in ripresa."}`, "info");
  s = say(s, "I colori non hanno un significato fisso. Il multimetro legge il percorso: cella, giunti, perle, relè. Non il costume del filo.", "info");
  const broken = mods.includes("display-rotto");
  return {
    ...s,
    phase: "play",
    mode,
    difficulty,
    seed: clean,
    bomb,
    secondsLeft: bomb.seconds,
    mods,
    campaign,
    // A dead display with no service cell: the count runs where nobody can read it.
    displayDead: broken,
    cellSpare: !broken,
  };
}

function toggle(s: RunState, key: "uv" | "xray" | "exploded"): RunState {
  const next = !s[key];
  let n: RunState = { ...s, [key]: next };
  if (key === "uv" && next) {
    n = say(n, "Lampada UV accesa. Da qualche parte sul guscio c'è una cifra che si vede solo così: giragli intorno.", "info");
  } else if (key === "uv") {
    n = say(n, "Lampada UV spenta.", "info");
  } else if (key === "xray") {
    n = say(n, next ? "Raggi di scena: il guscio diventa velo." : "Raggi spenti.", "info");
  } else if (key === "exploded") {
    n = say(n, next ? "Vista esplosa. I moduli si scostano, l'assetto non cambia." : "Moduli richiusi.", "info");
  }
  return n;
}

function advanceBridge(s: RunState, dt: number): RunState {
  if (s.phase !== "play" || !s.bomb) return s;
  const bomb = s.bomb;
  let hot = s.bridgeHot;
  let cause = s.bridgeCause;
  const wasHot = hot;
  if (hot && bruiseHealed(s)) {
    hot = false;
    cause = null;
  }
  const capLive = !!(bomb.gates.cap && !s.capDumped);
  const rest = bridgeRest(firingPath(bomb, viewOf(s)), capLive);
  const stepped = stepBridge(s.bridge, hot, rest, dt, s.mode === "prova");
  if (stepped.saturated) {
    return boom(
      { ...s, bridge: 1, bridgeHot: true },
      "Il ponte di scena ha saturato. Il tubo chiude il copione da solo.",
    );
  }
  let n: RunState = { ...s, bridge: stepped.bridge, bridgeHot: hot, bridgeCause: cause };
  if (hot && !n.bridgeWarned && stepped.bridge >= 0.75) {
    n = say(n, "Ponte oltre il settantacinque. Solo la guardia che l'ha ferito lo raffredda.", "warn");
    n = { ...n, bridgeWarned: true };
  }
  if (wasHot && !hot) {
    n = say(n, "La guardia è a posto. Il ponte smette di salire e torna al minimo di copione.", "good");
  }
  return n;
}

function tick(s: RunState, dt: number): RunState {
  if (s.phase !== "play" || !s.bomb) return s;
  // The scene clock batches frames into ticks of about a quarter second, so the
  // clamp must sit above that or the countdown runs slow. It only guards
  // against a stalled tab handing over one huge delta.
  const step = Math.min(Math.max(dt, 0), MAX_TICK);
  let n: RunState = { ...s, tally: { ...s.tally, elapsed: s.tally.elapsed + step } };
  s = n;
  if (s.listenLeft > 0) {
    const left = s.listenLeft - step;
    if (left <= 0) n = finishListen(s);
    else n = { ...s, listenLeft: left };
  }
  n = advanceBridge(n, step);
  if (n.phase !== "play") return n;
  if (n.mode !== "ripresa" || !n.bomb) return n;
  const bomb = n.bomb;

  // The line is open and the display has stopped: only the twin counts now, at its own pace.
  if (n.twinLeft !== null) {
    let acc = n.timeAcc + step;
    let twin = n.twinLeft;
    while (acc >= 1) {
      acc -= 1;
      twin -= 1;
    }
    if (twin <= 0) {
      return boom(
        { ...n, twinLeft: 0, timeAcc: 0 },
        "Il secondo conteggio è arrivato a zero. L'innesco aveva un gemello sul morsetto TEST, e nessuno gli ha tagliato il filo.",
      );
    }
    return { ...n, twinLeft: twin, timeAcc: acc };
  }

  let acc = n.timeAcc + step * (n.rush ? 2 : 1);
  let left = n.secondsLeft;
  let whole = 0;
  while (acc >= 1) {
    acc -= 1;
    whole += 1;
  }
  if (whole === 0) return { ...n, timeAcc: acc };

  left -= whole;
  if (left <= 0) return boom({ ...n, secondsLeft: 0, timeAcc: 0 }, "Il tempo di scena è finito. Sipario.");

  n = { ...n, secondsLeft: left, timeAcc: acc };

  if (n.mode === "ripresa" && !n.warned30 && left <= 30) {
    n = say({ ...n, warned30: true }, "Trenta secondi. Le mani pesano, il copione no.", "warn");
  }

  const senso = bomb.wires.find((w) => w.role === "senso");
  const sensoCut = !!senso && n.cutIds.includes(senso.id);
  const pinging = bomb.gates.receiver && !n.codeUnlocked && !sensoCut;
  if (pinging) {
    const { pingEvery, pingCost } = tuningFor(bomb.difficulty, n.mods);
    const due = Math.floor((bomb.seconds - left) / pingEvery);
    if (due > n.pingCount) {
      const hits = due - n.pingCount;
      left -= hits * pingCost;
      n = say(
        { ...n, pingCount: due, secondsLeft: Math.max(0, left), bridge: n.bridgeHot ? n.bridge + hits * 0.12 : Math.min(0.48, n.bridge + hits * 0.08) },
        n.bridgeHot
          ? "Ping radio di scena: l'antenna ruba secondi e spinge il ponte già in salita."
          : "Ping radio di scena: l'antenna ruba secondi finché il codice non la zittisce.",
        "warn",
      );
      if (n.bridge >= 1) return boom(n, "Il ping ha spinto il ponte di scena fino a saturazione.");
      if (left <= 0) return boom(n, "Il ping di copione ha mangiato l'ultimo secondo.");
    }
  }

  if (bomb.gates.dial && !n.dialMatched && !n.dialPenalty && bomb.seconds - n.secondsLeft > bomb.seconds * 0.5) {
    const penalized = n.secondsLeft - 25;
    n = say(
      { ...n, dialPenalty: true, secondsLeft: Math.max(0, penalized) },
      "Il contatore B, ignorato, salta in avanti di venticinque secondi.",
      "warn",
    );
    if (penalized <= 0) return boom(n, "Il contatore secondario ha chiuso la scena.");
  }

  return n;
}

function onTerminal(s: RunState, id: string): RunState {
  if (!live(s) || !s.bomb) {
    if (!s.bomb) return s;
    return { ...s, selectedId: ownerOf(s.bomb, id) };
  }
  const bomb = s.bomb;
  let n: RunState = { ...s, selectedId: ownerOf(bomb, id) };
  if (interior(id) && !n.lidOpen) {
    return say(n, `Il ${bomb.cover} copre i morsetti interni. Prima la chiusura, poi le mani.`, "warn");
  }
  if (n.tool === "multimetro") return probe(n, id);
  if (n.tool === "ponticello") return jumper(n, id);
  if (n.tool === "pinzette") return pullJumper(n, id);
  if (n.tool === "pila") return useCell(n);
  return n;
}

function pullJumper(s: RunState, id: string): RunState {
  const hit = s.jumpers.find((j) => j.a === id || j.b === id);
  if (!hit) return say(s, "Nessun coccodrillo su questo morsetto.", "info");
  const jumpers = s.jumpers.filter((j) => j !== hit);
  if (hit.kind === "pressure") {
    if (s.lidOpen) {
      return boom(
        { ...s, jumpers },
        "Ponticello tolto a copertura aperta. Il microswitch chiude il contatto.",
      );
    }
    return say(
      { ...s, jumpers, pressureShunted: false },
      "Coccodrilli via dal microswitch. La chiusura è di nuovo armata.",
      "warn",
    );
  }
  if (hit.kind === "cap") {
    return say({ ...s, jumpers }, "Ponticello tolto. La scarica non rientra nel cilindro.", "info");
  }
  return say({ ...s, jumpers }, "Ponticello rimosso.", "info");
}

function useCell(s: RunState): RunState {
  if (!s.cellSpare) return say(s, "La pila di servizio è già sul banco. Non ce n'è un'altra.", "warn");
  if (!s.displayDead) return say(s, "Il display è acceso. Tieni la pila per quando il vetro muore.", "info");
  return say(
    { ...s, displayDead: false, cellSpare: false },
    "Pila di servizio sul timer. Il vetro torna. Il filo dell'alimentazione resta tagliato.",
    "good",
  );
}

function onPart(s: RunState, id: string): RunState {
  const n: RunState = { ...s, selectedId: id };
  if (!live(s) || !s.bomb) return n;
  if (n.tool === "pila" && (id === "battery" || id === "timer")) return useCell(n);
  if (n.tool === "brugola" && id === "tilt") return onTilt(n);
  if (n.tool === "stetoscopio" && (id === "leds" || id === "receiver")) return onListen(n);
  if (id === "leds") return n.tool === "occhio" || n.tool === "maneggio" ? n : say(n, "Cluster: nessun attrezzo. I lampi si contano a occhio.", "info");
  if (n.tool === "cacciavite" && id === "tilt") {
    return say(n, "La vite del grano è una brugola. Il cacciavite delle chiusure non entra.", "warn");
  }
  if (n.tool === "occhio" || n.tool === "maneggio") return n;
  return say(n, fitLine(n.bomb, id), "info");
}

function probe(s: RunState, id: string): RunState {
  if (!s.probeA) return say({ ...s, probeA: id }, `Sonda A su ${terminalLabel(id)}.`, "info");
  if (s.probeA === id) return say({ ...s, probeA: null }, "Sonda ritirata.", "info");
  const reading = describePair(s, s.probeA, id);
  let n: RunState = bump({ ...s, probeA: null }, "probes");
  n = say(n, `${terminalLabel(s.probeA)} ↔ ${terminalLabel(id)} — ${reading.text}`, reading.wireId ? "good" : "info");
  n = note(n, `${terminalLabel(s.probeA)} ↔ ${terminalLabel(id)}: ${reading.text}`);
  if (reading.wireId && !n.knownWireIds.includes(reading.wireId)) {
    n = { ...n, knownWireIds: [...n.knownWireIds, reading.wireId] };
  }
  return n;
}

function jumper(s: RunState, id: string): RunState {
  if (!s.pendingJumper) return say({ ...s, pendingJumper: id }, `Primo capo su ${terminalLabel(id)}.`, "info");
  const a = s.pendingJumper;
  const b = id;
  if (a === b) return say({ ...s, pendingJumper: null }, "Ponticello annullato.", "info");
  const pair = new Set([a, b]);
  let n: RunState = { ...s, pendingJumper: null };

  if (pair.has("sw-a") && pair.has("sw-b")) {
    if (n.pressureShunted) return say(n, "Il microswitch è già in sicura.", "info");
    n = { ...n, pressureShunted: true, jumpers: [...n.jumpers, { a, b, kind: "pressure" }] };
    return say(n, "Ponticello sul microswitch. Il cacciavite adesso può aprire.", "good");
  }
  if (pair.has("cap-hot") && pair.has("cap-load")) {
    if (!n.bomb?.gates.cap) return say(n, "Qui non c'è un condensatore di scena.", "warn");
    if (n.capDumped) return say(n, "Scarica già avvenuta.", "info");
    n = { ...n, capDumped: true, jumpers: [...n.jumpers, { a, b, kind: "cap" }] };
    return say(n, "Il condensatore di scena scarica sul carico fittizio. Un clic da studio, niente altro.", "good");
  }
  if ((pair.has("cap-hot") && pair.has("det-in")) || (pair.has("bat-pos") && pair.has("det-in"))) {
    return boom(n, "Il ponticello ha chiuso l'innesco di scena. Taglio sbagliato di montaggio.");
  }
  return say({ ...n, mistakes: n.mistakes + 1 }, "Ponticello senza effetto. Quei due morsetti non formano una guardia.", "warn");
}

function onWire(s: RunState, id: string): RunState {
  if (!s.bomb) return s;
  const bomb = s.bomb;
  const wire = bomb.wires.find((w) => w.id === id);
  if (!wire) return s;
  let n: RunState = { ...s, selectedId: id };
  if (!live(s)) return n;
  if (n.tool === "nastro") {
    if (!n.lidOpen) return say(n, `Non raggiungi i fili con il ${bomb.cover} chiuso.`, "warn");
    const on = n.markedIds.includes(id);
    const markedIds = on ? n.markedIds.filter((item) => item !== id) : [...n.markedIds, id];
    return say(
      { ...n, markedIds },
      on ? `Nastro tolto dal ${colorName(wire.color).toLowerCase()}.` : `Nastro giallo sul ${colorName(wire.color).toLowerCase()}. Il circuito non cambia.`,
      "info",
    );
  }
  if (n.tool === "pinzette") return say(n, "Le pinzette staccano i coccodrilli, non i fili.", "info");
  if (n.tool !== "tronchese") {
    if (n.tool === "occhio") return n;
    const ends = n.knownWireIds.includes(id)
      ? `da ${terminalLabel(wire.a)} a ${terminalLabel(wire.b)}`
      : "capi non ancora misurati";
    return say(n, `${colorName(wire.color)}, ${ends}. Impugna la tronchese per tagliare.`, "info");
  }
  if (!n.lidOpen) return say(n, `Non raggiungi i fili con il ${bomb.cover} chiuso.`, "warn");
  if (n.cutIds.includes(id)) return say(n, "Questo tratto è già tagliato.", "info");

  if (wire.role === "trappola") {
    return boom(n, `Il ${colorName(wire.color).toLowerCase()} stava sul percorso dalla cella all'innesco. Il colore non c'entra, il verso sì.`);
  }
  if (wire.role === "esca") {
    n = bump({ ...n, cutIds: [...n.cutIds, id], knownWireIds: know(n, id) }, "decoyCuts");
    if (n.mods.includes("tronchese-spuntata") && n.mode === "ripresa") {
      n = { ...n, secondsLeft: Math.max(0, n.secondsLeft - BLUNT_CUT_COST) };
      if (n.secondsLeft <= 0) return boom(n, "Un taglio a vuoto con la tronchese spuntata ha bruciato gli ultimi secondi.");
      return say(n, `${colorName(wire.color)} tagliato a fatica: la tronchese spuntata si mangia ${BLUNT_CUT_COST} secondi. ${wireSeat(bomb, viewOf(n), id)}`, "warn");
    }
    return say(n, `${colorName(wire.color)} tagliato. ${wireSeat(bomb, viewOf(n), id)}`, "info");
  }
  if (wire.role === "quarzo") {
    n = { ...n, cutIds: [...n.cutIds, id], knownWireIds: know(n, id), rush: true, mistakes: n.mistakes + 1 };
    return say(n, "Hai tagliato il quarzo. Il timer non si ferma: perde il passo e il conto corre al doppio.", "bad");
  }
  if (wire.role === "gemello") {
    n = { ...n, cutIds: [...n.cutIds, id], knownWireIds: know(n, id) };
    if (n.twinLeft === null) {
      return say(n, "Filo del TEST tagliato. Sotto l'innesco un secondo conteggio, che nessuno aveva annunciato, resta senza corrente.", "good");
    }
    const twin = n.twinLeft;
    n = { ...n, phase: "safe", endCause: "disinnesco" };
    return {
      ...say(n, "Il gemello si ferma. Adesso sì: l'innesco di scena resta muto.", "good"),
      endReason: `Gemello fermato a ${twin} ${twin === 1 ? "secondo" : "secondi"} dallo zero, con ${formatClock(n.secondsLeft)} fermi sul display.`,
    };
  }
  if (wire.role === "senso") {
    n = {
      ...n,
      cutIds: [...n.cutIds, id],
      ledsBlind: true,
      secondsLeft: n.mode === "ripresa" ? Math.max(0, n.secondsLeft - 12) : n.secondsLeft,
    };
    n = say(n, "Onda di scena interrotta. Il cluster si spegne: se non avevi contato i lampi, la seconda cifra non si legge più.", "warn");
    if (n.secondsLeft <= 0) return boom(n, "Il taglio sul senso ha bruciato gli ultimi secondi.");
    return n;
  }
  if (wire.role === "alimentazione") {
    if (bomb.gates.cap && !n.capDumped) {
      return boom(n, "Alimentazione tagliata col condensatore carico: la scarica di scena finisce sull'innesco.");
    }
    n = { ...n, cutIds: [...n.cutIds, id], displayDead: true };
    return say(n, "Il display LCD si spegne. Il tempo di scena, dietro, continua.", "warn");
  }

  const g = guards(n);
  if (!g.ok) {
    const nick = n.forceNicks + 1;
    const relayHeld = bomb.gates.keypad && !n.codeUnlocked && g.reason.startsWith("sportello");
    if (nick >= 2) {
      return boom(
        { ...n, forceNicks: nick },
        relayHeld
          ? "Hai forzato due volte la linea tenuta dal relè del codice. Il copione chiude."
          : "Hai forzato la guardia due volte. L'innesco di scena chiude il piano.",
      );
    }
    n = {
      ...n,
      forceNicks: nick,
      mistakes: n.mistakes + 1,
      secondsLeft: n.mode === "ripresa" ? Math.max(1, n.secondsLeft - 8) : n.secondsLeft,
      bridgeHot: true,
      bridgeCause: bruiseOf(g.reason),
      bridge: Math.max(n.bridge, BRIDGE_BRUISE),
    };
    return say(
      n,
      relayHeld
        ? "Il relè del codice è chiuso in parallelo. La tronchese non apre la linea, e il ponte di scena parte: circa nove secondi."
        : `La tronchese non morde: ${g.reason}. Il ponte parte. Circa nove secondi, poi satura. Un secondo tentativo chiude subito.`,
      "warn",
    );
  }

  n = bump({ ...n, cutIds: [...n.cutIds, id], knownWireIds: know(n, id) }, "lineCuts");
  if (lineClosed(bomb, viewOf(n))) {
    return say(
      n,
      `${colorName(wire.color)} aperto, ma l'INIBITORE vede ancora BAT − da un altro ramo. La linea resta chiusa.`,
      "warn",
    );
  }
  if (n.twinLeft !== null) return say(n, "La linea è già aperta. Non è lei che sta contando.", "warn");
  const twinWire = bomb.wires.find((w) => w.role === "gemello");
  if (bomb.twin !== null && twinWire && !n.cutIds.includes(twinWire.id)) {
    // Waking the twin is a slip: the scene can still be saved, but not as a clean take.
    n = { ...n, twinLeft: bomb.twin, timeAcc: 0, mistakes: n.mistakes + 1, bridge: 0, bridgeHot: false, bridgeCause: null };
    return say(
      n,
      n.mode === "ripresa"
        ? `Inibitore aperto. Il display si ferma. Poi, sotto l'innesco, qualcosa ricomincia a contare: ${bomb.twin} secondi. C'è un altro filo.`
        : "Inibitore aperto. Il display si ferma. Poi, sotto l'innesco, si accende un secondo conteggio: in prova resta fermo, ma c'è un altro filo da trovare.",
      "bad",
    );
  }
  n = { ...n, phase: "safe", endCause: "disinnesco", bridge: 0, bridgeHot: false, bridgeCause: null };
  const left = n.secondsLeft;
  return {
    ...say(n, "Inibitore aperto. L'innesco di scena resta muto. Il timer si ferma.", "good"),
    endReason: `Disinnescato con ${formatClock(left)} ancora sul display.`,
  };
}

function know(s: RunState, id: string): string[] {
  return s.knownWireIds.includes(id) ? s.knownWireIds : [...s.knownWireIds, id];
}

function onLatch(s: RunState): RunState {
  if (!live(s) || !s.bomb) return { ...s, selectedId: "latch" };
  const bomb = s.bomb;
  let n: RunState = { ...s, selectedId: "latch" };
  if (n.tool === "brugola") return say(n, "La brugola è per la vite del grano, non per le chiusure.", "info");
  if (n.tool !== "cacciavite") return say(n, "Le chiusure vogliono il cacciavite, non le mani nude.", "info");
  if (n.lidOpen) return say(n, `Il ${bomb.cover} è già aperto.`, "info");
  if (bomb.gates.pressure && !n.pressureShunted) {
    return boom(n, `Il microswitch sotto il ${bomb.cover} ha chiuso il contatto. Andava ponticellato prima.`);
  }
  n = { ...n, lidOpen: true };
  return say(n, `${cap(bomb.cover)} aperto. I moduli di scena sono raggiungibili.`, "good");
}

function onTilt(s: RunState): RunState {
  if (!live(s) || !s.bomb) return { ...s, selectedId: "tilt" };
  const bomb = s.bomb;
  let n: RunState = { ...s, selectedId: "tilt" };
  if (!bomb.gates.tilt) return say(n, "In questa scena non c'è un grano d'inclinazione.", "info");
  if (!n.lidOpen) return say(n, "La vite di blocco è sotto la copertura.", "warn");
  if (n.tool === "cacciavite") return say(n, "La vite del grano è una brugola. Il cacciavite delle chiusure non entra.", "warn");
  if (n.tool !== "brugola") return say(n, "La vite di blocco vuole la brugola.", "info");
  if (n.tiltLocked) return say(n, "Assetto già bloccato. Puoi maneggiare l'ordigno.", "info");
  return say({ ...n, tiltLocked: true }, "Vite di blocco serrata. Il grano non chiude più il contatto.", "good");
}

function onKeypad(s: RunState, key: string): RunState {
  if (!live(s) || !s.bomb?.gates.keypad) return s;
  if (key === "C") return say({ ...s, keypad: "" }, "Tastierino azzerato.", "info");
  if (key === "OK") {
    if (s.keypad.length !== 4) return say(s, "Servono quattro cifre.", "warn");
    if (s.keypad === s.bomb.code) {
      let n: RunState = { ...s, codeUnlocked: true, keypad: "" };
      n = say(n, "Codice accettato. Lo sportello sulla linea di scena si ritrae.", "good");
      if (s.bomb.gates.receiver) n = say(n, "L'antenna smette di rubare secondi.", "info");
      return n;
    }
    const left = s.mode === "ripresa" ? Math.max(1, s.secondsLeft - 10) : s.secondsLeft;
    return say(
      bump({ ...s, keypad: "", mistakes: s.mistakes + 1, secondsLeft: left }, "wrongCodes"),
      "Codice rifiutato. Il copione non perdona a orecchio.",
      "warn",
    );
  }
  if (!/^[0-9]$/.test(key)) return s;
  if (s.keypad.length >= 4) return s;
  return { ...s, keypad: s.keypad + key };
}

function onDial(s: RunState, index: 0 | 1 | 2, dir: 1 | -1): RunState {
  if (!live(s) || !s.bomb?.dial) return s;
  if (!s.lidOpen) return say(s, "Il contatore B è sotto la copertura.", "warn");
  const digits: [number, number, number] = [...s.dialDigits];
  digits[index] = (digits[index] + dir + 10) % 10;
  const matched = digits.every((d, i) => d === s.bomb!.dial![i]);
  let n: RunState = { ...s, dialDigits: digits, dialMatched: matched };
  if (matched && !s.dialMatched) n = say(n, "Contatore B allineato. Il salto di tempo non arriverà.", "good");
  return n;
}

function onRotate(s: RunState, dx: number, dz: number): RunState {
  if (!s.bomb) return s;
  if (s.tool !== "maneggio") return s;
  if (s.phase !== "play") return s;
  const x = clamp(s.attitude.x + dx, -TILT_REACH, TILT_REACH);
  const z = clamp(s.attitude.z + dz, -TILT_REACH, TILT_REACH);
  const n: RunState = { ...s, attitude: { x, z } };
  if (!s.bomb.gates.tilt || s.tiltLocked) return n;
  const mag = Math.hypot(x, z);
  if (mag > TILT_LIMIT) {
    return boom(n, "Il grano di scena ha toccato il contatto. L'ordigno andava bloccato prima del maneggio.");
  }
  return n;
}

/** Seconds the stethoscope stays on the antenna: two full runs of the beat, so a missed count can be checked. */
export function listenSpan(bomb: Bomb): number {
  return 2 * beatCycle(Number(bomb.code[2] ?? 3)) + 0.3;
}

export const BEAT = 0.34;
export function beatCycle(beats: number): number {
  return beats * BEAT + 1.1;
}

function onListen(s: RunState): RunState {
  if (!live(s) || !s.bomb) return s;
  if (s.selectedId === "leds") return say(s, "Il cluster non si ascolta: i lampi si contano a occhio, da vicino.", "info");
  if (s.tool !== "stetoscopio") return say(s, "Serve lo stetoscopio di scena. L'orecchio nudo non tiene il tempo del battito.", "warn");
  if (s.listenLeft > 0) return s;
  if (s.selectedId === "receiver") {
    if (!s.bomb.gates.receiver) return say(s, "Nessuna antenna in questa scena.", "warn");
    return say(
      { ...s, listenLeft: listenSpan(s.bomb), listenKind: "receiver" },
      "Stetoscopio sull'antenna. Conta i battiti fra una pausa e l'altra: passano due volte.",
      "info",
    );
  }
  return say(s, "Lo stetoscopio va sul ricevitore.", "info");
}

function finishListen(s: RunState): RunState {
  const n: RunState = { ...s, listenLeft: 0, listenKind: null };
  return s.listenKind === "receiver" ? say(n, "Stetoscopio via. Se hai perso il conto, riascolta.", "info") : n;
}

function onHint(s: RunState): RunState {
  if (!live(s) || !s.bomb) return s;
  if (s.mods.includes("suggeritore-muto")) return say(s, "In questa scena il suggeritore non c'è. Te la cavi da solo.", "warn");
  if (s.hintsUsed >= 4) return say(s, "Il suggeritore ha finito le battute.", "warn");
  const { text, gives } = hintFor(s);
  let n: RunState = { ...s, hintsUsed: s.hintsUsed + 1 };
  if (gives) n = { ...n, decoded: { ...n.decoded, [gives]: true } };
  if (n.mode === "ripresa" && !n.mods.includes("suggeritore-gratis")) {
    n = { ...n, secondsLeft: Math.max(1, n.secondsLeft - 18) };
  }
  n = note(n, `Suggerimento: ${text}`);
  return say(n, text, "warn");
}

/** Seconds of airtime one question costs in a take. */
export const RADIO_COST = 8;

export const RADIO_ASKS: { id: RadioAsk; label: string }[] = [
  { id: "trappole", label: "Quante trappole?" },
  { id: "tagli", label: "Quanti tagli sulla linea?" },
  { id: "gemello", label: "C'è un secondo timer?" },
  { id: "rotti", label: "Fili rotti sotto la guaina?" },
  { id: "uv", label: "Dove punto la UV?" },
];

/** The receiver is listening: any transmission near it, the accomplice's included, sets it off. */
export function antennaLive(s: RunState): boolean {
  const b = s.bomb;
  if (!b || !b.gates.receiver || s.codeUnlocked) return false;
  const senso = b.wires.find((w) => w.role === "senso");
  return !(senso && s.cutIds.includes(senso.id));
}

/** What a call costs right now: airtime, doubled on a bad line, plus the ping it provokes. */
export function radioCost(s: RunState): number {
  if (!s.bomb || s.mode !== "ripresa") return 0;
  const air = RADIO_COST * (s.mods.includes("radio-disturbata") ? 2 : 1);
  return air + (antennaLive(s) ? tuningFor(s.bomb.difficulty, s.mods).pingCost : 0);
}

/** The accomplice reads the builder's drawings: counts and places, true every time, never which wire. */
export function radioAnswer(b: Bomb, ask: RadioAsk): string {
  switch (ask) {
    case "trappole": {
      const n = b.wires.filter((w) => w.role === "trappola").length;
      return n === 1
        ? "Dallo schema, fra la cella e l'innesco c'è un tratto solo. Una trappola: trovala e non toccarla."
        : `Dallo schema conto ${n} tratti fra la cella e l'innesco. ${cap(numero(n))} trappole: nessuna va toccata.`;
    }
    case "tagli":
      return cutsNeeded(b) > 1
        ? "La linea dell'inibitore qui si sdoppia: due rami in parallelo. Un taglio non basta, ne servono due."
        : "La linea dell'inibitore è un ramo solo. Un taglio, quello giusto, e hai finito.";
    case "gemello":
      return b.twin !== null
        ? `Sì. Sotto l'innesco ce n'è un altro, da ${b.twin} secondi. Cerca un terzo morsetto, con scritto TEST, e toglili il filo prima di aprire la linea.`
        : "No. Ho girato lo schema tre volte: un timer solo. Quando il display si ferma, è finita davvero.";
    case "rotti": {
      const n = b.wires.filter((w) => w.open).length;
      return n === 0
        ? "Nessuno. Qui ogni filo intero conduce: se il multimetro dice aperto, è una perla di senso."
        : `${cap(numero(n))}. ${n === 1 ? "Sembra intero ma ha" : "Sembrano interi ma hanno"} l'anima spezzata: non ${n === 1 ? "conta" : "contano"} per nessun percorso. Solo il multimetro te lo dice.`;
    }
    case "uv":
      return b.gates.keypad
        ? `Chi l'ha costruito firma sempre nello stesso posto. Punta la lampada ${UV_SPOTS[b.uvSpot]}. La cifra te la leggi tu.`
        : "Qui non c'è tastierino e non c'è codice: la UV lasciala in borsa.";
  }
}

const NUMERI = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
function numero(n: number): string {
  return NUMERI[n] ?? String(n);
}

function onRadio(s: RunState, ask: RadioAsk): RunState {
  if (!live(s) || !s.bomb) return s;
  if (s.mods.includes("suggeritore-muto")) return say(s, "Sulla radio c'è solo fruscio. In questa scena sei da solo.", "warn");
  const answer = radioAnswer(s.bomb, ask);
  if (s.asked.includes(ask)) return say(s, `Radio, di nuovo: «${answer}»`, "info");
  const ping = antennaLive(s) && s.mode === "ripresa";
  const n: RunState = { ...s, asked: [...s.asked, ask], secondsLeft: Math.max(1, s.secondsLeft - radioCost(s)) };
  return say(n, `Radio: «${answer}»${ping ? " La trasmissione sveglia l'antenna: ti costa anche un ping." : ""}`, "warn");
}

/** What the prompter says next. In the code stage each line gives away one digit. */
function hintFor(s: RunState): { text: string; gives?: "uv" | "blinks" | "morse" } {
  const b = s.bomb!;
  if (b.gates.pressure && !s.pressureShunted) {
    return { text: "Ponticella SW-A e SW-B, i due morsetti sulla chiusura, prima di usare il cacciavite." };
  }
  if (!s.lidOpen) return { text: `Cacciavite sulle chiusure: il ${b.cover} si apre solo con la sicura inserita.` };
  if (b.gates.cap && !s.capDumped) {
    return { text: "Ponticella COND + sul CARICO FITTIZIO. Mai sull'INNESCO." };
  }
  if (b.gates.keypad && !s.codeUnlocked) {
    if (!s.decoded.uv) {
      return { gives: "uv", text: `Prima cifra: ${b.code[0]}. Sta ${UV_SPOTS[b.uvSpot]}, e si legge solo con la lampada UV accesa.` };
    }
    if (!s.decoded.blinks) {
      return { gives: "blinks", text: `Seconda cifra: ${b.code[1]}. Sono i lampi del cluster in un ciclo, contati a occhio.` };
    }
    if (!s.decoded.morse) {
      return {
        gives: "morse",
        text: b.gates.receiver
          ? `Terza cifra: ${b.code[2]}. Sono i battiti dell'antenna, che si sentono solo con lo stetoscopio sul ricevitore.`
          : `Terza cifra: ${b.code[2]}. Senza antenna, è la riga del piatto che inizia con CIAK.`,
      };
    }
    return {
      text: `Quarta cifra = fili meno trappole, ultima cifra del risultato. Contano i tratti che portano corrente da BAT + all'INNESCO. Codice: ${b.code}.`,
    };
  }
  const dialNote =
    b.gates.dial && b.dial && !s.dialMatched
      ? ` Contatore B opzionale: ${b.dial[0]}-${b.dial[1]}-${b.dial[2]}.`
      : "";
  const tiltNote = b.gates.tilt && !s.tiltLocked ? " Serra il grano prima di maneggiare." : "";
  const line = b.wires
    .filter((w) => w.role === "sicura" && !s.cutIds.includes(w.id))
    .map((w) => `${colorName(w.color).toLowerCase()} (${terminalLabel(w.a)} → ${terminalLabel(w.b)})`);
  return {
    text: `La linea INIBITORE → BAT − passa da: ${line.join(", ")}. Aprila con la tronchese: se resta un ramo in parallelo, serve un secondo taglio.${dialNote}${tiltNote}`,
  };
}

export interface Stage {
  id: string;
  label: string;
  done: boolean;
  optional?: boolean;
}

export function stages(s: RunState): Stage[] {
  const b = s.bomb;
  if (!b) return [];
  const out: Stage[] = [];
  if (b.gates.pressure) out.push({ id: "sw", label: "Sicura copertura", done: s.pressureShunted });
  out.push({ id: "open", label: "Apertura", done: s.lidOpen });
  if (b.gates.tilt) out.push({ id: "tilt", label: "Blocco grano", done: s.tiltLocked, optional: true });
  if (b.gates.cap) out.push({ id: "cap", label: "Scarica di scena", done: s.capDumped });
  if (b.gates.keypad) out.push({ id: "code", label: "Codice", done: s.codeUnlocked });
  if (b.gates.dial) out.push({ id: "dial", label: "Contatore B", done: s.dialMatched, optional: true });
  out.push({ id: "cut", label: "Taglio inibitore", done: s.phase === "safe" });
  return out;
}

export function formatClock(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function tiltRatio(s: RunState): number {
  if (!s.bomb?.gates.tilt || s.tiltLocked) return 0;
  return Math.min(1, Math.hypot(s.attitude.x, s.attitude.z) / TILT_LIMIT);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function cap(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function findWire(bomb: Bomb | null, id: string | null): Wire | null {
  if (!bomb || !id) return null;
  return bomb.wires.find((w) => w.id === id) ?? null;
}
