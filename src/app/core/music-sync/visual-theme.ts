import { Genre, Track } from '../playlist/playlist.types';

/** The ways the sky can move with a track. */
export const MOTIFS = ['shockwave', 'warp', 'aurora', 'nebula'] as const;
export type Motif = (typeof MOTIFS)[number];

/** How the sky looks for one track: a motif of its own, coloured by its genre. */
export interface VisualTheme {
  readonly motif: Motif;
  readonly palette: Genre;
}

/** The same track always looks the same; neighbouring tracks rarely do. */
export function themeFor(track: Track): VisualTheme {
  return { motif: MOTIFS[hashOf(track.videoId) % MOTIFS.length], palette: track.genre };
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
