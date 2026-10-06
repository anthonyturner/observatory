import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ColumnsChart } from '../columns-chart';

/** Columns side by side, each valued above and labelled below. */
@Component({
  selector: 'app-usage-column-chart',
  templateUrl: './usage-column-chart.html',
  styleUrl: './usage-column-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageColumnChart {
  readonly chart = input.required<ColumnsChart>();
  /** What the chart shows, for a screen reader. */
  readonly label = input.required<string>();
}
