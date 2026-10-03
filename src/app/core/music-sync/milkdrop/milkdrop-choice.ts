import { Injectable, Signal, signal } from '@angular/core';
import { CURATED_PRESETS } from './milkdrop-presets';

const STORAGE_KEY = 'observatory.music.milkdrop-preset';

/** The Milkdrop preset picked to stay on screen, or null for Auto: the preset
 *  each look picks as the music changes. Kept in local storage only; where
 *  storage is blocked it lasts for this visit. */
@Injectable({ providedIn: 'root' })
export class MilkdropChoice {
  private readonly current = signal(readStored());

  readonly preset: Signal<string | null> = this.current.asReadonly();
  readonly presets: readonly string[] = CURATED_PRESETS;

  /** Keeps `preset` on screen; null, or a name not on the list, means Auto. */
  choose(preset: string | null): void {
    const kept = known(preset);
    this.current.set(kept);
    store(kept);
  }
}

function known(preset: string | null): string | null {
  return preset !== null && CURATED_PRESETS.includes(preset) ? preset : null;
}

/** Storage is outside the program: a name not on the list is dropped. */
function readStored(): string | null {
  try {
    return known(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function store(preset: string | null): void {
  try {
    if (preset === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preset);
  } catch {
    return;
  }
}
