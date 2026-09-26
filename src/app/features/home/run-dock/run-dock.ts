import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { RecentRunsFold } from '../../../core/runs/recent-runs-fold';
import { RunAnnouncer } from '../../../core/runs/run-announcer';
import { RunDock } from '../../../core/runs/run-dock';
import { dockHeadOf, flagsOf, noteOf, timerOf } from '../../../core/runs/run-dock-view';
import { RunsStore } from '../../../core/runs/runs-store';
import { Clock } from '../../../core/time/clock';
import { FocusOnArrival } from '../../../shared/focus-on-arrival/focus-on-arrival';
import { RunLog } from './run-log/run-log';
import { RunRecent } from './run-recent/run-recent';

/** A task's output, beside the page rather than over it: the run on show (the
 *  followed one, or an earlier one picked from Recent runs), its transcript,
 *  then Recent runs. */
@Component({
  selector: 'app-run-dock',
  imports: [FocusOnArrival, RunLog, RunRecent],
  templateUrl: './run-dock.html',
  styleUrl: './run-dock.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'motion.isStill()' },
})
export class RunDockPanel {
  protected readonly dock = inject(RunDock);
  protected readonly store = inject(RunsStore);
  protected readonly fold = inject(RecentRunsFold);
  protected readonly announcer = inject(RunAnnouncer);
  protected readonly motion = inject(MotionPreference);
  private readonly clock = inject(Clock);
  private readonly hideButton = viewChild<ElementRef<HTMLButtonElement>>('hide');

  /** The run on show while the dock is open. */
  private readonly run = computed(() => (this.dock.isOpen() ? this.dock.view() : null));
  /** As a list, so a different run draws a transcript of its own. */
  protected readonly runs = computed(() => {
    const run = this.run();
    return run ? [run] : [];
  });
  protected readonly head = computed(() => {
    const run = this.run();
    return run ? dockHeadOf(run, this.store.followed()) : null;
  });
  private readonly isFollowedLive = computed(
    () => this.run() === this.store.followed() && this.store.isLive(),
  );
  protected readonly flags = computed(() => {
    const run = this.run();
    return run ? flagsOf(run, this.isFollowedLive()) : [];
  });
  protected readonly timer = computed(() => {
    const run = this.run();
    return run ? timerOf(run, this.isFollowedLive(), this.clock.now().getTime()) : null;
  });
  protected readonly note = computed(() => {
    const run = this.run();
    return run ? noteOf(run, this.store.followed(), this.clock.now().getTime()) : null;
  });

  protected back(): void {
    this.dock.back();
    this.hideButton()?.nativeElement.focus();
  }
}
