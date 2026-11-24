let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(next: boolean) {
  muted = next;
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0) {
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function beep(freq = 880) {
  unlockAudio();
  tone(freq, 0.045, "square", 0.04);
}

export function click() {
  unlockAudio();
  tone(220, 0.03, "triangle", 0.05);
}

export function win() {
  unlockAudio();
  tone(523, 0.12, "triangle", 0.06);
  setTimeout(() => tone(659, 0.12, "triangle", 0.06), 120);
  setTimeout(() => tone(784, 0.22, "triangle", 0.07), 240);
}

export function boom() {
  unlockAudio();
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.6);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const e = 1 - i / len;
    data[i] = (Math.random() * 2 - 1) * e * e;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(420, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + 0.55);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(t);
  tone(90, 0.4, "sine", 0.2, -50);
}

/** Cutters closing on a wire: a bright bite, then the duller knock of the jaws meeting. */
export function snip() {
  unlockAudio();
  tone(2600, 0.016, "square", 0.05);
  setTimeout(() => tone(700, 0.035, "triangle", 0.07, -300), 22);
}

/** The meter settling on a reading. */
export function blip() {
  unlockAudio();
  tone(1320, 0.03, "sine", 0.05);
}

/** A crocodile clip biting a post. */
export function clamp() {
  unlockAudio();
  tone(420, 0.025, "triangle", 0.07);
}
