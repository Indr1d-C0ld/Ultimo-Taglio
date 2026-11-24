import { create } from "zustand";
import { beep, boom, setMuted, unlockAudio, win } from "./audio";
import { initialState, reduce } from "./logic";
import {
  activeProfile,
  addRun,
  createProfile,
  deleteProfile,
  importProfile,
  loadSave,
  selectProfile,
  type Save,
} from "./save";
import { earnedAwards, recordOf, type RunRecord } from "./stats";
import type { Action, RunState } from "./types";

export const fx = { shake: 0 };

interface UiState {
  archive: boolean;
  sound: boolean;
  dossier: boolean;
  bag: boolean;
  /** Mirror of what is in storage, so the screens re-render when it changes. */
  save: Save;
  lastRun: RunRecord | null;
  /** Awards unlocked by the scene that just ended. */
  newAwards: string[];
  /** What the pointer is over on the bench: "t:" terminal, "w:" wire, "m:" module. */
  hoverId: string | null;
  setHover: (id: string | null) => void;
  /** Module the camera is parked on for a close look. */
  inspectId: string | null;
  setInspect: (id: string | null) => void;
  /** The campaign screen. */
  film: boolean;
  toggleFilm: () => void;
  /** The player's own jottings for the four code digits. The game never fills or checks them. */
  codePad: string[];
  setPad: (index: number, value: string) => void;
  panel: Panel | null;
  /** The run the scene sheet is showing; null means the latest. */
  viewRun: RunRecord | null;
  openPanel: (panel: Panel, run?: RunRecord) => void;
  closePanel: () => void;
  profileCreate: (name: string) => void;
  profileSelect: (id: string) => void;
  profileDelete: (id: string) => void;
  profileImport: (code: string) => string | null;
  dispatch: (action: Action) => void;
  toggleArchive: () => void;
  toggleSound: () => void;
  toggleDossier: () => void;
  toggleBag: () => void;
}

export type Panel = "partita" | "carriera" | "fama" | "graduatoria" | "premi" | "camerino";

export type GameStore = RunState & UiState;

/** Files a finished scene in the active performer's register. */
function file(state: RunState, outcome: "safe" | "boom" | "abort"): Partial<UiState> {
  const run = recordOf(state, Date.now(), outcome);
  if (!run) return {};
  const before = new Set(earnedAwards(activeProfile(loadSave()).runs));
  const save = addRun(run);
  const newAwards = earnedAwards(activeProfile(save).runs).filter((id) => !before.has(id));
  return { save, lastRun: run, newAwards };
}

function toRun(s: GameStore): RunState {
  return {
    phase: s.phase,
    mode: s.mode,
    difficulty: s.difficulty,
    seed: s.seed,
    bomb: s.bomb,
    secondsLeft: s.secondsLeft,
    timeAcc: s.timeAcc,
    lidOpen: s.lidOpen,
    pressureShunted: s.pressureShunted,
    tiltLocked: s.tiltLocked,
    capDumped: s.capDumped,
    codeUnlocked: s.codeUnlocked,
    dialMatched: s.dialMatched,
    dialDigits: s.dialDigits,
    keypad: s.keypad,
    displayDead: s.displayDead,
    ledsBlind: s.ledsBlind,
    uv: s.uv,
    xray: s.xray,
    exploded: s.exploded,
    tool: s.tool,
    selectedId: s.selectedId,
    probeA: s.probeA,
    pendingJumper: s.pendingJumper,
    jumpers: s.jumpers,
    cutIds: s.cutIds,
    knownWireIds: s.knownWireIds,
    notes: s.notes,
    log: s.log,
    logSeq: s.logSeq,
    hintsUsed: s.hintsUsed,
    mistakes: s.mistakes,
    attitude: s.attitude,
    listenLeft: s.listenLeft,
    listenKind: s.listenKind,
    decoded: s.decoded,
    dialPenalty: s.dialPenalty,
    pingCount: s.pingCount,
    forceNicks: s.forceNicks,
    endReason: s.endReason,
    markedIds: s.markedIds,
    cellSpare: s.cellSpare,
    warned30: s.warned30,
    bridge: s.bridge,
    bridgeHot: s.bridgeHot,
    bridgeCause: s.bridgeCause,
    bridgeWarned: s.bridgeWarned,
    endCause: s.endCause,
    tally: s.tally,
    mods: s.mods,
    campaign: s.campaign,
  };
}

