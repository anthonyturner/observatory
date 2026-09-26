import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HudSection } from '../../../shared/hud-section/hud-section';
import { SKILLS } from '../data/skills';
import { SkillTile } from '../skill-tile/skill-tile';

/** How many tiles show before Browse all, so a long list cannot push the
 *  Ask box off the one-screen HUD. */
export const SKILLS_SHOWN = 4;

/** One-press tasks the assistant can propose. */
@Component({
  selector: 'app-skills-panel',
  imports: [HudSection, SkillTile],
  templateUrl: './skills-panel.html',
  styleUrl: './skills-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillsPanel {
  private readonly skills = inject(SKILLS);
  private readonly expanded = signal(false);

  protected readonly isExpanded = this.expanded.asReadonly();
  protected readonly total = computed(() => this.skills().length);
  protected readonly hasMore = computed(() => this.total() > SKILLS_SHOWN);
  protected readonly visible = computed(() =>
    this.expanded() ? this.skills() : this.skills().slice(0, SKILLS_SHOWN),
  );

  protected toggleExpanded(): void {
    this.expanded.update((isExpanded) => !isExpanded);
  }
}
