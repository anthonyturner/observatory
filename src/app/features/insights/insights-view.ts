import { AgentsReport } from '../../core/agents/agents-report';
import { InsightsReport, TrafficSeries } from '../../core/insights/insights-report';
import {
  NO_HANDOFF,
  RetroWeek,
  agentWeeks,
  cycleWeeks,
  finishedIn,
  retroWeeks,
} from '../../core/queue/weekly-retro';
import { plural } from '../../shared/text/plural';
import { BarRowsChart, barRowsChart } from '../starmap/starmap-usage/charts/bar-rows-chart';
import { ColumnsChart, columnsChart } from '../starmap/starmap-usage/charts/columns-chart';
import { agentRows, cycleColumns, cycleScale } from '../starmap/starmap-retro/retro-charts';
import {
  CLONE_NOUNS,
  TrafficNouns,
  VIEW_NOUNS,
  commitColumns,
  contributorBars,
  countScale,
  trafficColumns,
} from './insights-charts';
import {
  TableView,
  agentsTable,
  commitsTable,
  contributorsTable,
  cycleTable,
  trafficTable,
} from './insights-tables';
import { NO_AGENTS, NO_COMMITS, NO_CONTRIBUTORS, NO_MERGES, NO_TRAFFIC } from './insights-words';

/** One section of the screen: a chart and its table, or a note on why there is none. */
export interface SectionView<C> {
  readonly note: string | null;
  readonly chart: C | null;
  readonly table: TableView | null;
}

/** One traffic chart and the line that sums it up: "46 views · 1 unique visitor". */
export interface TrafficChart {
  readonly total: string;
  readonly chart: ColumnsChart;
}

export interface TrafficCharts {
  readonly views: TrafficChart;
  readonly clones: TrafficChart;
}

const noted = <C>(note: string): SectionView<C> => ({ note, chart: null, table: null });

/** The screen's weeks, oldest first, ending when the report was read. */
export const reportWeeks = (report: InsightsReport): RetroWeek[] =>
  retroWeeks(report.generatedAt, report.weeks);

export function commitsSection(report: InsightsReport, width: number): SectionView<ColumnsChart> {
  const { note, weeks } = report.commits;
  if (note) return noted(note);
  if (!weeks.some((week) => week.total)) return noted(NO_COMMITS);
  return {
    note: null,
    chart: columnsChart(commitColumns(weeks), width, countScale(weeks.map((week) => week.total))),
    table: commitsTable(weeks),
  };
}

/** Median open-to-merge time a week, as the Review Queue's weekly retro works it out. */
export function cycleSection(report: InsightsReport, width: number): SectionView<ColumnsChart> {
  const { note, finished } = report.pulls;
  if (note) return noted(note);
  const weeks = cycleWeeks(finished, reportWeeks(report));
  if (!weeks.some((week) => week.merged)) return noted(NO_MERGES);
  return {
    note: null,
    chart: columnsChart(cycleColumns(weeks), width, cycleScale(weeks)),
    table: cycleTable(weeks),
  };
}

export function contributorsSection(
  report: InsightsReport,
  width: number,
): SectionView<BarRowsChart> {
  const { note, people } = report.contributors;
  if (note) return noted(note);
  if (!people.length) return noted(NO_CONTRIBUTORS);
  return {
    note: null,
    chart: barRowsChart(contributorBars(people), width),
    table: contributorsTable(people),
  };
}

/** Each agent's merges over the weeks, attributed as the Agents report cards attribute them. */
export function agentsSection(
  report: InsightsReport,
  agents: AgentsReport | null,
  width: number,
): SectionView<BarRowsChart> {
  const { note, finished } = report.pulls;
  if (note) return noted(note);
  const weeks = reportWeeks(report);
  const span: RetroWeek = { start: weeks[0].start, end: weeks[weeks.length - 1].end };
  const rows = agentWeeks(agents, finishedIn(finished, span));
  if (!rows.some((row) => row.agent !== NO_HANDOFF)) return noted(NO_AGENTS);
  return {
    note: null,
    chart: barRowsChart(agentRows(rows), width),
    table: agentsTable(rows),
  };
}

function trafficChart(series: TrafficSeries, nouns: TrafficNouns, width: number): TrafficChart {
  return {
    total: `${plural(series.count, nouns.count)} · ${plural(series.uniques, nouns.unique)}`,
    chart: columnsChart(
      trafficColumns(series, nouns),
      width,
      countScale(series.days.map((day) => day.count)),
    ),
  };
}

export function trafficSection(report: InsightsReport, width: number): SectionView<TrafficCharts> {
  const { note, views, clones } = report.traffic;
  if (note) return noted(note);
  if (!views || !clones) return noted(NO_TRAFFIC);
  return {
    note: null,
    chart: {
      views: trafficChart(views, VIEW_NOUNS, width),
      clones: trafficChart(clones, CLONE_NOUNS, width),
    },
    table: trafficTable(views, clones),
  };
}
