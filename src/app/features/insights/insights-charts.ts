import { CommitWeek, Contributor, TrafficSeries } from '../../core/insights/insights-report';
import { plural } from '../../shared/text/plural';
import { BarItem } from '../starmap/starmap-usage/charts/bar-rows-chart';
import { Column, ColumnScale } from '../starmap/starmap-usage/charts/columns-chart';

const DAY_MS = 86_400_000;
/**
 * GitHub's weeks and traffic days start at midnight in its own reckoning, a
 * few hours either side of UTC's. Their name is read at noon, clear of both.
 */
const NAME_AT_MS = DAY_MS / 2;
const UTC = 'UTC';

/** "Oct 4": the day GitHub's week or traffic day starts on, whatever the viewer's timezone. */
export const gitHubDayText = (ms: number, locale?: string): string =>
  new Date(ms + NAME_AT_MS).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: UTC,
  });

/** "Mon": the weekday of the `index`th day after `ms`, as GitHub counts days. */
const weekdayOf = (ms: number, index: number, locale?: string): string =>
  new Date(ms + index * DAY_MS + NAME_AT_MS).toLocaleDateString(locale, {
    weekday: 'short',
    timeZone: UTC,
  });

/** "Mon, 71 commits", or null in a week with none. */
export function busiestDay(week: CommitWeek, locale?: string): string | null {
  if (!week.total) return null;
  const most = Math.max(...week.days);
  return `${weekdayOf(week.start, week.days.indexOf(most), locale)}, ${plural(most, 'commit')}`;
}

/** Each week's commits, as a column named by the day it starts. */
export function commitColumns(weeks: readonly CommitWeek[], locale?: string): Column[] {
  return weeks.map((week) => {
    const day = gitHubDayText(week.start, locale);
    const busiest = busiestDay(week, locale);
    return {
      label: day,
      value: week.total,
      text: String(week.total),
      tip: [`Week of ${day}`, plural(week.total, 'commit'), busiest && `Busiest: ${busiest}`]
        .filter(Boolean)
        .join('\n'),
    };
  });
}

/** Zero to the largest count. */
export function countScale(values: readonly number[]): ColumnScale {
  const top = Math.max(0, ...values);
  return { top, bottomLabel: '0', topLabel: top ? String(top) : '' };
}

/** What a traffic series counts, and who did it. */
export interface TrafficNouns {
  readonly count: string;
  readonly unique: string;
}

export const VIEW_NOUNS: TrafficNouns = { count: 'view', unique: 'unique visitor' };
export const CLONE_NOUNS: TrafficNouns = { count: 'clone', unique: 'unique cloner' };

/** Each day's views or clones, as a column named by its day. */
export function trafficColumns(
  series: TrafficSeries,
  nouns: TrafficNouns,
  locale?: string,
): Column[] {
  return series.days.map((day) => {
    const name = gitHubDayText(day.day, locale);
    return {
      label: name,
      value: day.count,
      text: String(day.count),
      tip: `${name}\n${plural(day.count, nouns.count)}\n${plural(day.uniques, nouns.unique)}`,
    };
  });
}

/** "dependabot[bot] (bot)": an app's account says so. */
export const contributorName = (person: Contributor): string =>
  person.isBot ? `${person.login} (bot)` : person.login;

/** Each contributor's commits, with the lines they changed in the tooltip. */
export function contributorBars(people: readonly Contributor[]): BarItem[] {
  return people.map((person) => {
    const name = contributorName(person);
    return {
      label: name,
      value: person.commits,
      text: String(person.commits),
      tip: `${name}\n${plural(person.commits, 'commit')}\n+${person.additions} −${person.deletions} lines`,
      isStrong: true,
    };
  });
}
