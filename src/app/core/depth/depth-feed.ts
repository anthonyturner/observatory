import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { parseDepthReport } from './depth-parse';
import { DepthReport } from './depth.types';

/** Where one repository's depth report stands. Only `ready` carries it. */
export type DepthState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly report: DepthReport };

const DEPTH_URL = '/api/depth';
const HTTP_NOT_FOUND = 404;
const FRESH = '1';

/** Reads one repository's modules for the page that provides it. `missing` means no clone of it on this machine. */
@Injectable()
export class DepthFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<DepthState>({ status: 'reading' });
  private repo: string | null = null;
  private reading: Subscription | null = null;

  readonly state = this.current.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
  }

  /** Reads `repo`, in place of any it was reading. */
  load(repo: string): void {
    this.repo = repo;
    this.read({ repo });
  }

  /** Reads the current repository's files again, past the server's short memory of them. */
  refresh(): void {
    if (this.repo !== null) this.read({ repo: this.repo, fresh: FRESH });
  }

  private read(params: Record<string, string>): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(DEPTH_URL, { params })
      .pipe(
        map((body): DepthState => {
          const report = parseDepthReport(body);
          return report ? { status: 'ready', report } : { status: 'unreachable' };
        }),
        catchError((error: unknown) =>
          of<DepthState>(
            error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
              ? { status: 'missing' }
              : { status: 'unreachable' },
          ),
        ),
      )
      .subscribe((state) => this.current.set(state));
  }
}
