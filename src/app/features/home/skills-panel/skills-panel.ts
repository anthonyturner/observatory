import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AskFeed } from '../../../core/assistant/ask-feed';
import { AssistantInfo } from '../../../core/assistant/assistant-info';
import { Skill } from '../../../core/assistant/assistant.types';
import { ViewerSession } from '../../../core/session/viewer-session';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { SkillTile } from '../skill-tile/skill-tile';

/** How many tiles show before Browse all, so a long list cannot push the
 *  Ask box off the one-screen HUD. */
export const SKILLS_SHOWN = 4;

const NOT_LOADED = 'Home couldn’t get them from the site.';
const STILL_NOT_LOADED =
  'Still no answer from the site. Check that it is running, then reload the page.';

/** One-press tasks from the router. A press proposes the task, the same as
 *  its words typed out would; it never starts one. */
@Component({
  selector: 'app-skills-panel',
  imports: [HudSection, SkillTile],
  templateUrl: './skills-panel.html',
  styleUrl: './skills-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillsPanel {
  private readonly info = inject(AssistantInfo);
  private readonly session = inject(ViewerSession);
  protected readonly feed = inject(AskFeed);
  private readonly expanded = signal(false);
  private readonly retrying = signal(false);
  private readonly hasRetried = signal(false);

  protected readonly isOwnersOnly = computed(
    () => this.session.isVisitor() || this.info.isRefused(),
  );
  protected readonly state = this.info.skills;
  protected readonly isExpanded = this.expanded.asReadonly();
  protected readonly isRetrying = this.retrying.asReadonly();
  protected readonly skills = computed<readonly Skill[]>(() => {
    const state = this.state();
    return state.status === 'known' ? state.skills : [];
  });
  protected readonly total = computed(() => this.skills().length);
  protected readonly hasMore = computed(() => this.total() > SKILLS_SHOWN);
  protected readonly visible = computed(() =>
    this.expanded() ? this.skills() : this.skills().slice(0, SKILLS_SHOWN),
  );
  /** Unknown is not none: only a known list has a count. */
  protected readonly count = computed(() => {
    const status = this.state().status;
    if (status === 'known') return String(this.total());
    return status === 'lost' ? 'unknown' : '';
  });
  protected readonly lostWhy = computed(() => (this.hasRetried() ? STILL_NOT_LOADED : NOT_LOADED));

  protected toggleExpanded(): void {
    this.expanded.update((isExpanded) => !isExpanded);
  }

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    await this.info.load();
    this.retrying.set(false);
    this.hasRetried.set(true);
  }
}
