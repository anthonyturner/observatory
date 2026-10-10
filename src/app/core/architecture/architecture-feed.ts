import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, catchError, map, of } from 'rxjs';
import { parseArchitecture } from './architecture-parse';
import { ArchitectureState } from './architecture.types';

const ARCHITECTURE_URL = '/api/architecture';
const HTTP_NOT_FOUND = 404;
const FRESH = '1';

/** Where one repository's full map is served as a page of its own. */
export const architectureHtmlUrl = (repo: string): string =>
  `${ARCHITECTURE_URL}/html?repo=${encodeURIComponent(repo)}`;

/** Reads one repository's map for the page that provides it. `missing` means no clone of it on this machine. */
@Injectable()
export class ArchitectureFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<ArchitectureState>({ status: 'reading' });
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

  /** Scans the current repository's clone again, past the server's memory of the last scan. */
  refresh(): void {
    if (this.repo !== null) this.read({ repo: this.repo, fresh: FRESH });
  }

  private read(params: Record<string, string>): void {
    this.reading?.unsubscribe();
    this.current.set({ status: 'reading' });
    this.reading = this.http
      .get<unknown>(ARCHITECTURE_URL, { params })
      .pipe(
        map((body): ArchitectureState => {
          const parsed = parseArchitecture(body);
          return parsed ? { status: 'ready', map: parsed } : { status: 'unreachable' };
        }),
        catchError((error: unknown) =>
          of<ArchitectureState>(
            error instanceof HttpErrorResponse && error.status === HTTP_NOT_FOUND
              ? { status: 'missing' }
              : { status: 'unreachable' },
          ),
        ),
      )
      .subscribe((state) => this.current.set(state));
  }
}
