import type { Grade, RunRecord } from "./stats";
import type { Difficulty, EndCause, Modifier } from "./types";

/** Each rule, and what it is worth on the score sheet: a handicap pays, a help costs. */
export const MODIFIERS: Record<Modifier, { label: string; text: string; bonus: number }> = {
  "suggeritore-gratis": { label: "Suggeritore in quinta", text: "I suggerimenti non costano secondi.", bonus: -20 },
  "suggeritore-muto": { label: "Senza suggeritore", text: "Niente suggeritore e niente radio.", bonus: 10 },
  "copione-strappato": { label: "Copione strappato", text: "L'archivio resta chiuso per tutta la scena.", bonus: 5 },
  "luci-basse": { label: "Blackout", text: "Luci di scena spente: resta la torcia che segue la camera.", bonus: 15 },
  "tronchese-spuntata": { label: "Tronchese spuntata", text: "Ogni taglio a vuoto costa venti secondi.", bonus: 10 },
  "radio-disturbata": { label: "Radio disturbata", text: "L'antenna ruba secondi più spesso e ogni chiamata alla radio costa il doppio.", bonus: 10 },
  "display-rotto": { label: "Display rotto", text: "Il timer è buio dall'inizio e non c'è pila di servizio.", bonus: 15 },
  "tempo-stretto": { label: "Montaggio serrato", text: "Un quinto di tempo in meno.", bonus: 20 },
  "senza-rete": { label: "Buona la prima", text: "Al primo errore il regista ferma tutto.", bonus: 25 },
};

/** Percentage the rules in force add to (or take from) a scene's score. */
export function modBonus(mods: readonly string[]): number {
  return mods.reduce((sum, m) => sum + (MODIFIERS[m as Modifier]?.bonus ?? 0), 0);
}

/** Rules that cannot be in force together: picking one drops the other. */
export const MOD_CLASH: Partial<Record<Modifier, Modifier>> = {
  "suggeritore-gratis": "suggeritore-muto",
  "suggeritore-muto": "suggeritore-gratis",
};

export function toggleMod(mods: Modifier[], mod: Modifier): Modifier[] {
  if (mods.includes(mod)) return mods.filter((m) => m !== mod);
  return [...mods.filter((m) => m !== MOD_CLASH[mod]), mod];
}

export interface FilmScene {
  id: string;
  act: 1 | 2 | 3;
  title: string;
  /** Screenplay slug line. */
  slug: string;
  difficulty: Difficulty;
  seed: string;
  mods: Modifier[];
  /** What the director says before the take. */
  brief: string;
  /** What the director says when it goes right. */
  wrap: string;
}

export const ACTS: Record<1 | 2 | 3, { title: string; line: string }> = {
  1: { title: "Atto primo — Il ritrovamento", line: "Qualcuno ha lasciato una valigetta. Tutti guardano te." },
  2: { title: "Atto secondo — Le complicazioni", line: "Ogni film, a metà, ti toglie qualcosa." },
  3: { title: "Atto terzo — Il finale", line: "Il pubblico sa già come finisce. Tu no." },
};

