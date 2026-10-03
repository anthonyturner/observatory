import { Injectable, Signal, signal } from '@angular/core';

const STORAGE_KEY = 'observatory.music.milkdrop-opacity';
/** Milkdrop fills the screen, screened over the sky; a touch under full keeps
 *  the beat hits standing out over it. */
export const DEFAULT_MILKDROP_OPACITY = 0.8;

/** How strongly Milkdrop shows over the sky, from 0 (hidden) to 1 (full). Kept
 *  in local storage only; where storage is blocked it lasts for this visit. */
@Injectable({ providedIn: 'root' })
export class MilkdropOpacity {
  private readonly current = signal(readStored());

  readonly level: Signal<number> = this.current.asReadonly();

  set(level: number): void {
    const kept = clamp(level);
    this.current.set(kept);
    store(kept);
  }
}

function clamp(level: number): number {
  return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : DEFAULT_MILKDROP_OPACITY;
}

/** Storage is outside the program: anything that is not a number from 0 to 1 is dropped. */
function readStored(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const level = saved === null ? NaN : Number(saved);
    return Number.isFinite(level) && level >= 0 && level <= 1 ? level : DEFAULT_MILKDROP_OPACITY;
  } catch {
    return DEFAULT_MILKDROP_OPACITY;
  }
}

function store(level: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    return;
  }
}
