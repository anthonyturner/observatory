import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RERUN_API } from '../../../core/queue/rerun-api';
import { messageOf } from '../../../core/runs/runs-api';
import { RERUN_IDLE, RerunState, rerunViewOf } from './rerun-view';

/** The card and the PR screen can both be open, so each hint needs its own id. */
let nextHint = 0;

/**
 * Rerun, for a pull request failing only on flaky checks: the button, which
 * reruns the failed jobs on GitHub, and how the press went.
 */
@Component({
  selector: 'app-rerun-control',
  templateUrl: './rerun-control.html',
  styleUrl: './rerun-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RerunControl {
  readonly repo = input.required<string>();
  readonly number = input.required<number>();
  /** Its failing checks, every one known to be flaky. */
  readonly flakyChecks = input.required<readonly string[]>();
  /** GitHub took the rerun. */
  readonly requested = output<void>();

  private readonly api = inject(RERUN_API);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hintId = `rerun-hint-${nextHint++}`;
  /** Each pull request starts with no press behind it. */
  private readonly state = linkedSignal<number, RerunState>({
    source: this.number,
    computation: () => RERUN_IDLE,
  });
  protected readonly view = computed(() => rerunViewOf(this.state(), this.flakyChecks()));

  protected rerun(): void {
    if (this.state().status === 'sending') return;
    this.state.set({ status: 'sending' });
    this.api
      .rerun(this.repo(), this.number())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (runs) => {
          this.state.set({ status: 'sent', runs });
          this.requested.emit();
        },
        error: (error: unknown) => this.state.set({ status: 'refused', reason: messageOf(error) }),
      });
  }
}
