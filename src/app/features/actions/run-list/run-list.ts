import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ActionsRun } from '../../../core/actions/actions-report';
import { OUTCOME_WORDS, agoWords, eventWords, tookWords } from '../actions-words';
import { outcomeColour } from '../run-sky/run-look';

export interface RunRow {
  readonly key: string;
  readonly title: string;
  /** "CI #41". */
  readonly workflow: string;
  readonly outcome: string;
  /** Its dot, coloured as the sky colours its star: a CSS colour. */
  readonly colour: string;
  readonly isFlaky: boolean;
  /** "main · push by me". */
  readonly meta: string;
  readonly took: string;
  readonly when: string;
}

/** The runs as rows, newest first, `now` being when the report was made. */
export function runRows(runs: readonly ActionsRun[], now: number): RunRow[] {
  return runs.map((run) => ({
    key: String(run.id),
    title: run.title || `Run ${run.number}`,
    workflow: `${run.workflow} #${run.number}`,
    outcome: OUTCOME_WORDS[run.outcome],
    colour: outcomeColour(run.outcome),
    isFlaky: run.isFlaky,
    meta: `${run.branch} · ${eventWords(run.event)}${run.actor ? ` by ${run.actor}` : ''}`,
    took: tookWords(run.durationS, run.outcome),
    when: agoWords(run.createdAt, now),
  }));
}

/** The same runs as the sky, as a list for the keyboard and a screen reader. */
@Component({
  selector: 'app-run-list',
  templateUrl: './run-list.html',
  styleUrl: './run-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunList {
  /** Newest first. */
  readonly runs = input.required<readonly ActionsRun[]>();
  readonly now = input.required<number>();
  readonly selected = input<string | null>(null);
  readonly picked = output<string>();

  protected readonly rows = computed(() => runRows(this.runs(), this.now()));
}
