import { SeverityId } from '../projects/severity';
import { hz } from './ambient-score';
import { Rig, SILENT, envelope, playFor } from './sound-rig';

/** How a severity sounds, so the timbre says what the colour says. */
interface Instrument {
  readonly wave?: OscillatorType;
  readonly cutoff?: number;
  readonly q?: number;
  readonly decay: number;
  /** Two oscillators this many cents apart: the harshness of a blocked world. */
  readonly detune?: number;
  /** A touch of FM: the glassy edge a sine alone cannot have. */
  readonly fm?: number;
  /** An inharmonic partial is what makes a sine read as struck metal. */
  readonly bell?: number;
  readonly isNoise?: boolean;
}

export const INSTRUMENTS: Readonly<Record<SeverityId, Instrument>> = {
  blocked: { wave: 'square', cutoff: 1700, q: 7, decay: 0.24, detune: 16 },
  unsettled: { wave: 'sawtooth', cutoff: 2100, q: 3, decay: 0.3, detune: 7 },
  untracked: { wave: 'triangle', cutoff: 3200, q: 1, decay: 0.34 },
  waiting: { wave: 'sine', cutoff: 5200, q: 0.7, decay: 0.45, fm: 2 },
  clear: { wave: 'sine', cutoff: 6400, q: 0.5, decay: 1.3, bell: 2.76 },
  unreadable: { isNoise: true, decay: 0.06 },
};

export interface Pluck {
  readonly at: number;
  readonly midi: number;
  readonly severity: SeverityId;
  readonly pan: number;
  readonly level: number;
}

/** One plucked note in a severity's instrument, into the room and the echo. */
export function pluck(rig: Rig, note: Pluck): void {
  const instrument = INSTRUMENTS[note.severity];
  const { decay } = instrument;
  if (instrument.isNoise) {
    noiseBurst(rig, {
      at: note.at,
      type: 'bandpass',
      freq: hz(note.midi),
      q: 8,
      level: note.level * 2,
      decay,
      pan: note.pan,
    });
    return;
  }
  const { context } = rig;
  const { at } = note;
  const freq = hz(note.midi);
  const gain = envelope(context, { at, attack: 0.006, level: note.level, end: at + decay });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = instrument.q ?? 1;
  const cutoff = instrument.cutoff ?? 4000;
  filter.frequency.setValueAtTime(cutoff * 1.6, at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(220, cutoff * 0.35), at + decay);
  const pan = context.createStereoPanner();
  pan.pan.value = note.pan;
  filter.connect(gain).connect(pan);
  pan.connect(rig.bus);
  pan.connect(rig.echo);

  const oscillators: OscillatorNode[] = [];
  const extras: AudioNode[] = [];
  const oscillator = (type: OscillatorType, frequency: number, detune = 0): OscillatorNode => {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(frequency, at);
    node.detune.setValueAtTime(detune, at);
    oscillators.push(node);
    return node;
  };
  const wave = instrument.wave ?? 'sine';
  const main = oscillator(wave, freq, instrument.detune ?? 0);
  main.connect(filter);
  if (instrument.detune) oscillator(wave, freq, -instrument.detune).connect(filter);
  if (instrument.fm) {
    const depth = context.createGain();
    depth.gain.setValueAtTime(freq * 0.9, at);
    depth.gain.exponentialRampToValueAtTime(1, at + decay);
    oscillator('sine', freq * instrument.fm)
      .connect(depth)
      .connect(main.frequency);
    extras.push(depth);
  }
  if (instrument.bell) {
    const partial = context.createGain();
    partial.gain.value = 0.35;
    oscillator('sine', freq * instrument.bell)
      .connect(partial)
      .connect(filter);
    extras.push(partial);
  }
  playFor(oscillators, [filter, gain, pan, ...extras], { at, end: at + decay + 0.05 });
}

export interface NoiseBurst {
  readonly at: number;
  readonly type?: BiquadFilterType;
  readonly freq?: number;
  readonly q?: number;
  readonly level?: number;
  readonly decay?: number;
  /** Where the filter sweeps to, for a rising scanner. */
  readonly to?: number;
  readonly pan?: number;
}

