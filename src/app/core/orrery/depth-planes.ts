import { CAMERA_DISTANCE } from './orrery-camera';
import { FIELD_DEEPEST } from './star-field';
import { dialRadius, SUN_CORONA_REACH, sunPlacement } from './sun-placement';
import { OrreryWorld } from './world-layout';

/** The distances from the 3D camera, along its line of sight, that it draws between. */
export interface DepthPlanes {
  readonly near: number;
  readonly far: number;
}

/** A world's air, rings and moons reach this many of its radii from its centre. */
const WORLD_REACH = 5;
/** Room beyond the furthest thing, for the smallest moons, the lines' width and rounding. */
const MARGIN = 200;
/** The nearest plane the camera may use, whatever the system's size, so it never reaches behind the lens. */
const MIN_NEAR = 1;
/** A 24-bit depth buffer has this many steps. */
const DEPTH_STEPS = 2 ** 24;

/** How far toward the camera anything in the system reaches from the plane
 *  through the Earth. A point on a tilted orbit is never further out of the
 *  plane than it is from the Earth, so an orbit's radius bounds its height. */
const reachTowardCamera = (worlds: readonly OrreryWorld[]): number =>
  Math.max(
    dialRadius(worlds),
    sunPlacement(worlds).radius * SUN_CORONA_REACH,
    ...worlds.map((world) => world.orbit + world.radius * WORLD_REACH),
  );

/**
 * The near and far planes that hug the scene. The system lies within a few
 * thousand units of the plane, the camera stands 24,000 off, and the deepest
 * field star is 42,000 behind it, so nothing is nearer than `near` or further
 * than `far`. A depth buffer spends its steps where they are put, so closing
 * `near` up to the system shrinks one step at the scene from about 34 units to
 * a few thousandths, and a world's air and cloud shells stay apart from its
 * ground.
 *
 * Zoom moves the field of view and not the camera, so these hold at every zoom.
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
