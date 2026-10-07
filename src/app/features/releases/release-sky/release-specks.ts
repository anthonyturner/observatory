import { seededRandom } from '../../../core/instrument/seeded-random';
import { PlacedRelease, PlacedWeek } from './release-layout';
import { Stage, pathAt } from './release-path';

/* Each merged pull request is a speck. One a release shipped circles its
   star on a tilted ring; one still unreleased streams back along the
   comet's tail inside its week's knot. Every draw is seeded by the pull
   request's number, so a speck keeps its ring and its lane on every load. */

/** A pull request's fixed draws, made once. */
export interface SpeckDraws {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  /** Three draws summed lean toward the middle: a tail densest on its centre line. */
  readonly across: number;
}

/** Where a speck is this frame, and how bright. */
export interface Speck {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly alpha: number;
  /** On the far side of its star's ring, so drawn before the star and dimmer. */
  readonly isBehind: boolean;
}

/** A moment of the sky: its scene time, and the stage the path runs through. */
export interface SkyMoment {
  readonly time: number;
  readonly stage: Stage;
}

const SEED_SALT = 7919;
const TURN = Math.PI * 2;
/** The ring's tilt and how flat it is seen. */
const RING_TILT = -0.32;
const RING_SQUASH = 0.36;
const RING_INNER = 1.6;
const RING_WIDTH = 1.4;
const RING_PAD_PX = 4;
/** Radians a second for an inner speck; outer ones are slower. */
const ORBIT_SPEED = 0.16;
const BEHIND_DIM = 0.4;
/** How many times a second a tail speck runs the length of its week's knot. */
const TAIL_FLOW = 0.018;
const SPECK_SIZE = 0.9;
const SPECK_GROWTH = 0.8;

export function speckDraws(number: number): SpeckDraws {
  const random = seededRandom(number * SEED_SALT);
  const [a, b, c] = [random(), random(), random()];
  return { a, b, c, across: (random() + random() + random()) / 1.5 - 1 };
}

/** A shipped pull request on its release's ring. */
export function ringSpeck(release: PlacedRelease, draws: SpeckDraws, time: number): Speck {
  const radius = release.radius * (RING_INNER + RING_WIDTH * draws.a) + RING_PAD_PX * release.depth;
  const angle = draws.b * TURN + (time * ORBIT_SPEED) / (0.6 + draws.a);
  const along = Math.cos(angle) * radius;
  const across = Math.sin(angle) * radius * RING_SQUASH;
  const isBehind = Math.sin(angle) < 0;
  return {
    x: release.x + along * Math.cos(RING_TILT) - across * Math.sin(RING_TILT),
    y: release.y + along * Math.sin(RING_TILT) + across * Math.cos(RING_TILT),
    size: release.depth * (SPECK_SIZE + SPECK_GROWTH * draws.c),
    alpha: (0.55 + 0.45 * draws.c) * (isBehind ? BEHIND_DIM : 1),
    isBehind,
  };
}

/** An unreleased pull request drifting back through its week's knot, fading in and out at its ends. */
export function tailSpeck(week: PlacedWeek, draws: SpeckDraws, moment: SkyMoment): Speck {
  const flow = (draws.a + moment.time * TAIL_FLOW * (0.6 + 0.8 * draws.b)) % 1;
  const point = pathAt(week.t + week.reach * (1 - 2 * flow), moment.stage);
  const offset = draws.across * week.spread;
  return {
    x: point.x - point.dy * offset,
    y: point.y + point.dx * offset,
    size: point.depth * (SPECK_SIZE + SPECK_GROWTH * draws.c),
    alpha: Math.sin(Math.PI * flow) * (0.5 + 0.5 * draws.c),
    isBehind: false,
  };
}
