import { Signal, WritableSignal, signal } from '@angular/core';

/** The whole numbers a setting allows, and the one it starts at. */
export interface WholeNumberRange {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

/** A whole number within a range, kept in local storage under its key; where
 *  storage is blocked it lasts for this visit. */
export abstract class StoredWholeNumber {
  private readonly current: WritableSignal<number>;

  readonly value: Signal<number>;

  protected constructor(
    private readonly storageKey: string,
    private readonly range: WholeNumberRange,
  ) {
    this.current = signal(this.readStored());
    this.value = this.current.asReadonly();
  }

  set(value: number): void {
    const kept = this.clamp(value);
    this.current.set(kept);
    this.store(kept);
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return this.range.fallback;
    return Math.min(Math.max(Math.round(value), this.range.min), this.range.max);
  }

  /** Private windows and blocked site data throw here; the fallback then holds. */
  private readStored(): number {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored === null ? this.range.fallback : this.clamp(Number(stored));
    } catch {
      return this.range.fallback;
    }
  }

  private store(value: number): void {
    try {
      localStorage.setItem(this.storageKey, String(value));
    } catch {
      return;
    }
  }
}
