import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegendChip, fmtN } from '../starmap-view';

/** The top of the star map: the way up to the orrery, the title, what the sky
 *  is and how old, and the legend that narrows it. */
@Component({
  selector: 'app-starmap-header',
  imports: [RouterLink],
  templateUrl: './starmap-header.html',
  styleUrl: './starmap-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapHeader {
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
