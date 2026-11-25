import type { Chain } from "./sequence";
export type Difficulty = "comparsa" | "caratterista" | "protagonista";
export type Mode = "prova" | "ripresa";
export type Archetype = "valigetta" | "cilindro" | "console";
export type Phase = "boot" | "play" | "boom" | "safe";

export type Tool =
  | "occhio"
  | "multimetro"
  | "tronchese"
  | "cacciavite"
  | "brugola"
  | "ponticello"
  | "pinzette"
  | "stetoscopio"
  | "nastro"
  | "pila"
  | "maneggio"
  | "uv";

export type WireRole = "sicura" | "trappola" | "esca" | "alimentazione" | "senso" | "quarzo" | "gemello";

export type ModuleKind =
  | "timer"
  | "harness"
  | "battery"
  | "detonator"
  | "cap"
  | "keypad"
  | "tilt"
  | "receiver"
  | "leds"
  | "dial"
  | "plate";

export type Vec3 = [number, number, number];

export interface Terminal {
  id: string;
  label: string;
  local: Vec3;
}

export interface Module {
  id: string;
  kind: ModuleKind;
  name: string;
  position: Vec3;
  explode: Vec3;
  terminals: Terminal[];
}

export interface Wire {
  id: string;
  color: string;
  role: WireRole;
  a: string;
  b: string;
  /** Theatrical one-way bead. "a-b" conducts only from a toward b. */
  diode: "a-b" | "b-a" | null;
  /** Core broken under the insulation: looks whole, conducts nothing. Only the meter tells. */
  open: boolean;
}

export interface Gates {
  pressure: boolean;
  keypad: boolean;
  cap: boolean;
  tilt: boolean;
  dial: boolean;
  receiver: boolean;
}

export interface Bomb {
  seed: string;
  difficulty: Difficulty;
  archetype: Archetype;
  title: string;
  cover: string;
  seconds: number;
  code: string;
  dial: [number, number, number] | null;
  gates: Gates;
  modules: Module[];
  wires: Wire[];
  chassisTerminals: Terminal[];
  uvDigit: string;
  /** Which face of the shell carries the UV digit; the scene picks the exact place. */
  uvSpot: number;
  /** Length of the hidden second countdown under the detonator; null when the scene has none. */
  twin: number | null;
  ledBlink: number;
  plateLines: string[];
}

export interface LogLine {
  id: number;
  text: string;
  tone: "info" | "warn" | "bad" | "good";
}

export interface RunState {
  phase: Phase;
  mode: Mode;
  difficulty: Difficulty;
  seed: string;
  bomb: Bomb | null;
  secondsLeft: number;
  timeAcc: number;
  lidOpen: boolean;
  pressureShunted: boolean;
  tiltLocked: boolean;
  capDumped: boolean;
  codeUnlocked: boolean;
  dialMatched: boolean;
  dialDigits: [number, number, number];
  keypad: string;
  displayDead: boolean;
  ledsBlind: boolean;
  uv: boolean;
  xray: boolean;
  exploded: boolean;
  tool: Tool;
  selectedId: string | null;
  probeA: string | null;
  pendingJumper: string | null;
  jumpers: { a: string; b: string; kind: string }[];
  cutIds: string[];
  knownWireIds: string[];
  notes: string[];
  log: LogLine[];
  logSeq: number;
  hintsUsed: number;
  /** Questions already put to the accomplice on the radio. Asking again is free. */
  asked: RadioAsk[];
  mistakes: number;
  attitude: { x: number; z: number };
  listenLeft: number;
  listenKind: "receiver" | "leds" | null;
  /** Digits the prompter has given away. Nothing is decoded for the player any more. */
  decoded: { uv: boolean; blinks: boolean; morse: boolean };
  dialPenalty: boolean;
  pingCount: number;
  forceNicks: number;
  endReason: string;
  markedIds: string[];
  cellSpare: boolean;
  warned30: boolean;
  /** 0–1 glow of the theatrical bridge inside the prop tube. */
  bridge: number;
  bridgeHot: boolean;
  bridgeCause: "cap" | "code" | "other" | null;
  bridgeWarned: boolean;
  /** Short machine tag for how the scene ended; the sentence is in endReason. */
  endCause: EndCause | null;
  tally: Tally;
  /** The quartz wire was cut: the countdown runs at double speed for the rest of the scene. */
  rush: boolean;
  /** Seconds left on the hidden second countdown; null until opening the line wakes it. */
  twinLeft: number | null;
  /** Scene rules in force, set by the campaign. Free scenes have none. */
  mods: Modifier[];
  /** Id of the campaign scene being shot, or null for a free scene. */
  campaign: string | null;
  /** The long take this scene is a link of, or null. */
  chain: Chain | null;
}

/** A rule a campaign scene adds on top of the ordinary ones. */
export type Modifier =
  | "suggeritore-gratis"
  | "suggeritore-muto"
  | "copione-strappato"
  | "luci-basse"
  | "tronchese-spuntata"
  | "radio-disturbata"
  | "display-rotto"
  | "tempo-stretto"
  | "senza-rete";

export type EndCause =
  | "disinnesco"
  | "gemello"
  | "tempo"
  | "trappola"
  | "microswitch"
  | "ponte"
  | "ponticello"
  | "grano"
  | "forzatura"
  | "condensatore"
  | "antenna"
  | "contatore"
  | "regista"
  | "altro";

/** Counters kept during a scene, for the end card and the career register. */
export interface Tally {
  /** Seconds of real play, whether or not the countdown runs. */
  elapsed: number;
  probes: number;
  wrongCodes: number;
  decoyCuts: number;
  lineCuts: number;
  /** Elapsed second at which each stage was first completed. */
  stageAt: Record<string, number>;
}

export type Action =
  | { type: "start"; seed: string; difficulty: Difficulty; mode: Mode; mods?: Modifier[]; campaign?: string; chain?: Chain }
  | { type: "archive-denied" }
  | { type: "abort" }
  | { type: "tool"; tool: Tool }
  | { type: "select"; id: string | null }
  | { type: "toggle"; key: "uv" | "xray" | "exploded" }
  | { type: "tick"; dt: number }
  | { type: "pointer-terminal"; id: string }
  | { type: "pointer-wire"; id: string }
  | { type: "pointer-part"; id: string }
  | { type: "pointer-latch" }
  | { type: "pointer-tilt" }
  | { type: "keypad"; key: string }
  | { type: "dial"; index: 0 | 1 | 2; dir: 1 | -1 }
  | { type: "rotate"; dx: number; dz: number }
  | { type: "reset-attitude" }
  | { type: "listen" }
  | { type: "hint" }
  | { type: "radio"; ask: RadioAsk };

/** What the accomplice on the radio can be asked: facts about the scene, never the solution. */
export type RadioAsk = "trappole" | "tagli" | "gemello" | "rotti" | "uv";
