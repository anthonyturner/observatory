import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PullChip } from '../issue-list';

/** A label as the chips paint it. */
export interface LabelChip {
  readonly name: string;
  readonly ink: string;
}

/**
 * An issue's labels in their GitHub colour, its assignees and its pull-request
 * chips, laid into whatever row holds them. An open pull request's chip asks
 * for its screen; any other is a link to GitHub.
 */
@Component({
  selector: 'app-issue-meta',
  templateUrl: './issue-meta.html',
  styleUrl: './issue-meta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.window]': "tone() === 'window'" },
})
export class IssueMeta {
  readonly labels = input<readonly LabelChip[]>([]);
  readonly assignees = input<readonly string[]>([]);
  readonly chips = input<readonly PullChip[]>([]);
  /** Marks an open issue nobody is on. */
  readonly comet = input(false);
  /** Says so when an open issue has nobody assigned. */
  readonly unassigned = input(false);
  /** The issue window paints labels a little brighter. */
  readonly tone = input<'row' | 'window'>('row');
  /** Asks for an open pull request's screen. */
  readonly pull = output<number>();
}
