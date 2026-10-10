import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { LegendChip, fmtN } from '../starmap-view';

/** The top of the star map: room for the project bar, the title, what the sky is
 *  and how old, and the legend that narrows it. */
@Component({
  selector: 'app-starmap-header',
  imports: [ProjectBarRoom],
  templateUrl: './starmap-header.html',
  styleUrl: './starmap-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapHeader {
  /** `owner/name`. */
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
