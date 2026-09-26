import { ProjectSnapshot } from '../projects/project.types';
import { severityOf } from '../projects/severity';
import { CoreState } from './core-states';
import { plural } from '../../shared/text/plural';

/** How the projects stand, as the core feels it. */
export type MoodName = 'unknown' | 'calm' | 'uneasy' | 'strained';

export interface CoreMood {
  readonly name: MoodName;
  /** 0 calm to 1 strained. Zero while unknown: unknown is shown by colour, not by stress. */
  readonly stress: number;
  /** Why, in words, e.g. "3 blocked projects, 16 stuck PRs". */
  readonly reason: string;
}

export const UNKNOWN_MOOD: CoreMood = {
  name: 'unknown',
  stress: 0,
  reason: 'projects not read yet',
};

/* How much each kind of trouble adds. A blocked project weighs most; each
   stuck PR a little more; a project GitHub has not worked out, or could not
   read, adds some, since unknown is never healthy. The sum runs through
   1 - e^-x, so the first troubles show plainly and a pile-up saturates. */
const BLOCKED_WEIGHT = 0.35;
const STUCK_WEIGHT = 0.04;
const UNSURE_WEIGHT = 0.12;
const UNEASY_FROM = 0.15;
const STRAINED_FROM = 0.6;

/** The mood for a set of read projects. */
export function moodOf(projects: readonly ProjectSnapshot[]): CoreMood {
  const readable = projects.filter((project) => !project.error);
  const blocked = readable.filter((project) => severityOf(project).id === 'blocked').length;
  const stuck = readable.reduce(
    (sum, project) => sum + project.counts.conflicted + project.counts.failing,
    0,
  );
  const unsure =
    projects.length -
    readable.length +
    readable.filter((project) => project.counts.unknown > 0).length;
  const load = blocked * BLOCKED_WEIGHT + stuck * STUCK_WEIGHT + unsure * UNSURE_WEIGHT;
  const stress = 1 - Math.exp(-load);
  return { name: nameOf(stress), stress, reason: reasonOf(blocked, stuck, unsure) };
}

function nameOf(stress: number): MoodName {
  if (stress >= STRAINED_FROM) return 'strained';
  if (stress >= UNEASY_FROM) return 'uneasy';
  return 'calm';
}

function reasonOf(blocked: number, stuck: number, unsure: number): string {
  const parts = [
    blocked ? plural(blocked, 'blocked project') : '',
    stuck ? plural(stuck, 'stuck PR') : '',
    unsure ? `${unsure} not worked out` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nothing blocked';
}

/* How far a fully strained core moves from its state: a quicker, deeper
   breath, a faster turn, and a ripple of unrest through the network. */
const PERIOD_AT_STRAIN = 0.45;
const BREATHE_AT_STRAIN = 2.2;
const TURN_AT_STRAIN = 1.8;
const RIPPLE_AT_STRAIN = 0.3;

/** A state as the mood colours it. The assistant's state still leads: the
 *  mood only quickens and deepens it. */
export function withMood(state: CoreState, mood: CoreMood): CoreState {
  const s = mood.stress;
  return {
    ...state,
    period: state.period * (1 - s * (1 - PERIOD_AT_STRAIN)),
    breathe: state.breathe * (1 + s * (BREATHE_AT_STRAIN - 1)),
    turn: state.turn * (1 + s * (TURN_AT_STRAIN - 1)),
    ripple: Math.max(state.ripple, s * RIPPLE_AT_STRAIN),
  };
}

/** How far the core's colour moves toward the mood's: warm with strain, grey while unknown. */
export const UNEASY_WARMTH = 0.55;
export const UNKNOWN_GREY = 0.45;
