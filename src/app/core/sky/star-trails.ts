import { clamp01 } from '../instrument/easing';
import { DEG } from '../instrument/proportions';
import { seededRandom } from '../instrument/seeded-random';

/* A long exposure: each star is a short arc about the pole, the point the
   core sits at before any scrolling. The arcs are drawn once into an image
   that turns once every twenty minutes, calm and only just noticeable.
   There is one star per open issue across the projects, so the sky fills as
   work piles up and clears as it is done. */

/** A star's colour, named by its token in tokens.css. */
export type StarTint =
  '--star-white' | '--star-ice' | '--star-blue' | '--star-cream' | '--star-amber';

export const STAR_TINTS: readonly StarTint[] = [
  '--star-white',
  '--star-ice',
  '--star-blue',
  '--star-cream',
  '--star-amber',
];

export interface StarTrail {
  /** 0 to 1: how far out from the pole, before the square root that spreads them evenly. */
  readonly spread: number;
  /** Where the arc's bright head sits, in radians. */
  readonly head: number;
  readonly length: number;
  readonly alpha: number;
  readonly width: number;
  /** The head's size, in pixels. */
  readonly size: number;
  readonly tint: StarTint;
  /** When and how fast the head twinkles. */
  readonly phase: number;
  readonly rate: number;
}

/** A trail at its distance from the pole, faded near the core so its rings read. */
export interface PlacedTrail extends StarTrail {
  readonly radius: number;
  readonly fade: number;
}

/** The most stars the sky draws, however many issues are open. */
export const MAX_TRAILS = 600;
/** One turn every twenty minutes. */
export const TRAIL_TURN_PER_S = (Math.PI * 2) / (20 * 60);
const TRAIL_SEED = 8675309;
const BRIGHT_SHARE = 0.06;
/** No trail is drawn inside this many pixels of the pole. */
const INNER_PX = 26;
/** Trails thin out within this many core radii of the pole. */
const CLEARING = 1.5;

/** Every star the sky can hold, the same on every load. The first `n` are
 *  the sky for `n` issues, so one more issue adds one star and moves none.
 *  Even the brightest stays under the 3D core's bloom threshold: only the
 *  core and the beads may glow. */
const ALL_TRAILS: readonly StarTrail[] = (() => {
  const random = seededRandom(TRAIL_SEED);
  return Array.from({ length: MAX_TRAILS }, (): StarTrail => {
    const isBright = random() < BRIGHT_SHARE;
    return {
      spread: random(),
      head: random() * Math.PI * 2,
      length: (16 + random() * 22) * DEG,
      alpha: isBright ? 0.42 + random() * 0.2 : 0.07 + Math.pow(random(), 2.2) * 0.38,
      width: isBright ? 1.1 + random() * 0.5 : 0.55 + random() * 0.5,
      size: isBright ? 0.8 + random() * 0.4 : 0.3 + random() * 0.6,
      tint: STAR_TINTS[Math.floor(random() * STAR_TINTS.length)],
      phase: random() * Math.PI * 2,
      rate: 0.3 + random() * 1.6,
    };
  });
})();

/** One star per open issue, up to MAX_TRAILS. */
export function starTrails(openIssues: number): readonly StarTrail[] {
  return ALL_TRAILS.slice(0, Math.max(0, Math.min(MAX_TRAILS, Math.floor(openIssues))));
}

/** Spreads the trails out to `reach` pixels from the pole, thinning them near a core of `coreRadius`. */
export function placeTrails(
  trails: readonly StarTrail[],
  reach: number,
  coreRadius: number,
): PlacedTrail[] {
  const clearing = coreRadius * CLEARING;
  return trails.map((trail) => {
    const radius = INNER_PX + Math.sqrt(trail.spread) * Math.max(0, reach - INNER_PX);
    const fade = 0.3 + 0.7 * clamp01((radius - clearing * 0.75) / (clearing * 0.6));
    return { ...trail, radius, fade };
  });
}

/** A canvas adds light in screen space, which dims a faint arc far more than
 *  light added in linear space would; this lifts it back, as the sRGB curve does. */
export const liftFaint = (alpha: number): number =>
  Math.min(1, Math.max(0, 1.055 * Math.pow(Math.max(0, alpha), 1 / 2.4) - 0.055));
