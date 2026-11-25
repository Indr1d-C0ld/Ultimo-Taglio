import type { Archetype, Difficulty, EndCause, Mode, RunState } from "./types";

export type Outcome = "safe" | "boom" | "abort";
export type Grade = "oscar" | "prima" | "montabile" | "rifare" | "tagliata";

/** One finished scene, as the register keeps it. Plain data: it goes straight into storage. */
export interface RunRecord {
  id: string;
  at: number;
  seed: string;
  difficulty: Difficulty;
  mode: Mode;
  archetype: Archetype;
  outcome: Outcome;
  cause: EndCause;
  reason: string;
  /** Date (YYYY-MM-DD) when this was that day's shared scene, otherwise null. */
  daily: string | null;
  /** Campaign scene id and the rules it ran under. Absent on records from before the campaign. */
  campaign?: string | null;
  mods?: string[];
  score: number;
  grade: Grade;
  budget: number;
  left: number;
  elapsed: number;
  /** Seconds taken by penalties rather than by the clock. */
  lost: number;
  hints: number;
  /** Questions put to the accomplice on the radio. Missing in records from before the radio. */
  calls?: number;
  mistakes: number;
  forced: number;
  probes: number;
  wrongCodes: number;
  decoyCuts: number;
  lineCuts: number;
  pings: number;
  wires: number;
  wiresRead: number;
  hidden: number;
  displayDead: boolean;
  dialMatched: boolean | null;
  tiltLocked: boolean | null;
  /** The hidden second countdown: cut before it woke, woken, or never found. Null (or missing, in old records) when not in the scene. */
  twin?: "prevenuto" | "partito" | "intatto" | null;
  stageAt: Record<string, number>;
}

export const GRADES: Record<Grade, { label: string; line: string }> = {
  oscar: { label: "Da Oscar", line: "Nessun suggerimento, nessun errore, tempo da vendere." },
  prima: { label: "Buona la prima", line: "Pulita. Il regista non chiede il bis." },
  montabile: { label: "Si può montare", line: "Qualche sbavatura, ma la scena regge." },
  rifare: { label: "Da rifare", line: "Disinnescato, ma il montatore suderà." },
  tagliata: { label: "Tagliata al montaggio", line: "Questa non arriva in sala." },
};

export const CAUSE_LABEL: Record<EndCause, string> = {
  disinnesco: "Disinnesco",
  gemello: "Secondo timer",
  tempo: "Tempo scaduto",
  trappola: "Filo trappola",
  microswitch: "Microswitch di copertura",
  ponte: "Ponte saturato",
  ponticello: "Ponticello sull'innesco",
  grano: "Grano d'inclinazione",
  forzatura: "Guardia forzata due volte",
  condensatore: "Scarica del condensatore",
  antenna: "Ping dell'antenna",
  contatore: "Contatore B",
  regista: "Stop del regista",
  altro: "Altro",
};

const BASE: Record<Difficulty, number> = { comparsa: 1000, caratterista: 2500, protagonista: 5000 };
const PER_SECOND: Record<Difficulty, number> = { comparsa: 5, caratterista: 8, protagonista: 12 };

export function dailySeed(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `G${y}${m}${d}`;
}

export function dayKey(date: Date): string {
  const s = dailySeed(date);
  return `${s.slice(1, 5)}-${s.slice(5, 7)}-${s.slice(7, 9)}`;
}

export interface ScoreLine {
  label: string;
  points: number;
}

