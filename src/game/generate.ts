import { colorName, terminalLabel, WIRE_COLORS, type WireColor } from "./palette";
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

  const wires = makeWires(difficulty, rng);
  const d0 = 1 + Math.floor(rng() * 9);
  const d1 = 1 + Math.floor(rng() * 9);
  const d2 = 1 + Math.floor(rng() * 9);
  const traps = wires.filter((w) => w.role === "trappola").length;
  const d3 = wires.length - traps;
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

  const seconds = difficulty === "comparsa" ? 360 : difficulty === "caratterista" ? 300 : 210;
  const scene = 8 + Math.floor(rng() * 80);

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
    ledBlink: d1,
    plateLines,
  };
}

function makeWires(diff: Difficulty, rng: Rng): Wire[] {
  const palette = shuffle(Object.keys(WIRE_COLORS) as WireColor[], rng);
  let colorAt = 0;
  const nextColor = () => palette[colorAt++] ?? "grigio";
  const wires: Wire[] = [];
  const add = (role: WireRole, a: string, b: string, diode: Wire["diode"], color?: string) => {
    wires.push({ id: "", role, a, b, diode, color: color ?? nextColor() });
  };

  add("sicura", "h-sic", "det-inhibit", null);
  add("alimentazione", "bat-pos", "timer-vin", null);

  if (diff === "comparsa") {
    add("esca", "h-l-0", "h-r-0", null);
    add("trappola", "bat-pos", "det-in", null);
  } else if (diff === "caratterista") {
    const twinA = nextColor();
    const diode: Wire["diode"] = rng() > 0.4 ? "a-b" : null;
    add("trappola", "bat-pos", "j1", diode, twinA);
    add("trappola", "j1", "det-in", null);
    add("esca", "j1", "h-l-0", null, twinA);
    const twinB = nextColor();
    add("trappola", "bat-pos", "det-in", null, twinB);
    add("esca", "h-l-1", "h-r-1", null, twinB);
    add("senso", "rx-out", "led-in", null);
  } else {
    const twinA = nextColor();
    add("trappola", "bat-pos", "j1", "a-b", twinA);
    add("trappola", "j1", "det-in", null);
    add("esca", "j1", "h-l-0", null, twinA);
    const twinB = nextColor();
    add("trappola", "bat-pos", "j2", null);
    add("trappola", "j2", "det-in", "a-b", twinB);
    add("esca", "j2", "h-l-1", null, twinB);
    add("esca", "h-l-2", "h-r-2", rng() > 0.5 ? "a-b" : null);
    add("senso", "rx-out", "led-in", null);
  }

  return shuffle(wires, rng).map((w, i) => ({ ...w, id: `w${i}` }));
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
    const x = -0.48 + (i * 0.96) / Math.max(1, ordered.length - 1);
    const joint = /^j\d+$/.test(id);
    harnessTerms.push(term(id, [x, joint ? 0.2 : 0.1, joint ? -0.02 : 0.08]));
  });

  const list: Module[] = [
    mod("timer", "Timer LCD", [term("timer-vin", [0.28, 0.12, 0.16])]),
    mod("harness", "Cablaggio di scena", harnessTerms),
    mod("battery", "Cella di palco", [
      term("bat-pos", [0.16, 0.16, 0.08]),
      term("bat-neg", [-0.16, 0.16, 0.08]),
    ]),
    mod("detonator", "Innesco di scena", [
      term("det-in", [0.1, 0.18, 0.12]),
      term("det-inhibit", [-0.12, 0.18, 0.08]),
    ]),
    mod("leds", "Cluster lampeggi", [term("led-in", [0.22, 0.1, 0.1])]),
    mod("keypad", "Tastierino di scena", []),
    mod("plate", "Piatto inciso", []),
  ];

  if (gates.cap) {
    list.push(
      mod("cap", "Condensatore di scena", [
        term("cap-hot", [-0.06, 0.16, 0.1]),
        term("cap-load", [0.22, 0.12, 0.14]),
      ]),
    );
  }
  if (gates.tilt) list.push(mod("tilt", "Grano d'inclinazione", []));
  if (gates.receiver) list.push(mod("receiver", "Ricevitore di copione", [term("rx-out", [0.16, 0.12, 0.1])]));
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

export function wireSummary(wire: Wire): string {
  return `${colorName(wire.color)} · ${terminalLabel(wire.a)} → ${terminalLabel(wire.b)}`;
}
