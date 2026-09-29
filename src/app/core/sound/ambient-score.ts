/* The score: what plays in each bar, as plain data, so the choices can be
   tested without an audio device. A trance tempo: each chord holds for four
   measures, sixteen beats, and the loop of four chords lasts about half a minute. */

/** i – VI – III – VII in D minor: Dm, B♭, F, C. It never quite comes home,
 *  which is what keeps a loop this long from sounding like one. */
export const CHORDS: readonly (readonly number[])[] = [
  [0, 3, 7, 14],
  [-4, 0, 3, 10],
  [3, 7, 10, 16],
  [-2, 2, 5, 12],
];

/** D3, as a MIDI note. */
export const TONIC = 50;
export const BPM = 137;
export const BEAT_S = 60 / BPM;
export const BEATS_PER_BAR = 16;
/** A "bar" here is one chord: four measures of four beats. */
export const BAR_S = BEAT_S * BEATS_PER_BAR;
/** Sixteenth notes: the grid everything in the groove lands on. */
export const STEP_S = BEAT_S / 4;

/** A bell-like ping: when in the bar, which note, and where in the room. */
export interface Ping {
  readonly offsetS: number;
  readonly midi: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  readonly level: number;
}

export interface Bar {
  readonly chord: readonly number[];
  /** The bar's pad notes, as MIDI. */
  readonly pad: readonly number[];
  /** The chord's root, two octaves down: the bass plays an octave above it. */
  readonly root: number;
  readonly pings: readonly Ping[];
  /** A quiet filtered sweep across the bar, every few bars. */
  readonly hasSweep: boolean;
}

const MIN_PINGS = 2;
const EXTRA_PINGS = 3;
const PING_OCTAVES = [24, 36] as const;
const MAX_PAN = 0.8;
const SWEEP_EVERY = 4;
/** Under strain the scanner sweeps every other bar. */
const SWEEP_EVERY_UNEASY = 2;
const SWEEP_OFTEN_FROM = 0.6;
/** Pings keep clear of the bar's last second, where the next chord arrives. */
const PING_WINDOW_S = BAR_S - 1;
const PING_LEVEL = 0.05;

const sweepEvery = (unease: number): number =>
  unease >= SWEEP_OFTEN_FROM ? SWEEP_EVERY_UNEASY : SWEEP_EVERY;

/** Hertz for a MIDI note. */
export const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** The bar at `index` in the loop, with its pings drawn from `random` (0 to 1).
 *  `unease`, 0 to 1, is how strained the projects are. */
export function barAt(index: number, random: () => number, unease = 0): Bar {
  const chord = CHORDS[((index % CHORDS.length) + CHORDS.length) % CHORDS.length];
  const count = MIN_PINGS + Math.floor(random() * (EXTRA_PINGS + 1));
  const pings = Array.from({ length: count }, (): Ping => {
    const tone = chord[Math.floor(random() * chord.length)];
    const octave = PING_OCTAVES[Math.floor(random() * PING_OCTAVES.length)];
    return {
      offsetS: Math.floor((random() * PING_WINDOW_S) / STEP_S) * STEP_S,
      midi: TONIC + octave + tone,
      pan: (random() * 2 - 1) * MAX_PAN,
      level: PING_LEVEL * (0.5 + random() * 0.5),
    };
  }).sort((a, b) => a.offsetS - b.offsetS);
  return {
    chord,
    pad: chord.map((tone) => TONIC + tone),
    root: TONIC - 24 + chord[0],
    pings,
    hasSweep: index % sweepEvery(unease) === sweepEvery(unease) - 1,
  };
}

/** While the projects are unknown the score is a little uneasy: unknown is never healthy. */
const UNKNOWN_UNEASE = 0.2;

/** How uneasy the score sounds, 0 to 1, for the core's mood. */
export function uneaseOf(mood: { readonly name: string; readonly stress: number }): number {
  return mood.name === 'unknown' ? UNKNOWN_UNEASE : Math.max(0, Math.min(1, mood.stress));
}
