import { directedPath, netEdges, type NetView } from "./circuit";
import type { Bomb, RunState } from "./types";

/** Theatrical idle glow while the cell still reaches the tube. Not a firing threshold. */
export const BRIDGE_REST = 0.16;
export const BRIDGE_REST_CAP = 0.36;
export const BRIDGE_DARK = 0.04;
/** Climb rate after a bruised clamp, per second. From 0.58 this saturates in about nine seconds. */
export const BRIDGE_CLIMB = 0.05;
export const BRIDGE_BRUISE = 0.58;

export type Bruise = "cap" | "code" | "other";

export function bruiseOf(reason: string): Bruise {
  if (reason.includes("condensatore")) return "cap";
  if (reason.startsWith("sportello")) return "code";
  return "other";
}

export function bruiseHealed(state: RunState): boolean {
  if (!state.bridgeHot || !state.bridgeCause || !state.bomb) return false;
  if (state.bridgeCause === "cap") return state.capDumped;
  if (state.bridgeCause === "code") return state.codeUnlocked;
  const capOk = !state.bomb.gates.cap || state.capDumped;
  const codeOk = !state.bomb.gates.keypad || state.codeUnlocked;
  return state.lidOpen && capOk && codeOk;
}

export function firingPath(bomb: Bomb, view: NetView): boolean {
  return directedPath(netEdges(bomb, view), "bat-pos", "det-in") !== null;
}

export function bridgeRest(hasPath: boolean, capLive: boolean): number {
  if (!hasPath) return BRIDGE_DARK;
  return capLive ? BRIDGE_REST_CAP : BRIDGE_REST;
}

export function stepBridge(
  bridge: number,
  hot: boolean,
  rest: number,
  dt: number,
  prova: boolean,
): { bridge: number; saturated: boolean } {
  let next = bridge;
  if (hot) next += BRIDGE_CLIMB * dt;
  else next += (rest - next) * (1 - Math.exp(-1.6 * dt));
  if (next >= 1) {
    if (prova) return { bridge: 0.9, saturated: false };
    return { bridge: 1, saturated: true };
  }
  if (!hot) next = Math.min(next, 0.5);
  return { bridge: Math.max(0, next), saturated: false };
}

export function bridgeSentence(bridge: number, hot: boolean, capLive: boolean): string {
  const pct = Math.round(Math.min(1, Math.max(0, bridge)) * 100);
  if (hot) return `Ponte di scena al ${pct}% e in salita. La guardia ferita non lo raffredda: se satura, il tubo chiude il copione.`;
  if (capLive) return `Ponte al ${pct}%. Il condensatore ancora carico lo tiene sopra il minimo. Finché l'inibitore è intero, non corre.`;
  return `Ponte al ${pct}%. Minimo di copione, tenuto dall'inibitore. Non è una soglia: è il tubo a riposo.`;
}
