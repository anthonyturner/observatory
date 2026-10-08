import { CommitWeek, Contributor, TrafficSeries } from '../../core/insights/insights-report';
import { AgentWeek, CycleWeek } from '../../core/queue/weekly-retro';
import { hours } from '../starmap/agents-panel/agents-panel';
import { dayText } from '../starmap/starmap-usage/usage-text';
import { busiestDay, contributorName, gitHubDayText } from './insights-charts';

/** One row of a chart's table: a key to track it by, and its cells as they read. */
export interface TableRow {
  readonly key: string;
  readonly cells: readonly string[];
}

/** A chart's numbers as a table, for a keyboard or a screen reader. */
export interface TableView {
  readonly columns: readonly string[];
  readonly rows: readonly TableRow[];
}

const NONE = '—';
const MEDIAN_COLUMN = 'Median open to merge';

export function commitsTable(weeks: readonly CommitWeek[], locale?: string): TableView {
  return {
    columns: ['Week of', 'Commits', 'Busiest day'],
    rows: weeks.map((week) => ({
      key: String(week.start),
      cells: [
        gitHubDayText(week.start, locale),
        String(week.total),
        busiestDay(week, locale) ?? NONE,
      ],
    })),
  };
}

export function cycleTable(weeks: readonly CycleWeek[], locale?: string): TableView {
  return {
    columns: ['Week to', 'Merged', 'Closed', MEDIAN_COLUMN],
    rows: weeks.map((week) => ({
      key: String(week.end),
      cells: [
        dayText(new Date(week.end).toISOString(), locale),
        String(week.merged),
        String(week.closed),
        hours(week.medianCycleHours),
      ],
    })),
  };
}

export function contributorsTable(people: readonly Contributor[]): TableView {
  return {
    columns: ['Contributor', 'Commits', 'Lines added', 'Lines removed'],
    rows: people.map((person) => ({
      key: person.login,
      cells: [
        contributorName(person),
        String(person.commits),
        String(person.additions),
        String(person.deletions),
      ],
    })),
  };
}

export function agentsTable(rows: readonly AgentWeek[]): TableView {
  return {
    columns: ['Agent', 'Merged', 'Closed', MEDIAN_COLUMN],
    rows: rows.map((row) => ({
      key: row.agent,
      cells: [row.agent, String(row.merged), String(row.closed), hours(row.medianCycleHours)],
    })),
  };
}

/** Views and clones side by side, a row a day; a day only one of them lists reads as none for the other. */
export function trafficTable(
  views: TrafficSeries,
  clones: TrafficSeries,
  locale?: string,
): TableView {
  const days = [...new Set([...views.days, ...clones.days].map((day) => day.day))].sort(
    (a, b) => a - b,
  );
  const byDay = (series: TrafficSeries) => new Map(series.days.map((day) => [day.day, day]));
  const [viewsOn, clonesOn] = [byDay(views), byDay(clones)];
  return {
    columns: ['Day', 'Views', 'Unique visitors', 'Clones', 'Unique cloners'],
    rows: days.map((day) => ({
      key: String(day),
      cells: [
        gitHubDayText(day, locale),
        String(viewsOn.get(day)?.count ?? 0),
        String(viewsOn.get(day)?.uniques ?? 0),
        String(clonesOn.get(day)?.count ?? 0),
        String(clonesOn.get(day)?.uniques ?? 0),
      ],
    })),
  };
}
