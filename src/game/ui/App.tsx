import {
  Battery,
  BookOpen,
  Boxes,
  Cable,
  Crosshair,
  Eye,
  Hand,
  Hexagon,
  Link2,
  RotateCcw,
  Scan,
  Scissors,
  Sparkles,
  Stethoscope,
  Sun,
  Tag,
  Trophy,
  Unplug,
  Volume2,
  VolumeX,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Component, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { ARTICLES, DIFFICULTY_COPY, DISCLAIMER } from "../catalog";
import { wireSeat, type NetView } from "../circuit";
import { ARCHETYPES } from "../generate";
import { KIT, KIT_GROUPS, fitLine, kitItem } from "../kit";
import { RADIO_ASKS, antennaLive, findWire, formatClock, radioAnswer, radioCost, stages, tiltRatio } from "../logic";
import { colorHex, colorName, terminalLabel } from "../palette";
import { randomSeed } from "../rng";
import { activeProfile, markRead } from "../save";
import { AWARDS, GRADES, dailySeed } from "../stats";
import { Records } from "./Records";
import { Film } from "./Film";
import { Notebook } from "./Notebook";
import { chainDifficulty, chainResults, chainSeed, firstLink, nextLink } from "../sequence";
import { MODIFIERS, nextScene, sceneById, stopLine, ciakOf, filmProgress } from "../campaign";
import { emitView, useGame } from "../store";
import { TUNING } from "../tuning";
import type { Difficulty, Mode, ModuleKind, Tool } from "../types";

const ICONS: Record<Tool, ComponentType<{ className?: string }>> = {
  occhio: Eye,
  multimetro: Cable,
  tronchese: Scissors,
  cacciavite: Wrench,
  brugola: Hexagon,
  ponticello: Link2,
  pinzette: Unplug,
  stetoscopio: Stethoscope,
  nastro: Tag,
  pila: Battery,
  maneggio: Hand,
  uv: Sun,
};

const MODULE_BLURB: Record<ModuleKind, string> = {
  timer: "Display di scena. Se si spegne, il tempo continua lo stesso.",
  harness: "Giunti e bus. Un ramo cieco può vestirsi come il tratto che continua verso l'innesco.",
  battery: "Cella di palco. Il positivo alimenta il timer e spesso una trappola.",
  detonator: "Tubo di repertorio con un ponte di scena. Sale solo se forzi una guardia. INIBITORE è il taglio, a relè aperto.",
  cap: "Scarica di copione. Solo il carico fittizio è un ponticello lecito.",
  keypad: "Quattro cifre, tutte da trovare di persona: UV, lampi del cluster, battiti dell'antenna o riga CIAK, poi fili meno trappole.",
  tilt: "Pallina in un tubo. Il maneggio la muove; la camera no. La brugola la blocca.",
  receiver: "Batte la terza cifra, ma si sente solo con lo stetoscopio. Ruba secondi finché il codice non la zittisce.",
  leds: "I lampi fra una pausa e l'altra sono la seconda cifra. Si contano a occhio: avvicinati.",
  dial: "Tre ruote opzionali. Evitano il salto di tempo a metà scena.",
  plate: "Gli ordini sul metallo mentono. Formula e riga CIAK no.",
};

export function App() {
  const phase = useGame((s) => s.phase);
  const archive = useGame((s) => s.archive);
  const endKey = useGame((s) => s.endReason);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const st = useGame.getState();
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Escape") {
        if (st.film) st.toggleFilm();
        else if (st.panel) st.closePanel();
        else if (st.inspectId && !st.archive) st.setInspect(null);
        else st.toggleArchive();
        return;
      }
      if (st.archive || st.panel || st.film || st.phase !== "play") return;
      if (event.key === "t" || event.key === "T") st.toggleNotebook();
      if (event.key === "e" || event.key === "E") st.dispatch({ type: "toggle", key: "exploded" });
      if (event.key === "x" || event.key === "X") st.dispatch({ type: "toggle", key: "xray" });
      if (event.key === "u" || event.key === "U") st.dispatch({ type: "toggle", key: "uv" });
      if (event.key === "f" || event.key === "F") emitView("focus");
      if (event.key === "r" || event.key === "R") emitView("reset");
      if (event.key === "Enter") st.dispatch({ type: "keypad", key: "OK" });
      if (event.key === "Backspace") st.dispatch({ type: "keypad", key: "C" });
      if (/^[0-9]$/.test(event.key)) st.dispatch({ type: "keypad", key: event.key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-root flex flex-col">
      <Header />
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0" style={{ touchAction: "none" }}>
          <Viewport />
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 flex">
          <ToolRail />
          <div className="relative min-w-0 flex-1">
            {phase === "boot" && (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3 md:items-center">
                <Boot />
              </div>
            )}
            {(phase === "boom" || phase === "safe") && (
              <div className="pointer-events-none absolute inset-0">
                <div
                  key={endKey}
                  className={`pointer-events-none absolute inset-0 ${phase === "boom" ? "bg-accent flash-boom" : "bg-ok flash-safe"}`}
                />
                <div key={`card-${endKey}`} className="end-late pointer-events-none absolute inset-0 flex items-end justify-center p-3 md:items-center">
                  <EndCard />
                </div>
              </div>
            )}
            <OpeningSlate />
            <TiltGauge />
            <BridgeMeter />
            <InspectBar />
            <SceneRules />
            <Notebook />
            <HoverChip />
          </div>
          <Dossier />
        </div>
      </div>
      <LogBar />
      {archive && <Archive />}
      <Records />
      <Film />
      <div className="grain" aria-hidden />
    </div>
  );
}

function Viewport() {
  const [View, setView] = useState<ComponentType | null>(null);
  useEffect(() => {
    void import("../scene/BombCanvas").then((mod) => setView(() => mod.BombCanvas));
  }, []);
  if (!View) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <p className="font-display text-2xl tracking-widest text-muted">CARICAMENTO SET</p>
      </div>
    );
  }
  return (
    <SceneBoundary>
      <View />
    </SceneBoundary>
  );
}

