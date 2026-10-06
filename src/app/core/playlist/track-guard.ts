import { GENRES, Genre, Track } from './playlist.types';

const VIDEO_ID = /^[\w-]{11}$/;

/** Whether a value read from outside the program (storage, a file) is a track. */
export function isTrack(value: unknown): value is Track {
  if (typeof value !== 'object' || value === null) return false;
  const { videoId, title, artist, genre } = value as Record<string, unknown>;
  return (
    typeof videoId === 'string' &&
    VIDEO_ID.test(videoId) &&
    typeof title === 'string' &&
    typeof artist === 'string' &&
    GENRES.includes(genre as Genre)
  );
}
