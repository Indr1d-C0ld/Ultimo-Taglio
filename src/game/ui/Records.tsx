import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DIFFICULTY_COPY } from "../catalog";
import { ARCHETYPES } from "../generate";
import { formatClock } from "../logic";
import { activeProfile, exportProfile, hallOfFame, standings } from "../save";
import {
  AWARDS,
  CAUSE_LABEL,
  GRADES,
  careerOf,
  dayKey,
  earnedAwards,
  formatSpan,
  scoreSheet,
  type RunRecord,
} from "../stats";
import { useGame, type Panel } from "../store";
import type { Archetype, Difficulty } from "../types";

const TABS: { id: Panel; label: string }[] = [
  { id: "partita", label: "Scheda di scena" },
  { id: "carriera", label: "Carriera" },
  { id: "fama", label: "Hall of fame" },
  { id: "graduatoria", label: "Graduatoria" },
  { id: "premi", label: "Premi" },
  { id: "camerino", label: "Camerino" },
];

const STAGE_LABEL: Record<string, string> = {
  sw: "Sicura copertura",
  open: "Apertura",
  tilt: "Blocco grano",
  cap: "Scarica di scena",
  code: "Codice",
  dial: "Contatore B",
  cut: "Taglio inibitore",
};
const STAGE_ORDER = ["sw", "open", "tilt", "cap", "code", "dial", "cut"];

