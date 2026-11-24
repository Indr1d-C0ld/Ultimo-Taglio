import { X } from "lucide-react";
import { wireClass, wireSeat, type NetView, type WireClass } from "../circuit";
import { colorHex, colorName, terminalLabel } from "../palette";
import { useGame } from "../store";
import type { Bomb, Wire } from "../types";

const W = 600;
const H = 378;

/** Fixed places for the terminals every scene has. Joints and bus ends are laid out as they turn up. */
const PLACE: Record<string, [number, number]> = {
  "bat-pos": [84, 74],
  "timer-vin": [270, 34],
  "timer-clk": [352, 34],
  "det-in": [516, 74],
  "det-inhibit": [516, 262],
  "bat-neg": [84, 262],
  "cap-hot": [40, 146],
  "cap-load": [40, 202],
  "rx-out": [240, 350],
  "led-in": [400, 350],
};

const CLASS: Record<WireClass, { label: string; tone: string }> = {
  trappola: { label: "TRAPPOLA", tone: "#e23b2b" },
  linea: { label: "LINEA", tone: "#d6e38a" },
  timer: { label: "TIMER", tone: "#ffb020" },
  cluster: { label: "CLUSTER", tone: "#ffb020" },
  quarzo: { label: "QUARZO", tone: "#e23b2b" },
  cieco: { label: "CIECO", tone: "#a89884" },
  morto: { label: "MORTO", tone: "#6f6256" },
  rotto: { label: "ROTTO", tone: "#6f6256" },
};

/**
 * Places for the harness terminals the notebook knows about. They sit on two neutral rows
 * in the middle, in id order: where a joint is drawn says nothing about which net it is on.
 */
