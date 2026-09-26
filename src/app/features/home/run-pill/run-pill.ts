import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RunDock } from '../../../core/runs/run-dock';
import { pillOf } from '../../../core/runs/run-dock-view';
import { RunsStore } from '../../../core/runs/runs-store';
import { Clock } from '../../../core/time/clock';

/** The state and time of a task in the top bar, and the way back to its dock
 *  once hidden; with no task followed, the way to the recent ones. */
@Component({
  selector: 'app-run-pill',
  template: `@if (pill(); as pill) {
    <button
      #button
      type="button"
      aria-controls="run-dock"
      [class.past]="pill.isPast"
      [attr.aria-label]="pill.label"
      (click)="dock.show()"
    >
      {{ pill.text }}
    </button>
  }`,
  styleUrl: './run-pill.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunPill {
  protected readonly dock = inject(RunDock);
  private readonly store = inject(RunsStore);
  private readonly clock = inject(Clock);
  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('button');

  protected readonly pill = computed(() => {
    if (!this.store.isAvailable() || this.dock.isOpen()) return null;
    const recent = this.store.list().recent.length;
    return pillOf(this.store.followed(), recent, this.clock.now().getTime());
  });

  private answered = 0;

  constructor() {
    afterRenderEffect(() => {
      const requests = this.dock.pillFocusRequests();
      if (requests <= this.answered) return;
      this.answered = requests;
      this.button()?.nativeElement.focus();
    });
  }
}
