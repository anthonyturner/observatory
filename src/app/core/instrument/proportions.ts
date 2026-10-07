/* The instrument's proportions, in core radii, and the angles it is seen at.
   Every renderer draws the same instrument from these numbers. */

export const DEG = Math.PI / 180;

/** The ball, the beads' orbit just clear of it so a bead never sinks into the
 *  ball, and the tier ring outside that. */
export const BALL = 1.18;
export const ORBIT = 1.3;
export const TIER_RING = 1.44;

/** How far above the equator the viewer looks from. */
export const ELEVATION = 24 * DEG;
/** How far the tier ring is rolled off the orbit. */
export const ECLIPTIC = 23.4 * DEG;
/** Camera distance: enough perspective to see depth, not enough to distort. */
export const CAMERA_DEPTH = 2400;