/** Without WebGL the renderer throws on mount; keep the rest of the app alive. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-bg p-6 text-center">
        <p className="font-display text-2xl tracking-widest text-fg">SET NON DISPONIBILE</p>
        <p className="max-w-sm text-sm text-muted">
          Il banco 3D ha bisogno di WebGL, che questo browser non offre o ha disattivato.
        </p>
      </div>
    );
  }
}

function Header() {
  const phase = useGame((s) => s.phase);
  const bomb = useGame((s) => s.bomb);
  const seconds = useGame((s) => s.secondsLeft);
  const mode = useGame((s) => s.mode);
  const dead = useGame((s) => s.displayDead);
  const sound = useGame((s) => s.sound);
  const toggleSound = useGame((s) => s.toggleSound);
  const toggleArchive = useGame((s) => s.toggleArchive);
  const openPanel = useGame((s) => s.openPanel);
  const progress = useGame((s) =>
    s.bomb
      ? `${s.phase}|${s.pressureShunted}|${s.lidOpen}|${s.tiltLocked}|${s.capDumped}|${s.codeUnlocked}|${s.dialMatched}`
      : "",
  );
  const list = progress ? stages(useGame.getState()) : [];
  const twin = useGame((s) => (s.phase === "play" ? s.twinLeft : null));
  const urgent = phase === "play" && mode === "ripresa" && (seconds <= 15 || twin !== null);

  return (
    <header className="z-20 flex shrink-0 items-center gap-3 border-b border-line bg-bg-raised px-3 py-2 md:px-4">
      <div className="min-w-0">
        <p className="font-display text-lg leading-none tracking-[0.18em] text-fg md:text-xl">ULTIMO TAGLIO</p>
        <p className="truncate text-xs text-muted">{bomb ? bomb.title : "Sala prova · copione di scena"}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {phase === "play" && (
          <div className="hidden items-center gap-1 xl:flex">
            {list.map((stage) => (
              <span
                key={stage.id}
                className={`whitespace-nowrap rounded-sm border px-1.5 py-1 text-[11px] ${stage.done ? "border-ok text-ok" : "border-line text-faint"}`}
              >
                {stage.label}
              </span>
            ))}
          </div>
        )}
        <div className={`lcd-readout text-2xl md:text-4xl ${urgent ? "lcd-hot" : ""}`}>
          {twin !== null ? formatClock(twin) : (phase === "play" && !dead) || phase === "safe" || phase === "boom" ? formatClock(seconds) : "––:––"}
        </div>
        {twin !== null && <p className="text-xs tracking-widest text-accent">GEMELLO</p>}
        <PingReadout />
        <div className="hidden text-xs text-muted sm:block">
          <p>{mode === "prova" ? "PROVA" : "RIPRESA"}</p>
          {dead && phase === "play" && <p className="text-lcd">display spento</p>}
        </div>
        <IconButton label={sound ? "Suono acceso" : "Suono spento"} onClick={toggleSound}>
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </IconButton>
        <IconButton label="Registro e statistiche" onClick={() => openPanel(phase === "boot" ? "carriera" : "partita")}>
          <Trophy className="size-4" />
        </IconButton>
        <IconButton label="Archivio di scena" onClick={toggleArchive}>
          <BookOpen className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}

function PingReadout() {
  const label = useGame((s) => {
    if (s.phase !== "play" || s.mode !== "ripresa" || !s.bomb?.gates.receiver || s.codeUnlocked) return "";
    const senso = s.bomb.wires.find((w) => w.role === "senso");
    if (senso && s.cutIds.includes(senso.id)) return "";
    const elapsed = s.bomb.seconds - s.secondsLeft;
    const every = TUNING[s.bomb.difficulty].pingEvery;
    const mod = elapsed % every;
    const until = mod === 0 ? every : every - mod;
    return `ping ${Math.ceil(until)}s`;
  });
  if (!label) return null;
  return <p className="hidden text-[10px] tracking-widest text-accent sm:block">{label}</p>;
}

function ToolRail() {
  const phase = useGame((s) => s.phase);
  if (phase === "boot") return null;
  return (
    <div className="pointer-events-auto hidden w-60 shrink-0 flex-col border-r border-line bg-bg-raised/95 md:flex">
      <KitList />
    </div>
  );
}

function KitList() {
  const tool = useGame((s) => s.tool);
  const dispatch = useGame((s) => s.dispatch);
  const phase = useGame((s) => s.phase);
  const cell = useGame((s) => s.cellSpare);
  const hand = kitItem(tool);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-3 py-2">
        <p className="font-display text-sm tracking-[0.18em] text-fg">BORSA DI SCENA</p>
        <p className="text-xs text-muted">In mano: {hand.label}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {KIT_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="px-1 text-[10px] tracking-[0.2em] text-lcd">{group.label.toUpperCase()}</p>
            <div className="mt-1 space-y-1">
              {KIT.filter((item) => item.group === group.id).map((item) => {
                const Icon = ICONS[item.id];
                const spent = item.id === "pila" && !cell;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={phase !== "play"}
                    onClick={() => {
                      dispatch({ type: "tool", tool: item.id });
                    }}
                    className={`flex w-full items-start gap-2 rounded-sm border px-2 py-2 text-left ${tool === item.id ? "border-accent bg-surface" : "border-line"}`}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-fg" />
                    <span className="min-w-0">
                      <span className="block text-sm text-fg">{spent ? "Pila esaurita" : item.label}</span>
                      <span className="block text-[11px] leading-snug text-muted">
                        {item.fits}. {item.blurb}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div>
          <p className="px-1 text-[10px] tracking-[0.2em] text-lcd">SGUARDI</p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            <ViewButtons disabled={phase !== "play"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewButtons({ disabled }: { disabled: boolean }) {
  const uv = useGame((s) => s.uv);
  const xray = useGame((s) => s.xray);
  const exploded = useGame((s) => s.exploded);
  const dispatch = useGame((s) => s.dispatch);
  const effects = useGame((s) => s.effects);
  const toggleEffects = useGame((s) => s.toggleEffects);
  return (
    <>
      <RailButton label="Ultravioletto" active={uv} disabled={disabled} onClick={() => dispatch({ type: "toggle", key: "uv" })}>
        <Sun className="size-4" />
      </RailButton>
      <RailButton label="Raggi" active={xray} disabled={disabled} onClick={() => dispatch({ type: "toggle", key: "xray" })}>
        <Scan className="size-4" />
      </RailButton>
      <RailButton label="Esploso" active={exploded} disabled={disabled} onClick={() => dispatch({ type: "toggle", key: "exploded" })}>
        <Boxes className="size-4" />
      </RailButton>
      <RailButton label="Inquadra" disabled={disabled} onClick={() => emitView("focus")}>
        <Crosshair className="size-4" />
      </RailButton>
      <RailButton label="Zoom avanti" disabled={disabled} onClick={() => emitView("zoom-in")}>
        <ZoomIn className="size-4" />
      </RailButton>
      <RailButton label="Zoom indietro" disabled={disabled} onClick={() => emitView("zoom-out")}>
        <ZoomOut className="size-4" />
      </RailButton>
      <RailButton label="Camera" disabled={disabled} onClick={() => emitView("reset")}>
        <RotateCcw className="size-4" />
      </RailButton>
      <RailButton label={effects ? "Effetti di lente: accesi" : "Effetti di lente: spenti"} active={effects} onClick={toggleEffects}>
        <Sparkles className="size-4" />
      </RailButton>
    </>
  );
}

function OpeningSlate() {
  const take = useGame((s) => s.take);
  const title = useGame((s) => s.bomb?.title ?? "");
  const phase = useGame((s) => s.phase);
  const performer = useGame((s) => activeProfile(s.save).name);
  const film = useGame((s) => sceneById(s.campaign)?.title ?? (s.chain ? `Piano sequenza · scena ${s.chain.index + 1}` : ""));
  // Which take of this very scene: earlier attempts on the same seed and part, plus this one.
  const ciak = useGame((s) => 1 + activeProfile(s.save).runs.filter((r) => r.seed === s.seed && r.difficulty === s.difficulty).length);
  if (phase !== "play" || !take) return null;
  const [scene, shell] = title.split(" — ");
  return (
    <div key={take} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div className="letterbox top-0" />
      <div className="letterbox bottom-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="slate-card w-72 border-2 border-fg bg-bg/95 p-3 font-mono text-fg">
          <p className="border-b border-fg pb-1 font-display text-xl tracking-[0.2em]">ULTIMO TAGLIO</p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 text-sm">
            <p className="text-muted">SCENA</p>
            <p className="text-right">{scene?.replace("Scena ", "") ?? ""}</p>
            <p className="text-muted">CIAK</p>
            <p className="text-right text-lcd">{ciak}</p>
            <p className="text-muted">INTERPRETE</p>
            <p className="truncate text-right">{performer}</p>
          </div>
          <p className="mt-2 border-t border-fg pt-1 text-xs text-muted">{film || shell}</p>
        </div>
      </div>
    </div>
  );
}

/** Names whatever the pointer is over, so the bench can be read without opening the sheet. */
function HoverChip() {
  const text = useGame((s) => {
    const bomb = s.bomb;
    if (!bomb || !s.hoverId || s.phase === "boot") return "";
    const kind = s.hoverId[0];
    const id = s.hoverId.slice(2);
    if (kind === "t") return `Morsetto ${terminalLabel(id)}`;
    if (kind === "w") {
      const wire = bomb.wires.find((w) => w.id === id);
      if (!wire) return "";
      const ends = s.knownWireIds.includes(id) ? `${terminalLabel(wire.a)} → ${terminalLabel(wire.b)}` : "capi non misurati";
      return `Filo ${colorName(wire.color).toLowerCase()} · ${ends}${s.cutIds.includes(id) ? " · tagliato" : ""}`;
    }
    const mod = bomb.modules.find((m) => m.id === id);
    if (!mod) return "";
    return s.inspectId === id ? mod.name : `${mod.name} · doppio clic per ispezionare`;
  });
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
      <p className="rounded-sm border border-line bg-bg-raised/95 px-3 py-1 font-mono text-xs text-fg">{text}</p>
    </div>
  );
}

