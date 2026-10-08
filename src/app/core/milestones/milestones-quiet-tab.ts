import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { QuietTab } from '../../shared/project-tabs/quiet-tab';
import { MILESTONES_URL, hasNothingIn } from './milestones-presence';

/**
 * Whether a project has no milestones and no discussions, so its Milestones
 * tab recedes. Each screen with the tab strip asks once as it opens; the API
 * keeps the answer for a few minutes, and the screen reads the same one.
 */
@Injectable({ providedIn: 'root' })
export class MilestonesQuietTab implements QuietTab {
  private readonly http = inject(HttpClient);

  readonly tabId = 'milestones';

  isEmpty(repo: string): Observable<boolean> {
    return this.http.get<unknown>(MILESTONES_URL, { params: { repo } }).pipe(
      map(hasNothingIn),
      catchError(() => of(false)),
    );
  }
}
