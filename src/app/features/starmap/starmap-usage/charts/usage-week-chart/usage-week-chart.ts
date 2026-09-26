import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WeekChart } from '../week-chart';

/** This week, reading by reading, with where the recent pace leads. */
@Component({
  selector: 'app-usage-week-chart',
  templateUrl: './usage-week-chart.html',
  styleUrl: './usage-week-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageWeekChart {
  readonly chart = input.required<WeekChart>();
}
