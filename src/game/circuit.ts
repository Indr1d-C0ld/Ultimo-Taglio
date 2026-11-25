import { terminalLabel } from "./palette";
import type { Bomb, Wire } from "./types";

export interface NetView {
  cutIds: string[];
  jumpers: { a: string; b: string }[];
  codeUnlocked: boolean;
  capDumped: boolean;
}

interface NetEdge {
  id: string;
  a: string;
  b: string;
  kind: "wire" | "jumper" | "relay" | "bond";
  diode: Wire["diode"];
}

export interface Trail {
  nodes: string[];
  edges: NetEdge[];
}

function stepFrom(edge: NetEdge, from: string): string | null {
  if (edge.a === from) return edge.diode === "b-a" ? null : edge.b;
  if (edge.b === from) return edge.diode === "a-b" ? null : edge.a;
  return null;
}

export function netEdges(bomb: Bomb, view: NetView): NetEdge[] {
  const cut = new Set(view.cutIds);
  const edges: NetEdge[] = [];
  for (const w of bomb.wires) {
    if (cut.has(w.id) || w.open) continue;
    edges.push({ id: w.id, a: w.a, b: w.b, kind: "wire", diode: w.diode });
  }
  for (const j of view.jumpers) {
    edges.push({ id: `jumper:${j.a}:${j.b}`, a: j.a, b: j.b, kind: "jumper", diode: null });
  }
  if (bomb.gates.keypad && !view.codeUnlocked) {
    edges.push({ id: "relay-code", a: "det-inhibit", b: "bat-neg", kind: "relay", diode: null });
  }
  if (bomb.gates.cap && !view.capDumped) {
    edges.push({ id: "bond-cap", a: "cap-hot", b: "bat-pos", kind: "bond", diode: null });
  }
  return edges;
}

/** Edges of a bare wire list, before any bomb exists. Used to read roles off a fresh topology. */
export function wireEdges(wires: Wire[]): NetEdge[] {
  return wires
    .filter((w) => !w.open)
    .map((w) => ({ id: w.id, a: w.a, b: w.b, kind: "wire" as const, diode: w.diode }));
}

function hardEdges(bomb: Bomb, view: NetView): NetEdge[] {
  return netEdges(bomb, view).filter((e) => e.kind === "wire" || e.kind === "jumper");
}

/** The inhibitor still sees BAT − through wires or clips. The code relay does not count. */
export function lineClosed(bomb: Bomb, view: NetView): boolean {
  return directedPath(hardEdges(bomb, view), "det-inhibit", "bat-neg") !== null;
}

export function directedPath(edges: NetEdge[], src: string, dst: string): Trail | null {
  if (src === dst) return { nodes: [src], edges: [] };
  const prev = new Map<string, { node: string; edge: NetEdge }>();
  const seen = new Set<string>([src]);
  const q = [src];
  while (q.length) {
    const node = q.shift()!;
    for (const edge of edges) {
      const to = stepFrom(edge, node);
      if (!to || seen.has(to)) continue;
      prev.set(to, { node, edge });
      if (to === dst) {
        const nodes = [dst];
        const trail: NetEdge[] = [];
        let cur = dst;
        while (cur !== src) {
          const step = prev.get(cur);
          if (!step) break;
          trail.push(step.edge);
          nodes.push(step.node);
          cur = step.node;
        }
        nodes.reverse();
        trail.reverse();
        return { nodes, edges: trail };
      }
      seen.add(to);
      q.push(to);
    }
  }
  return null;
}

/** True when some simple directed path from src to dst uses this edge. */
export function edgeCarries(edges: NetEdge[], src: string, dst: string, edgeId: string): boolean {
  const q: { node: string; used: boolean; seen: string[] }[] = [{ node: src, used: false, seen: [src] }];
  while (q.length) {
    const cur = q.pop()!;
    if (cur.used && cur.node === dst) return true;
    for (const edge of edges) {
      const to = stepFrom(edge, cur.node);
      if (!to || cur.seen.includes(to)) continue;
      q.push({ node: to, used: cur.used || edge.id === edgeId, seen: [...cur.seen, to] });
    }
  }
  return false;
}

function conducts(wire: Wire, from: string, to: string): boolean {
  if (wire.a === from && wire.b === to) return wire.diode !== "b-a";
  if (wire.b === from && wire.a === to) return wire.diode !== "a-b";
  return false;
}

function directWire(bomb: Bomb, view: NetView, a: string, b: string): Wire | undefined {
  return bomb.wires.find(
    (w) => !view.cutIds.includes(w.id) && ((w.a === a && w.b === b) || (w.a === b && w.b === a)),
  );
}

