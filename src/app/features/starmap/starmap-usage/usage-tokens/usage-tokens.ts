import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TokenReport } from '../../../../core/usage/usage-document';
import { tokenChart } from '../charts/token-chart';
import { UsageTokenChart } from '../charts/usage-token-chart/usage-token-chart';
import { familyLegend, modelRows, tokenTiles } from '../token-views';
import { UsageModelTable } from '../usage-model-table/usage-model-table';
import { UsageSection } from '../usage-section/usage-section';
import { UsageTiles } from '../usage-tiles/usage-tiles';

/** Tokens over the report's days: the totals, each day by model family, and
 *  each model. */
@Component({
  selector: 'app-usage-tokens',
  imports: [UsageSection, UsageTiles, UsageTokenChart, UsageModelTable],
  templateUrl: './usage-tokens.html',
  styleUrl: './usage-tokens.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageTokensSection {
  readonly tokens = input.required<TokenReport>();
  readonly width = input.required<number>();

  protected readonly small = computed(() => `last ${this.tokens().days} days`);
  protected readonly tiles = computed(() => tokenTiles(this.tokens()));
  protected readonly legend = computed(() => familyLegend(this.tokens()));
  protected readonly chart = computed(() => tokenChart(this.tokens().rows, this.width()));
  protected readonly models = computed(() => modelRows(this.tokens().models));
}
