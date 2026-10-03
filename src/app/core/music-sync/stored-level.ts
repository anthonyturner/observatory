import { Signal, WritableSignal, signal } from '@angular/core';

/** A level from 0 to 1, kept in local storage under its key; where storage is
 *  blocked it lasts for this visit. */
export abstract class StoredLevel {
  private readonly current: WritableSignal<number>;

  readonly level: Signal<number>;

  protected constructor(
    private readonly storageKey: string,
    private readonly fallback: number,
  ) {
    this.current = signal(this.readStored());
    this.level = this.current.asReadonly();
  }

  set(level: number): void {
    const kept = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : this.fallback;
    this.current.set(kept);
    this.store(kept);
  }

  /** Storage is outside the program: anything that is not a number from 0 to 1 is dropped. */
  private readStored(): number {
    try {
      const saved = localStorage.getItem(this.storageKey);
      const level = saved === null ? NaN : Number(saved);
      return Number.isFinite(level) && level >= 0 && level <= 1 ? level : this.fallback;
    } catch {
      return this.fallback;
    }
  }

  private store(level: number): void {
    try {
      localStorage.setItem(this.storageKey, String(level));
    } catch {
      return;
    }
  }
}
