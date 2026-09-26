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
