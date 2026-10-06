import { Injectable, Signal, signal } from '@angular/core';

/** Idle days before a pull request starts to fall, unless the viewer chose otherwise. */
export const DEFAULT_STALE_DAYS = 14;
/** The same range a snooze allows. */
export const MIN_STALE_DAYS = 1;
export const MAX_STALE_DAYS = 90;
const STORAGE_KEY = 'observatory.black-hole-days';

/** How long a pull request may sit idle before the black hole pulls it in,
 *  remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class BlackHoleSetting {
  private readonly chosen = signal(readStoredDays());

  readonly staleAfterDays: Signal<number> = this.chosen.asReadonly();

  set(days: number): void {
    const next = clampDays(days);
    this.chosen.set(next);
    storeDays(next);
  }
}

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_STALE_DAYS;
  return Math.min(Math.max(Math.round(days), MIN_STALE_DAYS), MAX_STALE_DAYS);
}

/** Private windows and blocked site data throw here; the default then holds. */
function readStoredDays(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? DEFAULT_STALE_DAYS : clampDays(Number(stored));
  } catch {
    return DEFAULT_STALE_DAYS;
  }
}

/** Where storage is blocked the choice lasts for this visit only. */
function storeDays(days: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(days));
  } catch {
    return;
  }
}