/** The score sheet shown on the end card, line by line. Only a defused take in ripresa scores. */
export function scoreSheet(r: Omit<RunRecord, "score" | "grade">): ScoreLine[] {
  if (r.outcome !== "safe" || r.mode !== "ripresa") return [];
  const lines: ScoreLine[] = [
    { label: "Scena girata", points: BASE[r.difficulty] },
    { label: `Tempo rimasto (${Math.round(r.left)} s)`, points: Math.round(r.left) * PER_SECOND[r.difficulty] },
  ];
  if (r.wiresRead >= r.wires) lines.push({ label: "Lettura completa dei fili", points: 300 });
  if (r.dialMatched) lines.push({ label: "Contatore B allineato", points: 250 });
  if (r.decoyCuts === 0) lines.push({ label: "Nessun taglio a vuoto", points: 150 });
  if (r.hints) lines.push({ label: `Suggerimenti (${r.hints})`, points: -250 * r.hints });
  if (r.calls) lines.push({ label: `Chiamate alla radio (${r.calls})`, points: -60 * r.calls });
  if (r.mistakes) lines.push({ label: `Errori (${r.mistakes})`, points: -150 * r.mistakes });
  const subtotal = lines.reduce((sum, l) => sum + l.points, 0);
  if (r.hints === 0 && r.mistakes === 0) {
    lines.push({ label: "Buona la prima (+25%)", points: Math.round(subtotal * 0.25) });
  }
  return lines;
}

export function gradeOf(r: Omit<RunRecord, "score" | "grade">): Grade {
  if (r.outcome !== "safe") return "tagliata";
  const spare = r.mode === "ripresa" ? r.left / r.budget : 1;
  if (r.hints === 0 && r.mistakes === 0 && spare >= 0.4) return "oscar";
  if (r.hints <= 1 && r.mistakes <= 1 && spare >= 0.2) return "prima";
  if (r.hints <= 2 && spare >= 0.05) return "montabile";
  return "rifare";
}

/** Freezes a finished (or abandoned) scene into a record. */
export function recordOf(s: RunState, at: number, outcome: Outcome): RunRecord | null {
  const bomb = s.bomb;
  if (!bomb) return null;
  const date = new Date(at);
  const elapsed = Math.round(s.tally.elapsed);
  const spent = bomb.seconds - s.secondsLeft;
  const base = {
    id: `${at.toString(36)}-${bomb.seed}`,
    at,
    seed: bomb.seed,
    difficulty: bomb.difficulty,
    mode: s.mode,
    archetype: bomb.archetype,
    outcome,
    cause: outcome === "abort" ? ("altro" as const) : (s.endCause ?? "altro"),
    reason: outcome === "abort" ? "Scena abbandonata." : s.endReason,
    daily: !s.campaign && bomb.seed === dailySeed(date) && bomb.difficulty === "caratterista" ? dayKey(date) : null,
    campaign: s.campaign,
    mods: s.mods,
    budget: bomb.seconds,
    left: outcome === "safe" ? s.secondsLeft : 0,
    elapsed,
    lost: s.mode === "ripresa" ? Math.max(0, Math.round(spent - s.tally.elapsed)) : 0,
    hints: s.hintsUsed,
    calls: s.asked.length,
    mistakes: s.mistakes,
    forced: s.forceNicks,
    probes: s.tally.probes,
    wrongCodes: s.tally.wrongCodes,
    decoyCuts: s.tally.decoyCuts,
    lineCuts: s.tally.lineCuts,
    pings: s.pingCount,
    wires: bomb.wires.length,
    wiresRead: s.knownWireIds.length,
    hidden: bomb.wires.filter((w) => w.open).length,
    displayDead: s.displayDead,
    dialMatched: bomb.gates.dial ? s.dialMatched : null,
    tiltLocked: bomb.gates.tilt ? s.tiltLocked : null,
    twin:
      bomb.twin === null
        ? null
        : s.twinLeft !== null
          ? ("partito" as const)
          : s.cutIds.some((id) => bomb.wires.find((w) => w.id === id)?.role === "gemello")
            ? ("prevenuto" as const)
            : ("intatto" as const),
    stageAt: s.tally.stageAt,
  };
  const score = Math.max(0, scoreSheet(base).reduce((sum, l) => sum + l.points, 0));
  return { ...base, score, grade: gradeOf(base) };
}

export interface Slice {
  played: number;
  won: number;
  bestScore: number;
  bestLeft: number;
}

