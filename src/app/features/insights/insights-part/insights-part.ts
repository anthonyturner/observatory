import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UsageSection } from '../../starmap/starmap-usage/usage-section/usage-section';
import { TableView } from '../insights-tables';

/** One section of the Insights screen: its chart, the same numbers as a table
 *  under it, or a plain note on why there are none. */
@Component({
  selector: 'app-insights-part',
  imports: [UsageSection],
  templateUrl: './insights-part.html',
  styleUrl: './insights-part.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsPart {
  readonly heading = input.required<string>();
  readonly small = input.required<string>();
  /** Why there is no chart; null when there is one. */
  readonly note = input<string | null>(null);
  readonly table = input<TableView | null>(null);
}
