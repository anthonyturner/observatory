import { DoneItem } from '../../../core/queue/done-work';

/* Where finished work sits on the galaxy: a spiral arm is a timeline, so the
   newest work is out at the arm tips and older work winds in to the core. */

/** The innermost and outermost radius work is placed at, in galaxy units. */
export const DONE_INNER = 0.035;
export const DONE_OUTER = 0.22;
/** The arm spans the work actually shown, oldest at the core, but never less
 *  than a week, so a young repository's few days are not stretched thin. */
const MIN_SPAN_DAYS = 7;
const DAY_MS = 86_400_000;
/** Ages are eased so recent days get more of the arm than old ones. */
const AGE_EASE = 0.6;
/** How far a light may sit off its arm's centre line, in radians either way. */
const LEAN = 0.22;
/** And how far along the radius, so a busy day does not stack on one point. */
const SPREAD = 0.012;

/** One finished thing, placed on the galaxy. */
export interface DonePlace {
  readonly item: DoneItem;
  /** Distance from the core. */
  readonly r: number;
  /** Which of the two arms. */
  readonly arm: 0 | 1;
  /** Its angle off the arm's centre line. */
  readonly lean: number;
  /** Its order of arrival, oldest first, so the core fills before the tips. */
  readonly rank: number;
}

/** A stable number in [0, 1) from a key, so a light keeps its place across reloads. */
function unit(key: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** Each finished thing on an arm, at a radius set by how long ago it finished,
 *  the oldest shown at the core and today at the tips. */
export function placeDone(items: readonly DoneItem[], now: number): DonePlace[] {
  const oldestFirst = [...items].sort((a, b) => a.at - b.at);
  const oldest = oldestFirst.length ? (now - oldestFirst[0].at) / DAY_MS : 0;
  const span = Math.max(oldest, MIN_SPAN_DAYS);
  return oldestFirst.map((item, rank) => {
    const age = Math.min(Math.max((now - item.at) / DAY_MS, 0), span) / span;
    const r = DONE_OUTER - (DONE_OUTER - DONE_INNER) * Math.pow(age, AGE_EASE);
    return {
      item,
      r: Math.max(DONE_INNER, r + (unit(item.key, 3) - 0.5) * 2 * SPREAD),
      arm: unit(item.key, 1) < 0.5 ? 0 : 1,
      lean: (unit(item.key, 2) - 0.5) * 2 * LEAN,
      rank,
    };
  });
}
