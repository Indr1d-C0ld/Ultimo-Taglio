let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(next: boolean) {
  muted = next;
  if (next) hushVoice();
  if (score && ctx) score.out.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.05);
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

/** The clapperboard: two dry cracks a breath apart. */
export function clap() {
  unlockAudio();
  if (!ctx || muted) return;
  for (const at of [0, 0.03]) {
    const t = ctx.currentTime + at;
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1900;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(band);
    band.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }
}

/**
 * The score under a scene, made of oscillators: a low drone that opens up as the clock
 * runs down, a heartbeat that comes in past the middle and quickens, and a held
 * dissonance for the last stretch. `setTension` moves all three.
 */
interface Score {
  out: GainNode;
  drone: GainNode;
  filter: BiquadFilterNode;
  strings: GainNode;
  nodes: OscillatorNode[];
  timer: ReturnType<typeof setInterval>;
  tension: number;
  nextBeat: number;
}
let score: Score | null = null;

export function startScore() {
  unlockAudio();
  stopScore();
  if (!ctx) return;
  const audio = ctx;
  const out = audio.createGain();
  out.gain.value = muted ? 0 : 1;
  out.connect(audio.destination);

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 160;
  const drone = audio.createGain();
  drone.gain.value = 0;
  drone.gain.setTargetAtTime(0.05, audio.currentTime, 1.2);
  filter.connect(drone);
  drone.connect(out);

  const nodes: OscillatorNode[] = [];
  const voice = (type: OscillatorType, freq: number, to: AudioNode | AudioParam, level = 1) => {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = audio.createGain();
    g.gain.value = level;
    osc.connect(g);
    // connect() is overloaded for nodes and params; the union needs a nudge.
    g.connect(to as AudioNode);
    osc.start();
    nodes.push(osc);
    return osc;
  };
  voice("sawtooth", 41.2, filter, 0.6);
  voice("sawtooth", 41.5, filter, 0.6);
  voice("sine", 61.7, filter, 0.9);

  // Two notes a semitone apart, shivering: the sound of a decision about to be wrong.
  const strings = audio.createGain();
  strings.gain.value = 0;
  const tremolo = audio.createGain();
  tremolo.gain.value = 0.6;
  voice("sine", 6.5, tremolo.gain, 0.4);
  tremolo.connect(strings);
  strings.connect(out);
  voice("triangle", 220, tremolo, 0.5);
  voice("triangle", 233.1, tremolo, 0.5);

  const timer = setInterval(() => {
    if (!score || !ctx) return;
    const now = ctx.currentTime;
    if (score.tension < 0.45 || now < score.nextBeat) return;
    // Lub-dub. From one beat every 1.1 s down to one every 0.42 s.
    const gap = 1.1 - (score.tension - 0.45) * 1.24;
    for (const [at, level] of [[0, 0.22], [0.13, 0.15]] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(70, now + at);
      osc.frequency.exponentialRampToValueAtTime(42, now + at + 0.09);
      g.gain.setValueAtTime(level, now + at);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.11);
      osc.connect(g);
      g.connect(score.out);
      osc.start(now + at);
      osc.stop(now + at + 0.14);
    }
    score.nextBeat = now + gap;
  }, 60);

  score = { out, drone, filter, strings, nodes, timer, tension: 0, nextBeat: 0 };
}

/** 0 at the opening of a scene, 1 at the last second. */
export function setTension(value: number) {
  if (!score || !ctx) return;
  const t = Math.min(1, Math.max(0, value));
  score.tension = t;
  const now = ctx.currentTime;
  score.filter.frequency.setTargetAtTime(160 + t * t * 620, now, 0.4);
  score.drone.gain.setTargetAtTime(0.05 + t * 0.05, now, 0.4);
  score.strings.gain.setTargetAtTime(t > 0.75 ? (t - 0.75) * 0.14 : 0, now, 0.3);
}

export function stopScore() {
  if (!score || !ctx) return;
  const done = score;
  score = null;
  clearInterval(done.timer);
  done.out.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  setTimeout(() => {
    for (const osc of done.nodes) osc.stop();
    done.out.disconnect();
  }, 700);
}


/** The burst of static that opens and closes a transmission. */
export function squelch(dur = 0.16) {
  unlockAudio();
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2200;
  band.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.setValueAtTime(0.05, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(band);
  band.connect(g);
  g.connect(ctx.destination);
  src.start(t);
}

/**
 * Says a radio line aloud with the browser's own voice, when it has an Italian one, between
 * two bursts of static. A machine without voices just gets the static and the written line.
 */
export function radioVoice(text: string) {
  squelch();
  if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const line = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ""));
    line.lang = "it-IT";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("it"));
    if (voice) line.voice = voice;
    line.rate = 1.08;
    line.pitch = 0.85;
    line.volume = 0.9;
    line.onend = () => squelch(0.1);
    synth.speak(line);
  } catch {
    // No voice on this machine: the line is in the log anyway.
  }
}

export function hushVoice() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
