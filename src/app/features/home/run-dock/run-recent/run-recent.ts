import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RecentRow } from '../../../../core/runs/run-dock-view';

/** Recent runs: the run going now and the last few that finished, newest
 *  first. Pressing one shows it in the dock. */
@Component({
  selector: 'app-run-recent',
  templateUrl: './run-recent.html',
  styleUrl: './run-recent.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunRecent {
  readonly rows = input.required<readonly RecentRow[]>();
  readonly isOpen = input.required<boolean>();
  readonly picked = output<string>();
  readonly toggled = output<void>();
}
