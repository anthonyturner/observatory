import { layoutBeads } from '../instrument/beads';
import { ORBIT } from '../instrument/proportions';
import { hashString } from '../orrery/world-layout';
import { ProjectSnapshot } from '../projects/project.types';
import { SeverityId } from '../projects/severity';
import { BAR_S, Bar, TONIC } from './ambient-score';
import { INSTRUMENT_LEVEL, WorldVoice, euclid, pulsesFor } from './orrery-score';

/* Home's score plays the projects too: each project on the ring chimes a
   Euclidean rhythm on the beats of the bar, over the groove, in its severity's
   instrument, from where its dot sits. Busier projects chime more; the worst
   chime highest. */

/** One chime in a bar. */
export interface Chime {
  readonly offsetS: number;
  readonly midi: number;
  readonly severity: SeverityId;
  readonly pan: number;
  readonly level: number;
}

export const CHIME_STEPS = 16;
const CHIME_STEP_S = BAR_S / CHIME_STEPS;
/** Fewer voices than the Orrery: chimes, not a band. */
export const MAX_CHIMERS = 10;
const CHIME_BUDGET = 0.07;
/** How far to the sides the ring plays; never hard left or right. */
const MAX_PAN = 0.8;
const MOTIF_STEP_S = 0.35;
const MOTIF_LEVEL = 0.07;

/** The projects as the score hears them, in ring order (worst first), each
 *  panned to where its dot sits on the ring. */
export function homeVoicesOf(projects: readonly ProjectSnapshot[]): WorldVoice[] {
  return layoutBeads(projects, 1).beads.map((bead) => ({
    key: bead.key,
    severity: bead.severity.id,
    open: bead.project.open,
    rotate: hashString(bead.key) % CHIME_STEPS,
    pan: (bead.x / ORBIT) * MAX_PAN,
  }));
}

/** Half the Orrery's pulses, at least one: a slow chime, not a rhythm section. */
const chimesPerBar = (open: number): number => Math.max(1, Math.ceil(pulsesFor(open) / 2));

/** Every chime in bar `index`, whose chord is `bar`'s. */
export function chimesFor(index: number, bar: Bar, voices: readonly WorldVoice[]): Chime[] {
  const chimers = voices.slice(0, MAX_CHIMERS);
  const each = CHIME_BUDGET / Math.sqrt(Math.max(chimers.length, 1));
  return chimers.flatMap((voice, rank) => {
    const pattern = euclid(chimesPerBar(voice.open), CHIME_STEPS);
    const octave = rank < chimers.length / 3 ? 24 : 12;
    return pattern.flatMap((_, step): Chime[] => {
      if (!pattern[(step + voice.rotate) % CHIME_STEPS]) return [];
      const tone = bar.chord[(rank + step + index) % bar.chord.length];
      return [
        {
          offsetS: step * CHIME_STEP_S,
          midi: TONIC + octave + tone,
          severity: voice.severity,
          pan: voice.pan,
          level: each * INSTRUMENT_LEVEL[voice.severity],
        },
      ];
    });
  });
}

/** A project's motif when it is lit: its instrument rising slowly through the chord. */
export function homeMotif(voice: WorldVoice, bar: Bar): Chime[] {
  return bar.chord.slice(0, 3).map((tone, i) => ({
    offsetS: i * MOTIF_STEP_S,
    midi: TONIC + 24 + tone,
    severity: voice.severity,
    pan: voice.pan,
    level: MOTIF_LEVEL,
  }));
}