/** The rules this campaign scene adds, kept in sight while it is being shot. */
function SceneRules() {
  const mods = useGame((s) => s.mods);
  const phase = useGame((s) => s.phase);
  const title = useGame((s) => sceneById(s.campaign)?.title ?? "");
  if (phase !== "play" || !title) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-48">
      <div className="max-w-md rounded-sm border border-line bg-bg-raised/90 px-3 py-1 text-center">
        <p className="font-display text-sm tracking-[0.14em] text-fg">{title}</p>
        {mods.length > 0 && <p className="text-[11px] text-lcd">{mods.map((m) => MODIFIERS[m].label).join(" · ")}</p>}
      </div>
    </div>
  );
}

function InspectBar() {
  const name = useGame((s) => s.bomb?.modules.find((m) => m.id === s.inspectId)?.name ?? "");
  const blurb = useGame((s) => {
    const mod = s.bomb?.modules.find((m) => m.id === s.inspectId);
    return mod ? MODULE_BLURB[mod.kind] : "";
  });
  const setInspect = useGame((s) => s.setInspect);
  if (!name) return null;
  return (
    <div className="pointer-events-auto absolute left-3 top-3 max-w-xs rounded-sm border border-accent bg-bg-raised/95 p-2">
      <p className="text-[10px] tracking-[0.2em] text-lcd">ISPEZIONE</p>
      <p className="font-display tracking-[0.14em] text-fg">{name}</p>
      <p className="mt-1 text-xs text-muted">{blurb}</p>
      <button type="button" onClick={() => setInspect(null)} className="mt-2 h-9 w-full rounded-sm border border-line text-xs text-fg">
        Torna al banco (Esc)
      </button>
    </div>
  );
}

function BridgeMeter() {
  const phase = useGame((s) => s.phase);
  const bridge = useGame((s) => s.bridge);
  const hot = useGame((s) => s.bridgeHot);
  if (phase !== "play") return null;
  const pct = Math.round(Math.min(1, bridge) * 100);
  return (
    <div className="pointer-events-none absolute right-3 top-3 w-40 rounded-sm border border-line bg-bg-raised/90 p-2">
      <p className="text-xs text-muted">Ponte di scena</p>
      <div className="mt-1 h-1.5 bg-surface">
        <div className={`h-full ${hot || bridge > 0.5 ? "bg-accent" : "bg-lcd"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-1 text-[10px] tracking-widest ${hot ? "text-accent" : "text-muted"}`}>
        {hot ? "IN SALITA" : "TENUTO"} · {pct}%
      </p>
    </div>
  );
}

