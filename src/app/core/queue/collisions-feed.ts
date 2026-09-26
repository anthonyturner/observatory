import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { CollisionsReport, parseCollisions } from './collisions-report';

const COLLISIONS_URL = '/api/collisions';

/** Reads which of one repository's pull requests collide. Until it arrives,
 *  or if it cannot be read, there is no report and nothing is drawn. */
@Injectable()
export class CollisionsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<CollisionsReport | null>(null);
  private repo: string | null = null;

  readonly report = this.current.asReadonly();

  /** Reads `repo`'s collisions; another repository's are dropped at once, not shown meanwhile. */
  load(repo: string): void {
    if (repo !== this.repo) this.current.set(null);
    this.repo = repo;
    this.http
      .get<unknown>(COLLISIONS_URL, { params: { repo } })
      .pipe(
        map((body) => parseCollisions(body)),
        catchError(() => of(null)),
      )
      .subscribe((report) => this.current.set(report));
  }
}
