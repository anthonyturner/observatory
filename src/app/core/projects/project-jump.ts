import { Injectable, Signal, signal } from '@angular/core';

/** A request to bring a project's card into view. `id` is new on every request,
 *  so clicking the same dot twice jumps twice. */
export interface JumpRequest {
  readonly key: string;
  readonly id: number;
}

/** Carries a jump from a dot on the core to its project's card. */
@Injectable({ providedIn: 'root' })
export class ProjectJump {
  private readonly latest = signal<JumpRequest | null>(null);
  private nextId = 0;

  readonly request: Signal<JumpRequest | null> = this.latest.asReadonly();

  jumpTo(key: string): void {
    this.nextId++;
    this.latest.set({ key, id: this.nextId });
  }
}
