import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PastWeeksChart } from '../past-weeks-chart';

/** Earlier weeks, each as far as it got before its reset. */
@Component({
  selector: 'app-usage-past-weeks',
  templateUrl: './usage-past-weeks.html',
  styleUrl: './usage-past-weeks.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsagePastWeeks {
  readonly chart = input.required<PastWeeksChart>();
}
