import { hashString } from '../orrery/world-layout';
import { WorldKind, worldKind } from '../orrery/world-kind';
import { Heat } from './architecture-graph';

/** How a node's planet is painted: what it is made of, and which way its sun lies. */
export interface PlanetLook {
  readonly kind: WorldKind;
  readonly seed: number;
  /** A unit vector from the planet toward the sun, in the map's y-down plane. */
  readonly towardSun: { readonly x: number; readonly y: number };
}

/** The token each heat's air is drawn in, so heat still reads at a glance. */
export const AIR_TOKEN: Readonly<Record<Heat, string>> = {
  plain: 'flow',
  hot: 'bad-soft',
  unused: 'faint',
};

/** The same kind and surface for a node on every load, as the orrery does for a repo. */
export function planetLook(id: string, x: number, y: number): PlanetLook {
  const distance = Math.hypot(x, y) || 1;
  return {
    kind: worldKind(id),
    seed: hashString(id) % 997,
    towardSun: { x: -x / distance, y: -y / distance },
  };
}
