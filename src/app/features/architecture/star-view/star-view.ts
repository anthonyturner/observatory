import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { SUN_RADIUS, StarSystem } from '../../../core/architecture/star-layout';
import { MotionPreference } from '../../../core/motion/motion-preference';

/** One class as a sun: what it injects and what injects it turn round it, a ring per area. */
@Component({
  selector: 'app-star-view',
  templateUrl: './star-view.html',
  styleUrl: './star-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'isStill()' },
})
export class StarView {
  readonly system = input.required<StarSystem>();
  /** The name of the class to put at the centre next. */
  readonly pick = output<string>();

  protected readonly isStill = inject(MotionPreference).isStill;
  protected readonly sunRadius = SUN_RADIUS;
}
