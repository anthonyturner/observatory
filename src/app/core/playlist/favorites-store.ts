import { Injectable, Signal, computed, signal } from '@angular/core';
import { Track } from './playlist.types';
import { isTrack } from './track-guard';

const STORAGE_KEY = 'observatory.playlist.favorites';

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

  /** Hearts each track not already a favourite, after the ones already hearted. */
  addAll(tracks: readonly Track[]): void {
    this.saved.update((saved) => mergedByVideoId(saved, tracks));
    store(this.saved());
  }
}

function mergedByVideoId(saved: readonly Track[], incoming: readonly Track[]): readonly Track[] {
  const seen = new Set(saved.map((track) => track.videoId));
  const added = incoming.filter((track) => {
    if (seen.has(track.videoId)) return false;
    seen.add(track.videoId);
    return true;
  });
  return added.length === 0 ? saved : [...saved, ...added];
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