export const useGame = create<GameStore>((set, get) => ({
  ...initialState(),
  archive: false,
  sound: true,
  dossier: false,
  bag: false,
  dispatch: (action) => {
    const prev = get();
    if (action.type === "start" || action.type === "pointer-terminal" || action.type === "keypad") unlockAudio();
    const next = reduce(toRun(prev), action);
    if (prev.phase === "play" && next.phase === "boom") fx.shake = 0.28;
    if (prev.phase === "play" && next.phase === "safe") fx.shake = 0.06;
    if (prev.sound) {
      if (prev.phase === "play" && next.phase === "boom") boom();
      else if (prev.phase === "play" && next.phase === "safe") win();
      else if (
        next.phase === "play" &&
        next.mode === "ripresa" &&
        next.secondsLeft < prev.secondsLeft &&
        prev.phase === "play"
      ) {
        beep(next.secondsLeft <= 5 ? 1760 : next.secondsLeft <= 10 ? 1400 : 880);
      }
    }
    let filed: Partial<UiState> = {};
    if (prev.phase === "play" && (next.phase === "safe" || next.phase === "boom")) {
      filed = file(next, next.phase);
    } else if (action.type === "abort" && prev.phase === "play" && prev.tally.elapsed >= 10) {
      filed = file(toRun(prev), "abort");
    }
    if (action.type === "start") set({ ...next, ...filed, archive: false, panel: null, film: false, newAwards: [], inspectId: null, hoverId: null, codePad: ["", "", "", ""] });
    else if (action.type === "abort") set({ ...next, ...filed, inspectId: null, hoverId: null });
    else set({ ...next, ...filed });
  },
  save: loadSave(),
  lastRun: null,
  newAwards: [],
  hoverId: null,
  setHover: (hoverId) => {
    if (get().hoverId !== hoverId) set({ hoverId });
  },
  inspectId: null,
  setInspect: (inspectId) => set(inspectId ? { inspectId, selectedId: inspectId } : { inspectId: null }),
  film: false,
  toggleFilm: () => set({ film: !get().film }),
  codePad: ["", "", "", ""],
  setPad: (index, value) => {
    const codePad = [...get().codePad];
    codePad[index] = value.replace(/[^0-9]/g, "").slice(-1);
    set({ codePad });
  },
  panel: null,
  viewRun: null,
  openPanel: (panel, run) => set({ panel, viewRun: run ?? null }),
  closePanel: () => set({ panel: null, viewRun: null }),
  profileCreate: (name) => set({ save: createProfile(name), lastRun: null, newAwards: [] }),
  profileSelect: (id) => set({ save: selectProfile(id), lastRun: null, newAwards: [] }),
  profileDelete: (id) => set({ save: deleteProfile(id), lastRun: null, newAwards: [] }),
  profileImport: (code) => {
    const { save, error } = importProfile(code);
    set({ save });
    return error ?? null;
  },
  toggleArchive: () => {
    const st = get();
    if (!st.archive && st.phase === "play" && st.mods.includes("copione-strappato")) st.dispatch({ type: "archive-denied" });
    else set({ archive: !st.archive });
  },
  toggleSound: () => {
    const sound = !get().sound;
    setMuted(!sound);
    set({ sound });
  },
  toggleDossier: () => set({ dossier: !get().dossier }),
  toggleBag: () => set({ bag: !get().bag }),
}));

export function emitView(type: "zoom-in" | "zoom-out" | "reset" | "focus") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ut-view", { detail: type }));
}
