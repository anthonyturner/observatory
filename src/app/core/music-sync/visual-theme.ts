import { Genre, Track } from '../playlist/playlist.types';

/** The ways the sky can move with a track. */
export const MOTIFS = ['shockwave', 'warp', 'aurora', 'nebula'] as const;
export type Motif = (typeof MOTIFS)[number];

/** How the sky looks for one track: a motif of its own, coloured by its genre. */
export interface VisualTheme {
  readonly motif: Motif;
  readonly palette: Genre;
}

/** The motif changes every 2–3 minutes of a track. */
const CHANGE_AFTER_S = 120;
const CHANGE_SPREAD_S = 60;

/** The same track always looks the same at the same point; neighbouring tracks
 *  rarely do. */
export function themeFor(track: Track, elapsedS = 0): VisualTheme {
  return { motif: motifAt(track.videoId, elapsedS), palette: track.genre };
}

export function sameTheme(a: VisualTheme, b: VisualTheme): boolean {
  return a.motif === b.motif && a.palette === b.palette;
}

/** A track opens on its own motif, then changes to a different one at random
 *  gaps; the draw is seeded by the track, so a seek or a replay lands on the
 *  same look. */
function motifAt(videoId: string, elapsedS: number): Motif {
  const seed = hashOf(videoId);
  const random = randomFrom(seed);
  const gapS = () => CHANGE_AFTER_S + random() * CHANGE_SPREAD_S;
  let index = seed % MOTIFS.length;
  for (let changeS = gapS(); changeS <= elapsedS; changeS += gapS())
    index = (index + 1 + Math.floor(random() * (MOTIFS.length - 1))) % MOTIFS.length;
  return MOTIFS[index];
}

/** FNV-1a: a small, even spread of short strings over whole numbers. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: a small seeded generator of numbers in [0, 1). */
function randomFrom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
}
