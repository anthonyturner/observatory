import { ThreadCounts } from '../../../core/queue/pull-ending';
import { rnd } from '../engine/rnd';
import { Departure } from './departure';
import { CueScene, ExitEvent, fromOf, panAt } from './departure-exit';
import { exitBeat } from './exits';

/* The review discussion a pull request carried, shed as it leaves: each thread
   is a spark that peels off the star like debris, red while the thread was
   unresolved and gold once resolved. Both skies and the crackle read the same
   rule from here, timed from the exit's own beats so they cannot drift. */

/** The most sparks one star sheds: thread counts show as they are up to here, which bounds the particle load. */
export const MAX_SPARKS = 12;

export const UNRESOLVED_SPARK = '#ff6f5e';
export const RESOLVED_SPARK = '#ffd36e';

/** How long one spark flies, and how long the star takes to shed them all, in seconds. */
export const SPARK_S = 1.3;
const SHED_S = 0.4;
const LAG_JITTER_S = 0.05;

/** How far a spark travels, in world units, and how far gravity pulls it down by the end. */
const REACH = [90, 190] as const;
const DROP = 36;

/** The pitch of each kind of crackle, in hertz: a low rasp for what is still open, a bright tick for what is settled. */
const CRACKLE_HZ = { unresolved: 2800, resolved: 6200 } as const;
/** More crackle in one refresh than this is mud, so the rest are silent. */
const MAX_CRACKLES_HEARD = 4;

/** One thread, as a spark. */
export interface Spark {
  readonly unresolved: boolean;
  /** Seconds after the star begins to go that it peels off. */
  readonly lagS: number;
  readonly angle: number;
  readonly reach: number;
  /** Scales its crackle's pitch, so no two pops are alike. */
  readonly pitch: number;
}

const whole = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/**
 * How many sparks each kind of thread gets: its real count while they fit, else
 * the cap shared in proportion, so neither kind that has threads vanishes.
 */
export function sparkCounts(threads: ThreadCounts): { unresolved: number; resolved: number } {
  const unresolved = whole(threads.unresolved);
  const resolved = whole(threads.resolved);
  if (unresolved + resolved <= MAX_SPARKS) return { unresolved, resolved };
  const share = Math.round((unresolved / (unresolved + resolved)) * MAX_SPARKS);
  const shown = Math.min(
    Math.max(share, unresolved > 0 ? 1 : 0),
    MAX_SPARKS - (resolved > 0 ? 1 : 0),
  );
  return { unresolved: shown, resolved: MAX_SPARKS - shown };
}

/**
 * The sparks for a pull request's threads: none when they are unknown or there
 * are none. Seeded by the pull request, so a replay peels them off the same way.
 */
export function sparksOf(threads: ThreadCounts | null | undefined, seed: number): Spark[] {
  if (!threads) return [];
  const counts = sparkCounts(threads);
  const random = rnd(seed * 6271 + 11);
  const kinds = [
    ...Array<boolean>(counts.unresolved).fill(true),
    ...Array<boolean>(counts.resolved).fill(false),
  ];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return kinds.map((unresolved, i) => ({
    unresolved,
    lagS: (i / kinds.length) * SHED_S + random() * LAG_JITTER_S,
    angle: random() * Math.PI * 2,
    reach: REACH[0] + random() * (REACH[1] - REACH[0]),
    pitch: 0.85 + random() * 0.3,
  }));
}

/** A spark's colour. */
export const sparkColour = (unresolved: boolean): string =>
  unresolved ? UNRESOLVED_SPARK : RESOLVED_SPARK;

/** News as the sparks read it: an exit, and the threads its pull request ended with. */
export interface SparkEvent extends ExitEvent {
  readonly pr: number;
  readonly departure?: Pick<Departure, 'ending'>;
}

const sparksOfEvent = (ev: SparkEvent): Spark[] => sparksOf(ev.departure?.ending?.threads, ev.pr);

/** A spark in the air: its place in the world, how bright and how big. */
export interface FlyingSpark {
  readonly unresolved: boolean;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** 0 to 1. */
  readonly alpha: number;
  /** In pixels. */
  readonly size: number;
}

/** The spark `q` (0 to 1) through its flight from `from`: fast away from the star, slowing, drooping. */
function fly(spark: Spark, from: { x: number; y: number; z: number }, q: number): FlyingSpark {
  const travel = spark.reach * (1 - (1 - q) ** 2);
  return {
    unresolved: spark.unresolved,
    x: from.x + Math.cos(spark.angle) * travel,
    y: from.y + Math.sin(spark.angle) * travel + DROP * q * q,
    z: from.z,
    alpha: Math.min(1, q * 10) * (1 - q) ** 1.5,
    size: 3 * (1 - q * 0.6),
  };
}

/**
 * The sparks in the air at `wall`, peeling off from the moment the exit's star
 * begins to go. Nothing before it begins or once they have landed, and nothing
 * for news with no exit or no known threads.
 */
export function sparksInFlight(ev: SparkEvent, wall: number): FlyingSpark[] {
  const begin = exitBeat(ev, 'begin');
  if (begin == null) return [];
  const from = fromOf(ev);
  return sparksOfEvent(ev).flatMap((spark) => {
    const q = (wall - begin - spark.lagS) / SPARK_S;
    return q > 0 && q < 1 ? [fly(spark, from, q)] : [];
  });
}

/** One crackle: when it pops (seconds after the star begins to go) and how it is pitched. */
export interface CracklePop {
  readonly atS: number;
  readonly hz: number;
  readonly unresolved: boolean;
}

/** The crackle of one star's sparks. */
export interface SparkCue {
  /** Seconds until the star begins to go. */
  readonly delayS: number;
  /** -1 left to 1 right. */
  readonly pan: number;
  readonly pops: readonly CracklePop[];
}

/**
 * A crackle for each pull request that sheds sparks, no more than a few: one
 * pop as each spark peels off, from the side of the screen its star stood on.
 * Only an exit the diff found and that has started has one; with motion off
 * nothing peels, so nothing is heard.
 */
export function sparkCues(
  events: readonly SparkEvent[],
  { now, width, frozen, project }: Pick<CueScene, 'now' | 'width' | 'frozen' | 'project'>,
): SparkCue[] {
  if (frozen) return [];
  return events
    .flatMap((ev) => {
      const begin = exitBeat(ev, 'begin');
      const sparks = sparksOfEvent(ev);
      if (begin == null || !sparks.length) return [];
      const from = fromOf(ev);
      return [
        {
          delayS: Math.max(0, begin - now),
          pan: panAt(project(from.x, from.y, from.z).x, width),
          pops: sparks.map((spark) => ({
            atS: spark.lagS,
            hz: CRACKLE_HZ[spark.unresolved ? 'unresolved' : 'resolved'] * spark.pitch,
            unresolved: spark.unresolved,
          })),
        },
      ];
    })
    .slice(0, MAX_CRACKLES_HEARD);
}
