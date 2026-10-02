import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { SUN_RADIUS, StarSystem } from '../../../core/architecture/star-layout';
import { MotionPreference } from '../../../core/motion/motion-preference';

/** One node as a sun: what it depends on and what depends on it turn round it, a ring per area. */
@Component({
  selector: 'app-star-view',
  templateUrl: './star-view.html',
  styleUrl: './star-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'isStill()' },
})
export class StarView {
  readonly system = input.required<StarSystem>();
  /** The id of the node to put at the centre next. */
  readonly pick = output<string>();

  protected readonly isStill = inject(MotionPreference).isStill;
  protected readonly sunRadius = SUN_RADIUS;
}
