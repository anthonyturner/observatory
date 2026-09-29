import { layoutBeads } from '../instrument/beads';
import { ORBIT } from '../instrument/proportions';
import { hashString } from '../orrery/world-layout';
import { ProjectSnapshot } from '../projects/project.types';
import { BEAT_S, Bar, TONIC } from './ambient-score';
import { WorldVoice } from './orrery-score';

/* The projects as Home's score hears them. They no longer chime in the
   background; lighting one plays a short motif on the lead, from where its dot
   sits on the ring. */

/** One note of a lit project's motif. */
export interface MotifNote {
  readonly offsetS: number;
  readonly midi: number;
  readonly pan: number;
  readonly level: number;
}

/** Sixteen positions on the ring, one per beat of the bar. */
const RING_STEPS = 16;
/** How far to the sides the ring plays; never hard left or right. */
const MAX_PAN = 0.8;
/** The motif rises on eighth notes, in time with the groove. */
const MOTIF_STEP_S = BEAT_S / 2;
const MOTIF_LEVEL = 0.05;

/** The projects in ring order (worst first), each panned to where its dot sits. */
export function homeVoicesOf(projects: readonly ProjectSnapshot[]): WorldVoice[] {
  return layoutBeads(projects, 1).beads.map((bead) => ({
    key: bead.key,
    severity: bead.severity.id,
    open: bead.project.open,
    rotate: hashString(bead.key) % RING_STEPS,
    pan: (bead.x / ORBIT) * MAX_PAN,
  }));
}

/** A project's motif when it is lit: three notes rising through the chord. */
export function homeMotif(voice: WorldVoice, bar: Bar): MotifNote[] {
  return bar.chord.slice(0, 3).map((tone, i) => ({
    offsetS: i * MOTIF_STEP_S,
    midi: TONIC + 24 + tone,
    pan: voice.pan,
    level: MOTIF_LEVEL,
  }));
}
