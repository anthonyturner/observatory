import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, Signal, computed, inject, linkedSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, scan, switchMap } from 'rxjs';
import { Clock } from '../time/clock';
import { localDayKey } from '../usage/usage-format';
import { Principle, PrinciplesState } from './principle.types';
import { parsePrinciplesReport, placeIn } from './principles-parse';

/** Reads the principles for a local calendar day (`YYYY-MM-DD`), as a state that never errors. */
export type PrinciplesRead = (day: string) => Observable<PrinciplesState>;

const PRINCIPLES_URL = '/api/principles';

/** One read of the principles from Observatory's API. */
export const PRINCIPLES_READ = new InjectionToken<PrinciplesRead>('PRINCIPLES_READ', {
  providedIn: 'root',
  factory: () => {
    const http = inject(HttpClient);
    return (day) =>
      http.get<unknown>(PRINCIPLES_URL, { params: { day } }).pipe(
        map((body): PrinciplesState => {
          const report = parsePrinciplesReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError(() => of<PrinciplesState>({ status: 'unreachable' })),
      );
  },
});

/** The principle on show, and where it sits in the deck. */
export interface ShownPrinciple {
  readonly principle: Principle;
  /** Counted from one, for people. */
  readonly place: number;
  readonly count: number;
  readonly isToday: boolean;
}

/**
 * The software-design principle of the day, read again when the local day
 * turns, and a way to step through the rest. A failed read keeps the one on
 * show, and a new day's read starts the stepping again from it.
 */
@Injectable({ providedIn: 'root' })
export class PrincipleOfDay {
  private readonly read = inject(PRINCIPLES_READ);
  private readonly clock = inject(Clock);
  private readonly today = computed(() => localDayKey(this.clock.now().getTime()));

  readonly state: Signal<PrinciplesState> = toSignal(
    toObservable(this.today).pipe(
      switchMap((day) => this.read(day)),
      scan((shown, next) => (next.status === 'ready' ? next : shown)),
    ),
    { initialValue: { status: 'reading' } },
  );

  private readonly steps = linkedSignal({ source: this.state, computation: () => 0 });

  readonly shown: Signal<ShownPrinciple | null> = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return null;
    const { principles, today } = state.report;
    const at = placeIn(principles.length, today + this.steps());
    return {
      principle: principles[at],
      place: at + 1,
      count: principles.length,
      isToday: at === today,
    };
  });

  next(): void {
    this.steps.update((steps) => steps + 1);
  }

  previous(): void {
    this.steps.update((steps) => steps - 1);
  }

  backToToday(): void {
    this.steps.set(0);
  }
}
