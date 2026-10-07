import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, startWith, switchMap, takeWhile } from 'rxjs';
import { PageVisibility } from '../presence/page-visibility';
import { LIVE_AGENTS_API } from './live-agents-api';
import { LiveAgent, LiveAgentsState } from './live-agents.types';
import { whileVisible } from './visible-poll';

/** Agents start and stop within minutes; the server keeps each read 5 s. */
export const LIVE_AGENTS_REFRESH_MS = 15_000;

/** The agents running on this machine, read now and every 15 s while the page
 *  is shown. One feed serves the list and every badge. The hosted site has
 *  none to read, so there it reads once and stops. */
@Injectable({ providedIn: 'root' })
export class LiveAgentsFeed {
  private readonly api = inject(LIVE_AGENTS_API);
  private readonly current = signal<LiveAgentsState>({ status: 'reading' });
  private readonly retries = new Subject<void>();

  readonly state = this.current.asReadonly();
  /** The running agents; none until they have been read. */
  readonly agents: Signal<readonly LiveAgent[]> = computed(() => {
    const state = this.current();
    return state.status === 'ready' ? state.agents : [];
  });

  constructor() {
    const isHidden = toObservable(inject(PageVisibility).isHidden);
    this.retries
      .pipe(
        startWith(undefined),
        switchMap(() => whileVisible(isHidden, LIVE_AGENTS_REFRESH_MS, () => this.api.list())),
        takeWhile((state) => state.status !== 'local-only', true),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.current.set(state));
  }

  /** Reads again now, after a failed read. */
  retry(): void {
    this.current.set({ status: 'reading' });
    this.retries.next();
  }
}
