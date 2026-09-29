import { BEAT_S, hz } from './ambient-score';
import { noiseBurst } from './instruments';
import { Rig, envelope, playFor } from './sound-rig';

/* The dance voices of Home's score. Each writes one note onto the audio clock
   and unhooks itself when it ends. */

const SUPERSAW_CENTS = [-14, -5, 5, 14] as const;
/** How far each kick ducks the pad: the pump that makes a pad breathe on the beat. */
const PUMP_FLOOR = 0.25;
const PUMP_RECOVER = 0.7;

/** A trance kick: a sine falling fast from a click to a sub, straight into the master. */
export function kick(rig: Rig, at: number, level: number): void {
  const { context } = rig;
  const oscillator = context.createOscillator();
  oscillator.frequency.setValueAtTime(180, at);
  oscillator.frequency.exponentialRampToValueAtTime(48, at + 0.08);
  oscillator.frequency.exponentialRampToValueAtTime(40, at + 0.3);
  const gain = envelope(context, { at, attack: 0.002, level, end: at + 0.36 });
  oscillator.connect(gain).connect(rig.master);
  playFor([oscillator], [gain], { at, end: at + 0.4 });
}

/** A clap or a roll hit: a band of noise around the snare's crack. */
export function clap(rig: Rig, at: number, level: number): void {
  noiseBurst(rig, { at, type: 'bandpass', freq: 1600, q: 1.4, level, decay: 0.16 });
}

/** A hat: closed is a tick, open a short hiss on the off-beat. */
export function hat(rig: Rig, at: number, level: number, open: boolean): void {
  noiseBurst(rig, { at, freq: 8000, level, decay: open ? 0.11 : 0.03 });
}

/** A gated supersaw pluck, bright at the front, into the room and the echo. */
export function supersawPluck(
  rig: Rig,
  {
    at,
    midi,
    level,
    pan,
    decay,
  }: { at: number; midi: number; level: number; pan: number; decay: number },
): void {
  const { context } = rig;
  const gain = envelope(context, { at, attack: 0.004, level, end: at + decay });
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 4;
  filter.frequency.setValueAtTime(5200, at);
  filter.frequency.exponentialRampToValueAtTime(700, at + decay);
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  filter.connect(gain).connect(panner);
  panner.connect(rig.bus);
  panner.connect(rig.echo);
  const oscillators = SUPERSAW_CENTS.map((detune) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = hz(midi);
    oscillator.detune.value = detune;
    oscillator.connect(filter);
    return oscillator;
  });
  playFor(oscillators, [filter, gain, panner], { at, end: at + decay + 0.05 });
}

/** A chord of supersaws held across the bar, ducking on every beat that has a kick. */
export function pumpingPad(
  rig: Rig,
  {
    at,
    notes,
    level,
    lengthS,
    beats,
  }: {
    at: number;
    notes: readonly number[];
    level: number;
    lengthS: number;
    /** Offsets of the beats to duck on, in seconds from `at`. */
    beats: readonly number[];
  },
): void {
  const { context } = rig;
  const swell = envelope(context, { at, attack: lengthS * 0.15, level, end: at + lengthS * 1.05 });
  const pump = context.createGain();
  pump.gain.setValueAtTime(1, at);
  for (const beat of beats) {
    pump.gain.setValueAtTime(PUMP_FLOOR, at + beat);
    pump.gain.linearRampToValueAtTime(1, at + beat + BEAT_S * PUMP_RECOVER);
  }
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.connect(swell).connect(pump).connect(rig.bus);
  const oscillators = notes.flatMap((midi) =>
    SUPERSAW_CENTS.map((detune) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = hz(midi);
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      return oscillator;
    }),
  );
  playFor(oscillators, [filter, swell, pump], { at, end: at + lengthS * 1.1 });
}
