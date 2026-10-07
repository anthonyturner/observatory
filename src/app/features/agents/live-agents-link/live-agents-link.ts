import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LiveAgentsFeed } from '../../../core/live-agents/live-agents-feed';
import { countName, runningCount } from '../../../core/live-agents/live-agents-view';

/**
 * The way to the agents running now, with how many are. The count hides at
 * zero; the link hides until the agents have been read, so the hosted site,
 * which has none to read, never shows it. Add class `tool` on a toolbar.
 */
@Component({
  selector: 'app-live-agents-link',
  imports: [RouterLink],
  templateUrl: './live-agents-link.html',
  styleUrl: './live-agents-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveAgentsLink {
  readonly label = input.required<string>();
  /** Count only this repository's agents (owner/name); null counts them all. */
  readonly repo = input<string | null>(null);

  private readonly feed = inject(LiveAgentsFeed);

  protected readonly count = computed(() =>
    this.feed.state().status === 'ready' ? runningCount(this.feed.agents(), this.repo()) : null,
  );
  protected readonly name = computed(() => {
    const count = this.count();
    return count ? countName(this.label(), count) : this.label();
  });
}
