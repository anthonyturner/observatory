import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { PublishSize } from '../../../shared/publish-size/publish-size';
import { LegendChip, fmtN } from '../starmap-view';

/** The top of the star map: the title, what the sky is and how old, pinned above the status strip
 *  and the project bar; room for the bar; and the legend that narrows it. What the page projects in (its search and notices) joins the
 *  legend; on a wide screen the two make a column at the top right, the search above the legend. */
@Component({
  selector: 'app-starmap-header',
  imports: [ProjectBarRoom, PublishSize],
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
