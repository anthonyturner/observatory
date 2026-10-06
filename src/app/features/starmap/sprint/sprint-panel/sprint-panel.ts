import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SprintPhase } from '../review-sprint';
import { SprintMark, SprintOption, SprintRow, sprintSummary } from '../sprint-plan';

const MARK_LABEL: Readonly<Record<SprintMark, string>> = {
  merged: 'merged',
  reviewed: 'reviewed',
  open: 'to do',
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "4:05": minutes and seconds, a part second counted as a whole one. */
export function countdownOf(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The button for one length: "25 min · 3 PRs", or that nothing fits. */
const optionView = (option: SprintOption) => ({
  option,
  label: `${option.minutes} min`,
  count: option.picks.length ? plural(option.picks.length, 'PR') : 'none fit',
  title: option.picks.length
    ? option.picks.map((pick) => `#${pick.pr} ${pick.title}`).join('\n')
    : `No pull request's review fits in ${option.minutes} minutes`,
});

const rowView = (row: SprintRow) => ({
  ...row,
  label: row.mark === 'open' ? `~${Math.ceil(row.minutes)} min` : MARK_LABEL[row.mark],
});

/**
 * The review sprint: its lengths to choose from, then its timer and pull
 * requests while it runs, then what it cleared. Each row opens its pull request.
 */
@Component({
  selector: 'app-sprint-panel',
  templateUrl: './sprint-panel.html',
  styleUrl: './sprint-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'still()' },
})
export class SprintPanel {
  readonly phase = input.required<SprintPhase>();
  readonly options = input<readonly SprintOption[]>([]);
  readonly rows = input<readonly SprintRow[]>([]);
  readonly remainingMs = input(0);
  readonly totalMs = input(0);
  /** Motion is off: the timer's bar steps rather than glides. */
  readonly still = input(false);

  readonly start = output<SprintOption>();
  readonly go = output<number>();
  readonly end = output<void>();
  readonly closed = output<void>();

  protected readonly optionViews = computed(() => this.options().map(optionView));
  protected readonly rowViews = computed(() => this.rows().map(rowView));
  protected readonly countdown = computed(() => countdownOf(this.remainingMs()));
  protected readonly elapsedPercent = computed(() => {
    const total = this.totalMs();
    return total > 0 ? Math.min(100, 100 * (1 - this.remainingMs() / total)) : 100;
  });
  protected readonly summary = computed(() => {
    const summary = sprintSummary(this.rows());
    return {
      line: `${summary.merged.length} merged · ${summary.reviewed.length} reviewed · ${summary.skipped.length} skipped`,
      groups: [
        { name: 'Merged', mark: 'merged', rows: summary.merged },
        { name: 'Reviewed', mark: 'reviewed', rows: summary.reviewed },
        { name: 'Skipped', mark: 'open', rows: summary.skipped },
      ].filter((group) => group.rows.length),
    };
  });
}
