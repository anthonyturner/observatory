import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  expand,
  map,
  of,
  switchMap,
  timer,
} from 'rxjs';
import { Deployment, isBuilding, parsePullPreview } from './deployments-report';

const PREVIEW_URL = '/api/deployments/preview';
/** While a deployment builds, often enough to see it go live soon after it does. */
const BUILDING_POLL_MS = 30_000;
const NONE: readonly Deployment[] = [];

/**
 * Reads what one commit, a pull request's head, was deployed as, for the
 * screen that provides it: once when it opens, and again while a deployment
 * is still building. A failed read shows as nothing deployed.
 */
@Injectable()
export class PullPreviewFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<readonly Deployment[]>(NONE);
  private reading: Subscription | null = null;

  /** The newest deployment of the commit to each environment; none until read. */
  readonly deployments = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `sha`'s deployments in `repo`, in place of any it was reading. */
  load(repo: string, sha: string): void {
    this.reading?.unsubscribe();
    this.current.set(NONE);
    if (!sha) return;
    const params = { repo, sha };
    this.reading = this.read(params)
      .pipe(
        expand((deployments) =>
          isBuilding(deployments)
            ? timer(BUILDING_POLL_MS).pipe(switchMap(() => this.read(params)))
            : EMPTY,
        ),
      )
      .subscribe((deployments) => this.current.set(deployments));
  }

  private read(params: Readonly<Record<string, string>>): Observable<readonly Deployment[]> {
    return this.http.get<unknown>(PREVIEW_URL, { params }).pipe(
      map((body) => parsePullPreview(body)?.deployments ?? NONE),
      catchError(() => of(NONE)),
    );
  }
}