const points = (n: number) => n.toLocaleString("it-IT");
const percent = (n: number) => `${Math.round(n * 100)}%`;
const when = (at: number) =>
  new Date(at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Records() {
  const panel = useGame((s) => s.panel);
  const openPanel = useGame((s) => s.openPanel);
  const closePanel = useGame((s) => s.closePanel);
  const name = useGame((s) => activeProfile(s.save).name);
  if (!panel) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-bg/90 p-2 md:p-6">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-md border border-line bg-bg-raised">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <div className="min-w-0">
            <p className="font-display text-lg tracking-[0.18em] text-fg">REGISTRO DI SCENA</p>
            <p className="truncate text-xs text-muted">Interprete: {name}</p>
          </div>
          <button type="button" className="grid size-11 place-items-center text-muted" onClick={closePanel} aria-label="Chiudi registro">
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-line p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => openPanel(tab.id)}
              className={`h-10 shrink-0 rounded-sm px-3 text-sm ${panel === tab.id ? "bg-surface text-fg" : "text-muted"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {panel === "partita" && <SceneSheet />}
          {panel === "carriera" && <CareerView />}
          {panel === "fama" && <Fame />}
          {panel === "graduatoria" && <Standings />}
          {panel === "premi" && <Awards />}
          {panel === "camerino" && <DressingRoom />}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="rounded-sm border border-line bg-bg p-3">
      <p className="text-[10px] tracking-[0.18em] text-muted">{label.toUpperCase()}</p>
      <p className="lcd-readout mt-1 text-xl">{value}</p>
      {note && <p className="mt-1 text-xs text-faint">{note}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="font-display tracking-[0.14em] text-fg">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Bar({ label, value, max, tone = "bg-lcd" }: { label: string; value: number; max: number; tone?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-48 shrink-0 truncate text-muted">{label}</span>
      <span className="h-2 flex-1 bg-surface">
        <span className={`block h-full ${tone}`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="w-10 text-right font-mono text-fg">{value}</span>
    </div>
  );
}

function outcomeTone(run: RunRecord) {
  return run.outcome === "safe" ? "text-ok" : run.outcome === "boom" ? "text-accent" : "text-faint";
}

function RunRow({ run, name }: { run: RunRecord; name?: string }) {
  const openPanel = useGame((s) => s.openPanel);
  return (
    <button
      type="button"
      onClick={() => openPanel("partita", run)}
      className="flex w-full items-center gap-3 border-b border-line px-1 py-2 text-left text-sm hover:bg-surface"
    >
      <span className={`w-24 shrink-0 ${outcomeTone(run)}`}>
        {run.outcome === "safe" ? "Disinnescato" : run.outcome === "boom" ? "Fine rullo" : "Abbandonata"}
      </span>
      {name && <span className="w-28 shrink-0 truncate text-fg">{name}</span>}
      <span className="min-w-0 flex-1 truncate text-muted">
        {DIFFICULTY_COPY[run.difficulty]?.label} · {run.seed}
        {run.mode === "prova" ? " · prova" : ""}
        {run.daily ? " · scena del giorno" : ""}
      </span>
      <span className="hidden w-32 shrink-0 text-xs text-faint sm:block">{when(run.at)}</span>
      <span className="w-16 shrink-0 text-right font-mono text-lcd">{run.outcome === "safe" ? formatClock(run.left) : "––:––"}</span>
      <span className="w-16 shrink-0 text-right font-mono text-fg">{points(run.score)}</span>
    </button>
  );
}

function SceneSheet() {
  const viewRun = useGame((s) => s.viewRun);
  const lastRun = useGame((s) => s.lastRun);
  const runs = useGame((s) => activeProfile(s.save).runs);
  const run = viewRun ?? lastRun ?? runs.at(-1) ?? null;
  if (!run) return <p className="text-sm text-muted">Ancora nessuna scena a registro. Gira la prima e torna qui.</p>;
  const sheet = scoreSheet(run);
  const grade = GRADES[run.grade];
  const marks = STAGE_ORDER.filter((id) => run.stageAt[id] !== undefined);
  const sameSeed = runs.filter((r) => r.seed === run.seed && r.difficulty === run.difficulty && r.mode === "ripresa" && r.outcome === "safe");
  const seedBest = sameSeed.length ? Math.max(...sameSeed.map((r) => r.score)) : 0;
  return (
    <>
      <p className="text-xs tracking-[0.18em] text-lcd">
        {when(run.at)} · {run.mode === "prova" ? "PROVA GENERALE" : "RIPRESA"}
        {run.daily ? " · SCENA DEL GIORNO" : ""}
      </p>
      <h2 className={`font-display text-3xl tracking-wide ${outcomeTone(run)}`}>
        {run.outcome === "safe" ? grade.label : run.outcome === "boom" ? "Fine rullo" : "Scena abbandonata"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {run.outcome === "safe" ? grade.line : run.reason} {ARCHETYPES[run.archetype].name}, {DIFFICULTY_COPY[run.difficulty]?.label.toLowerCase()}, seme {run.seed}.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Punteggio" value={points(run.score)} note={seedBest > run.score ? `Record su questo seme: ${points(seedBest)}` : undefined} />
        <Tile label="Sul display" value={run.outcome === "safe" ? formatClock(run.left) : "00:00"} note={`su ${formatClock(run.budget)}`} />
        <Tile label="Durata reale" value={formatSpan(run.elapsed)} />
        <Tile label="Secondi persi" value={run.lost} note="penalità, ping, suggerimenti" />
        <Tile label="Misure" value={run.probes} note={`${Math.min(run.wiresRead, run.wires)} fili letti su ${run.wires}`} />
        <Tile label="Tagli" value={run.lineCuts + run.decoyCuts} note={`${run.lineCuts} sulla linea, ${run.decoyCuts} a vuoto`} />
        <Tile label="Suggerimenti" value={run.hints} />
        <Tile label="Chiamate radio" value={run.calls ?? 0} />
        <Tile label="Errori" value={run.mistakes} note={`${run.wrongCodes} codici sbagliati, ${run.forced} forzature`} />
      </div>
      {sheet.length > 0 && (
        <Section title="Foglio punti">
          <ul className="max-w-md text-sm">
            {sheet.map((line) => (
              <li key={line.label} className="flex justify-between border-b border-line py-1">
                <span className="text-muted">{line.label}</span>
                <span className={`font-mono ${line.points < 0 ? "text-accent" : "text-fg"}`}>
                  {line.points > 0 ? "+" : ""}
                  {points(line.points)}
                </span>
              </li>
            ))}
            <li className="flex justify-between py-1 font-display tracking-wide text-fg">
              <span>Totale</span>
              <span className="font-mono text-lcd">{points(run.score)}</span>
            </li>
          </ul>
        </Section>
      )}
      {run.mode === "prova" && run.outcome === "safe" && (
        <p className="mt-4 text-sm text-faint">Le prove generali restano a registro ma non fanno punteggio né graduatoria.</p>
      )}
      <Section title="Cronologia delle fasi">
        {marks.length === 0 ? (
          <p className="text-sm text-muted">Nessuna fase completata.</p>
        ) : (
          <div className="space-y-1">
            {marks.map((id) => (
              <Bar key={id} label={`${STAGE_LABEL[id] ?? id} — ${formatSpan(run.stageAt[id]!)}`} value={Math.round(run.stageAt[id]!)} max={Math.max(run.elapsed, 1)} tone="bg-ok" />
            ))}
          </div>
        )}
      </Section>
      <Section title="Dettagli di scena">
        <ul className="grid gap-x-6 gap-y-1 text-sm text-muted md:grid-cols-2">
          <li>Causa di chiusura: <span className="text-fg">{CAUSE_LABEL[run.cause]}</span></li>
          <li>Fili con l'anima interrotta: <span className="text-fg">{run.hidden}</span></li>
          <li>Ping dell'antenna subiti: <span className="text-fg">{run.pings}</span></li>
          <li>Display spento a fine scena: <span className="text-fg">{run.displayDead ? "sì" : "no"}</span></li>
          <li>Contatore B: <span className="text-fg">{run.dialMatched === null ? "non in scena" : run.dialMatched ? "allineato" : "ignorato"}</span></li>
          <li>Secondo timer: <span className="text-fg">{run.twin == null ? "non in scena" : run.twin === "prevenuto" ? "scollegato prima" : run.twin === "partito" ? "svegliato" : "mai trovato"}</span></li>
          <li>Grano d'inclinazione: <span className="text-fg">{run.tiltLocked === null ? "non in scena" : run.tiltLocked ? "bloccato" : "libero"}</span></li>
        </ul>
      </Section>
    </>
  );
}

function CareerView() {
  const runs = useGame((s) => activeProfile(s.save).runs);
  const c = careerOf(runs);
  if (!runs.length) return <p className="text-sm text-muted">La carriera comincia con la prima scena girata.</p>;
  const causeMax = Math.max(1, ...c.causes.map((x) => x.count));
  const gradeMax = Math.max(1, ...Object.values(c.grades));
  const stageIds = STAGE_ORDER.filter((id) => c.stageAverage[id] !== undefined);
  const stageMax = Math.max(1, ...stageIds.map((id) => c.stageAverage[id]!));
  const recent = [...runs].reverse().slice(0, 15);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Riprese" value={c.played} note={`${c.rehearsals} prove generali`} />
        <Tile label="Disinneschi" value={c.won} note={`${percent(c.winRate)} di successo`} />
        <Tile label="Fine rullo" value={c.lost} note={`${c.abandoned} abbandonate`} />
        <Tile label="Serie in corso" value={c.streak} note={`migliore: ${c.bestStreak}`} />
        <Tile label="Punteggio totale" value={points(c.totalScore)} />
        <Tile label="Miglior scena" value={points(c.bestScore)} note={`media ${points(c.averageScore)}`} />
        <Tile label="Tempo sul set" value={formatSpan(c.playSeconds)} />
        <Tile label="Buone la prima" value={c.cleanWins} note="senza aiuti né errori" />
        <Tile label="Più veloce" value={c.fastestWin === null ? "—" : formatSpan(c.fastestWin)} />
        <Tile label="Più al limite" value={c.closestCall === null ? "—" : formatClock(c.closestCall)} note="tempo più basso a un disinnesco" />
        <Tile label="Media sul display" value={formatClock(c.averageLeft)} />
        <Tile label="Scene del giorno" value={c.dailies} />
      </div>
      <Section title="Per difficoltà">
        <SliceTable rows={(Object.keys(c.byDifficulty) as Difficulty[]).map((id) => ({ label: DIFFICULTY_COPY[id]!.label, ...c.byDifficulty[id] }))} />
      </Section>
      <Section title="Per carrozzeria">
        <SliceTable rows={(Object.keys(c.byArchetype) as Archetype[]).map((id) => ({ label: ARCHETYPES[id].name, ...c.byArchetype[id] }))} />
      </Section>
      <Section title="Come è finita male">
        {c.causes.length === 0 ? (
          <p className="text-sm text-muted">Nessuna esplosione a registro. Per ora.</p>
        ) : (
          <div className="space-y-1">
            {c.causes.map((x) => (
              <Bar key={x.cause} label={CAUSE_LABEL[x.cause]} value={x.count} max={causeMax} tone="bg-accent" />
            ))}
          </div>
        )}
      </Section>
      <Section title="Voti della critica">
        <div className="space-y-1">
          {(Object.keys(GRADES) as (keyof typeof GRADES)[]).map((id) => (
            <Bar key={id} label={GRADES[id].label} value={c.grades[id]} max={gradeMax} tone={id === "tagliata" ? "bg-accent" : "bg-ok"} />
          ))}
        </div>
      </Section>
      <Section title="Mani e strumenti">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Tile label="Misure totali" value={c.probes} note={`${c.probesPerScene} a scena`} />
          <Tile label="Suggerimenti" value={c.hints} />
          <Tile label="Errori" value={c.mistakes} note={`${c.wrongCodes} codici sbagliati`} />
          <Tile label="Tagli a vuoto" value={c.decoyCuts} />
          <Tile label="Doppi tagli riusciti" value={c.doubleCuts} />
          <Tile label="Secondi persi" value={c.secondsLost} note="in penalità" />
          <Tile label="Ping subiti" value={c.pings} />
        </div>
      </Section>
      {stageIds.length > 0 && (
        <Section title="Quando arrivi a ogni fase (media nei disinneschi)">
          <div className="space-y-1">
            {stageIds.map((id) => (
              <Bar key={id} label={`${STAGE_LABEL[id] ?? id} — ${formatSpan(c.stageAverage[id]!)}`} value={c.stageAverage[id]!} max={stageMax} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Ultime scene">
        <div>
          {recent.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">Tocca una scena per aprirne la scheda completa.</p>
      </Section>
    </>
  );
}

function SliceTable({ rows }: { rows: { label: string; played: number; won: number; bestScore: number; bestLeft: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <thead className="text-left text-[10px] tracking-[0.18em] text-muted">
          <tr>
            <th className="py-1 font-normal"> </th>
            <th className="py-1 text-right font-normal">GIRATE</th>
            <th className="py-1 text-right font-normal">VINTE</th>
            <th className="py-1 text-right font-normal">SUCCESSO</th>
            <th className="py-1 text-right font-normal">RECORD</th>
            <th className="py-1 text-right font-normal">MIGLIOR TEMPO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <td className="py-1 text-fg">{row.label}</td>
              <td className="py-1 text-right font-mono text-muted">{row.played}</td>
              <td className="py-1 text-right font-mono text-muted">{row.won}</td>
              <td className="py-1 text-right font-mono text-muted">{row.played ? percent(row.won / row.played) : "—"}</td>
              <td className="py-1 text-right font-mono text-fg">{row.bestScore ? points(row.bestScore) : "—"}</td>
              <td className="py-1 text-right font-mono text-lcd">{row.won ? formatClock(row.bestLeft) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fame() {
  const save = useGame((s) => s.save);
  const [filter, setFilter] = useState<Difficulty | "tutte">("tutte");
  const all = hallOfFame(save, 500);
  const list = all.filter((e) => filter === "tutte" || e.run.difficulty === filter).slice(0, 10);
  const today = dayKey(new Date());
  const daily = all.filter((e) => e.run.daily === today).slice(0, 5);
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {(["tutte", "comparsa", "caratterista", "protagonista"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`h-10 rounded-sm border px-3 text-sm ${filter === id ? "border-accent text-fg" : "border-line text-muted"}`}
          >
            {id === "tutte" ? "Tutte" : DIFFICULTY_COPY[id]!.label}
          </button>
        ))}
      </div>
      <Section title="Le dieci scene migliori su questo dispositivo">
        {list.length === 0 ? (
          <p className="text-sm text-muted">Nessun disinnesco in ripresa, per ora. La parete è vuota.</p>
        ) : (
          <ol>
            {list.map((entry, i) => (
              <li key={entry.run.id} className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-display text-lg text-lcd">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <RunRow run={entry.run} name={entry.name} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title={`Scena del giorno · ${today}`}>
        {daily.length === 0 ? (
          <p className="text-sm text-muted">Nessuno l'ha ancora disinnescata oggi. È uguale per tutti: stesso seme, caratterista.</p>
        ) : (
          daily.map((entry) => <RunRow key={entry.run.id} run={entry.run} name={entry.name} />)
        )}
      </Section>
    </>
  );
}

function Standings() {
  const save = useGame((s) => s.save);
  const rows = standings(save);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left text-[10px] tracking-[0.18em] text-muted">
            <tr>
              <th className="py-1 font-normal">#</th>
              <th className="py-1 font-normal">INTERPRETE</th>
              <th className="py-1 text-right font-normal">PUNTI</th>
              <th className="py-1 text-right font-normal">RECORD</th>
              <th className="py-1 text-right font-normal">VINTE / GIRATE</th>
              <th className="py-1 text-right font-normal">SUCCESSO</th>
              <th className="py-1 text-right font-normal">SERIE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.profile.id} className={`border-t border-line ${row.profile.id === save.activeId ? "text-fg" : "text-muted"}`}>
                <td className="py-2 font-display text-lcd">{i + 1}</td>
                <td className="py-2">{row.profile.name}</td>
                <td className="py-2 text-right font-mono">{points(row.totalScore)}</td>
                <td className="py-2 text-right font-mono">{points(row.bestScore)}</td>
                <td className="py-2 text-right font-mono">
                  {row.won} / {row.played}
                </td>
                <td className="py-2 text-right font-mono">{row.played ? percent(row.winRate) : "—"}</td>
                <td className="py-2 text-right font-mono">{row.bestStreak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-faint">
        La graduatoria mette in fila gli interpreti salvati su questo dispositivo. Per confrontarti con chi gioca altrove, porta il profilo da un dispositivo all'altro dal camerino.
      </p>
    </>
  );
}

function Awards() {
  const runs = useGame((s) => activeProfile(s.save).runs);
  const earned = new Set(earnedAwards(runs));
  return (
    <>
      <p className="text-sm text-muted">
        {earned.size} premi su {AWARDS.length}.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {AWARDS.map((award) => {
          const got = earned.has(award.id);
          return (
            <div key={award.id} className={`rounded-sm border p-3 ${got ? "border-ok" : "border-line opacity-60"}`}>
              <p className={`font-display tracking-wide ${got ? "text-ok" : "text-fg"}`}>{award.title}</p>
              <p className="mt-1 text-sm text-muted">{award.text}</p>
              <p className="mt-2 text-[10px] tracking-[0.18em] text-faint">{got ? "IN BACHECA" : "DA CONQUISTARE"}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DressingRoom() {
  const save = useGame((s) => s.save);
  const phase = useGame((s) => s.phase);
  const create = useGame((s) => s.profileCreate);
  const select = useGame((s) => s.profileSelect);
  const remove = useGame((s) => s.profileDelete);
  const importCode = useGame((s) => s.profileImport);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [exported, setExported] = useState("");
  const [note, setNote] = useState("");
  const [doomed, setDoomed] = useState<string | null>(null);
  const busy = phase === "play";
  return (
    <>
      <p className="text-sm text-muted">
        Ogni interprete ha il suo registro: scene, statistiche, premi. Niente password e niente server: i profili vivono in questo browser.
      </p>
      {busy && <p className="mt-2 text-sm text-lcd">C'è una scena in corso: cambia interprete a scena chiusa.</p>}
      <Section title="Interpreti">
        <ul className="space-y-1">
          {save.profiles.map((p) => {
            const c = careerOf(p.runs);
            const on = p.id === save.activeId;
            return (
              <li key={p.id} className={`flex flex-wrap items-center gap-2 rounded-sm border p-2 ${on ? "border-accent" : "border-line"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-fg">{p.name}</p>
                  <p className="text-xs text-muted">
                    {c.won} disinneschi su {c.played} riprese · {points(c.totalScore)} punti
                  </p>
                </div>
                {on ? (
                  <span className="px-2 text-xs tracking-widest text-lcd">IN SCENA</span>
                ) : (
                  <button type="button" disabled={busy} onClick={() => select(p.id)} className="h-10 rounded-sm border border-line px-3 text-sm text-fg disabled:opacity-40">
                    Entra
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setExported(exportProfile(p));
                    setNote("");
                  }}
                  className="h-10 rounded-sm border border-line px-3 text-sm text-muted"
                >
                  Esporta
                </button>
                {doomed === p.id ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      remove(p.id);
                      setDoomed(null);
                    }}
                    className="h-10 rounded-sm bg-accent px-3 text-sm text-fg disabled:opacity-40"
                  >
                    Conferma: elimina tutto
                  </button>
                ) : (
                  <button type="button" onClick={() => setDoomed(p.id)} className="h-10 rounded-sm border border-line px-3 text-sm text-muted">
                    Elimina
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Nuovo interprete">
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            create(name);
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={18}
            placeholder="Nome d'arte"
            className="h-11 min-w-0 flex-1 border border-line bg-bg px-3 text-sm text-fg outline-none"
          />
          <button type="submit" disabled={busy || !name.trim()} className="h-11 rounded-sm bg-accent px-4 text-sm text-fg disabled:opacity-40">
            Entra in scena
          </button>
        </form>
        <p className="mt-1 text-xs text-faint">Se il nome esiste già, rientri in quel profilo.</p>
      </Section>
      {exported && (
        <Section title="Codice del profilo">
          <textarea readOnly value={exported} className="h-28 w-full border border-line bg-bg p-2 font-mono text-xs text-muted" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(exported).then(() => setNote("Copiato negli appunti."));
            }}
            className="mt-1 h-10 rounded-sm border border-line px-3 text-sm text-fg"
          >
            Copia
          </button>
        </Section>
      )}
      <Section title="Importa un profilo">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Incolla qui il codice esportato da un altro dispositivo"
          className="h-24 w-full border border-line bg-bg p-2 font-mono text-xs text-fg outline-none"
        />
        <button
          type="button"
          disabled={busy || !code.trim()}
          onClick={() => {
            const error = importCode(code);
            setNote(error ?? "Profilo importato. Se il nome esisteva già, i registri sono stati uniti.");
            if (!error) setCode("");
          }}
          className="mt-1 h-10 rounded-sm border border-line px-3 text-sm text-fg disabled:opacity-40"
        >
          Importa
        </button>
      </Section>
      {note && <p className="mt-3 text-sm text-lcd">{note}</p>}
    </>
  );
}