function TiltGauge() {
  const ratio = useGame((s) => {
    return s.tool === "maneggio" ? tiltRatio(s) : 0;
  });
  const tool = useGame((s) => s.tool);
  if (tool !== "maneggio" || ratio <= 0) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 w-36 -translate-x-1/2 rounded-sm border border-line bg-bg-raised/90 p-2">
      <p className="text-xs text-muted">Grano di scena</p>
      <div className="mt-1 h-1.5 bg-surface">
        <div className={`h-full ${ratio > 0.75 ? "bg-accent" : "bg-lcd"}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  );
}

function Dossier() {
  const open = useGame((s) => s.dossier);
  const phase = useGame((s) => s.phase);
  const bomb = useGame((s) => s.bomb);
  const selectedId = useGame((s) => s.selectedId);
  const dispatch = useGame((s) => s.dispatch);
  const toggleDossier = useGame((s) => s.toggleDossier);
  const known = useGame((s) => s.knownWireIds);
  const notebook = useGame((s) => s.notebook);
  const toggleNotebook = useGame((s) => s.toggleNotebook);
  if (phase === "boot" || !bomb) return null;

  const wire = findWire(bomb, selectedId);
  const module = bomb.modules.find((m) => m.id === selectedId);
  const wireKnown = !!wire && known.includes(wire.id);

  return (
    <aside
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[58%] overflow-y-auto border-line bg-bg-raised/95 p-3 md:static md:inset-auto md:block md:max-h-none md:w-80 md:border-l ${open ? "block" : "hidden md:block"}`}
    >
      <div className="mb-2 flex items-center justify-between md:hidden">
        <p className="font-display tracking-widest text-fg">SCHEDA</p>
        <button type="button" onClick={toggleDossier} className="grid size-11 place-items-center text-muted" aria-label="Chiudi scheda">
          <X className="size-4" />
        </button>
      </div>
      <p className="font-display tracking-[0.14em] text-fg">{wire ? colorName(wire.color) : module ? module.name : "Banco di scena"}</p>
      <p className="mt-1 text-sm text-muted">
        {wire
          ? wireKnown
            ? `${terminalLabel(wire.a)} → ${terminalLabel(wire.b)}`
            : "Capi non ancora letti. Seguilo sul banco e sonda i due morsetti."
          : module
            ? MODULE_BLURB[module.kind]
            : `${ARCHETYPES[bomb.archetype].blurb} Trascina per orbitare, pizzica o usa la rotella per lo zoom.`}
      </p>
      <p className="mt-2 text-xs text-lcd">{fitLine(bomb, selectedId)}</p>
      {wire && <WireFacts id={wire.id} />}
      {module && (
        <button
          type="button"
          onClick={() => useGame.getState().setInspect(module.id)}
          className="mt-2 h-10 w-full rounded-sm border border-line text-xs text-fg"
        >
          Ispeziona da vicino
        </button>
      )}
      {module?.kind === "keypad" && <KeypadPad />}
      {module?.kind === "dial" && <DialPad />}
      {module?.kind === "receiver" && <ListenButton />}
      <Contacts />
      <div className="mt-3 flex flex-wrap gap-1">
        {bomb.modules.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => dispatch({ type: "select", id: item.id })}
            className={`rounded-sm border px-2 py-1 text-xs ${selectedId === item.id ? "border-accent text-fg" : "border-line text-muted"}`}
          >
            {item.name}
          </button>
        ))}
      </div>
      <button type="button" onClick={toggleNotebook} className="mt-3 h-10 w-full rounded-sm border border-line text-xs text-fg">
        {notebook ? "Chiudi il taccuino (T)" : "Apri il taccuino: schema del circuito (T)"}
      </button>
      <CodePad />
      <Notes />
      <Radio />
      {phase === "play" && (
        <button type="button" onClick={() => dispatch({ type: "abort" })} className="mt-2 h-10 w-full text-xs text-faint">
          Abbandona la scena
        </button>
      )}
    </aside>
  );
}

function Contacts() {
  const bomb = useGame((s) => s.bomb);
  const selectedId = useGame((s) => s.selectedId);
  const dispatch = useGame((s) => s.dispatch);
  if (!bomb) return null;
  const module = bomb.modules.find((item) => item.id === selectedId);
  const wire = findWire(bomb, selectedId);
  const terminals = module?.terminals ?? (selectedId === "chassis" || !module ? bomb.chassisTerminals : []);
  return (
    <div className="mt-3 space-y-1">
      {terminals.map((terminal) => (
        <button
          key={terminal.id}
          type="button"
          onClick={() => dispatch({ type: "pointer-terminal", id: terminal.id })}
          className="h-11 w-full rounded-sm border border-line px-2 text-left text-xs text-fg"
        >
          Morsetto {terminal.label}
        </button>
      ))}
      {wire && (
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "tool", tool: "tronchese" });
            dispatch({ type: "pointer-wire", id: wire.id });
          }}
          className="h-11 w-full rounded-sm border border-accent text-sm text-fg"
        >
          Taglia questo filo
        </button>
      )}
      {wire && (
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "tool", tool: "nastro" });
            dispatch({ type: "pointer-wire", id: wire.id });
          }}
          className="h-11 w-full rounded-sm border border-line text-sm text-muted"
        >
          Nastro su questo filo
        </button>
      )}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "tool", tool: "cacciavite" });
            dispatch({ type: "pointer-latch" });
          }}
          className="h-11 flex-1 rounded-sm border border-line text-xs text-muted"
        >
          Chiusure
        </button>
        {bomb.gates.tilt && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "tool", tool: "brugola" });
              dispatch({ type: "pointer-tilt" });
            }}
            className="h-11 flex-1 rounded-sm border border-line text-xs text-muted"
          >
            Brugola
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 pt-1">
        {bomb.wires.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => dispatch({ type: "select", id: item.id })}
            className={`h-11 rounded-sm border px-2 text-xs ${selectedId === item.id ? "border-accent text-fg" : "border-line text-muted"}`}
            style={{ borderLeftColor: colorHex(item.color), borderLeftWidth: 3 }}
          >
            {colorName(item.color)}
          </button>
        ))}
      </div>
    </div>
  );
}

