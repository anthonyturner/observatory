import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AgentsFeed } from '../../../core/agents/agents-report';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LedgerFeed } from '../../../core/queue/ledger-feed';
import {
  RETRO_WEEKS,
  agentWeeks,
  cycleWeeks,
  finishedIn,
  retroWeeks,
  whereTheyWaited,
} from '../../../core/queue/weekly-retro';
import { ELEMENT_WIDTH } from '../../../shared/element-width/element-width';
import { TipAt, UsageTip, tipAt } from '../../../shared/charts/usage-tip/usage-tip';
import { columnsChart } from '../starmap-usage/charts/columns-chart';
import { UsageColumnChart } from '../starmap-usage/charts/usage-column-chart/usage-column-chart';
import { DEFAULT_WIDTH, chartWidth } from '../starmap-usage/starmap-usage';
import { UsageBarsSection } from '../starmap-usage/usage-bars/usage-bars';
import { UsageSection } from '../starmap-usage/usage-section/usage-section';
import { agentRows, cycleColumns, cycleScale, waitBars, waitNote } from './retro-charts';

/**
 * The weekly retro: where the week's merged and closed pull requests waited,
 * how long merges took over recent weeks, and who finished what. The weeks
 * end when the ledger was read, so the view is as of that read.
 */
@Component({
  selector: 'app-starmap-retro',
  imports: [UsageBarsSection, UsageSection, UsageColumnChart, UsageTip],
  templateUrl: './starmap-retro.html',
  styleUrl: './starmap-retro.css',
  host: { '(pointermove)': 'tip.set(tipAt($event))', '(pointerleave)': 'tip.set(null)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapRetro {
  private readonly ledger = inject(LedgerFeed).ledger;
  private readonly frames = inject(HistoryFeed).frames;
  private readonly agents = inject(AgentsFeed).report;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly width = toSignal(inject(ELEMENT_WIDTH)(this.host).pipe(map(chartWidth)), {
    initialValue: DEFAULT_WIDTH,
  });
  protected readonly cycleSmall = `median open to merge, last ${RETRO_WEEKS} weeks`;
  protected readonly tip = signal<TipAt | null>(null);
  protected readonly tipAt = tipAt;

  private readonly finished = computed(() => {
    const ledger = this.ledger();
    if (!ledger) return null;
    const weeks = retroWeeks(Date.parse(ledger.generatedAt));
    const thisWeek = weeks[weeks.length - 1];
    return { all: ledger.finished, weeks, thisWeek: finishedIn(ledger.finished, thisWeek) };
  });

  protected readonly waits = computed(() => {
    const finished = this.finished();
    if (!finished) return null;
    const waits = whereTheyWaited(this.frames(), finished.thisWeek);
    return { note: waitNote(waits), items: waitBars(waits) };
  });

  protected readonly cycle = computed(() => {
    const finished = this.finished();
    if (!finished) return null;
    const weeks = cycleWeeks(finished.all, finished.weeks);
    return columnsChart(cycleColumns(weeks), this.width(), cycleScale(weeks));
  });

  protected readonly byAgent = computed(() => {
    const finished = this.finished();
    return finished ? agentRows(agentWeeks(this.agents(), finished.thisWeek)) : null;
  });
}
