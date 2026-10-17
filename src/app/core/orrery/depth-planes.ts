import { CAMERA_DISTANCE, clampScale } from './orrery-camera';
import { FIELD_DEEPEST } from './star-field';
import { dialRadius, SUN_CORONA_REACH, sunPlacement } from './sun-placement';
import { AIR_SCALE, OrreryWorld, RING_OUTER, farthestMoon } from './world-layout';

/** The distances from the 3D camera, along its line of sight, that it draws between. */
export interface DepthPlanes {
  readonly near: number;
  readonly far: number;
}

/** Room beyond the furthest thing, for the lines' width and rounding. */
const MARGIN = 200;
/** The nearest plane the camera may use, whatever the system's size, so it never reaches behind the lens. */
const MIN_NEAR = 1;
/** A 24-bit depth buffer has this many steps. */
const DEPTH_STEPS = 2 ** 24;

/** The furthest a world's air, ring or moons reach from its centre. Moons are
 *  largest at the smallest scale, so that is the one measured. */
const worldReach = (radius: number): number =>
  Math.max(AIR_SCALE * radius, RING_OUTER * radius, farthestMoon(radius, clampScale(0)));

/** How far toward the camera anything in the system reaches from the plane
 *  through the Earth. A point on a tilted orbit is never further out of the
 *  plane than it is from the Earth, so an orbit's radius bounds its height. */
const reachTowardCamera = (worlds: readonly OrreryWorld[]): number =>
  Math.max(
    dialRadius(worlds),
    sunPlacement(worlds).radius * SUN_CORONA_REACH,
    ...worlds.map((world) => world.orbit + worldReach(world.radius)),
  );

/**
 * The near and far planes that hug the scene: near in front of the furthest
 * thing toward the camera, far behind the deepest field star. The closer they
 * hug it, the finer a gap the depth buffer can tell apart (see `depthStep`).
 * Zoom moves the field of view, not the camera, so they hold at every zoom.
 */
export function depthPlanes(worlds: readonly OrreryWorld[]): DepthPlanes {
  return {
    near: Math.max(MIN_NEAR, CAMERA_DISTANCE - reachTowardCamera(worlds) - MARGIN),
    far: CAMERA_DISTANCE + FIELD_DEEPEST + MARGIN,
  };
}

/** How far apart two surfaces must be, along the line of sight at `distance`
 *  from the camera, to land on different steps of a 24-bit depth buffer. */
export const depthStep = (distance: number, { near, far }: DepthPlanes): number =>
  (distance * distance * (1 / near - 1 / far)) / DEPTH_STEPS;
