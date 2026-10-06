import { Injectable, Signal, computed, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.playlist.video-size';
const SIZES = ['usual', 'smaller', 'larger'] as const;

export type VideoCardSizeName = (typeof SIZES)[number];

/** How big the playlist's video card is. Smaller and larger each toggle against the
 *  usual size, so choosing one turns the other off. Kept in local storage; where
 *  storage is blocked it lasts for this visit. */
@Injectable({ providedIn: 'root' })
export class VideoCardSize {
  private readonly size = signal(readStored());

  readonly current: Signal<VideoCardSizeName> = this.size.asReadonly();
  readonly isSmaller = computed(() => this.size() === 'smaller');
  readonly isLarger = computed(() => this.size() === 'larger');

  toggleSmaller(): void {
    this.choose(this.isSmaller() ? 'usual' : 'smaller');
  }

  toggleLarger(): void {
    this.choose(this.isLarger() ? 'usual' : 'larger');
  }

  private choose(size: VideoCardSizeName): void {
    this.size.set(size);
    store(size);
  }
}

function isSizeName(value: string | null): value is VideoCardSizeName {
  return SIZES.some((size) => size === value);
}

/** Storage is outside the program: anything but a known size reads as usual. */
function readStored(): VideoCardSizeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSizeName(stored) ? stored : 'usual';
  } catch {
    return 'usual';
  }
}

function store(size: VideoCardSizeName): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    return;
  }
}
