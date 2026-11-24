import type { Bomb, Tool } from "./types";

export type KitGroup = "mano" | "misura" | "banco";

export interface KitItem {
  id: Tool;
  label: string;
  group: KitGroup;
  fits: string;
  blurb: string;
}

export const KIT: KitItem[] = [
  { id: "occhio", label: "Occhio", group: "mano", fits: "Tutto il banco", blurb: "Seleziona. Non taglia, non sposta." },
  { id: "maneggio", label: "Maneggio", group: "mano", fits: "Assetto", blurb: "Inclina l'ordigno. La camera, da sola, non lo fa." },
  { id: "pinzette", label: "Pinzette", group: "mano", fits: "Ponticelli", blurb: "Staccano un coccodrillo. A coperchio aperto, sul microswitch, è il finale." },
  { id: "multimetro", label: "Multimetro", group: "misura", fits: "Morsetti", blurb: "Due sonde. Verso, perla, e se la cella passa da quel tratto." },
  { id: "stetoscopio", label: "Stetoscopio", group: "misura", fits: "Cluster, antenna", blurb: "Conta i lampeggi o il battito. Senza, la cifra non entra negli appunti." },
  { id: "nastro", label: "Nastro", group: "misura", fits: "Fili", blurb: "Segna un tratto già letto. Non cambia il circuito." },
  { id: "tronchese", label: "Tronchese", group: "banco", fits: "Fili", blurb: "Apre un tratto. Solo a banco aperto, solo se sai dov'è." },
  { id: "cacciavite", label: "Cacciavite", group: "banco", fits: "Chiusure", blurb: "Alza il coperchio. Prima il ponticello su SW-A e SW-B." },
  { id: "brugola", label: "Brugola", group: "banco", fits: "Vite del grano", blurb: "Serra il grano d'inclinazione. Il cacciavite delle chiusure non entra." },
  { id: "ponticello", label: "Coccodrilli", group: "banco", fits: "Coppie di morsetti", blurb: "Microswitch, oppure COND + sul carico fittizio. Mai sull'innesco." },
  { id: "pila", label: "Pila di servizio", group: "banco", fits: "Timer spento", blurb: "Monouso. Riaccende il vetro. Non ricuce il filo dell'alimentazione." },
];

export const KIT_GROUPS: { id: KitGroup; label: string }[] = [
  { id: "mano", label: "Mano" },
  { id: "misura", label: "Misura" },
  { id: "banco", label: "Banco" },
];

export function kitItem(id: Tool): KitItem {
  return KIT.find((item) => item.id === id) ?? KIT[0]!;
}

export function fitLine(bomb: Bomb | null, id: string | null): string {
  if (!bomb || !id) return "Ogni pezzo ha l'attrezzo giusto. Il colore di un filo non è un attrezzo.";
  if (bomb.wires.some((w) => w.id === id)) {
    return "Fili: multimetro sui due capi, nastro per segnarli, tronchese solo a percorso chiaro.";
  }
  if (id === "latch") return "Chiusure: cacciavite, dopo i coccodrilli su SW-A e SW-B.";
  const kind = bomb.modules.find((m) => m.id === id)?.kind;
  switch (kind) {
    case "tilt":
      return "Vite del grano: brugola. Poi, se serve, il maneggio.";
    case "cap":
      return "Condensatore: coccodrilli fra COND + e CARICO FITTIZIO.";
    case "leds":
    case "receiver":
      return "Cluster e antenna: stetoscopio, poi decodifica.";
    case "battery":
      return "Cella: multimetro su BAT +. Se il vetro è morto, la pila di servizio è una sola.";
    case "timer":
      return "Timer: si guarda. La pila di servizio lo riaccende, non il filo.";
    case "detonator":
      return "Innesco: solo il multimetro. Il ponte si legge lì, in percentuale. Un coccodrillo sul tubo chiude la scena.";
    case "keypad":
      return "Tastierino: le dita, quattro cifre, poi OK.";
    case "dial":
      return "Contatore B: le ruote, a mano. Non serve un attrezzo.";
    case "plate":
      return "Piatto: occhio. Gli ordini sul metallo mentono.";
    case "harness":
      return "Cablaggio: multimetro, un tratto alla volta. I giunti sono morsetti.";
    default:
      return "Seleziona un modulo o un filo. La borsa dice cosa impugnare.";
  }
}
