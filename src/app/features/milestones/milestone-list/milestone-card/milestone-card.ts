import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MilestoneRow } from '../milestone-rows';

/** One milestone in the list: its date, its progress, and its issues and pull requests in a fold. */
@Component({
  selector: 'app-milestone-card',
  templateUrl: './milestone-card.html',
  styleUrl: './milestone-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--dot]': 'row().colour' },
})
export class MilestoneCard {
  readonly row = input.required<MilestoneRow>();
}
