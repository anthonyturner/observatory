import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  concat,
  filter,
  map,
  of,
  switchMap,
} from 'rxjs';
import { RiskGlance, RiskView, parseRiskGlance, parseRiskSummary, riskViewOf } from './risk-glance';

/** Where one pull request's risk glance stands. Only `ready` carries it. */
export type RiskGlanceState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly view: RiskView };

const RISK_URL = '/api/risk';
const SUMMARY_URL = '/api/risk/summary';
const UNREACHABLE: RiskGlanceState = { status: 'unreachable' };

const ready = (glance: RiskGlance, summary: string | null): RiskGlanceState => ({
  status: 'ready',
  view: riskViewOf(glance, summary),
});

/**
 * Reads one pull request's risk for the star card that provides it: the rules
 * first, then the one-line summary when the server has a model to write one.
 */
@Injectable()
export class RiskGlanceFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<RiskGlanceState>({ status: 'reading' });
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`'s pull request `number`, in place of any it was reading. */
  load(repo: string, number: number): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    const params = { repo, number: String(number) };
    this.reading = this.http
      .get<unknown>(RISK_URL, { params })
      .pipe(
        map(parseRiskGlance),
        switchMap((glance) =>
          glance
            ? concat(of(ready(glance, null)), this.withSummary(glance, params))
            : of(UNREACHABLE),
        ),
        catchError(() => of(UNREACHABLE)),
      )
      .subscribe((state) => this.current.set(state));
  }

  /** The glance again with its summary; nothing when there is none, so the rules stay shown. */
  private withSummary(
    glance: RiskGlance,
    params: Record<string, string>,
  ): Observable<RiskGlanceState> {
    if (!glance.summarizes) return EMPTY;
    return this.http.get<unknown>(SUMMARY_URL, { params }).pipe(
      map(parseRiskSummary),
      // A summary of another head describes code no longer there.
      map((answer) => (answer?.headSha === glance.headSha ? answer.summary : null)),
      filter((summary): summary is string => summary !== null),
      map((summary) => ready(glance, summary)),
      catchError(() => EMPTY),
    );
  }
}
