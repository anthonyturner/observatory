import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Clock } from '../../../core/time/clock';
import { toClockFace, toDayLabel } from '../../../core/time/clock-format';

/** The time and date. It ticks whatever the motion setting: it is a reading,
 *  not an animation. */
@Component({
  selector: 'app-clock-readout',
  templateUrl: './clock-readout.html',
  styleUrl: './clock-readout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockReadout {
  private readonly now = inject(Clock).now;

  protected readonly face = computed(() => toClockFace(this.now()));
  protected readonly day = computed(() => toDayLabel(this.now()));
  protected readonly isoTime = computed(() => this.now().toISOString());
}