function WireFacts({ id }: { id: string }) {
  const known = useGame((s) => s.knownWireIds.includes(id));
  const cut = useGame((s) => s.cutIds.includes(id));
  const marked = useGame((s) => s.markedIds.includes(id));
  const bomb = useGame((s) => s.bomb);
  // Selected one by one: a selector that builds a fresh object makes zustand re-render forever.
  const cutIds = useGame((s) => s.cutIds);
  const jumpers = useGame((s) => s.jumpers);
  const codeUnlocked = useGame((s) => s.codeUnlocked);
  const capDumped = useGame((s) => s.capDumped);
  const view: NetView = { cutIds, jumpers, codeUnlocked, capDumped };
  const wire = bomb?.wires.find((w) => w.id === id);
  if (!wire || !bomb) return null;
  return (
    <div className="mt-3 border border-line p-2 text-sm">
      <p className="flex items-center gap-2 text-fg">
        <span className="inline-block size-3 rounded-sm" style={{ background: colorHex(wire.color) }} />
        {cut ? "Tagliato" : "Integro"}
        {wire.diode ? " · perla" : ""}
        {marked ? " · nastro" : ""}
      </p>
      <p className="mt-1 text-muted">
        {known ? wireSeat(bomb, view, wire.id) : "Non misurato. Due sonde agli estremi di questo tratto, non agli estremi del percorso."}
      </p>
    </div>
  );
}

function KeypadPad() {
  const entry = useGame((s) => s.keypad);
  const unlocked = useGame((s) => s.codeUnlocked);
  const dispatch = useGame((s) => s.dispatch);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];
  return (
    <div className="mt-3">
      <p className="lcd-readout text-xl">{unlocked ? "APERTO" : entry.padEnd(4, "·")}</p>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            disabled={unlocked}
            onClick={() => dispatch({ type: "keypad", key })}
            className="h-11 rounded-sm border border-line bg-surface text-sm text-fg"
          >
            {key === "C" ? "Canc" : key}
          </button>
        ))}
      </div>
    </div>
  );
}

function DialPad() {
  const digits = useGame((s) => s.dialDigits);
  const dispatch = useGame((s) => s.dispatch);
  return (
    <div className="mt-3 flex gap-2">
      {digits.map((n, i) => (
        <div key={i} className="flex flex-1 flex-col gap-1">
          <button type="button" className="h-11 border border-line text-fg" onClick={() => dispatch({ type: "dial", index: i as 0 | 1 | 2, dir: 1 })}>
            +
          </button>
          <p className="lcd-readout text-center text-xl">{n}</p>
          <button type="button" className="h-11 border border-line text-fg" onClick={() => dispatch({ type: "dial", index: i as 0 | 1 | 2, dir: -1 })}>
            −
          </button>
        </div>
      ))}
    </div>
  );
}

function ListenButton() {
  const left = useGame((s) => s.listenLeft);
  const dispatch = useGame((s) => s.dispatch);
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({ type: "tool", tool: "stetoscopio" });
        dispatch({ type: "listen" });
      }}
      className="mt-3 h-11 w-full rounded-sm bg-accent text-sm text-fg"
    >
      {left > 0 ? "In ascolto: conta i battiti…" : "Stetoscopio sull'antenna"}
    </button>
  );
}

const PAD_HINT = ["UV", "lampi", "battiti", "fili"];

/**
 * The accomplice on the radio, with the builder's drawings in front of them. Facts about the
 * scene for a few seconds each; the prompter's line, which says what to do, costs more.
 */
