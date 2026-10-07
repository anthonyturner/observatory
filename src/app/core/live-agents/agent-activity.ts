import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, defer, filter, map, takeWhile } from 'rxjs';
import { whileVisibleEvery } from './visible-poll';
import { PageVisibility } from '../presence/page-visibility';
import { ActivityLog } from './activity-log';
import { AGENT_FEED_API } from './agent-feed-api';
import { ActivityState, AgentFeedRead } from './agent-feed.types';
import { LiveAgentKey, LiveAgentState } from './live-agents.types';

/** How often an open Activity tab asks for more: often while the agent is
 *  working, seldom while it is quiet, waiting for you or stopped. */
export const ACTIVITY_WORKING_MS = 3_000;
export const ACTIVITY_IDLE_MS = 15_000;

export const activityEveryMs = (state: LiveAgentState): number =>
  state === 'working' ? ACTIVITY_WORKING_MS : ACTIVITY_IDLE_MS;

/** An agent's activity, read from its feed a page at a time. */
@Injectable({ providedIn: 'root' })
export class AgentActivity {
  private readonly api = inject(AGENT_FEED_API);
  private readonly isHidden = toObservable(inject(PageVisibility).isHidden);

  /**
   * `key`'s transcript, read now and then every `everyMs` while the page is
   * shown, each read carrying on from the last. A failed read after the first
   * keeps the rows already shown; the next read catches up. The hosted site
   * has no feed, so there it reads once and stops.
   */
  follow(key: LiveAgentKey, everyMs: Observable<number>): Observable<ActivityState> {
    return defer(() => {
      const log = new ActivityLog();
      const isShown = (read: AgentFeedRead): boolean =>
        read.status === 'ready' || read.status === 'local-only' || !log.hasRead();
      return whileVisibleEvery(this.isHidden, everyMs, () => this.api.feed(key, log.from())).pipe(
        filter(isShown),
        map((read): ActivityState => {
          if (read.status !== 'ready') return read;
          log.take(read.page);
          return { status: 'ready', entries: log.entries() };
        }),
        takeWhile((state) => state.status !== 'local-only', true),
      );
    });
  }
}
