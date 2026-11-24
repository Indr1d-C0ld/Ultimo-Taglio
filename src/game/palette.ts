export const WIRE_COLORS = {
  rosso: { name: "Rosso", hex: "#c4322a" },
  blu: { name: "Blu", hex: "#2f5f9e" },
  giallo: { name: "Giallo", hex: "#e2b43a" },
  verde: { name: "Verde", hex: "#3f8f55" },
  bianco: { name: "Bianco", hex: "#e8e2d6" },
  nero: { name: "Nero", hex: "#6b6560" },
  arancio: { name: "Arancio", hex: "#e07a2f" },
  viola: { name: "Viola", hex: "#7a4a93" },
  grigio: { name: "Grigio", hex: "#8d8880" },
  marrone: { name: "Marrone", hex: "#7a5340" },
} as const;

export type WireColor = keyof typeof WIRE_COLORS;

export function colorName(id: string): string {
  return WIRE_COLORS[id as WireColor]?.name ?? id;
}

export function colorHex(id: string): string {
  return WIRE_COLORS[id as WireColor]?.hex ?? "#888888";
}

export const TERMINAL_LABELS: Record<string, string> = {
  "det-in": "INNESCO",
  "det-inhibit": "INIBITORE",
  "bat-pos": "BAT +",
  "bat-neg": "BAT −",
  "cap-hot": "COND +",
  "cap-load": "CARICO FITTIZIO",
  "timer-vin": "TIMER",
  "rx-out": "RX",
  "led-in": "CLUSTER",
  "sw-a": "SW-A",
  "sw-b": "SW-B",
  "h-sic": "BUS SICURA",
};

export function terminalLabel(id: string): string {
  if (TERMINAL_LABELS[id]) return TERMINAL_LABELS[id];
  if (id.startsWith("h-l-")) return `BUS L${Number(id.slice(4)) + 1}`;
  if (id.startsWith("h-r-")) return `BUS R${Number(id.slice(4)) + 1}`;
  if (/^j\d+$/.test(id)) return `GIUNTO ${id.slice(1)}`;
  return id;
}