function Radio() {
  const dispatch = useGame((s) => s.dispatch);
  const bomb = useGame((s) => s.bomb);
  const asked = useGame((s) => s.asked);
  const hints = useGame((s) => s.hintsUsed);
  const phase = useGame((s) => s.phase);
  const dead = useGame((s) => s.mods.includes("suggeritore-muto"));
  const free = useGame((s) => s.mode !== "ripresa");
  const freeHint = useGame((s) => s.mods.includes("suggeritore-gratis"));
  // Changes with the antenna and the rules, not with the clock.
  const cost = useGame((s) => radioCost(s));
  const antenna = useGame((s) => antennaLive(s) && s.mode === "ripresa");
  if (!bomb || phase !== "play") return null;
  return (
    <div className="mt-3 border border-line p-2">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xs tracking-widest text-lcd">RADIO · REGIA</p>
        <p className="text-[10px] text-faint">{dead ? "solo fruscio" : free ? "in prova non costa" : `−${cost} s a domanda`}</p>
      </div>
      {antenna && !dead && <p className="mt-1 text-[11px] text-accent">L'antenna è in ascolto: ogni chiamata la sveglia.</p>}
      <div className="mt-2 flex flex-col gap-1">
        {RADIO_ASKS.map((q) => {
          const done = asked.includes(q.id);
          return (
            <div key={q.id}>
              <button
                type="button"
                disabled={dead}
                onClick={() => dispatch({ type: "radio", ask: q.id })}
                className={`h-8 w-full rounded-sm border px-2 text-left text-xs ${done ? "border-line text-muted" : "border-line text-fg"} disabled:text-faint`}
              >
                {q.label}
              </button>
              {done && <p className="border-l border-lcd px-2 py-1 font-serif text-xs italic text-lcd">«{radioAnswer(bomb, q.id)}»</p>}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={dead || hints >= 4}
        onClick={() => dispatch({ type: "hint" })}
        className="mt-2 h-9 w-full rounded-sm border border-lcd text-xs text-lcd disabled:border-line disabled:text-faint"
      >
        E adesso che faccio? {free || freeHint ? "" : "(−18 s)"}
      </button>
    </div>
  );
}

/** Four boxes to jot the digits as you find them. Yours to fill: nothing here is checked. */
function CodePad() {
  const pad = useGame((s) => s.codePad);
  const setPad = useGame((s) => s.setPad);
  const keypad = useGame((s) => !!s.bomb?.gates.keypad && !s.codeUnlocked);
  if (!keypad) return null;
  return (
    <div className="mt-3 border border-line p-2">
      <p className="text-[10px] tracking-[0.2em] text-lcd">TACCUINO DEL CODICE</p>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {pad.map((value, i) => (
          <label key={i} className="block text-center text-[10px] text-muted">
            <input
              value={value}
              onChange={(e) => setPad(i, e.target.value)}
              inputMode="numeric"
              aria-label={`Cifra ${i + 1} (${PAD_HINT[i]})`}
              className="lcd-readout h-11 w-full border border-line bg-bg text-center text-xl outline-none focus:border-accent"
            />
            {PAD_HINT[i]}
          </label>
        ))}
      </div>
    </div>
  );
}

function Notes() {
  const notes = useGame((s) => s.notes);
  if (!notes.length) return <p className="mt-3 text-xs text-faint">Gli appunti compaiono qui: le letture del multimetro e i suggerimenti. Le cifre le annoti tu, nel taccuino.</p>;
  return (
    <ul className="mt-3 space-y-1 text-xs text-muted">
      {notes.map((n) => (
        <li key={n} className="border-l border-lcd pl-2">
          {n}
        </li>
      ))}
    </ul>
  );
}

function LogBar() {
  const log = useGame((s) => s.log);
  const last = log.slice(-2);
  return (
    <div className="z-20 flex h-14 shrink-0 items-center gap-4 overflow-hidden border-t border-line bg-bg px-3 text-xs md:h-12 md:px-4 md:text-sm">
      {last.length === 0 && <span className="text-faint">Il registro di scena è vuoto.</span>}
      {last.map((line) => (
        <span key={line.id} className={line.tone === "bad" ? "text-accent" : line.tone === "good" ? "text-ok" : line.tone === "warn" ? "text-lcd" : "text-muted"}>
          {line.text}
        </span>
      ))}
    </div>
  );
}

function Boot() {
  const dispatch = useGame((s) => s.dispatch);
  const toggleArchive = useGame((s) => s.toggleArchive);
  const [seed, setSeed] = useState("CIAK01");
  const [difficulty, setDifficulty] = useState<Difficulty>("caratterista");
  const [mode, setMode] = useState<Mode>("ripresa");
  const openPanel = useGame((s) => s.openPanel);
  const performer = useGame((s) => activeProfile(s.save).name);
  const toggleFilm = useGame((s) => s.toggleFilm);
  const filmDone = useGame((s) => filmProgress(activeProfile(s.save).runs).filter((p) => p.done).length);
  const daily = dailySeed(new Date());
  const bestChain = useGame((s) => chainResults(activeProfile(s.save).runs)[0]?.scenes ?? 0);

  useEffect(() => {
    setSeed(randomSeed());
  }, []);

  return (
    <section className="pointer-events-auto max-h-[70dvh] w-full max-w-xl overflow-y-auto rounded-md border border-line bg-bg-raised/95 p-4 md:max-h-full md:p-5">
      <p className="text-xs tracking-[0.22em] text-lcd">PROTOCOLLO DI SCENA</p>
      <h1 className="font-display text-4xl leading-none tracking-wide text-fg md:text-5xl">ULTIMO TAGLIO</h1>
      <p className="mt-2 text-sm text-muted">
        Un ordigno da film, diverso a ogni seme. Si orbita, si apre, si misura, si taglia. Nessun colore è una regola.
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-sm border border-line px-3 py-2">
        <p className="min-w-0 truncate text-sm text-muted">
          Interprete: <span className="text-fg">{performer}</span>
        </p>
        <button type="button" onClick={() => openPanel("camerino")} className="h-9 shrink-0 rounded-sm border border-line px-3 text-xs text-lcd">
          Cambia interprete
        </button>
      </div>
      <button
        type="button"
        onClick={toggleFilm}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-sm border border-accent bg-surface p-3 text-left"
      >
        <span>
          <span className="block font-display text-lg tracking-[0.14em] text-fg">IL FILM</span>
          <span className="block text-sm text-muted">Dodici scene in tre atti, ognuna con la sua regola.</span>
        </span>
        <span className="lcd-readout shrink-0 text-sm">
          {filmDone} / 12
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          const chain = firstLink(randomSeed());
          dispatch({ type: "start", seed: chainSeed(chain.id, 0), difficulty: chainDifficulty(0), mode: "ripresa", chain });
        }}
        className="mt-2 flex w-full items-center justify-between gap-3 rounded-sm border border-line bg-surface p-3 text-left"
      >
        <span>
          <span className="block font-display text-lg tracking-[0.14em] text-fg">PIANO SEQUENZA</span>
          <span className="block text-sm text-muted">Una scena dopo l'altra, senza stacchi: sempre più difficili, sempre più corte. Il tempo che avanzi ti segue.</span>
        </span>
        <span className="lcd-readout shrink-0 text-sm">{bestChain ? `record ${bestChain}` : "—"}</span>
      </button>
      <p className="mt-4 text-[10px] tracking-[0.2em] text-muted">SCENA LIBERA</p>
      <div className="mt-1 grid gap-2">
        {(Object.keys(DIFFICULTY_COPY) as Difficulty[]).map((id) => {
          const copy = DIFFICULTY_COPY[id]!;
          const on = difficulty === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setDifficulty(id)}
              className={`rounded-sm border p-3 text-left ${on ? "border-accent bg-surface" : "border-line"}`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display tracking-wide text-fg">{copy.label}</span>
                <span className="lcd-readout text-sm">{formatClock(TUNING[id].seconds).replace(/^0/, "")}</span>
              </span>
              <span className="mt-1 block text-sm text-muted">{copy.text}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("ripresa")}
          className={`h-11 flex-1 rounded-sm border text-sm ${mode === "ripresa" ? "border-accent text-fg" : "border-line text-muted"}`}
        >
          Ripresa
        </button>
        <button
          type="button"
          onClick={() => setMode("prova")}
          className={`h-11 flex-1 rounded-sm border text-sm ${mode === "prova" ? "border-accent text-fg" : "border-line text-muted"}`}
        >
          Prova generale
        </button>
      </div>
      <label className="mt-3 block text-xs text-muted">
        Seme
        <div className="mt-1 flex gap-2">
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value.toUpperCase())}
            className="h-11 min-w-0 flex-1 border border-line bg-bg px-3 font-mono text-sm text-fg outline-none"
            maxLength={12}
            spellCheck={false}
          />
          <button type="button" onClick={() => setSeed(randomSeed())} className="h-11 border border-line px-3 text-sm text-muted">
            Nuovo
          </button>
        </div>
      </label>
      <button
        type="button"
        onClick={() => dispatch({ type: "start", seed, difficulty, mode })}
        className="mt-3 h-12 w-full rounded-sm bg-accent font-display text-lg tracking-[0.18em] text-fg"
      >
        AZIONE
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: "start", seed: daily, difficulty: "caratterista", mode: "ripresa" })}
        className="mt-2 h-11 w-full rounded-sm border border-line text-sm text-fg"
      >
        Scena del giorno · {daily}
      </button>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => openPanel("carriera")} className="h-11 flex-1 text-sm text-lcd">
          Registro e statistiche
        </button>
        <button type="button" onClick={toggleArchive} className="h-11 flex-1 text-sm text-lcd">
          Archivio di scena
        </button>
      </div>
      <p className="mt-3 text-xs text-faint">{DISCLAIMER}</p>
    </section>
  );
}

