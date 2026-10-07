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
import { RUN_RERUN_API } from '../../../core/actions/run-rerun-api';
import { messageOf } from '../../../core/runs/runs-api';
import { RERUN_IDLE, RerunState } from '../../starmap/rerun-control/rerun-view';

const SENT = 'Rerun started on GitHub. This run updates here within a couple of minutes.';

/** Rerun failed jobs, for a run that failed: the button, and how the press went. */
@Component({
  selector: 'app-run-rerun',
  templateUrl: './run-rerun.html',
  // The queue's Rerun control's look, shared rather than copied.
  styleUrl: '../../starmap/rerun-control/rerun-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunRerun {
  readonly repo = input.required<string>();
  readonly runId = input.required<number>();
  /** GitHub took the rerun. */
  readonly requested = output<void>();

  private readonly api = inject(RUN_RERUN_API);
  private readonly destroyRef = inject(DestroyRef);

  /** Each run starts with no press behind it. */
  private readonly state = linkedSignal<number, RerunState>({
    source: this.runId,
    computation: () => RERUN_IDLE,
  });
  protected readonly label = computed(() =>
    this.state().status === 'sending' ? 'Rerunning…' : 'Rerun failed jobs',
  );
  protected readonly isDisabled = computed(() => {
    const status = this.state().status;
    return status === 'sending' || status === 'sent';
  });
  protected readonly status = computed(() => {
    const state = this.state();
    if (state.status === 'sent') return { text: SENT, tone: 'ok' };
    if (state.status === 'refused')
      return { text: `Couldn’t rerun: ${state.reason}.`, tone: 'bad' };
    return null;
  });

  protected rerun(): void {
    if (this.isDisabled()) return;
    this.state.set({ status: 'sending' });
    this.api
      .rerun(this.repo(), this.runId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.state.set({ status: 'sent', runs: 1 });
          this.requested.emit();
        },
        error: (error: unknown) => this.state.set({ status: 'refused', reason: messageOf(error) }),
      });
  }
}
