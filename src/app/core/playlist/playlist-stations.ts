import { InjectionToken } from '@angular/core';
import { MUSIC_POOL } from './music-pool';
import { pickShuffled } from './playlist-order';
import { Genre, Track } from './playlist.types';
import { TECH_POOL } from './tech-pool';

export type StationId = 'music' | 'ai' | 'git' | 'learn';

/** A list the playlist can tune to: one kind of video, shuffled afresh each visit. */
export interface Station {
  readonly id: StationId;
  readonly label: string;
  readonly tracks: readonly Track[];
}

interface StationPlan {
  readonly id: StationId;
  readonly label: string;
  readonly genres: readonly Genre[];
}

/** In the picker's order; the first is the one a visit opens on. */
const STATION_PLANS: readonly StationPlan[] = [
  { id: 'music', label: 'Music', genres: ['trance', 'techno'] },
  { id: 'ai', label: 'AI', genres: ['ai'] },
  { id: 'git', label: 'Git & GitHub', genres: ['git'] },
  { id: 'learn', label: 'Learn', genres: ['learn'] },
];

/** How many videos one visit's station holds. */
const STATION_SIZE = 12;

/** Each station's share of `pool`: up to `size` of its videos, in a random order. */
export function stationsFrom(
  pool: readonly Track[],
  size: number,
  random: () => number,
): Station[] {
  return STATION_PLANS.map(({ id, label, genres }) => ({
    id,
    label,
    tracks: pickShuffled(
      pool.filter((track) => genres.includes(track.genre)),
      size,
      random,
    ),
  }));
}

/** The stations, every one holding at least one video. */
export const PLAYLIST_STATIONS = new InjectionToken<readonly Station[]>('PLAYLIST_STATIONS', {
  providedIn: 'root',
  factory: () => stationsFrom([...MUSIC_POOL, ...TECH_POOL], STATION_SIZE, Math.random),
});
