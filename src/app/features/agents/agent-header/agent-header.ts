import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LiveAgent } from '../../../core/live-agents/live-agents.types';
import {
  kindText,
  notRunningText,
  stateText,
  titleText,
} from '../../../core/live-agents/live-agents-view';
import { AgentStateChip } from '../agent-state-chip/agent-state-chip';
import { TimeAgo } from '../time-ago/time-ago';

/**
 * One agent's header: where it works, what it is doing and since when, and,
 * once it has stopped, that it is not running. Tabs for the agent's page go
 * in its `[tabs]` slot, under the route line.
 */
@Component({
  selector: 'app-agent-header',
  imports: [AgentStateChip, TimeAgo],
  templateUrl: './agent-header.html',
  styleUrl: './agent-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentHeader {
  readonly agent = input.required<LiveAgent>();

  protected readonly kicker = computed(() => {
    const agent = this.agent();
    return [agent.project, kindText(agent)].filter(Boolean).join(' · ');
  });
  protected readonly title = computed(() => titleText(this.agent()));
  protected readonly stateText = computed(() => stateText(this.agent()));
  protected readonly notRunning = computed(() =>
    this.agent().state === 'not-running' ? notRunningText(this.agent()) : null,
  );
}