export interface Career {
  played: number;
  won: number;
  lost: number;
  abandoned: number;
  rehearsals: number;
  winRate: number;
  streak: number;
  bestStreak: number;
  totalScore: number;
  bestScore: number;
  averageScore: number;
  playSeconds: number;
  fastestWin: number | null;
  closestCall: number | null;
  averageLeft: number;
  probes: number;
  probesPerScene: number;
  hints: number;
  mistakes: number;
  wrongCodes: number;
  decoyCuts: number;
  doubleCuts: number;
  secondsLost: number;
  pings: number;
  cleanWins: number;
  dailies: number;
  byDifficulty: Record<Difficulty, Slice>;
  byArchetype: Record<Archetype, Slice>;
  causes: { cause: EndCause; count: number }[];
  grades: Record<Grade, number>;
  stageAverage: Record<string, number>;
}

const slice = (): Slice => ({ played: 0, won: 0, bestScore: 0, bestLeft: 0 });

/** Career figures from the register. Rehearsals are counted apart and never rank. */
export function careerOf(runs: RunRecord[]): Career {
  const takes = runs.filter((r) => r.mode === "ripresa");
  const ordered = [...takes].sort((a, b) => a.at - b.at);
  const wins = takes.filter((r) => r.outcome === "safe");
  const booms = takes.filter((r) => r.outcome === "boom");
  let streak = 0;
  let bestStreak = 0;
  for (const r of ordered) {
    streak = r.outcome === "safe" ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  const sum = (list: RunRecord[], f: (r: RunRecord) => number) => list.reduce((acc, r) => acc + f(r), 0);
  const byDifficulty: Career["byDifficulty"] = { comparsa: slice(), caratterista: slice(), protagonista: slice() };
  const byArchetype: Career["byArchetype"] = { valigetta: slice(), cilindro: slice(), console: slice() };
  for (const r of takes) {
    for (const s of [byDifficulty[r.difficulty], byArchetype[r.archetype]]) {
      s.played += 1;
      if (r.outcome !== "safe") continue;
      s.won += 1;
      s.bestScore = Math.max(s.bestScore, r.score);
      s.bestLeft = Math.max(s.bestLeft, r.left);
    }
  }
  const causeCount = new Map<EndCause, number>();
  for (const r of booms) causeCount.set(r.cause, (causeCount.get(r.cause) ?? 0) + 1);
  const grades: Career["grades"] = { oscar: 0, prima: 0, montabile: 0, rifare: 0, tagliata: 0 };
  for (const r of takes) if (r.outcome !== "abort") grades[r.grade] += 1;
  const stageSum = new Map<string, { total: number; n: number }>();
  for (const r of wins) {
    for (const [id, at] of Object.entries(r.stageAt)) {
      const cur = stageSum.get(id) ?? { total: 0, n: 0 };
      stageSum.set(id, { total: cur.total + at, n: cur.n + 1 });
    }
  }
  return {
    played: takes.length,
    won: wins.length,
    lost: booms.length,
    abandoned: takes.length - wins.length - booms.length,
    rehearsals: runs.length - takes.length,
    winRate: takes.length ? wins.length / takes.length : 0,
    streak,
    bestStreak,
    totalScore: sum(wins, (r) => r.score),
    bestScore: Math.max(0, ...wins.map((r) => r.score)),
    averageScore: wins.length ? Math.round(sum(wins, (r) => r.score) / wins.length) : 0,
    playSeconds: sum(runs, (r) => r.elapsed),
    fastestWin: wins.length ? Math.min(...wins.map((r) => r.elapsed)) : null,
    closestCall: wins.length ? Math.min(...wins.map((r) => r.left)) : null,
    averageLeft: wins.length ? Math.round(sum(wins, (r) => r.left) / wins.length) : 0,
    probes: sum(runs, (r) => r.probes),
    probesPerScene: runs.length ? Math.round((sum(runs, (r) => r.probes) / runs.length) * 10) / 10 : 0,
    hints: sum(runs, (r) => r.hints),
    mistakes: sum(runs, (r) => r.mistakes),
    wrongCodes: sum(runs, (r) => r.wrongCodes),
    decoyCuts: sum(runs, (r) => r.decoyCuts),
    doubleCuts: wins.filter((r) => r.lineCuts >= 2).length,
    secondsLost: sum(takes, (r) => r.lost),
    pings: sum(takes, (r) => r.pings),
    cleanWins: wins.filter((r) => r.hints === 0 && r.mistakes === 0).length,
    dailies: new Set(takes.filter((r) => r.daily).map((r) => r.daily)).size,
    byDifficulty,
    byArchetype,
    causes: [...causeCount].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count),
    grades,
    stageAverage: Object.fromEntries([...stageSum].map(([id, v]) => [id, Math.round(v.total / v.n)])),
  };
}

