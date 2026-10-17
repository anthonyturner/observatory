import { ORBIT_SQUASH, OrbitPoint, orbitPoint } from './orbit';
import { OrreryWorld, outermostOrbit, sunRadius } from './world-layout';

/** The dial sits this far beyond the outermost orbit. */
export const DIAL_BEYOND_ORBIT = 100;

/** Where the sun reads on screen, in degrees counter-clockwise from screen-right:
 *  about ten o'clock, clear of the chrome, so it lights the Earth from the side. */
const SUN_SCREEN_BEARING = (150 * Math.PI) / 180;
/** The house names sit just outside the dial's ring, at this multiple of its radius. */
const HOUSE_NAMES_AT = 1.07;
/** Clear space between the sun's disc and the house names. */
const SUN_CLEARANCE = 12;

/** The in-plane angle that projects to the screen bearing, given how flat the plane looks. */
const SUN_PLANE_ANGLE = Math.atan2(
  -Math.sin(SUN_SCREEN_BEARING) / ORBIT_SQUASH,
  Math.cos(SUN_SCREEN_BEARING),
);

/** The sun: where it is, how far it stands from the Earth in the orbital
 *  plane, and its disc's radius. All in orrery units. */
export interface SunPlacement extends OrbitPoint {
  readonly distance: number;
  readonly radius: number;
}

/** What Fit frames: the orbits, and the sun standing off past them. */
export interface SystemExtent {
  readonly outermostOrbit: number;
  readonly sun: SunPlacement;
}

/** The dial's radius: the outermost orbit and a margin for its world and label. */
export const dialRadius = (worlds: readonly OrreryWorld[]): number =>
  outermostOrbit(worlds) + DIAL_BEYOND_ORBIT;

/** The one rule for where the sun is. 3D, 2D, the light, picking and Fit all
 *  read it, so they cannot disagree. It sits at a fixed bearing that does not
 *  turn with the dial, just outside the house names, and it keeps its size.
 *
 *  It is at the Earth's depth, not on the tilted plane's far side: a sun that
 *  reads as ten o'clock on the plane stands well behind the Earth, and would
 *  light only a thin crescent of it. At the Earth's depth the light comes from
 *  the side, and the terminator runs about vertical. */
export function sunPlacement(worlds: readonly OrreryWorld[]): SunPlacement {
  const radius = sunRadius(worlds);
  const distance = HOUSE_NAMES_AT * dialRadius(worlds) + radius + SUN_CLEARANCE;
  const { x, y } = orbitPoint(distance, SUN_PLANE_ANGLE);
  return { x, y, z: 0, distance, radius };
}

export const systemExtent = (worlds: readonly OrreryWorld[]): SystemExtent => ({
  outermostOrbit: outermostOrbit(worlds),
  sun: sunPlacement(worlds),
});

/** Toward the sun from a point of the plane, in radians: the side that point is lit from. */
export const sunwardAngle = (
  from: { readonly x: number; readonly y: number },
  sun: { readonly x: number; readonly y: number },
): number => Math.atan2(sun.y - from.y, sun.x - from.x);
