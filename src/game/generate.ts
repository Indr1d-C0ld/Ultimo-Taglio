import { edgeCarries, wireEdges } from "./circuit";
import { terminalLabel, WIRE_COLORS, type WireColor } from "./palette";
import { TUNING } from "./tuning";
import { hashString, mulberry32, pick, shuffle, type Rng } from "./rng";
import type {
  Archetype,
  Bomb,
  Difficulty,
  Gates,
  Module,
  ModuleKind,
  Terminal,
  Vec3,
  Wire,
  WireRole,
} from "./types";

export const ARCHETYPES: Record<
  Archetype,
  { name: string; cover: string; blurb: string }
> = {
  valigetta: {
    name: "Valigetta del regista",
    cover: "coperchio",
    blurb: "La valigetta con il vetro sul tempo. Classico da terza bobina.",
  },
  cilindro: {
    name: "Cilindro di scena",
    cover: "calotta",
    blurb: "Un tubo fresato, appoggiato in culla. Sembra industriale, è un attrezzo di palco.",
  },
  console: {
    name: "Console da regia",
    cover: "vetro",
    blurb: "Pannello inclinato da sala macchine, costruito per essere inquadrato di tre quarti.",
  },
};

/** Faces of the shell where the UV digit may be painted, as the prompter names them. */
export const UV_SPOTS = ["sul fianco destro", "sul fianco sinistro", "sulla parete posteriore", "sul fondo, verso le chiusure"] as const;

const SLOT: Record<ModuleKind, Vec3> = {
  timer: [0, 0, -0.22],
  battery: [-0.74, 0, -0.16],
  detonator: [0.74, 0, -0.12],
  keypad: [-0.74, 0, 0.3],
  tilt: [0.02, 0, 0.16],
  cap: [0.74, 0, 0.34],
  leds: [0.02, 0, -0.56],
  harness: [0.02, 0, 0.5],
  receiver: [-0.74, 0, -0.56],
  dial: [0.46, 0, -0.56],
  plate: [0, 0, 0.98],
};

function explodeOf(kind: ModuleKind, pos: Vec3): Vec3 {
  if (kind === "plate") return [0, 0.22, 0.28];
  return [pos[0] * 0.42, 0.38 + Math.abs(pos[0]) * 0.05, pos[2] * 0.42];
}

function term(id: string, local: Vec3): Terminal {
  return { id, label: terminalLabel(id), local };
}

export function generateBomb(seed: string, difficulty: Difficulty): Bomb {
  const rng = mulberry32(hashString(`${seed}|${difficulty}|ultimo-taglio-v2`));
  const archetype = pick(rng, ["valigetta", "cilindro", "console"] as const);
  const gates: Gates = {
    pressure: true,
    keypad: true,
    cap: difficulty === "comparsa" ? rng() > 0.28 : true,
    tilt: difficulty !== "comparsa",
    dial: difficulty === "protagonista",
    receiver: difficulty === "comparsa" ? rng() > 0.45 : true,
  };

  const wires = withQuartz(makeWires(difficulty, rng), seed, difficulty);
  const d0 = 1 + Math.floor(rng() * 9);
  const d1 = 1 + Math.floor(rng() * 9);
  const d2 = 1 + Math.floor(rng() * 9);
  const traps = wires.filter((w) => w.role === "trappola").length;
  const d3 = (wires.length - traps) % 10;
  const code = `${d0}${d1}${d2}${d3}`;

  const escaCount = wires.filter((w) => w.role === "esca").length;
  const dial: [number, number, number] | null = gates.dial ? [escaCount, d0, d1] : null;

  const lies = shuffle(
    ["TAGLIA IL ROSSO", "IL BLU DISINNESCA", "PRIMA IL NERO", "NON TOCCARE IL GIALLO", "SOLO IL VERDE"],
    rng,
  ).slice(0, 2);

  const plateLines = [
    ...lies,
    gates.receiver ? "ANTENNA IN ASCOLTO" : `CIAK ${d2}`,
    "IV = FILI − TRAPPOLE",
  ];

  const seconds = TUNING[difficulty].seconds;
  const scene = 8 + Math.floor(rng() * 80);

  const uvSpot = Math.floor(rng() * UV_SPOTS.length);

  const modules = buildModules(gates, wires);

  return {
    seed,
    difficulty,
    archetype,
    title: `Scena ${scene} — ${ARCHETYPES[archetype].name}`,
    cover: ARCHETYPES[archetype].cover,
    seconds,
    code,
    dial,
    gates,
    modules,
    wires,
    chassisTerminals: [
      term("sw-a", [-0.34, 0.08, 0.78]),
      term("sw-b", [0.34, 0.08, 0.78]),
    ],
    uvDigit: String(d0),
    uvSpot,
    ledBlink: d1,
    plateLines,
  };
}

interface Draft {
  a: string;
  b: string;
  diode: Wire["diode"];
  color: string;
  open: boolean;
  fixed?: WireRole;
}

