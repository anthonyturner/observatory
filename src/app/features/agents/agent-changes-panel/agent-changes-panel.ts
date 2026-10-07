import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  combineLatest,
  exhaustMap,
  interval,
  map,
  merge,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { AGENT_CHANGES_API } from '../../../core/live-agents/agent-changes-api';
import {
  AGENT_DIFF_WORDING,
  SHARED_CHECKOUT_TEXT,
  agentChangesDiffKey,
  canRetry,
  committedOnlyText,
  comparedText,
  hasNoDiff,
  noChangesText,
  problemText,
  queuePathOf,
  untrackedNotes,
} from '../../../core/live-agents/agent-changes-view';
import { AgentChangesState } from '../../../core/live-agents/agent-changes.types';
import { LiveAgent, LiveAgentKey } from '../../../core/live-agents/live-agents.types';
import { PageVisibility } from '../../../core/presence/page-visibility';
import { SheetDiff } from '../../starmap/pr-screen/sheet-diff/sheet-diff';
import { LocalOnlyNote } from '../local-only-note/local-only-note';

/** While the agent works, its diff is read again this often; quiet, only on Refresh. */
export const CHANGES_REFRESH_MS = 30_000;

const READING: AgentChangesState = { status: 'reading' };

interface PullQuery {
  readonly repo: string;
  readonly branch: string;
}

const sameKey = (a: LiveAgentKey, b: LiveAgentKey): boolean =>
  a.session === b.session && a.agentId === b.agentId;

const samePullQuery = (a: PullQuery | null, b: PullQuery | null): boolean =>
  a === b || (a !== null && b !== null && a.repo === b.repo && a.branch === b.branch);

/**
 * The Changes tab: what git says the agent has changed in its folder, read
 * when the tab opens, on Refresh, and every 30 s while the agent works and the
 * page is shown. Links the open pull request whose branch it is on.
 */
@Component({
  selector: 'app-agent-changes-panel',
  imports: [RouterLink, SheetDiff, LocalOnlyNote],
  templateUrl: './agent-changes-panel.html',
  styleUrl: './agent-changes-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentChangesPanel {
  readonly agent = input.required<LiveAgent>();

  private readonly api = inject(AGENT_CHANGES_API);
  private readonly isHidden = toObservable(inject(PageVisibility).isHidden);
  private readonly refreshes = new Subject<void>();

  /** The agent is read again every 15 s; only a new agent means a new diff. */
  private readonly key = computed(
    (): LiveAgentKey => ({ session: this.agent().session, agentId: this.agent().agentId }),
    { equal: sameKey },
  );
  private readonly isWorking = computed(() => this.agent().state === 'working');
  private readonly autoRefreshes: Observable<number> = combineLatest([
    toObservable(this.isWorking),
    this.isHidden,
  ]).pipe(
    switchMap(([working, hidden]) => (working && !hidden ? interval(CHANGES_REFRESH_MS) : EMPTY)),
  );

  protected readonly state = toSignal(
    toObservable(this.key).pipe(
      switchMap((key) =>
        merge(of(0), this.refreshes, this.autoRefreshes).pipe(
          exhaustMap(() => this.api.changes(key)),
          startWith(READING),
        ),
      ),
    ),
    { initialValue: READING },
  );

  protected readonly wording = AGENT_DIFF_WORDING;
  protected readonly sharedCheckoutText = SHARED_CHECKOUT_TEXT;

  protected readonly view = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return null;
    const { changes } = state;
    return {
      changes,
      compared: comparedText(changes),
      committedOnly: changes.isCommittedOnly ? committedOnlyText(changes) : null,
      notes: untrackedNotes(changes),
      empty: hasNoDiff(changes) ? noChangesText(changes) : null,
      viewedKey: agentChangesDiffKey(this.key()),
    };
  });

  protected readonly problem = computed(() => {
    const state = this.state();
    if (state.status !== 'problem') return null;
    return { text: problemText(state.problem), canRetry: canRetry(state.problem) };
  });

  private readonly pullQuery = computed(
    (): PullQuery | null => {
      const changes = this.view()?.changes;
      return changes?.repo && changes.branch
        ? { repo: changes.repo, branch: changes.branch }
        : null;
    },
    { equal: samePullQuery },
  );

  protected readonly pull = toSignal(
    toObservable(this.pullQuery).pipe(
      switchMap((query) =>
        query
          ? this.api
              .openPullOf(query.repo, query.branch)
              .pipe(
                map((number) =>
                  number === null
                    ? null
                    : { path: queuePathOf(query.repo), query: { pr: number }, number },
                ),
              )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected refresh(): void {
    this.refreshes.next();
  }
}
