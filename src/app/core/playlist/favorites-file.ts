import { Track } from './playlist.types';
import { isTrack } from './track-guard';

/** Marks a file as Observatory's favourites, so any other JSON is turned away. */
const FORMAT = 'observatory.favorites';
/** Raise it only for a change older copies could not read: files of any other version are turned away. */
const VERSION = 1;
const INDENT = 2;
const FILE_PREFIX = 'observatory-favorites';

export const FAVORITES_FILE_TYPE = 'application/json';

interface FavoritesFile {
  readonly format: typeof FORMAT;
  readonly version: typeof VERSION;
  readonly exportedAt: string;
  readonly tracks: readonly Track[];
}

/** What a picked file holds: not an export at all, or an export's valid tracks
 *  and how many of its entries were not tracks. */
export type FavoritesFileRead =
  | { readonly isExport: false }
  | { readonly isExport: true; readonly tracks: readonly Track[]; readonly invalid: number };

export function favoritesFileOf(tracks: readonly Track[], exportedAt: Date): string {
  const file: FavoritesFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: exportedAt.toISOString(),
    tracks,
  };
  return JSON.stringify(file, null, INDENT);
}

/** Named for the local day, e.g. observatory-favorites-2026-10-03.json. */
export function favoritesFileNameOf(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${FILE_PREFIX}-${day.getFullYear()}-${month}-${date}.json`;
}

/** The file is outside the program: entries that are not tracks are counted and dropped. */
export function readFavoritesFile(text: string): FavoritesFileRead {
  const entries = exportedEntriesOf(text);
  if (!entries) return { isExport: false };
  const tracks = entries.filter(isTrack);
  return { isExport: true, tracks, invalid: entries.length - tracks.length };
}

function exportedEntriesOf(text: string): readonly unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { format, version, tracks } = parsed as Record<string, unknown>;
  if (format !== FORMAT || version !== VERSION || !Array.isArray(tracks)) return null;
  return tracks;
}