function EndCard() {
  const phase = useGame((s) => s.phase);
  const reason = useGame((s) => s.endReason);
  const seed = useGame((s) => s.seed);
  const difficulty = useGame((s) => s.difficulty);
  const mode = useGame((s) => s.mode);
  const seconds = useGame((s) => s.secondsLeft);
  const dispatch = useGame((s) => s.dispatch);
  const run = useGame((s) => s.lastRun);
  const newAwards = useGame((s) => s.newAwards);
  const openPanel = useGame((s) => s.openPanel);
  const mods = useGame((s) => s.mods);
  const campaign = useGame((s) => s.campaign);
  const cause = useGame((s) => s.endCause);
  const toggleFilm = useGame((s) => s.toggleFilm);
  const chain = useGame((s) => s.chain);
  // Select the register itself and derive from it: a selector that builds a new object every read loops forever.
  const runs = useGame((s) => activeProfile(s.save).runs);
  const chainSoFar = useMemo(() => (chain ? chainResults(runs).find((c) => c.id === chain.id) : undefined), [runs, chain]);
  const ok = phase === "safe";
  const link = chain && ok ? nextLink(chain, seconds) : null;
  const scene = sceneById(campaign);
  const next = scene && ok ? nextScene(scene.id) : undefined;
  return (
    <section className="pointer-events-auto w-full max-w-md rounded-md border border-line bg-bg-raised p-4">
      <p className="font-display text-3xl tracking-wide text-fg">{ok ? "DISINNESCATO" : "FINE RULLO"}</p>
      <p className="mt-2 text-sm text-muted">{reason}</p>
      {scene && (
        <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm text-fg">
          <p className="text-[10px] tracking-[0.2em] text-muted">IL REGISTA</p>
          <p>«{ok ? scene.wrap : stopLine(cause ?? "altro")}»</p>
          {ok && run && <p className="mt-1 text-xs text-lcd">{ciakOf(run.grade)} ciak su 3</p>}
        </blockquote>
      )}
      {chain && (
        <div className="mt-3 border-l-2 border-lcd pl-3 text-sm text-fg">
          <p className="text-[10px] tracking-[0.2em] text-muted">PIANO SEQUENZA</p>
          {ok && link ? (
            <p>
              Scena {chain.index + 1} in macchina. Nessuno stacco: la prossima è da {DIFFICULTY_COPY[chainDifficulty(link.index)]!.label.toLowerCase()}
              {link.carry ? `, e ti porti dietro ${link.carry} secondi.` : "."}
            </p>
          ) : (
            <p>
              Stacco. Il piano sequenza si chiude a {chainSoFar?.scenes ?? 0} {chainSoFar?.scenes === 1 ? "scena" : "scene"}
              {chainSoFar?.score ? `, ${chainSoFar.score.toLocaleString("it-IT")} punti.` : "."}
            </p>
          )}
        </div>
      )}
      {run && ok && (
        <div className="mt-3 flex items-end justify-between gap-3 border-y border-line py-2">
          <div>
            <p className="text-[10px] tracking-[0.18em] text-muted">VOTO DELLA CRITICA</p>
            <p className="font-display text-xl tracking-wide text-ok">{GRADES[run.grade].label}</p>
          </div>
          {mode === "ripresa" && (
            <div className="text-right">
              <p className="text-[10px] tracking-[0.18em] text-muted">PUNTEGGIO</p>
              <p className="lcd-readout text-2xl">{run.score.toLocaleString("it-IT")}</p>
            </div>
          )}
        </div>
      )}
      {run && (
        <p className="mt-2 text-xs text-muted">
          {run.probes} misure · {run.hints} suggerimenti · {run.mistakes} errori · {run.lost} s persi in penalità
        </p>
      )}
      {newAwards.map((id) => {
        const award = AWARDS.find((a) => a.id === id);
        return award ? (
          <p key={id} className="mt-2 rounded-sm border border-ok px-2 py-1 text-sm text-ok">
            Premio: {award.title}
          </p>
        ) : null;
      })}
      <p className="mt-2 font-mono text-sm text-lcd">
        {seed} · {ok ? formatClock(seconds) : "00:00"} · {mode === "prova" ? "prova" : "ripresa"}
      </p>
      <div className="mt-4 flex gap-2">
        {chain ? (
          <button
            type="button"
            className="h-11 flex-1 rounded-sm bg-accent text-sm text-fg"
            onClick={() => {
              const go = link ?? firstLink(randomSeed());
              dispatch({ type: "start", seed: chainSeed(go.id, go.index), difficulty: chainDifficulty(go.index), mode: "ripresa", chain: go });
            }}
          >
            {link ? "Prossima scena, senza stacco" : "Nuovo piano sequenza"}
          </button>
        ) : (
          <button
            type="button"
            className="h-11 flex-1 rounded-sm bg-accent text-sm text-fg"
            onClick={() => dispatch({ type: "start", seed, difficulty, mode, mods, campaign: campaign ?? undefined })}
          >
            {scene ? "Rigira la scena" : "Stesso seme"}
          </button>
        )}
        {chain ? null : scene ? (
          <button
            type="button"
            className="h-11 flex-1 rounded-sm border border-line text-sm text-fg"
            onClick={() =>
              next
                ? dispatch({ type: "start", seed: next.seed, difficulty: next.difficulty, mode: "ripresa", mods: next.mods, campaign: next.id })
                : toggleFilm()
            }
          >
            {next ? "Scena successiva" : "Torna al film"}
          </button>
        ) : (
          <button
            type="button"
            className="h-11 flex-1 rounded-sm border border-line text-sm text-fg"
            onClick={() => dispatch({ type: "start", seed: randomSeed(), difficulty, mode })}
          >
            Nuova scena
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className="h-11 flex-1 text-sm text-lcd" onClick={() => openPanel("partita")}>
          Titoli di coda
        </button>
        <button type="button" className="h-11 flex-1 text-sm text-muted" onClick={() => dispatch({ type: "abort" })}>
          Torna in sala prova
        </button>
      </div>
    </section>
  );
}

function Archive() {
  const toggleArchive = useGame((s) => s.toggleArchive);
  const bomb = useGame((s) => s.bomb);
  const [id, setId] = useState(ARTICLES[0]!.id);
  const article = ARTICLES.find((item) => item.id === id) ?? ARTICLES[0]!;
  useEffect(() => {
    markRead(article.id);
  }, [article.id]);

  return (
    <div className="fixed inset-0 z-30 flex items-stretch justify-center bg-bg/90 p-2 md:p-6">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-md border border-line bg-bg-raised md:flex-row">
        <div className="flex items-center justify-between border-b border-line p-3 md:hidden">
          <p className="font-display tracking-widest">ARCHIVIO</p>
          <button type="button" className="grid size-11 place-items-center" onClick={toggleArchive} aria-label="Chiudi archivio">
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-line p-2 md:w-64 md:flex-col md:overflow-y-auto md:border-r md:border-b-0">
          {bomb && (
            <button type="button" onClick={() => setId("questa")} className={`h-11 shrink-0 rounded-sm px-3 text-left text-sm ${id === "questa" ? "bg-surface text-fg" : "text-muted"}`}>
              Questa sequenza
            </button>
          )}
          {ARTICLES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setId(item.id)}
              className={`h-11 shrink-0 rounded-sm px-3 text-left text-sm ${id === item.id ? "bg-surface text-fg" : "text-muted"}`}
            >
              {item.title}
            </button>
          ))}
        </nav>
        <article className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mb-4 hidden items-start justify-between md:flex">
            <p className="text-xs tracking-[0.2em] text-lcd">ARCHIVIO DI SCENA</p>
            <button type="button" className="grid size-11 place-items-center text-muted" onClick={toggleArchive} aria-label="Chiudi archivio">
              <X className="size-4" />
            </button>
          </div>
          {id === "questa" && bomb ? <Sequence /> : <ArticleView id={article.id} />}
        </article>
      </div>
    </div>
  );
}

