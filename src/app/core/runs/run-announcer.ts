import { Injectable, signal } from '@angular/core';

/** What a screen reader hears of a run: milestones only, each said once per
 *  run. A streamed line each would drown it. */
@Injectable({ providedIn: 'root' })
export class RunAnnouncer {
  private readonly told = new Map<string, Set<string>>();
  private readonly latest = signal('');

  readonly said = this.latest.asReadonly();

  say(runId: string, text: string | undefined): void {
    if (!text) return;
    const told = this.told.get(runId) ?? new Set<string>();
    if (told.has(text)) return;
    told.add(text);
    this.told.set(runId, told);
    this.latest.set(text);
  }
}
