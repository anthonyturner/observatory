import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, defer, filter, map, takeWhile } from 'rxjs';
import { PageVisibility } from '../presence/page-visibility';
import { ActivityLog } from './activity-log';
import { AGENT_FEED_API } from './agent-feed-api';
import { ActivityState, AgentFeedPage, AgentFeedRead } from './agent-feed.types';
import { LiveAgentKey, LiveAgentState } from './live-agents.types';
import { whileVisibleEvery } from './visible-poll';

/** How often an open Activity tab asks for more: often while the agent is
 *  working, seldom while it is quiet, waiting for you or stopped. */
export const ACTIVITY_WORKING_MS = 3_000;
export const ACTIVITY_IDLE_MS = 15_000;

export const activityEveryMs = (state: LiveAgentState): number =>
  state === 'working' ? ACTIVITY_WORKING_MS : ACTIVITY_IDLE_MS;

/** A page that adds no rows: only the cursor moves, so the screen need not. */
const isUnchanged = (page: AgentFeedPage): boolean => page.events.length === 0 && !page.isRestart;

/** What `read` puts on screen once `log` has taken it, or null for no change.
 *  A failed read after the first keeps the rows already shown. */
function afterRead(log: ActivityLog, read: AgentFeedRead): ActivityState | null {
  if (read.status !== 'ready') return read.status === 'unreachable' && log.hasRead() ? null : read;
  const isFirst = !log.hasRead();
  log.take(read.page);
  return isFirst || !isUnchanged(read.page) ? { status: 'ready', entries: log.entries() } : null;
}

/** An agent's activity, read from its feed a page at a time. */
@Injectable({ providedIn: 'root' })
export class AgentActivity {
  private readonly api = inject(AGENT_FEED_API);
  private readonly isHidden = toObservable(inject(PageVisibility).isHidden);

  /**
   * `key`'s transcript, read now and then every `everyMs` while the page is
   * shown, each read carrying on from the last. The hosted site has no feed,
   * so there it reads once and stops.
   */
  follow(key: LiveAgentKey, everyMs: Observable<number>): Observable<ActivityState> {
    return defer(() => {
      const log = new ActivityLog();
      return whileVisibleEvery(this.isHidden, everyMs, () => this.api.feed(key, log.from())).pipe(
        map((read) => afterRead(log, read)),
        filter((state): state is ActivityState => state !== null),
        takeWhile((state) => state.status !== 'local-only', true),
      );
    });
  }
}
