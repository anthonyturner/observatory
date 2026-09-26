import { SeverityId } from '../projects/severity';

/* pr-starmap's orrery score: the system playing itself. Generated live, never
   a recording, and it carries the data:
     - each world is a voice with its own Euclidean rhythm, more open work
       making more pulses in its sixteen steps, so a busy world is audibly busy;
     - its severity picks the instrument, so a blocked world sounds harsh
       before you find it and a clear one rings like a bell;
     - it plays from where it sits, panned to its place in the system;
     - the sun keeps the beat, hitting harder the more is open, and a scanning
       sweep rises with the number of blocked worlds.
   Every voice picks its notes from the chord of the moment, so however many
   worlds there are they stay in harmony. This file is the plan; the synth plays it. */

export const BPM = 112;
/** A sixteenth. */
export const STEP_S = 60 / BPM / 4;
export const STEPS_PER_BAR = 16;
/** D3. */
export const TONIC = 50;
/** i – VI – III – VII in D minor, one bar each: Dm, B♭, F, C. The loop every
 *  late-night synth score leans on, because it never quite comes home. */
export const CHORDS: readonly (readonly number[])[] = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];
export const LOOP_STEPS = STEPS_PER_BAR * CHORDS.length;
/** More voices than this and the score turns to noise. */
export const MAX_VOICES = 12;

/** One world as the score hears it. */
export interface WorldVoice {
  readonly key: string;
  readonly severity: SeverityId;
  readonly open: number;
  /** Where its rhythm starts in the bar, 0 to 15, so equal worlds do not play in unison. */
  readonly rotate: number;
  /** -1 left to 1 right, where it sits now. */
  readonly pan: number;
}

/** The system at one step: its worlds innermost first, and what is open and blocked. */
export interface SystemSound {
  readonly voices: readonly WorldVoice[];
  readonly totalOpen: number;
  readonly blocked: number;
}

export type ScoreEvent =
  | { readonly kind: 'pad'; readonly notes: readonly number[] }
  | { readonly kind: 'sweep'; readonly level: number; readonly pan: number }
  | { readonly kind: 'thump'; readonly level: number }
  | { readonly kind: 'hat' }
  | { readonly kind: 'bass'; readonly midi: number }
  | {
      readonly kind: 'pluck';
      readonly midi: number;
      readonly severity: SeverityId;
      readonly pan: number;
      readonly level: number;
    };

const BASS_STEPS = [0, 3, 6, 8, 11, 14] as const;
const THUMP_BASE = 0.16;
const THUMP_SPREAD = 0.22;
const THUMP_FULL_OPEN = 60;
const SWEEP_PER_BLOCKED = 0.012;
const MAX_SWEEP = 0.07;
const MAX_PULSES = 9;
const VOICE_BUDGET = 0.1;

/** k pulses spread as evenly as they fall over n steps: the rhythms that run
 *  through West African bells and Cuban clave, from one division. */
export function euclid(pulses: number, steps: number): boolean[] {
  return Array.from(
    { length: steps },
    (_, i) => Math.floor((i * pulses) / steps) !== Math.floor(((i - 1) * pulses) / steps),
  );
}

/** How many of its sixteen steps a world plays: one for an empty world, up to nine. */
export const pulsesFor = (open: number): number =>
  Math.max(1, Math.min(MAX_PULSES, Math.round(1 + Math.sqrt(open) * 1.6)));

export const chordAt = (step: number): readonly number[] =>
  CHORDS[Math.floor(step / STEPS_PER_BAR) % CHORDS.length];

/** Everything that sounds at `step` of the loop. */
export function stepEvents(step: number, system: SystemSound): ScoreEvent[] {
  const sixteenth = step % STEPS_PER_BAR;
  const chord = chordAt(step);
  const events: ScoreEvent[] = [];
  if (sixteenth === 0) {
    events.push({ kind: 'pad', notes: chord.map((tone) => TONIC + tone) });
    if (system.blocked > 0) {
      // The scanner: once a bar, louder per blocked world, drifting across the room.
      events.push({
        kind: 'sweep',
        level: Math.min(SWEEP_PER_BLOCKED * system.blocked, MAX_SWEEP),
        pan: Math.sin(step * 0.37) * 0.6,
      });
    }
  }
  if (sixteenth % 4 === 0) {
    const weight = Math.min(system.totalOpen, THUMP_FULL_OPEN) / THUMP_FULL_OPEN;
    events.push({ kind: 'thump', level: THUMP_BASE + weight * THUMP_SPREAD });
  }
  if (sixteenth % 4 === 2) events.push({ kind: 'hat' });
  if ((BASS_STEPS as readonly number[]).includes(sixteenth)) {
    events.push({ kind: 'bass', midi: TONIC - 12 + chord[0] });
  }
  return [...events, ...plucks(step, system)];
}

/** Inner worlds play higher, as a smaller body rings at a higher pitch. */
function plucks(step: number, system: SystemSound): ScoreEvent[] {
  const voices = system.voices.slice(0, MAX_VOICES);
  const sixteenth = step % STEPS_PER_BAR;
  const chord = chordAt(step);
  const each = VOICE_BUDGET / Math.sqrt(Math.max(voices.length, 1));
  return voices.flatMap((voice, index): ScoreEvent[] => {
    if (!euclid(pulsesFor(voice.open), STEPS_PER_BAR)[(sixteenth + voice.rotate) % STEPS_PER_BAR]) {
      return [];
    }
    const octave = index < voices.length / 3 ? 24 : index < (voices.length * 2) / 3 ? 12 : 0;
    const tone = chord[(index + Math.floor(step / 2)) % chord.length];
    return [
      {
        kind: 'pluck',
        midi: TONIC + octave + tone,
        severity: voice.severity,
        pan: voice.pan,
        level: each * INSTRUMENT_LEVEL[voice.severity],
      },
    ];
  });
}

/** How loud each instrument sits in the mix. */
export const INSTRUMENT_LEVEL: Readonly<Record<SeverityId, number>> = {
  blocked: 0.85,
  unsettled: 0.75,
  untracked: 1,
  waiting: 1.1,
  clear: 0.6,
  unreadable: 0.5,
};

/** A world's motif when it is picked: its instrument rising through the chord. */
export function motifFor(voice: WorldVoice, step: number): ScoreEvent[] {
  return chordAt(step).map((tone) => ({
    kind: 'pluck',
    midi: TONIC + 24 + tone,
    severity: voice.severity,
    pan: voice.pan,
    level: 0.09,
  }));
}