/** Cuts a careful hand needs to open the inhibitor line with every guard down: one, or two when a branch runs in parallel. */
export function cutsNeeded(bomb: Bomb): number {
  const view: NetView = { cutIds: [], jumpers: [], codeUnlocked: true, capDumped: true };
  let cuts = 0;
  for (const wire of bomb.wires.filter((w) => w.role === "sicura")) {
    if (!lineClosed(bomb, view)) break;
    if (!edgeCarries(netEdges(bomb, view), "det-inhibit", "bat-neg", wire.id)) continue;
    view.cutIds = [...view.cutIds, wire.id];
    cuts += 1;
  }
  return cuts;
}

export type WireClass = "trappola" | "linea" | "timer" | "cluster" | "quarzo" | "gemello" | "cieco" | "morto" | "rotto";

/** What the meter makes of a wire, as a tag. The sentence for the same reading is wireSeat(). */
export function wireClass(bomb: Bomb, view: NetView, wireId: string): WireClass | null {
  const wire = bomb.wires.find((w) => w.id === wireId);
  if (!wire) return null;
  if (wire.open) return "rotto";
  if (wire.a === "timer-clk" || wire.b === "timer-clk") return "quarzo";
  if (wire.a === "det-aux" || wire.b === "det-aux") return "gemello";
  const present: NetView = { ...view, cutIds: view.cutIds.filter((id) => id !== wireId) };
  const edges = netEdges(bomb, present);
  const hard = hardEdges(bomb, present);
  if (edgeCarries(edges, "bat-pos", "det-in", wire.id)) return "trappola";
  if (edgeCarries(edges, "bat-pos", "timer-vin", wire.id)) return "timer";
  if (edgeCarries(edges, "rx-out", "led-in", wire.id) || edgeCarries(edges, "led-in", "rx-out", wire.id)) return "cluster";
  if (edgeCarries(hard, "det-inhibit", "bat-neg", wire.id)) return "linea";
  const without = edges.filter((e) => e.id !== wire.id);
  const anchors = ["det-in", "det-inhibit", "bat-neg", "bat-pos"];
  const touches = (end: string) =>
    anchors.some((t) => end === t || !!directedPath(without, end, t) || !!directedPath(without, t, end));
  return touches(wire.a) || touches(wire.b) ? "cieco" : "morto";
}

export function wireSeat(bomb: Bomb, view: NetView, wireId: string): string {
  const wire = bomb.wires.find((w) => w.id === wireId);
  if (!wire) return "";
  if (wire.open) return "Anima interrotta sotto l'isolante: non conduce in nessun verso. Tratto morto, fuori da ogni percorso.";
  if (wire.a === "timer-clk" || wire.b === "timer-clk") {
    return "Filo del quarzo: dà il passo al conto alla rovescia. Tagliarlo non ferma il timer, lo fa correre al doppio.";
  }
  if (wire.a === "det-aux" || wire.b === "det-aux") {
    return "Filo del gemello: sul morsetto TEST non c'è nessun collaudo, c'è un secondo conteggio nascosto sotto l'innesco. Finché questo filo è intero, aprire la linea ferma il display e sveglia l'altro.";
  }
  const present: NetView = { ...view, cutIds: view.cutIds.filter((id) => id !== wireId) };
  const edges = netEdges(bomb, present);
  const hard = hardEdges(bomb, present);
  const line = edgeCarries(hard, "det-inhibit", "bat-neg", wire.id);
  const live = edgeCarries(edges, "bat-pos", "det-in", wire.id);
  const timer = edgeCarries(edges, "bat-pos", "timer-vin", wire.id);
  const cluster = edgeCarries(edges, "rx-out", "led-in", wire.id) || edgeCarries(edges, "led-in", "rx-out", wire.id);
  const without = edges.filter((e) => e.id !== wire.id);
  const anchors = ["det-in", "det-inhibit", "bat-neg", "bat-pos"];
  const touches = (end: string) =>
    anchors.some((t) => end === t || !!directedPath(without, end, t) || !!directedPath(without, t, end));
  const spur = !live && !line && (touches(wire.a) || touches(wire.b));
  const bead = wire.diode ? " Su questo tratto una perla lascia aperto il verso opposto." : "";
  if (live) return `Sul percorso BAT + → INNESCO: segmento di trappola.${bead}`;
  if (timer) {
    const hot =
      bomb.gates.cap && !view.capDumped
        ? " Il condensatore è ancora sulla cella: tagliarlo adesso scarica sull'innesco."
        : " Il display si spegne, il tempo no.";
    return `Fra cella e TIMER.${hot}${bead}`;
  }
  if (cluster) return `Fra RX e CLUSTER. È l'onda dei lampeggi.${bead}`;
  if (line) {
    const spare = directedPath(
      hard.filter((e) => e.id !== wire.id),
      "det-inhibit",
      "bat-neg",
    );
    const twin = spare
      ? " C'è un secondo ramo in parallelo: aprire solo questo non basta."
      : " È l'unica strada rimasta: aprirla è il taglio.";
    return `Sulla linea INIBITORE → BAT −. Non sta sul percorso dell'innesco.${twin}${bead}`;
  }
  if (spur) return `Ramo cieco. È appeso a un percorso, ma la corrente non passa di qui.${bead}`;
  return `Ritorno morto: fuori da cella, innesco, timer e cluster.${bead}`;
}

