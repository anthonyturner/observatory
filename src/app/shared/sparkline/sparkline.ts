import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SPARK_HEIGHT, SPARK_WIDTH, sparklineShape } from './sparkline-geometry';

/** A small trend line, stretched to its box; a dashed baseline when there
 *  is not yet a trend to draw. Decorative: the number beside it says it. */
@Component({
  selector: 'app-sparkline',
  templateUrl: './sparkline.html',
  styleUrl: './sparkline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class Sparkline {
  readonly values = input.required<readonly number[]>();
  readonly max = input<number>();

  protected readonly width = SPARK_WIDTH;
  protected readonly height = SPARK_HEIGHT;
  protected readonly baselineY = SPARK_HEIGHT - 1;
  protected readonly shape = computed(() => sparklineShape(this.values(), this.max()));
}
