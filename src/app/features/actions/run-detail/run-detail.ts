import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RunRerun } from '../run-rerun/run-rerun';
import { JobView, RunDetail } from './run-detail-view';

/** Where the picked run's jobs stand, ready to show. */
export type JobsView =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly jobs: readonly JobView[] };

/** One run: its facts, its jobs and the steps that failed, each linked to GitHub. */
@Component({
  selector: 'app-run-detail',
  imports: [RunRerun],
  templateUrl: './run-detail.html',
  styleUrl: './run-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunDetailPanel {
  readonly repo = input.required<string>();
  readonly detail = input.required<RunDetail>();
  readonly jobs = input.required<JobsView>();
  /** The owner may rerun its failed jobs; a preview visitor sees no button. */
  readonly canRerun = input(false);
  readonly rerun = output<void>();
}