export interface Award {
  id: string;
  title: string;
  text: string;
  earned: (runs: RunRecord[], career: Career) => boolean;
}

const won = (runs: RunRecord[]) => runs.filter((r) => r.mode === "ripresa" && r.outcome === "safe");

export const AWARDS: Award[] = [
  { id: "prima", title: "Buona la prima", text: "Disinnesca senza suggerimenti e senza errori.", earned: (_, c) => c.cleanWins >= 1 },
  { id: "filo", title: "Sul filo del rasoio", text: "Disinnesca con cinque secondi o meno sul display.", earned: (r) => won(r).some((x) => x.left <= 5) },
  { id: "protagonista", title: "Nome in cartellone", text: "Disinnesca una scena da protagonista.", earned: (_, c) => c.byDifficulty.protagonista.won >= 1 },
  { id: "metodo", title: "Metodo Stanislavskij", text: "Vinci dopo aver misurato ogni singolo filo.", earned: (r) => won(r).some((x) => x.wiresRead >= x.wires) },
  { id: "doppio", title: "Doppio taglio", text: "Apri una linea che aveva due rami in parallelo.", earned: (_, c) => c.doubleCuts >= 1 },
  { id: "coda", title: "Colpo di coda", text: "Ferma il secondo timer dopo che si è svegliato.", earned: (r) => won(r).some((x) => x.twin === "partito") },
  { id: "silenzio", title: "Silenzio radio", text: "Disinnesca da protagonista senza radio e senza suggeritore.", earned: (r) => won(r).some((x) => x.difficulty === "protagonista" && x.hints === 0 && x.calls === 0) },
  { id: "buio", title: "Al buio", text: "Disinnesca con il display spento.", earned: (r) => won(r).some((x) => x.displayDead) },
  { id: "carrozzerie", title: "Tris di carrozzerie", text: "Vinci con valigetta, cilindro e console.", earned: (_, c) => Object.values(c.byArchetype).every((s) => s.won >= 1) },
  { id: "serie", title: "Cinque ciak di fila", text: "Cinque disinneschi consecutivi in ripresa.", earned: (_, c) => c.bestStreak >= 5 },
  { id: "oscar", title: "Statuetta", text: "Ottieni il voto «Da Oscar» da protagonista.", earned: (r) => won(r).some((x) => x.grade === "oscar" && x.difficulty === "protagonista") },
  { id: "veterano", title: "Controfigura veterana", text: "Venticinque disinneschi in carriera.", earned: (_, c) => c.won >= 25 },
  { id: "giornaliero", title: "Abbonato al cineforum", text: "Gioca la scena del giorno in sette giorni diversi.", earned: (_, c) => c.dailies >= 7 },
  { id: "saltato", title: "Grande finale", text: "Salta in aria in sei modi diversi. Anche questo è cinema.", earned: (_, c) => c.causes.length >= 6 },
];

export function earnedAwards(runs: RunRecord[]): string[] {
  const career = careerOf(runs);
  return AWARDS.filter((a) => a.earned(runs, career)).map((a) => a.id);
}

export function formatSpan(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${s} s`;
}
