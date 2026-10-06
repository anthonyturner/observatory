import { Ledger } from '../../../core/queue/ledger';
import { AgentWeek, CycleWeek, Waits } from '../../../core/queue/weekly-retro';
import { hours } from '../agents-panel/agents-panel';
import { BY_ID } from '../engine/sky-model';
import { BarItem } from '../starmap-usage/charts/bar-rows-chart';
import { Column, ColumnScale } from '../starmap-usage/charts/columns-chart';
import { dayText } from '../starmap-usage/usage-text';

const NONE = '—';

const pulls = (n: number): string => `${n} pull request${n === 1 ? '' : 's'}`;
const dayOf = (ms: number, locale?: string): string => dayText(new Date(ms).toISOString(), locale);
const finishedText = (merged: number, closed: number): string =>
  `${merged} merged · ${closed} closed`;
const cycleText = (medianHours: number | null): string =>
  medianHours === null ? 'nothing merged' : `median ${hours(medianHours)} from open to merge`;

/** Each bucket the week's finished pull requests sat in, named as the legend names it. */
export function waitBars(waits: Waits): BarItem[] {
  return waits.buckets.map((wait) => {
    const name = BY_ID.get(wait.bucket)?.sub ?? wait.bucket;
    const text = wait.hours ? hours(wait.hours) : NONE;
    return {
      label: name,
      value: wait.hours,
      text,
      tip: `${name}\n${text} across ${pulls(wait.pulls)}`,
      isStrong: true,
    };
  });
}

/** How much of the week the frames could see, and how the time is counted. */
export function waitNote(waits: Waits, locale?: string): string {
  if (!waits.finished) return 'Nothing merged or closed this week.';
  if (waits.since === null) {
    return 'No refreshes recorded yet: the queue’s memory records where each pull request stood at every refresh.';
  }
  return (
    `${waits.observed} of the ${pulls(waits.finished)} finished this week seen at refreshes since ` +
    `${dayOf(waits.since, locale)}. Each counts from the refresh that saw it to the next refresh, ` +
    'or until it finished; time before the oldest refresh is not counted.'
  );
}

/** Each week's median time from open to merge, as a column labelled by its last day. */
export function cycleColumns(weeks: readonly CycleWeek[], locale?: string): Column[] {
  return weeks.map((week) => {
    const day = dayOf(week.end, locale);
    return {
      label: day,
      value: week.medianCycleHours ?? 0,
      text: week.medianCycleHours === null ? NONE : hours(week.medianCycleHours),
      tip: `Week to ${day}\n${finishedText(week.merged, week.closed)}\n${cycleText(week.medianCycleHours)}`,
    };
  });
}

/** Zero to the slowest week's median. */
export function cycleScale(weeks: readonly CycleWeek[]): ColumnScale {
  const top = Math.max(0, ...weeks.map((week) => week.medianCycleHours ?? 0));
  return { top, bottomLabel: '0', topLabel: top ? hours(top) : '' };
}

/** Each agent's merges this week, with its closes and median in the tooltip. */
export function agentRows(rows: readonly AgentWeek[]): BarItem[] {
  return rows.map((row) => ({
    label: row.agent,
    value: row.merged,
    text: String(row.merged),
    tip: `${row.agent}\n${finishedText(row.merged, row.closed)}\n${cycleText(row.medianCycleHours)}`,
    isStrong: true,
  }));
}

/** The header's line: "owner/name · week to Oct 6 · read 10/6/2026, 9:14:02 AM". */
export function retroStamp(repo: string, ledger: Ledger | null, locale?: string): string {
  if (!ledger) return 'no history read yet';
  const at = Date.parse(ledger.generatedAt);
  const week = `week to ${dayOf(at, locale)} · read ${new Date(at).toLocaleString(locale)}`;
  return repo ? `${repo} · ${week}` : week;
}
