/** A world as drawn this frame, in screen pixels. */
export interface DrawnWorld {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** A small world is still easy to hit: its target reaches this far... */
const MIN_HIT_RADIUS = 20;
/** ...or this far beyond its disc, whichever is more. */
const HIT_REACH = 1.7;

/** The world under the pointer. A pointer on a disc beats a neighbour's
 *  forgiving reach; otherwise the nearest wins. */
export function pickWorld(drawn: readonly DrawnWorld[], sx: number, sy: number): string | null {
  let best: { key: string; inside: boolean; distance: number } | null = null;
  for (const world of drawn) {
    const distance = Math.hypot(world.x - sx, world.y - sy);
    if (distance >= Math.max(world.radius * HIT_REACH, MIN_HIT_RADIUS)) continue;
    const inside = distance < world.radius;
    const better =
      !best || (inside && !best.inside) || (inside === best.inside && distance < best.distance);
    if (better) best = { key: world.key, inside, distance };
  }
  return best?.key ?? null;
}

/** A disc that hides what is behind it: a body at depth `z`, in screen pixels. */
export interface Occluder {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

/** Whether a world's centre is hidden by a disc in front of it: nearer the
 *  viewer than the world, and with the world's centre inside its edge. */
export const isOccluded = (
  world: { readonly x: number; readonly y: number; readonly z: number },
  occluders: readonly Occluder[],
): boolean =>
  occluders.some(
    (disc) => world.z < disc.z && Math.hypot(world.x - disc.x, world.y - disc.y) < disc.radius,
  );
