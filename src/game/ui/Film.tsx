import { Clapperboard, Lock, X } from "lucide-react";
import { useState } from "react";
import { ACTS, FILM, MODIFIERS, filmProgress, type SceneProgress } from "../campaign";
import { DIFFICULTY_COPY } from "../catalog";
import { formatClock } from "../logic";
import { activeProfile } from "../save";
import { useGame } from "../store";
import { tuningFor } from "../tuning";

function Ciak({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} ciak su 3`}>
      {[1, 2, 3].map((i) => (
        <Clapperboard key={i} className={`size-4 ${i <= n ? "text-lcd" : "text-line"}`} />
      ))}
    </span>
  );
}

/** The campaign: twelve scenes in three acts, each unlocked by defusing the one before. */
export function Film() {
  const open = useGame((s) => s.film);
  const toggleFilm = useGame((s) => s.toggleFilm);
  const dispatch = useGame((s) => s.dispatch);
  const runs = useGame((s) => activeProfile(s.save).runs);
  const name = useGame((s) => activeProfile(s.save).name);
  const progress = filmProgress(runs);
  const firstOpen = [...progress].reverse().find((p) => p.unlocked) ?? progress[0]!;
  const [pick, setPick] = useState<string | null>(null);
  if (!open) return null;
  const current = progress.find((p) => p.scene.id === pick) ?? firstOpen;
  const done = progress.filter((p) => p.done).length;
  const ciak = progress.reduce((sum, p) => sum + p.ciak, 0);

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-bg/90 p-2 md:p-6">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-md border border-line bg-bg-raised">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <div className="min-w-0">
            <p className="font-display text-lg tracking-[0.18em] text-fg">IL FILM</p>
            <p className="truncate text-xs text-muted">
              {name} · {done} scene su {FILM.length} · {ciak} ciak su {FILM.length * 3}
            </p>
          </div>
          <button type="button" className="grid size-11 place-items-center text-muted" onClick={toggleFilm} aria-label="Chiudi il film">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className="max-h-[42%] overflow-y-auto border-b border-line p-2 md:max-h-none md:w-96 md:border-r md:border-b-0">
            {([1, 2, 3] as const).map((act) => (
              <div key={act} className="mb-3">
                <p className="px-2 text-[10px] tracking-[0.2em] text-lcd">{ACTS[act].title.toUpperCase()}</p>
                <p className="px-2 text-xs text-faint">{ACTS[act].line}</p>
                <ul className="mt-1 space-y-1">
                  {progress
                    .filter((p) => p.scene.act === act)
                    .map((p) => (
                      <SceneRow key={p.scene.id} p={p} on={current.scene.id === p.scene.id} onPick={() => setPick(p.scene.id)} />
                    ))}
                </ul>
              </div>
            ))}
          </nav>
          <article className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            <p className="font-mono text-xs tracking-widest text-lcd">{current.scene.slug}</p>
            <h2 className="font-display text-3xl tracking-wide text-fg">
              {FILM.indexOf(current.scene) + 1}. {current.scene.title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {DIFFICULTY_COPY[current.scene.difficulty]!.label} · {formatClock(tuningFor(current.scene.difficulty, current.scene.mods).seconds)} · ripresa
            </p>
            <blockquote className="mt-4 border-l-2 border-accent pl-3 text-fg">
              <p className="text-[10px] tracking-[0.2em] text-muted">IL REGISTA</p>
              <p className="mt-1">«{current.scene.brief}»</p>
            </blockquote>
            <h3 className="mt-5 font-display tracking-[0.14em] text-fg">Regole di scena</h3>
            {current.scene.mods.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Nessuna regola in più: solo il copione.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {current.scene.mods.map((m) => (
                  <li key={m} className="rounded-sm border border-line px-3 py-2 text-sm">
                    <span className="text-fg">{MODIFIERS[m].label}.</span> <span className="text-muted">{MODIFIERS[m].text}</span>
                  </li>
                ))}
              </ul>
            )}
            {current.done && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Ciak n={current.ciak} /> record {current.bestScore.toLocaleString("it-IT")} punti · {current.attempts} riprese
              </p>
            )}
            {current.unlocked ? (
              <button
                type="button"
                onClick={() => {
                  toggleFilm();
                  dispatch({ type: "start", seed: current.scene.seed, difficulty: current.scene.difficulty, mode: "ripresa", mods: current.scene.mods, campaign: current.scene.id });
                }}
                className="mt-5 h-12 w-full max-w-sm rounded-sm bg-accent font-display text-lg tracking-[0.18em] text-fg"
              >
                {current.done ? "RIGIRA LA SCENA" : "AZIONE"}
              </button>
            ) : (
              <p className="mt-5 flex items-center gap-2 text-sm text-faint">
                <Lock className="size-4" /> Si gira dopo aver disinnescato la scena precedente.
              </p>
            )}
            <p className="mt-4 text-xs text-faint">Un ciak per esserne uscito, due per una scena pulita, tre per il voto «Da Oscar».</p>
          </article>
        </div>
      </div>
    </div>
  );
}

function SceneRow({ p, on, onPick }: { p: SceneProgress; on: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`flex w-full items-center gap-2 rounded-sm border px-2 py-2 text-left ${on ? "border-accent bg-surface" : "border-line"} ${p.unlocked ? "" : "opacity-50"}`}
      >
        <span className="w-6 shrink-0 font-display text-lcd">{FILM.indexOf(p.scene) + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{p.scene.title}</span>
          <span className="block truncate text-[11px] text-muted">{p.scene.slug}</span>
        </span>
        {p.unlocked ? <Ciak n={p.ciak} /> : <Lock className="size-4 text-faint" />}
      </button>
    </li>
  );
}
