import { ELEVATION } from './proportions';

const COS_ELEVATION = Math.cos(ELEVATION);
const SIN_ELEVATION = Math.sin(ELEVATION);

/** A point in screen pixels about the core's centre: y down, z toward the viewer. */
export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A point given in the equator's own frame, as seen from ELEVATION above. */
export function tilt(x: number, y: number, z: number): Point3 {
  return {
    x,
    y: y * COS_ELEVATION + z * SIN_ELEVATION,
    z: -y * SIN_ELEVATION + z * COS_ELEVATION,
  };
}

/** The same, written into a flat xyz buffer at `index`, for paths of many points. */
export function tiltInto(out: Float32Array, index: number, point: Point3): void {
  const seen = tilt(point.x, point.y, point.z);
  out[index * 3] = seen.x;
  out[index * 3 + 1] = seen.y;
  out[index * 3 + 2] = seen.z;
}
