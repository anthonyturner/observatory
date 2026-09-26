import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CoreGeometry } from '../../../core/instrument/core-geometry';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { ProgressFeed } from '../../../core/projects/progress-feed';

/** How long a burst shows round a project's dot after work got done there. */
const BURST_MS = 2600;
/** The burst starts just outside the bead. */
const BURST_REACH = 2.2;

/** A green ring bursting from the dot of each project where work got done
 *  since the last report. HTML over the core, so it is the same in 3D and 2D. */
@Component({
  selector: 'app-bead-burst',
  template: `@for (burst of bursts(); track burst.key + burst.id) {
    <span
      class="burst"
      [style.left.px]="burst.x"
      [style.top.px]="burst.y"
      [style.--burst.px]="burst.radius"
    ></span>
  }`,
  styleUrl: './bead-burst.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'motion.isStill()' },
})
export class BeadBurst {
  protected readonly motion = inject(MotionPreference);
  private readonly geometry = inject(CoreGeometry);
  private readonly progress = inject(ProgressFeed);
  private readonly bursting = signal<readonly { key: string; id: number }[]>([]);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  protected readonly bursts = computed(() => {
    const placed = this.geometry.placed();
    return this.bursting().flatMap(({ key, id }) => {
      const dot = placed.find((one) => one.bead.key === key);
      return dot ? [{ key, id, x: dot.x, y: dot.y, radius: dot.radius * BURST_REACH }] : [];
    });
  });

  constructor() {
    effect(() => {
      const moment = this.progress.latest();
      if (!moment) return;
      const fresh = moment.progress.map((p) => ({ key: p.key, id: moment.id }));
      this.bursting.update((now) => [...now, ...fresh]);
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.bursting.update((now) => now.filter((burst) => burst.id !== moment.id));
      }, BURST_MS);
      this.timers.add(timer);
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
  }
}