/** A filtered breath of noise: a hat, a scanner sweep, an unreadable world. */
export function noiseBurst(rig: Rig, burst: NoiseBurst): void {
  const { context } = rig;
  const {
    at,
    type = 'highpass',
    freq = 7000,
    q = 1,
    level = 0.05,
    decay = 0.04,
    to,
    pan = 0,
  } = burst;
  const source = context.createBufferSource();
  source.buffer = rig.noise;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, at);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, at + decay);
  const gain = context.createGain();
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.exponentialRampToValueAtTime(
    level,
    at + Math.min(0.01, decay / 3) + (to ? decay * 0.45 : 0),
  );
  gain.gain.exponentialRampToValueAtTime(SILENT, at + decay);
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  source.connect(filter).connect(gain).connect(panner).connect(rig.bus);
  source.loop = true;
  playFor([source], [filter, gain, panner], { at, end: at + decay + 0.05 });
}

/** One stop on a whoosh's path: where the filter is, and where it sits between the speakers. */
export interface WhooshStop {
  /** Seconds after the whoosh begins. */
  readonly at: number;
  readonly freq: number;
  readonly pan: number;
}

export interface Whoosh {
  readonly at: number;
  readonly seconds: number;
  readonly level: number;
  readonly q: number;
  /** At least one stop; the filter and the pan glide from each to the next. */
  readonly path: readonly WhooshStop[];
}

/** Noise through a band that glides along `path`: something passing, heard as it goes. */
export function whoosh(rig: Rig, { at, seconds, level, q, path }: Whoosh): void {
  if (path.length === 0) return;
  const { context } = rig;
  const source = context.createBufferSource();
  source.buffer = rig.noise;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  const gain = envelope(context, { at, attack: seconds * 0.2, level, end: at + seconds });
  const panner = context.createStereoPanner();
  filter.frequency.setValueAtTime(path[0].freq, at);
  panner.pan.setValueAtTime(path[0].pan, at);
  for (const stop of path.slice(1)) {
    filter.frequency.linearRampToValueAtTime(stop.freq, at + stop.at);
    panner.pan.linearRampToValueAtTime(stop.pan, at + stop.at);
  }
  source.connect(filter).connect(gain).connect(panner).connect(rig.bus);
  playFor([source], [filter, gain, panner], { at, end: at + seconds + 0.05 });
}

/** The sun's pulse: a falling sine, the heartbeat of the system. */
export function thump(rig: Rig, at: number, level: number, pan = 0): void {
  const { context } = rig;
  const oscillator = context.createOscillator();
  oscillator.frequency.setValueAtTime(120, at);
  oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.22);
  const gain = envelope(context, { at, attack: 0.004, level, end: at + 0.34 });
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  oscillator.connect(gain).connect(panner).connect(rig.master);
  playFor([oscillator], [gain, panner], { at, end: at + 0.4 });
}

/** A short filtered saw on the chord's root, for the bass line. */
export function bass(rig: Rig, at: number, midi: number, stepS: number): void {
  const { context } = rig;
  const gain = envelope(context, { at, attack: 0.01, level: 0.11, end: at + stepS * 2.6 });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 9;
  filter.frequency.setValueAtTime(900, at);
  filter.frequency.exponentialRampToValueAtTime(140, at + stepS * 2.2);
  const oscillator = context.createOscillator();
  oscillator.type = 'sawtooth';
  oscillator.frequency.value = hz(midi);
  oscillator.connect(filter).connect(gain).connect(rig.bus);
  playFor([oscillator], [filter, gain], { at, end: at + stepS * 3 });
}

/** A bar-long pad under everything, so the rhythms have a floor. */
export function barPad(rig: Rig, at: number, notes: readonly number[], barS: number): void {
  const { context } = rig;
  const gain = envelope(context, { at, attack: barS * 0.3, level: 0.028, end: at + barS * 1.08 });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.connect(gain).connect(rig.bus);
  const oscillators = notes.flatMap((midi) =>
    [-9, 9].map((detune) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = hz(midi);
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      return oscillator;
    }),
  );
  playFor(oscillators, [filter, gain], { at, end: at + barS * 1.1 });
}
