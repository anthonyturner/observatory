import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AgentsReport } from '../../../core/agents/agents-report';
import { InsightsReport } from '../../../core/insights/insights-report';
import { TipAt, UsageTip, tipAt } from '../../../shared/charts/usage-tip/usage-tip';
import { ELEMENT_WIDTH } from '../../../shared/element-width/element-width';
import { UsageBarChart } from '../../starmap/starmap-usage/charts/usage-bar-chart/usage-bar-chart';
import { UsageColumnChart } from '../../starmap/starmap-usage/charts/usage-column-chart/usage-column-chart';
import { DEFAULT_WIDTH, chartWidth } from '../../starmap/starmap-usage/starmap-usage';
import { InsightsPart } from '../insights-part/insights-part';
import {
  agentsSection,
  commitsSection,
  contributorsSection,
  cycleSection,
  trafficSection,
} from '../insights-view';

/** The Insights screen's charts, drawn at the width of the column they sit in;
 *  each mark names itself in the shared tooltip under the pointer. */
@Component({
  selector: 'app-insights-sections',
  imports: [InsightsPart, UsageColumnChart, UsageBarChart, UsageTip],
  templateUrl: './insights-sections.html',
  styleUrl: './insights-sections.css',
  host: { '(pointermove)': 'tip.set(tipAt($event))', '(pointerleave)': 'tip.set(null)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsSections {
  readonly report = input.required<InsightsReport>();
  /** The Agents report cards, which attribute pull requests to agents; null where none were read. */
  readonly agents = input<AgentsReport | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly width = toSignal(inject(ELEMENT_WIDTH)(this.host).pipe(map(chartWidth)), {
    initialValue: DEFAULT_WIDTH,
  });
  protected readonly tip = signal<TipAt | null>(null);
  protected readonly tipAt = tipAt;
  protected readonly weeks = computed(() => `last ${this.report().weeks} weeks`);

  protected readonly commits = computed(() => commitsSection(this.report(), this.width()));
  protected readonly cycle = computed(() => cycleSection(this.report(), this.width()));
  protected readonly contributors = computed(() =>
    contributorsSection(this.report(), this.width()),
  );
  protected readonly agentRows = computed(() =>
    agentsSection(this.report(), this.agents(), this.width()),
  );
  protected readonly traffic = computed(() => trafficSection(this.report(), this.width()));
}
