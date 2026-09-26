import { Injectable, InjectionToken, inject } from '@angular/core';
import { ProjectsFeed } from './projects-feed';

/** How a refresh went: done, one already under way, or failed. */
export type RefreshOutcome = 'done' | 'busy' | 'failed';

/** Reads the page's data again now, rather than at the next regular read. */
export interface PageRefresh {
  refresh(): Promise<RefreshOutcome>;
}

/** Home's refresh: every project read again from the API now. */
@Injectable({ providedIn: 'root' })
export class ProjectsRefresh implements PageRefresh {
  private readonly feed = inject(ProjectsFeed);
  private isRefreshing = false;

  async refresh(): Promise<RefreshOutcome> {
    if (this.isRefreshing) return 'busy';
    this.isRefreshing = true;
    try {
      return (await this.feed.readNow()) ? 'done' : 'failed';
    } finally {
      this.isRefreshing = false;
    }
  }
}

export const PAGE_REFRESH = new InjectionToken<PageRefresh>('PageRefresh', {
  providedIn: 'root',
  factory: () => inject(ProjectsRefresh),
});
