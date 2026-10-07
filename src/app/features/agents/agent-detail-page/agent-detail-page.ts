import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, map, startWith, switchMap, takeWhile } from 'rxjs';
import { LIVE_AGENTS_API } from '../../../core/live-agents/live-agents-api';
import { LIVE_AGENTS_REFRESH_MS } from '../../../core/live-agents/live-agents-feed';
import { LiveAgentKey, OneAgentState } from '../../../core/live-agents/live-agents.types';
import { whileVisible } from '../../../core/live-agents/visible-poll';
import { PageVisibility } from '../../../core/presence/page-visibility';
import { TabStrip, TabStripTab, tabStripTabId } from '../../../shared/tab-strip/tab-strip';
import { UpLink } from '../../../shared/up-link/up-link';
import { AgentActivityPanel } from '../agent-activity-panel/agent-activity-panel';
import { AgentChangesPanel } from '../agent-changes-panel/agent-changes-panel';
import { AgentHeader } from '../agent-header/agent-header';
import { LocalOnlyNote } from '../local-only-note/local-only-note';

const READING: OneAgentState = { status: 'reading' };
const TAB_STRIP = 'agent';
const PANEL_ID = 'agent-panel';

const tab = (id: string, label: string): TabStripTab => ({
  id,
  label,
  note: '',
  spokenNote: '',
  isBad: false,
});

/** The agent page's tabs, in order: another view is one more entry here and
 *  one more case in the template. */
const AGENT_TABS: readonly TabStripTab[] = [tab('activity', 'Activity'), tab('changes', 'Changes')];

/** One agent's page, at `/agents/:session` or `/agents/:session/:agentId`,
 *  read again every 15 s while it is shown. Its transcript, running or not. */
@Component({
  selector: 'app-agent-detail-page',
  imports: [
    RouterLink,
    UpLink,
    AgentHeader,
    LocalOnlyNote,
    TabStrip,
    AgentActivityPanel,
    AgentChangesPanel,
  ],
  templateUrl: './agent-detail-page.html',
  styleUrl: './agent-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentDetailPage {
  private readonly api = inject(LIVE_AGENTS_API);
  private readonly isHidden = toObservable(inject(PageVisibility).isHidden);
  private readonly retries = new Subject<void>();

  private readonly key = inject(ActivatedRoute).paramMap.pipe(
    map((params): LiveAgentKey => ({
      session: params.get('session') ?? '',
      agentId: params.get('agentId'),
    })),
  );

  protected readonly state = toSignal(
    this.key.pipe(
      switchMap((key) =>
        this.retries.pipe(
          startWith(undefined),
          switchMap(() =>
            whileVisible(this.isHidden, LIVE_AGENTS_REFRESH_MS, () => this.api.one(key)).pipe(
              startWith(READING),
            ),
          ),
        ),
      ),
      takeWhile((state) => state.status !== 'local-only', true),
    ),
    { initialValue: READING },
  );

  protected readonly tabStrip = TAB_STRIP;
  protected readonly panelId = PANEL_ID;
  protected readonly tabs = AGENT_TABS;
  protected readonly selected = signal(AGENT_TABS[0].id);
  protected readonly selectedTabId = computed(() => tabStripTabId(TAB_STRIP, this.selected()));

  protected retry(): void {
    this.retries.next();
  }
}
