import { LimitWindow, UsageDocument, workTokensOf } from '../../../core/usage/usage-document';
import { UsageState } from '../../../core/usage/usage-reader';
import {
  ageOf,
  formatPercent,
  formatTokens,
  hoursMinutes,
  localDayKey,
  weekdayTime,
} from '../../../core/usage/usage-format';
import { HOT_PERCENT, VitalReading, WeeklyUsage } from './vitals';
import { weekToday } from './week-today';

/** The three meters Home draws from Claude Code's usage. */
export interface UsageMeters {
  readonly tokens: VitalReading;
  readonly fiveHour: VitalReading;
  readonly weekly: WeeklyUsage;
}

const PERCENT_CEILING = 100;

/** Why there are no readings at all, by where the document stands. */
const UNREAD_REASON: Record<Exclude<UsageState['status'], 'ready'>, string> = {
  reading: 'reading',
  unreachable: 'store out of reach',
  missing: 'no usage recorded',
};

/** Where limit readings come from, said beside a limit that has none current. */
const LIMITS_SOURCE = 'read while the local site runs';

const TOKENS_LABEL = { id: 'tokens', label: 'Tokens today' } as const;
const FIVE_HOUR_LABEL = { id: 'five', label: '5-hour window' } as const;

/** Maps the usage document to Home's meters. Anything not known reads as
 *  unknown with the reason, never as a number. */
export function usageMeters(state: UsageState, now: number, locale?: string): UsageMeters {
  if (state.status !== 'ready') {
    const note = UNREAD_REASON[state.status];
    return {
      tokens: { ...TOKENS_LABEL, value: null, note },
      fiveHour: { ...FIVE_HOUR_LABEL, value: null, note },
      weekly: { percentUsed: null, note },
    };
  }
  const { document } = state;
  return {
    tokens: tokensToday(document, now),
    fiveHour: fiveHourWindow(document, now),
    weekly: weeklyLimit(document, now, locale),
  };
}

function tokensToday(document: UsageDocument, now: number): VitalReading {
  const rows = document.tokens?.rows ?? [];
  const series = rows.map(workTokensOf);
  const age = ageOf(document.generatedAt, now);
  const todayIndex = rows.findIndex((row) => row.day === localDayKey(now));
  if (todayIndex < 0) return { ...TOKENS_LABEL, value: null, age, note: 'not read today', series };

  const average = series.reduce((sum, total) => sum + total, 0) / series.length;
  return {
    ...TOKENS_LABEL,
    value: formatTokens(series[todayIndex]),
    age,
    note: `avg ${formatTokens(average)} /day`,
    series,
  };
}

const hasReset = (window: LimitWindow, now: number): boolean =>
  window.expired === true || Date.parse(window.resetsAt) <= now;

/** " · last read Fri 09:05": the window's newest point, else the newest reading. */
function lastRead(window: LimitWindow, limitsAt: string | undefined, locale?: string): string {
  const newest = window.points.at(-1)?.[0] ?? Date.parse(limitsAt ?? '');
  return Number.isFinite(newest) ? ` · last read ${weekdayTime(newest, locale)}` : '';
}

function fiveHourWindow(document: UsageDocument, now: number): VitalReading {
  const limitsAt = document.limits?.at;
  const age = limitsAt ? ageOf(limitsAt, now) : undefined;
  const five = document.limits?.five;
  if (!five) {
    return { ...FIVE_HOUR_LABEL, value: null, age, note: 'no limit readings', how: LIMITS_SOURCE };
  }
  const resetsAt = Date.parse(five.resetsAt);
  if (hasReset(five, now)) {
    return {
      ...FIVE_HOUR_LABEL,
      value: null,
      age,
      note: `reset ${hoursMinutes(resetsAt)}${lastRead(five, limitsAt)}`,
      how: LIMITS_SOURCE,
    };
  }
  return {
    ...FIVE_HOUR_LABEL,
    value: formatPercent(five.pct),
    unit: '%',
    age,
    note: `resets ${hoursMinutes(resetsAt)}`,
    series: five.points.map(([, percent]) => percent),
    max: PERCENT_CEILING,
    isHot: five.pct >= HOT_PERCENT,
  };
}

function weeklyLimit(document: UsageDocument, now: number, locale?: string): WeeklyUsage {
  const week = document.limits?.week;
  if (!week) return { percentUsed: null, note: `no limit readings yet · ${LIMITS_SOURCE}` };

  const resetsAt = weekdayTime(Date.parse(week.resetsAt), locale);
  if (hasReset(week, now)) {
    return {
      percentUsed: null,
      note: `reset ${resetsAt}${lastRead(week, document.limits?.at, locale)} · ${LIMITS_SOURCE}`,
    };
  }
  const pace = week.projection ? ` · on pace for ${formatPercent(week.projection.atReset)}%` : '';
  return { percentUsed: week.pct, note: `resets ${resetsAt}${pace}`, today: weekToday(week, now) };
}
