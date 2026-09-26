import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CollisionCheck } from '../../../core/queue/collisions-report';
import { PlanReason, PlanStep } from '../merge-plan';

/** What each reason says, and how it reads. */
const REASON: Readonly<Record<PlanReason, readonly [string, 'ok' | 'hot']>> = {
  clear: ['touches nothing else waiting', 'ok'],
  'after-base': ['its stacked base has landed', 'ok'],
  conflicts: ['lands first; forces a rebase of', 'hot'],
  'needs-rebase': ['already conflicts with its base — rebase it', 'hot'],
};

/** One row of the plan, as the panel shows it. */
export interface PlanRow {
  readonly step: number;
  readonly pr: number;
  readonly title: string;
  readonly why: string;
  readonly tone: 'ok' | 'hot';
}

export const planRows = (steps: readonly PlanStep[]): PlanRow[] =>
  steps.map((s, i) => {
    const [why, tone] = REASON[s.reason];
    const then = s.reason === 'conflicts' ? ` ${s.rebaseAfter.map((n) => `#${n}`).join(' ')}` : '';
    return { step: i + 1, pr: s.pr, title: s.title, why: why + then, tone };
  });

/** How the pairs were checked, in pr-starmap's words. */
export function planHow(check: CollisionCheck | null, conflicting: number): string {
  return check === 'checked'
    ? `${conflicting} pair${conflicting === 1 ? '' : 's'} would conflict — git merged every pair that shares a file.`
    : 'No checkout was available, so pairs that share files are shown unchecked.';
}

/** pr-starmap's Merge plan panel: the order that needs the fewest rebases. */
@Component({
  selector: 'app-plan-panel',
  templateUrl: './plan-panel.html',
  styleUrl: './plan-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanPanel {
  readonly steps = input.required<readonly PlanStep[]>();
  readonly check = input<CollisionCheck | null>(null);
  readonly conflicting = input(0);
  readonly go = output<number>();

  protected readonly rows = computed(() => planRows(this.steps()));
  protected readonly how = computed(() => planHow(this.check(), this.conflicting()));
}
