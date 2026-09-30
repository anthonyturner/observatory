import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AgentChart, AgentFocus } from '../../../core/agent-usage/agent-focus';
import { AgentReminders } from '../../../core/agent-usage/agent-reminders';
import { Weekday } from '../../../core/agent-usage/agent-review-week';
import { AgentUsageFeed, AgentUsageState } from '../../../core/agent-usage/agent-usage-feed';
import { formatTokens } from '../../../core/usage/usage-format';
import { TipAt, UsageTip } from '../../../shared/charts/usage-tip/usage-tip';
import { TopLink } from '../../../shared/section-jump/top-link';
import { projectGrid } from './charts/agent-grid';
import { agentOrrery } from './charts/agent-orrery';
import { rankChart } from './charts/agent-rank';
import { contextChart } from './charts/agent-context';
import { dailyChart, dayLabel, windowDays } from './charts/agent-daily';
import { AgentFilter, NO_FILTER, runsMatching, runsTitle } from './charts/agent-filter';
import { AgentContextView } from './views/agent-context-view';
import { AgentDailyView } from './views/agent-daily-view';
import { AgentGridView, GridPick } from './views/agent-grid-view';
import { AgentOrreryView } from './views/agent-orrery-view';
import { AgentRankView } from './views/agent-rank-view';
import { AgentRunsList } from './views/agent-runs-list';

/** What the section says in place of charts, by where the report stands. */
const WAITING_MESSAGE: Record<Exclude<AgentUsageState['status'], 'ready'>, string> = {
  reading: 'Reading your agents’ runs from Claude Code’s logs…',
  unreachable: 'Agent runs out of reach: is the API running (npm start)?',
  missing:
    'No agent runs to show here: they are read from Claude Code’s logs on the machine that runs Observatory.',
};

/** The days a weekly review can fall on, Monday first. */
const WEEKDAYS: readonly { day: Weekday; name: string }[] = [
  { day: 1, name: 'Monday' },
  { day: 2, name: 'Tuesday' },
  { day: 3, name: 'Wednesday' },
  { day: 4, name: 'Thursday' },
  { day: 5, name: 'Friday' },
  { day: 6, name: 'Saturday' },
  { day: 0, name: 'Sunday' },
];

/** Below the projects: what each agent you use costs, in six charts that
 *  filter one another, and the runs behind them. */
@Component({
  selector: 'app-agents-section',
  imports: [
    TopLink,
    UsageTip,
    AgentOrreryView,
    AgentRankView,
    AgentDailyView,
    AgentContextView,
    AgentGridView,
    AgentRunsList,
  ],
  templateUrl: './agents-section.html',
  styleUrl: './agents-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(pointermove)': 'pointAt($event)', '(pointerleave)': 'tip.set(null)' },
})
export class AgentsSection {
  private readonly feed = inject(AgentUsageFeed);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  protected readonly reminders = inject(AgentReminders);
  protected readonly weekdays = WEEKDAYS;
  /** The chart a reminder just opened, outlined for a moment. */
  protected readonly flashed = signal<AgentChart | null>(null);

  protected readonly filter = signal<AgentFilter>(NO_FILTER);
  protected readonly tip = signal<TipAt | null>(null);

  protected readonly reading = computed(() => this.feed.state().status === 'reading');
  protected readonly waiting = computed(() => {
    const state = this.feed.state();
    if (state.status !== 'ready') return WAITING_MESSAGE[state.status];
    return state.document.runs.length
      ? null
      : 'No agent runs in the last 30 days. They appear here once an agent such as pm, dev or qa finishes a task.';
  });
  /** When the report was made: the charts' "today", steady between reads. */
  private readonly asOf = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready'
      ? Date.parse(state.document.generatedAt) || Date.now()
      : Date.now();
  });
  private readonly days = computed(() => {
    const state = this.feed.state();
    return windowDays(this.asOf(), state.status === 'ready' ? state.document.days : 30);
  });
  private readonly runs = this.feed.runs;
  /** The project filter narrows every chart but the grid, which is how it is chosen. */
  private readonly inProject = computed(() =>
    runsMatching(this.runs(), { ...NO_FILTER, project: this.filter().project }),
  );

  protected readonly now = this.asOf;
  protected readonly summary = computed(() => {
    const runs = this.inProject();
    const work = runs.reduce((total, run) => total + run.workTokens, 0);
    return `${runs.length} runs · ${formatTokens(work)} work tokens`;
  });
  protected readonly orrery = computed(() => agentOrrery(this.inProject()));
  protected readonly rank = computed(() => rankChart(this.inProject()));
  protected readonly daily = computed(() =>
    dailyChart(this.inProject(), this.days(), this.filter().day),
  );
  protected readonly context = computed(() => contextChart(this.inProject()));
  protected readonly grid = computed(() => projectGrid(this.runs(), this.filter()));
  protected readonly listed = computed(() => runsMatching(this.runs(), this.filter()));
  protected readonly listTitle = computed(() => runsTitle(this.filter(), dayLabel));
  protected readonly dayName = computed(() => {
    const day = this.filter().day;
    return day ? dayLabel(day) : null;
  });

  /** Every project with a run, the busiest first, for the Project list. */
  protected readonly projects = computed(() => {
    const work = new Map<string, number>();
    for (const run of this.runs())
      work.set(run.project, (work.get(run.project) ?? 0) + run.workTokens);
    return [...work].sort((a, b) => b[1] - a[1]).map(([project]) => project);
  });

  constructor() {
    // A review step or a nudge asks for a chart: narrow to what it names, then
    // bring the chart into view once it has drawn.
    const focus = inject(AgentFocus);
    effect(() => {
      const request = focus.request();
      if (!request) return;
      untracked(() => {
        this.filter.update((filter) => ({
          project: request.project ?? filter.project,
          agent: request.agent ?? null,
          day: request.day ?? null,
        }));
        this.flashed.set(request.chart);
      });
      afterNextRender(
        () => {
          const panel = this.document.getElementById(`agents-${request.chart}`);
          panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          panel?.focus({ preventScroll: true });
        },
        { injector: this.injector },
      );
    });
  }

  protected setReminderDay(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.reminders.setDay(value === '' ? null : (Number(value) as Weekday));
  }

  protected setNotify(event: Event): void {
    void this.reminders.setNotify((event.target as HTMLInputElement).checked);
  }

  protected pickProject(event: Event): void {
    const project = (event.target as HTMLSelectElement).value || null;
    this.filter.update((filter) => ({ ...filter, project }));
  }

  protected pickAgent(agent: string): void {
    this.filter.update((filter) => ({ ...filter, agent: filter.agent === agent ? null : agent }));
  }

  protected pickDay(day: string): void {
    this.filter.update((filter) => ({ ...filter, day: filter.day === day ? null : day }));
  }

  protected pickCell({ project, agent }: GridPick): void {
    this.filter.update((filter) =>
      filter.project === project && filter.agent === agent
        ? { ...filter, project: null, agent: null }
        : { ...filter, project, agent },
    );
  }

  protected clear(part: keyof AgentFilter): void {
    this.filter.update((filter) => ({ ...filter, [part]: null }));
  }

  /** Any chart mark with a `data-tip` shows its text beside the pointer. */
  protected pointAt(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const text = target?.closest('[data-tip]')?.getAttribute('data-tip');
    this.tip.set(text ? { text, pointer: { x: event.clientX, y: event.clientY } } : null);
  }
}
