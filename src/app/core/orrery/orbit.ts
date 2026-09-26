import { OrreryWorld } from './world-layout';

export interface OrbitPoint {
  readonly x: number;
  readonly y: number;
  /** Toward the viewer: positive in front of the sun, negative behind. */
  readonly z: number;
}

/** How flat the common orbital plane looks from the viewer's seat. */
export const ORBIT_SQUASH = 0.56;

/** A point on a circular orbit of `radius`, seen from above the plane at an
 *  angle, so it draws as an ellipse `radius` wide and `radius * (squash + tilt)` tall. */
export function orbitPoint(radius: number, angle: number, tilt = 0): OrbitPoint {
  const inclination = Math.acos(ORBIT_SQUASH + tilt);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * Math.cos(inclination),
    z: Math.sin(angle) * radius * Math.sin(inclination),
  };
}

/** Where a world is at scene time `time`, in seconds. */
export const worldPosition = (world: OrreryWorld, time: number): OrbitPoint =>
  orbitPoint(world.orbit, world.angle + time * world.speed, world.tilt);

/** How far a world has grown in, from 0 to 1, eased out. */
export function growth(world: OrreryWorld, sinceShown: number): number {
  const progress = sinceShown - world.delay;
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return 1 - Math.pow(1 - progress, 3);
}
