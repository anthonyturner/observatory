import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LiveAgentsFeed } from '../../../core/live-agents/live-agents-feed';
import { rowsOf, runningCount, summaryText } from '../../../core/live-agents/live-agents-view';
import { UpLink } from '../../../shared/up-link/up-link';
import { AgentStateChip } from '../agent-state-chip/agent-state-chip';
import { LocalOnlyNote } from '../local-only-note/local-only-note';
import { TimeAgo } from '../time-ago/time-ago';

/** The Claude Code sessions and subagents running on this machine, each a link to its page. */
@Component({
  selector: 'app-agents-page',
  imports: [RouterLink, UpLink, AgentStateChip, LocalOnlyNote, TimeAgo],
  templateUrl: './agents-page.html',
  styleUrl: './agents-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsPage {
  protected readonly feed = inject(LiveAgentsFeed);
  protected readonly rows = computed(() => rowsOf(this.feed.agents()));
  protected readonly count = computed(() => runningCount(this.feed.agents(), null));
  /** Said once per change, through the one status line, never per row. */
  protected readonly summary = computed(() =>
    this.feed.state().status === 'ready' ? summaryText(this.count()) : '',
  );
}
