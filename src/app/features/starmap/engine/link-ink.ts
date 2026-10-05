/* The lines between stars, inked like a printed star atlas: one pale silver
   for every constellation, never a bucket's colour, so a trace reads as its own
   layer over the coloured stars. Each segment stops short of the stars it joins. */

/** The constellation lines' ink. No bucket uses it. */
export const LINK_INK = '#d4e0f4';
/** The queue-order flow's ink: the same silver, a shade brighter, drawn dotted. */
export const FLOW_INK = '#eef3ff';
/** Clear sky left round a star, beyond its own size, before a line begins. */
export const LINK_GAP = 7;

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The part of the segment from `a` to `b` left once `trimA` is cut from the
 * `a` end and `trimB` from the `b` end, or null when the cuts meet.
 */
export function trimSegment(
  a: Point3,
  b: Point3,
  trimA: number,
  trimB: number,
): readonly [Point3, Point3] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  if (length <= trimA + trimB) return null;
  const at = (d: number): Point3 => ({
    x: a.x + (dx * d) / length,
    y: a.y + (dy * d) / length,
    z: a.z + (dz * d) / length,
  });
  return [at(trimA), at(length - trimB)];
}
