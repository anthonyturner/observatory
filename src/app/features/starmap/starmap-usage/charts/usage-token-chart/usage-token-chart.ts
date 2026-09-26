import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TokenChart } from '../token-chart';

/** Tokens per day, stacked by model family. */
@Component({
  selector: 'app-usage-token-chart',
  templateUrl: './usage-token-chart.html',
  styleUrl: './usage-token-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageTokenChart {
  readonly chart = input.required<TokenChart>();
}