/**
 * Lays out a fresh topology. Two nets never touch: the firing net (BAT + → INNESCO)
 * and the inhibitor line (INIBITORE → BAT −). Around them hang blind spurs, dead
 * returns and look-alike routes killed by a reversed bead or a broken core.
 * Roles are not assigned here: they are read off the finished circuit.
 */
function draftWires(diff: Difficulty, rng: Rng): Draft[] {
  const palette = shuffle(Object.keys(WIRE_COLORS) as WireColor[], rng);
  let colorAt = 0;
  const nextColor = (): string => palette[colorAt++] ?? pick(rng, palette);
  const drafts: Draft[] = [];
  let joints = 0;
  let stubs = 0;
  const joint = () => `j${++joints}`;
  const chance = (p: number) => rng() < p;

  const add = (a: string, b: string, o: Partial<Draft> = {}): Draft => {
    const d: Draft = { a, b, diode: null, open: false, color: o.color ?? nextColor(), ...o };
    drafts.push(d);
    return d;
  };
  /** A run of `segs` wires from a to b through fresh joints, built in the conducting direction. */
  const chain = (a: string, b: string, segs: number): { wires: Draft[]; joints: string[] } => {
    const made: Draft[] = [];
    const mids: string[] = [];
    let from = a;
    for (let i = 0; i < segs; i++) {
      const to = i === segs - 1 ? b : joint();
      if (to !== b) mids.push(to);
      made.push(add(from, to));
      from = to;
    }
    return { wires: made, joints: mids };
  };
  /** Blind branch off a joint, optionally dressed like a wire that really continues. */
  const spur = (from: string, twin?: Draft) => add(from, `h-l-${stubs++}`, twin ? { color: twin.color } : {});
  const deadReturn = () => {
    const n = stubs++;
    return add(`h-l-${n}`, `h-r-${n}`);
  };
  /** Stops a wire from carrying its route: reversed bead (visible) or broken core (hidden). */
  const kill = (d: Draft, allowBead = true) => {
    if (allowBead && chance(0.5)) d.diode = "b-a";
    else d.open = true;
  };

  add("bat-pos", "timer-vin", { fixed: "alimentazione" });

  if (diff === "comparsa") {
    const fire = chain("bat-pos", "det-in", chance(0.5) ? 1 : 2);
    const line = chain("det-inhibit", "bat-neg", 2);
    spur(line.joints[0]!);
    if (fire.joints[0] && chance(0.5)) spur(fire.joints[0]);
    if (chance(0.6)) deadReturn();
    return drafts;
  }

  if (diff === "caratterista") {
    const fire = chain("bat-pos", "det-in", 2);
    if (chance(0.6)) fire.wires[0]!.diode = "a-b";
    spur(fire.joints[0]!, pick(rng, fire.wires));
    const second = rng();
    if (second < 0.35) add("bat-pos", "det-in");
    else {
      const alt = chain("bat-pos", "det-in", 2);
      if (second < 0.75) kill(pick(rng, alt.wires));
    }
    const line = chain("det-inhibit", "bat-neg", chance(0.5) ? 2 : 3);
    spur(pick(rng, line.joints), pick(rng, line.wires));
    if (chance(0.4)) kill(add("det-inhibit", "bat-neg"));
    add("rx-out", "led-in", { fixed: "senso" });
    return drafts;
  }

  const fire = chain("bat-pos", "det-in", 2);
  fire.wires[chance(0.5) ? 0 : 1]!.diode = "a-b";
  spur(fire.joints[0]!, pick(rng, fire.wires));
  const alt = chain("bat-pos", "det-in", 2);
  alt.wires[1]!.color = fire.wires[1]!.color;
  if (chance(0.4)) kill(pick(rng, alt.wires));
  const lineA = chain("det-inhibit", "bat-neg", 2);
  const lineB = chain("det-inhibit", "bat-neg", 2);
  lineB.wires[0]!.color = lineA.wires[0]!.color;
  if (chance(0.5)) lineB.wires[1]!.color = lineA.wires[1]!.color;
  if (chance(0.5)) kill(pick(rng, lineB.wires));
  if (chance(0.5)) spur(pick(rng, [...lineA.joints, ...lineB.joints]));
  add("rx-out", "led-in", { fixed: "senso" });
  return drafts;
}

/** Shuffles joint and bus numbers so the build order does not leak which net a node belongs to. */
function relabel(drafts: Draft[], rng: Rng): Draft[] {
  const ends = drafts.flatMap((d) => [d.a, d.b]);
  const jointIds = [...new Set(ends.filter((e) => /^j\d+$/.test(e)))];
  const busIds = [...new Set(ends.filter((e) => e.startsWith("h-")).map((e) => e.slice(4)))];
  const jointMap = new Map(shuffle(jointIds, rng).map((id, i) => [id, `j${i + 1}`]));
  const busMap = new Map(shuffle(busIds, rng).map((id, i) => [id, String(i)]));
  const rename = (e: string) => {
    if (jointMap.has(e)) return jointMap.get(e)!;
    if (e.startsWith("h-")) return `${e.slice(0, 4)}${busMap.get(e.slice(4))}`;
    return e;
  };
  return drafts.map((d) => ({ ...d, a: rename(d.a), b: rename(d.b) }));
}