function harnessPlaces(ids: string[]): Record<string, [number, number]> {
  const joints = ids.filter((id) => /^j\d+$/.test(id)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const bus = ids.filter((id) => id.startsWith("h-")).sort();
  const row = (list: string[], y: number) =>
    Object.fromEntries(list.map((id, i) => [id, [170 + ((i + 0.5) * 260) / Math.max(1, list.length), y] as [number, number]]));
  return { ...row(joints, 140), ...row(bus, 206) };
}

function known(bomb: Bomb, ids: string[]): Wire[] {
  return bomb.wires.filter((w) => ids.includes(w.id));
}

/** A notebook page that draws the circuit as the meter reveals it. Nothing here is known until measured. */
export function Notebook() {
  const open = useGame((s) => s.notebook);
  const toggle = useGame((s) => s.toggleNotebook);
  const bomb = useGame((s) => s.bomb);
  const phase = useGame((s) => s.phase);
  const knownIds = useGame((s) => s.knownWireIds);
  const cutIds = useGame((s) => s.cutIds);
  const marked = useGame((s) => s.markedIds);
  const jumpers = useGame((s) => s.jumpers);
  const codeUnlocked = useGame((s) => s.codeUnlocked);
  const capDumped = useGame((s) => s.capDumped);
  const hoverId = useGame((s) => s.hoverId);
  const selectedId = useGame((s) => s.selectedId);
  const setHover = useGame((s) => s.setHover);
  const dispatch = useGame((s) => s.dispatch);
  if (!open || !bomb || phase === "boot") return null;

  const view: NetView = { cutIds, jumpers, codeUnlocked, capDumped };
  const wires = known(bomb, knownIds);
  const harness = harnessPlaces([...new Set(wires.flatMap((w) => [w.a, w.b]))]);
  const at = (id: string): [number, number] | null => PLACE[id] ?? harness[id] ?? null;
  const pads = new Set<string>(["bat-pos", "bat-neg", "det-in", "det-inhibit", "timer-vin"]);
  if (bomb.gates.cap) for (const id of ["cap-hot", "cap-load"]) pads.add(id);
  if (bomb.wires.some((w) => w.role === "senso")) for (const id of ["rx-out", "led-in"]) pads.add(id);
  // Whatever a measured wire lands on gets its pad, CLOCK included.
  for (const w of wires) for (const id of [w.a, w.b]) pads.add(id);

  const focus = hoverId?.startsWith("w:") ? hoverId.slice(2) : wires.some((w) => w.id === selectedId) ? selectedId : null;
  const focused = wires.find((w) => w.id === focus);
  const unread = bomb.wires.filter((w) => !knownIds.includes(w.id));
  const traps = wires.filter((w) => wireClass(bomb, view, w.id) === "trappola").length;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-10 w-[38rem] max-w-[calc(100%-1.5rem)] rounded-sm border border-line bg-bg-raised/95 shadow-xl">
      <div className="flex items-center justify-between border-b border-line px-3 py-1">
        <p className="font-display text-sm tracking-[0.18em] text-fg">TACCUINO · SCHEMA</p>
        <p className="text-[11px] text-muted">
          {wires.length} fili letti su {bomb.wires.length} · {traps} trappole viste
        </p>
        <button type="button" onClick={toggle} className="grid size-8 place-items-center text-muted" aria-label="Chiudi il taccuino">
          <X className="size-4" />
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Schema del circuito misurato finora">
        <rect x="0" y="0" width={W} height={H} fill="#14110f" />
        {/* Faint guides: where the firing path and the inhibitor line would run if they were straight. */}
        <text x={300} y={66} textAnchor="middle" fontSize="9" fill="#3c342c" letterSpacing="2">CELLA → INNESCO</text>
        <text x={300} y={282} textAnchor="middle" fontSize="9" fill="#3c342c" letterSpacing="2">INIBITORE → BAT −</text>

        {bomb.gates.keypad && !codeUnlocked && (
          <g>
            <path d={`M 516 262 Q 300 345 84 262`} fill="none" stroke="#6f6256" strokeWidth="1.5" strokeDasharray="5 5" />
            <text x={300} y={320} textAnchor="middle" fontSize="10" fill="#a89884">relè del codice · chiuso</text>
          </g>
        )}
        {bomb.gates.cap && !capDumped && (
          <g>
            <path d={`M 40 146 Q 44 100 84 74`} fill="none" stroke="#6f6256" strokeWidth="1.5" strokeDasharray="5 5" />
            <text x={18} y={108} fontSize="10" fill="#a89884">vincolo</text>
          </g>
        )}
        {jumpers.map((j) => {
          const a = at(j.a);
          const b = at(j.b);
          return a && b ? <line key={`${j.a}-${j.b}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#c9d46a" strokeWidth="3" strokeDasharray="2 4" /> : null;
        })}

        {wires.map((wire, n) => {
          const a = at(wire.a);
          const b = at(wire.b);
          if (!a || !b) return null;
          const cls = wireClass(bomb, view, wire.id) ?? "morto";
          const cut = cutIds.includes(wire.id);
          const lit = focus === wire.id;
          // Bow each wire a little, alternately, so two between the same rows do not overlap.
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len = Math.hypot(dx, dy) || 1;
          const bow = ((n % 2 ? 1 : -1) * (12 + (n % 3) * 7));
          const cx = mx - (dy / len) * bow;
          const cy = my + (dx / len) * bow;
          const path = `M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`;
          const lx = (a[0] + 2 * cx + b[0]) / 4;
          const ly = (a[1] + 2 * cy + b[1]) / 4;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI + (wire.diode === "b-a" ? 180 : 0);
          return (
            <g
              key={wire.id}
              opacity={cut ? 0.45 : 1}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(`w:${wire.id}`)}
              onMouseLeave={() => setHover(null)}
              onClick={() => dispatch({ type: "select", id: wire.id })}
            >
              <path d={path} fill="none" stroke="transparent" strokeWidth="14" />
              {lit && <path d={path} fill="none" stroke="#f4efe6" strokeWidth="7" opacity="0.35" />}
              <path
                d={path}
                fill="none"
                stroke={colorHex(wire.color)}
                strokeWidth={lit ? 4 : 3}
                strokeLinecap="round"
                strokeDasharray={cls === "rotto" ? "3 6" : cut ? "10 8" : undefined}
              />
              {wire.diode && !cut && (
                <path d="M -6 -5 L 6 0 L -6 5 Z" fill="#e7d27a" stroke="#14110f" strokeWidth="1" transform={`translate(${lx} ${ly}) rotate(${angle})`} />
              )}
              {marked.includes(wire.id) && <circle cx={lx} cy={ly - 9} r="3.5" fill="#e2b43a" />}
              <g transform={`translate(${lx} ${ly + (wire.diode && !cut ? 15 : 4)})`}>
                <rect x={-24} y={-8} width={48} height={12} fill="#14110f" stroke={CLASS[cls].tone} strokeWidth="0.75" />
                <text textAnchor="middle" y={1.5} fontSize="8" letterSpacing="1" fill={CLASS[cls].tone}>
                  {cut ? "TAGLIATO" : CLASS[cls].label}
                </text>
              </g>
            </g>
          );
        })}

        {[...pads].map((id) => {
          const p = at(id);
          if (!p) return null;
          const anchor = p[0] < 70 ? "start" : p[0] > 530 ? "end" : "middle";
          const tx = anchor === "start" ? p[0] - 22 : anchor === "end" ? p[0] + 22 : p[0];
          const above = p[1] < 180;
          return (
            <g key={id}>
              <circle cx={p[0]} cy={p[1]} r="6" fill="#e6e0d4" stroke="#14110f" strokeWidth="2" />
              <text x={tx} y={above ? p[1] - 12 : p[1] + 19} textAnchor={anchor} fontSize="10" fill="#f4efe6" fontFamily="IBM Plex Mono, monospace">
                {terminalLabel(id)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="border-t border-line px-3 py-2 text-xs">
        {focused ? (
          <p className="text-muted">
            <span className="text-fg">
              {colorName(focused.color)} · {terminalLabel(focused.a)} → {terminalLabel(focused.b)}.
            </span>{" "}
            {wireSeat(bomb, view, focused.id)}
          </p>
        ) : (
          <p className="text-faint">
            Lo schema si disegna da solo man mano che misuri. Passa su un tratto per rileggerne la misura e ritrovarlo sul banco.
          </p>
        )}
        {unread.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-faint">
            Da misurare:
            {unread.map((w) => (
              <button
                key={w.id}
                type="button"
                title={`Filo ${colorName(w.color).toLowerCase()}`}
                onMouseEnter={() => setHover(`w:${w.id}`)}
                onMouseLeave={() => setHover(null)}
                onClick={() => dispatch({ type: "select", id: w.id })}
                className="inline-block h-3 w-5 rounded-sm border border-line"
                style={{ background: colorHex(w.color) }}
              />
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
