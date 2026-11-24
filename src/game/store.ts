import { create } from "zustand";
import { beep, boom, setMuted, unlockAudio, win } from "./audio";
import { initialState, reduce } from "./logic";
import { recordWin } from "./save";
import type { Action, RunState } from "./types";

export const fx = { shake: 0 };

interface UiState {
  archive: boolean;
  sound: boolean;
  dossier: boolean;
  bag: boolean;
  dispatch: (action: Action) => void;
  toggleArchive: () => void;
  toggleSound: () => void;
  toggleDossier: () => void;
  toggleBag: () => void;
}

export type GameStore = RunState & UiState;

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
    if (prev.phase !== "safe" && next.phase === "safe" && next.mode === "ripresa" && next.bomb) {
      recordWin({
        seed: next.seed,
        difficulty: next.difficulty,
        left: next.secondsLeft,
        hints: next.hintsUsed,
      });
    }
    if (action.type === "start") set({ ...next, archive: false });
    else set(next);
  },
  toggleArchive: () => set({ archive: !get().archive }),
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