export const FILM: FilmScene[] = [
  {
    id: "f01", act: 1, title: "Prima lettura", slug: "INT. SALA PROVE — GIORNO",
    difficulty: "comparsa", seed: "FILM01T13", mods: ["suggeritore-gratis"],
    brief: "Con calma. Oggi il suggeritore è in quinta e non ti costa niente: chiedi quando vuoi. Voglio solo vederti aprire, misurare e tagliare nell'ordine giusto.",
    wrap: "Ecco. Adesso sai dove mettere le mani. Domani si gira davvero.",
  },
  {
    id: "f02", act: 1, title: "Il filo rosso", slug: "INT. DEPOSITO BAGAGLI — SERA",
    difficulty: "comparsa", seed: "FILM02T38", mods: [],
    brief: "In ogni film qualcuno urla «taglia il rosso!». Qui c'è un rosso, e c'è un'antenna che ti ruba il tempo. Non ascoltare chi urla: misura.",
    wrap: "Il rosso l'hai lasciato dov'era. In sala non applaudiranno, ma sei vivo.",
  },
  {
    id: "f03", act: 1, title: "La valigetta sotto il tavolo", slug: "INT. RISTORANTE — NOTTE",
    difficulty: "caratterista", seed: "FILM03T2", mods: [],
    brief: "Undici fili, gemelli di colore, giunti. Il maître finge di non vedere. Trova la linea che va dall'inibitore a BAT − e non fidarti dei vestiti.",
    wrap: "Conto pagato, valigetta muta. Stacco.",
  },
  {
    id: "f04", act: 1, title: "Chiamata dall'attentatore", slug: "INT. CABINA TELEFONICA — NOTTE",
    difficulty: "caratterista", seed: "FILM04T11", mods: ["radio-disturbata"],
    brief: "Lui chiama, ride, e l'antenna batte più in fretta del solito. Prima zittiscila col codice, poi pensa al resto.",
    wrap: "Ha riattaccato lui. Fine del primo atto.",
  },
  {
    id: "f05", act: 2, title: "Blackout", slug: "INT. CENTRALE ELETTRICA — NOTTE",
    difficulty: "caratterista", seed: "FILM05T5", mods: ["luci-basse"],
    brief: "Saltano le luci, come sempre al momento sbagliato. Hai una torcia: illumina dove guardi. I colori dei fili, al buio, mentono ancora di più.",
    wrap: "Le luci tornano un secondo dopo. Naturalmente.",
  },
  {
    id: "f06", act: 2, title: "Il copione strappato", slug: "EST. TETTO — ALBA",
    difficulty: "caratterista", seed: "FILM06T6", mods: ["copione-strappato", "suggeritore-muto"],
    brief: "Il vento si è portato via le pagine. Niente archivio, niente suggeritore. E occhio: qui dentro un filo è rotto sotto la guaina.",
    wrap: "A memoria. Così si fa il cinema.",
  },
  {
    id: "f07", act: 2, title: "Il montatore taglia corto", slug: "INT. FURGONE IN CORSA — GIORNO",
    difficulty: "caratterista", seed: "FILM07T4", mods: ["tempo-stretto"],
    brief: "Al montaggio hanno deciso che la scena dura troppo. Hai un quinto di tempo in meno e la strada è piena di buche.",
    wrap: "Entrata nel minutaggio. Il montatore ti saluta.",
  },
  {
    id: "f08", act: 2, title: "Il display è andato", slug: "INT. SCANTINATO ALLAGATO — NOTTE",
    difficulty: "caratterista", seed: "FILM08T11", mods: ["display-rotto"],
    brief: "L'acqua ha spento il timer e la pila di servizio è rimasta in camerino. Il conto va avanti, ma non lo vedi. Conta tu, o fai in fretta.",
    wrap: "Non sapevi quanto mancava. Meglio così, credimi.",
  },
  {
    id: "f09", act: 3, title: "La tronchese del trovarobe", slug: "INT. CAVEAU — NOTTE",
    difficulty: "protagonista", seed: "FILM09T2", mods: ["tronchese-spuntata"],
    brief: "Il trovarobe ti ha dato la tronchese vecchia. Ogni taglio che non serve ti costa venti secondi, e qui di fili inutili ce n'è una selva.",
    wrap: "Tagli puliti con un ferro da buttare. Tieniti quella tronchese.",
  },
  {
    id: "f10", act: 3, title: "Senza rete", slug: "EST. PONTE SOSPESO — TRAMONTO",
    difficulty: "protagonista", seed: "FILM10T5", mods: ["copione-strappato", "suggeritore-muto"],
    brief: "Nessuno a cui chiedere e niente da consultare. La linea ha due rami, tutti e due veri. Un taglio non basta.",
    wrap: "Due rami, due tagli. Il ponte resta dov'è.",
  },
  {
    id: "f11", act: 3, title: "Buona la prima", slug: "INT. TEATRO DI POSA — NOTTE",
    difficulty: "protagonista", seed: "FILM11T6", mods: ["senza-rete"],
    brief: "La pellicola è finita: ce n'è per una sola ripresa. Un codice sbagliato, un ponticello a caso, una forzatura, e fermo tutto.",
    wrap: "Una ripresa sola. Stampatela.",
  },
  {
    id: "f12", act: 3, title: "Ultimo taglio", slug: "INT. STUDIO, SET PRINCIPALE — NOTTE",
    difficulty: "protagonista", seed: "FILM12T63", mods: ["luci-basse", "senza-rete", "suggeritore-muto"],
    brief: "Buio, nessun aiuto, nessun errore concesso. Due rami sulla linea e un filo che non conduce. È l'ultima scena: falla come se la guardassero.",
    wrap: "Fine. Titoli di coda. Era solo un film, ma le mani ti tremano lo stesso.",
  },
];

const STOP: Partial<Record<EndCause, string>> = {
  tempo: "Stop! Il tempo era nel copione, non un consiglio.",
  trappola: "Stop. Quel filo portava corrente all'innesco. Trucco, rimettete in piedi la controfigura.",
  microswitch: "Stop. Prima il ponticello, poi il cacciavite. Da capo.",
  regista: "Stop. Avevo detto buona la prima.",
  antenna: "Stop. L'antenna andava zittita prima.",
  ponte: "Stop. Hai lasciato scaldare il ponte.",
};

export function stopLine(cause: EndCause): string {
  return STOP[cause] ?? "Stop. Si rifà. Tutti ai posti.";
}

/** Clapperboards earned by a grade: one for getting through, three for a clean, fast take. */
export function ciakOf(grade: Grade): number {
  return grade === "oscar" ? 3 : grade === "prima" ? 2 : grade === "tagliata" ? 0 : 1;
}

export interface SceneProgress {
  scene: FilmScene;
  unlocked: boolean;
  done: boolean;
  ciak: number;
  bestScore: number;
  attempts: number;
}

/** Where a performer stands in the film, read off the register: nothing is stored apart. */
export function filmProgress(runs: RunRecord[]): SceneProgress[] {
  let open = true;
  return FILM.map((scene) => {
    const takes = runs.filter((r) => r.campaign === scene.id);
    const wins = takes.filter((r) => r.outcome === "safe");
    const entry: SceneProgress = {
      scene,
      unlocked: open,
      done: wins.length > 0,
      ciak: Math.max(0, ...wins.map((r) => ciakOf(r.grade))),
      bestScore: Math.max(0, ...wins.map((r) => r.score)),
      attempts: takes.length,
    };
    open = open && entry.done;
    return entry;
  });
}

export function sceneById(id: string | null | undefined): FilmScene | undefined {
  return FILM.find((s) => s.id === id);
}

export function nextScene(id: string): FilmScene | undefined {
  const i = FILM.findIndex((s) => s.id === id);
  return i >= 0 ? FILM[i + 1] : undefined;
}
