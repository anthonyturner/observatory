import { Injectable, Signal, computed, signal } from '@angular/core';

/** The lever's stops, as multiples of the trails' natural turn of once every twenty minutes. */
export const TRAIL_SPEEDS: readonly number[] = [0, 0.5, 1, 2, 5, 10, 25, 50, 100];
const NATURAL = TRAIL_SPEEDS.indexOf(1);
const STORAGE_KEY = 'observatory.trail-speed';

/** How fast Home's star trails turn about the core, remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class TrailSpeed {
  private readonly chosen = signal(readStoredStop());

  /** Which of TRAIL_SPEEDS the lever sits at. */
  readonly stop: Signal<number> = this.chosen.asReadonly();
  readonly multiplier: Signal<number> = computed(() => TRAIL_SPEEDS[this.chosen()]);

  set(stop: number): void {
    const next = clampStop(stop);
    this.chosen.set(next);
    storeStop(next);
  }
}

function clampStop(stop: number): number {
  return Number.isInteger(stop) ? Math.min(Math.max(stop, 0), TRAIL_SPEEDS.length - 1) : NATURAL;
}

/** Private windows and blocked site data throw here; the natural pace then holds. */
function readStoredStop(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? NATURAL : clampStop(Number(stored));
  } catch {
    return NATURAL;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function storeStop(stop: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(stop));
  } catch {
    return;
  }
}
