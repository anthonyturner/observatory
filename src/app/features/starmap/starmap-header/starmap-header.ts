import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ProjectTabs } from '../../../shared/project-tabs/project-tabs';
import { UpLink } from '../../../shared/up-link/up-link';
import { LegendChip, fmtN } from '../starmap-view';

/** The top of the star map: the way up to the orrery and across to the
 *  project's other screens, the title, what the sky is and how old, and the
 *  legend that narrows it. */
@Component({
  selector: 'app-starmap-header',
  imports: [UpLink, ProjectTabs],
  templateUrl: './starmap-header.html',
  styleUrl: './starmap-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapHeader {
  /** `owner/name`, for the project's other screens. */
  readonly repo = input.required<string>();
  readonly repoName = computed(()=> this.repo().split('/').pop() ?? '');
  readonly title = input.required<string>();
  readonly stamp = input.required<string>();
  /** "fogged · 9 hours old", once the sky has fogged over. */
  readonly stale = input<string | null>(null);
  readonly replaying = input(false);
  readonly chips = input<readonly LegendChip[]>([]);
  readonly filter = input<string | null>(null);
  readonly toggled = output<string>();

  protected readonly fmtN = fmtN;
}