/** Chance that a scene carries the quartz wire: the one that, cut, makes the countdown race. */
const QUARTZ: Record<Difficulty, number> = { comparsa: 0, caratterista: 0.5, protagonista: 1 };

/**
 * Adds the quartz wire from the timer's CLOCK post to a bus end of its own. It draws from
 * a separate stream so that scenes keep the wiring they had before this wire existed.
 */
function withQuartz(wires: Wire[], seed: string, diff: Difficulty): Wire[] {
  const rng = mulberry32(hashString(`${seed}|${diff}|quarzo`));
  if (rng() >= QUARTZ[diff]) return wires;
  const taken = wires.flatMap((w) => [w.a, w.b]).filter((e) => e.startsWith("h-")).map((e) => Number(e.slice(4)));
  const free = taken.length ? Math.max(...taken) + 1 : 0;
  const quartz: Wire = {
    id: "",
    color: pick(rng, Object.keys(WIRE_COLORS) as WireColor[]),
    role: "quarzo",
    a: "timer-clk",
    b: `h-l-${free}`,
    diode: null,
    open: false,
  };
  const at = Math.floor(rng() * (wires.length + 1));
  return [...wires.slice(0, at), quartz, ...wires.slice(at)].map((w, i) => ({ ...w, id: `w${i}` }));
}

function makeWires(diff: Difficulty, rng: Rng): Wire[] {
  const drafts = shuffle(relabel(draftWires(diff, rng), rng), rng);
  const bare: Wire[] = drafts.map((d, i) => ({
    id: `w${i}`,
    color: d.color,
    role: d.fixed ?? "esca",
    a: d.a,
    b: d.b,
    diode: d.diode,
    open: d.open,
  }));
  const edges = wireEdges(bare);
  const wires = bare.map((w, i): Wire => {
    if (drafts[i]!.fixed || w.open) return w;
    if (edgeCarries(edges, "bat-pos", "det-in", w.id)) return { ...w, role: "trappola" };
    if (edgeCarries(edges, "det-inhibit", "bat-neg", w.id)) return { ...w, role: "sicura" };
    return w;
  });
  if (!wires.some((w) => w.role === "trappola") || !wires.some((w) => w.role === "sicura")) {
    throw new Error(`Topologia senza percorso d'innesco o senza linea d'inibitore (${diff}).`);
  }
  return wires;
}

function buildModules(gates: Gates, wires: Wire[]): Module[] {
  const harnessTerms: Terminal[] = [];
  const ids = new Set<string>();
  for (const w of wires) {
    for (const end of [w.a, w.b]) {
    if ((end.startsWith("h-") || /^j\d+$/.test(end)) && !ids.has(end)) ids.add(end);
    }
  }
  const ordered = [...ids].sort((a, b) => a.localeCompare(b, "it"));
  ordered.forEach((id, i) => {
    const x = -0.44 + (i * 0.88) / Math.max(1, ordered.length - 1);
    const joint = /^j\d+$/.test(id);
    // Two rows on the brass rail: joints behind, bus ends in front.
    harnessTerms.push(term(id, [x, 0.095, joint ? -0.035 : 0.035]));
  });

  const list: Module[] = [
    mod("timer", "Timer LCD", [
      term("timer-vin", [-0.3, 0.2, 0.165]),
      ...(wires.some((w) => w.role === "quarzo") ? [term("timer-clk", [0.1, 0.2, 0.165])] : []),
    ]),
    mod("harness", "Cablaggio di scena", harnessTerms),
    mod("battery", "Cella di palco", [
      term("bat-pos", [0.115, 0.22, -0.01]),
      term("bat-neg", [-0.115, 0.22, -0.01]),
    ]),
    mod("detonator", "Innesco di scena", [
      term("det-in", [0.13, 0.06, 0.105]),
      term("det-inhibit", [-0.13, 0.06, 0.105]),
    ]),
    mod("leds", "Cluster lampeggi", [term("led-in", [0.285, 0.1, 0.062])]),
    mod("keypad", "Tastierino di scena", []),
    mod("plate", "Piatto inciso", []),
  ];

  if (gates.cap) {
    list.push(
      mod("cap", "Condensatore di scena", [
        term("cap-hot", [-0.1, 0.045, 0.095]),
        term("cap-load", [0.16, 0.045, 0.095]),
      ]),
    );
  }
  if (gates.tilt) list.push(mod("tilt", "Grano d'inclinazione", []));
  if (gates.receiver) list.push(mod("receiver", "Ricevitore di copione", [term("rx-out", [0.13, 0.15, 0.07])]));
  if (gates.dial) list.push(mod("dial", "Contatore B", []));

  return list;
}

function mod(kind: ModuleKind, name: string, terminals: Terminal[]): Module {
  const position = SLOT[kind];
  return {
    id: kind,
    kind,
    name,
    position,
    explode: explodeOf(kind, position),
    terminals,
  };
}