function ArticleView({ id }: { id: string }) {
  const article = ARTICLES.find((item) => item.id === id) ?? ARTICLES[0]!;
  return (
    <>
      <p className="text-xs tracking-[0.18em] text-lcd">{article.kicker}</p>
      <h2 className="font-display text-3xl tracking-wide text-fg">{article.title}</h2>
      <div className="mt-3 space-y-3 text-sm text-muted">
        {article.body.map((para) => (
          <p key={para}>{para}</p>
        ))}
      </div>
      <p className="mt-6 text-xs text-faint">{DISCLAIMER}</p>
    </>
  );
}

function Sequence() {
  const bomb = useGame((s) => s.bomb);
  const known = useGame((s) => s.knownWireIds);
  const marked = useGame((s) => s.markedIds);
  const notes = useGame((s) => s.notes);
  const progress = useGame((s) =>
    s.bomb
      ? `${s.phase}|${s.pressureShunted}|${s.lidOpen}|${s.tiltLocked}|${s.capDumped}|${s.codeUnlocked}|${s.dialMatched}`
      : "",
  );
  const list = progress ? stages(useGame.getState()) : [];
  if (!bomb) return null;
  return (
    <>
      <p className="text-xs tracking-[0.18em] text-lcd">SEQUENZA</p>
      <h2 className="font-display text-3xl text-fg">{bomb.title}</h2>
      <p className="mt-1 text-sm text-muted">
        Seme {bomb.seed}. {ARCHETYPES[bomb.archetype].blurb}
      </p>
      <ul className="mt-4 space-y-1 text-sm">
        {list.map((stage) => (
          <li key={stage.id} className={stage.done ? "text-ok" : "text-muted"}>
            {stage.done ? "Fatto" : stage.optional ? "Opzionale" : "Aperto"} — {stage.label}
          </li>
        ))}
      </ul>
      <h3 className="mt-5 font-display tracking-wide text-fg">Tratti</h3>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {bomb.wires.map((wire) => (
          <li key={wire.id}>
            {colorName(wire.color)}:{" "}
            {known.includes(wire.id) ? `${terminalLabel(wire.a)} → ${terminalLabel(wire.b)}` : "non misurato"}
            {wire.diode ? " · perla" : ""}
            {marked.includes(wire.id) ? " · nastro" : ""}
          </li>
        ))}
      </ul>
      <h3 className="mt-5 font-display tracking-wide text-fg">Appunti</h3>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {notes.length === 0 && <li>Ancora niente. UV, multimetro, decodifica.</li>}
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-faint">{DISCLAIMER}</p>
    </>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-11 place-items-center rounded-sm border border-line text-fg">
      {children}
    </button>
  );
}

function RailButton({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-11 w-full place-items-center rounded-sm border text-fg disabled:opacity-40 ${active ? "border-accent bg-accent-dim" : "border-line text-muted"}`}
    >
      {children}
    </button>
  );
}
