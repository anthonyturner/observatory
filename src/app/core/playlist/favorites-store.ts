import { Injectable, Signal, computed, signal } from '@angular/core';
import { Genre, Track } from './playlist.types';

const STORAGE_KEY = 'observatory.playlist.favorites';
const GENRES: readonly Genre[] = ['trance', 'techno'];
const VIDEO_ID = /^[\w-]{11}$/;

/** The tracks hearted on this browser, oldest first. Kept in local storage
 *  only; where storage is blocked they last for this visit. */
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly saved = signal<readonly Track[]>(readStored());
  private readonly ids = computed(() => new Set(this.saved().map((track) => track.videoId)));

  readonly tracks: Signal<readonly Track[]> = this.saved.asReadonly();
  readonly count = computed(() => this.saved().length);

  has(videoId: string): boolean {
    return this.ids().has(videoId);
  }

  /** Hearts a track that is not a favourite, and un-hearts one that is. */
  toggle(track: Track): void {
    this.saved.update((tracks) =>
      this.has(track.videoId)
        ? tracks.filter((each) => each.videoId !== track.videoId)
        : [...tracks, track],
    );
    store(this.saved());
  }
}

/** Storage is outside the program: anything that is not a list of tracks is dropped. */
function readStored(): readonly Track[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isTrack) : [];
  } catch {
    return [];
  }
}

function store(tracks: readonly Track[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  } catch {
    return;
  }
}

function isTrack(value: unknown): value is Track {
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
