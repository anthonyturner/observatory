import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BarRowsChart } from '../bar-rows-chart';

/** Horizontal bars, one row each, labelled on the left and valued on the right. */
@Component({
  selector: 'app-usage-bar-chart',
  templateUrl: './usage-bar-chart.html',
  styleUrl: './usage-bar-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageBarChart {
  readonly chart = input.required<BarRowsChart>();
  readonly label = input.required<string>();
}
