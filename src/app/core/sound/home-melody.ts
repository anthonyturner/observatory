import { BEAT_S } from './ambient-score';
import { buildsAt } from './trance-groove';

/* Home's lead: one slow, singable line over the loop's four chords, every
   long note on a chord tone and every passing note in D minor, so it never
   rubs against the pad or the arpeggio. The first pass sings it low and the
   second answers an octave up; under the build at the end of the phrase it
   holds back to one long note. */

/** One note of the lead: when in the bar, which note, and for how long. */
export interface MelodyNote {
  readonly offsetS: number;
  readonly midi: number;
  readonly lengthS: number;
}

/** [beat, MIDI note, beats held], one line per chord of the loop. */
type Line = readonly (readonly [number, number, number])[];

const A4 = 69;
const B_FLAT4 = 70;
const C5 = 72;
const D5 = 74;
const E5 = 76;
const F5 = 77;
const G5 = 79;
const A5 = 81;

/** Dm, B♭, F, C: rising through the first two chords, peaking on the third,
 *  and stepping down so the loop falls back into its start. */
export const LINES: readonly Line[] = [
  [
    [0, A4, 3],
    [3, D5, 1],
    [4, E5, 2],
    [6, F5, 4],
    [10, E5, 2],
    [12, D5, 4],
  ],
  [
    [0, F5, 3],
    [3, D5, 1],
    [4, C5, 2],
    [6, D5, 6],
    [12, B_FLAT4, 4],
  ],
  [
    [0, C5, 3],
    [3, A4, 1],
    [4, C5, 2],
    [6, F5, 4],
    [10, G5, 2],
    [12, A5, 4],
  ],
  [
    [0, G5, 3],
    [3, E5, 1],
    [4, D5, 2],
    [6, E5, 6],
    [12, D5, 2],
    [14, C5, 2],
  ],
];

/** Under the build, the chord's first note holds for three measures. */
const BUILD_HOLD_BEATS = 12;

/** The lead's notes in bar `index`. */
export function melodyFor(index: number): MelodyNote[] {
  const line = LINES[index % LINES.length];
  // Every other pass through the loop answers an octave up.
  const octave = Math.floor(index / LINES.length) % 2 === 1 ? 12 : 0;
  const [first] = line;
  const notes: Line = buildsAt(index) ? [[first[0], first[1], BUILD_HOLD_BEATS]] : line;
  return notes.map(([beat, midi, beats]) => ({
    offsetS: beat * BEAT_S,
    midi: midi + octave,
    lengthS: beats * BEAT_S,
  }));
}
