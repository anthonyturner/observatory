import { hashString } from './world-layout';

/** What a world is made of. Variety only, never a signal: severity lives in its air. */
export type WorldKind = 'rocky' | 'gas' | 'ice' | 'desert';

/** In the order the surface shader numbers them. */
export const WORLD_KINDS: readonly WorldKind[] = ['rocky', 'gas', 'ice', 'desert'];

/** How much of each kind's sky is cloud. A gas giant is all cloud already. */
export const CLOUD_COVER: Readonly<Record<WorldKind, number>> = {
  rocky: 0.55,
  gas: 0,
  ice: 0.3,
  desert: 0.15,
};

/** The same kind for a repo on every load. The low bits of the hash also seed
 *  the surface, so the kind draws on higher ones. */
export const worldKind = (repo: string): WorldKind =>
  WORLD_KINDS[(hashString(repo) >>> 11) % WORLD_KINDS.length];
