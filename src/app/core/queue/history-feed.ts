import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { Frame, parseHistory } from './history-report';

const HISTORY_URL = '/api/history';

/** Reads one repository's remembered frames. Until they arrive, or if they
 *  cannot be read, there are none, and the page shows no changes. */
@Injectable()
export class HistoryFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<readonly Frame[]>([]);
  private repo: string | null = null;
  private readonly done = signal(false);

  /** Whether the frames have arrived, or could not be read: the memory waits for it. */
  readonly loaded = this.done.asReadonly();

  readonly frames = this.current.asReadonly();

  /** Reads `repo`'s frames; another repository's are dropped at once, not shown meanwhile. */
  load(repo: string): void {
    if (repo !== this.repo) {
      this.current.set([]);
      this.done.set(false);
    }
    this.repo = repo;
    this.http
      .get<unknown>(HISTORY_URL, { params: { repo } })
      .pipe(
        map((body) => parseHistory(body) ?? []),
        catchError(() => of<Frame[]>([])),
      )
      .subscribe((frames) => {
        this.current.set(frames);
        this.done.set(true);
      });
  }
}
