import { Injectable, Signal, signal } from '@angular/core';

/** The one project lit on the core, by its repo: from its card or its dot. */
@Injectable({ providedIn: 'root' })
export class LitProject {
  private readonly lit = signal<string | null>(null);

  readonly key: Signal<string | null> = this.lit.asReadonly();

  light(key: string): void {
    this.lit.set(key);
  }

  /** Unlights `key` only if it is still the lit one, so a late leave never darkens another. */
  unlight(key: string): void {
    if (this.lit() === key) this.lit.set(null);
  }
}
