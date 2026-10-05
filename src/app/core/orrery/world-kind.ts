import { hashString } from './world-layout';

/** What a world is made of. Variety only, never a signal: severity lives in its air. */
export type WorldKind = 'rocky' | 'gas' | 'ice' | 'desert';

/** In the order the surface shader numbers them. */
export const WORLD_KINDS: readonly WorldKind[] = ['rocky', 'gas', 'ice', 'desert'];

/** The same kind for a repo on every load. The low bits of the hash also seed
 *  the surface, so the kind draws on higher ones. */
export const worldKind = (repo: string): WorldKind =>
  WORLD_KINDS[(hashString(repo) >>> 11) % WORLD_KINDS.length];