function relayClause(bomb: Bomb, view: NetView, wire: Wire | undefined): string {
  if (!bomb.gates.keypad || !wire || wire.open) return "";
  if (!edgeCarries(hardEdges(bomb, view), "det-inhibit", "bat-neg", wire.id)) return "";
  if (!view.codeUnlocked) return " Relè del codice chiuso in parallelo alla linea: nessun taglio la apre finché non entra il codice.";
  return " Relè del codice aperto: la linea passa solo dai fili.";
}

function routePhrase(trail: Trail): string {
  const tags: string[] = [];
  if (trail.edges.some((e) => e.kind === "relay")) tags.push("relè del codice");
  if (trail.edges.some((e) => e.kind === "bond")) tags.push("vincolo del condensatore");
  if (trail.edges.some((e) => e.kind === "jumper")) tags.push("ponticello");
  const tag = tags.length ? `, con ${tags.join(" e ")}` : "";
  const one = trail.edges[0];
  if (trail.edges.length === 1 && one?.kind === "wire") return "Tratto diretto.";
  if (trail.edges.length === 1 && one?.kind === "bond") {
    return "Vincolo interno: il condensatore sta sulla cella finché non scarica sul carico fittizio.";
  }
  if (trail.edges.length === 1 && one?.kind === "relay") {
    return "Contatto del relè del codice: finché è chiuso tiene unita la linea, qualunque filo tagli.";
  }
  const via = trail.nodes.slice(1, -1).map((id) => terminalLabel(id));
  const viaTxt = via.length ? ` via ${via.join(" · ")}` : "";
  return `Continuità in ${trail.edges.length} passi${viaTxt}${tag}.`;
}

export function probeReading(bomb: Bomb, view: NetView, a: string, b: string): { text: string; wireId?: string } {
  const wire = directWire(bomb, view, a, b);
  if (wire?.open) {
    return { text: `Aperto nei due versi, eppure il filo è intero. ${wireSeat(bomb, view, wire.id)}`, wireId: wire.id };
  }
  if (wire) {
    const aToB = conducts(wire, a, b);
    const bToA = conducts(wire, b, a);
    const sense =
      aToB && bToA
        ? "Conduce nei due versi."
        : aToB
          ? `Perla di senso: solo da ${terminalLabel(a)} verso ${terminalLabel(b)}.`
          : `Perla di senso: solo da ${terminalLabel(b)} verso ${terminalLabel(a)}.`;
    let loop = "";
    if (aToB !== bToA) {
      const edges = netEdges(bomb, view).filter((e) => e.id !== wire.id);
      const from = aToB ? b : a;
      const to = aToB ? a : b;
      if (directedPath(edges, from, to)) loop = " Il verso opposto esiste solo facendo il giro, non su questa perla.";
    }
    return {
      text: `${sense} Tratto diretto. ${wireSeat(bomb, view, wire.id)}${loop}${relayClause(bomb, view, wire)}`,
      wireId: wire.id,
    };
  }

  const edges = netEdges(bomb, view);
  const fw = directedPath(edges, a, b);
  const bw = directedPath(edges, b, a);
  if (!fw && !bw) return { text: "Circuito aperto nei due versi." };
  const trail = (fw ?? bw)!;
  const sense =
    fw && bw
      ? "Conduce nei due versi."
      : fw
        ? `Solo da ${terminalLabel(a)} verso ${terminalLabel(b)}.`
        : `Solo da ${terminalLabel(b)} verso ${terminalLabel(a)}.`;
  const isolated = trail.edges.length === 1 && trail.edges[0]?.kind === "wire";
  const seat = isolated
    ? wireSeat(bomb, view, trail.edges[0]!.id)
    : "Non è un singolo tratto: sonda i due capi di un filo per sapere se la cella ci passa.";
  return { text: `${sense} ${routePhrase(trail)} ${seat}` };
}
