import { AGENT_GROUPS, groupOf } from '../../../../core/agent-usage/agent-groups';
import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { formatTokens, localDayKey } from '../../../../core/usage/usage-format';
import {
  ChartBox,
  ChartLine,
  ChartText,
  gridRow,
  tenth,
} from '../../../../shared/charts/chart-marks';
import { niceCeiling } from './agent-stats';

export interface DailySegment extends ChartBox {
  readonly colour: string;
  /** Only the top of a column is rounded: the data's end, not its base. */
  readonly isTop: boolean;
}

export interface DailyHit extends ChartBox {
  readonly day: string;
  readonly tip: string;
}

export interface DailyChart {
  readonly width: number;
  readonly height: number;
  readonly grid: readonly ChartLine[];
  readonly axis: readonly ChartText[];
  readonly segments: readonly DailySegment[];
  readonly hits: readonly DailyHit[];
  readonly baseline: ChartLine;
  /** The chosen day's column, outlined. */
  readonly picked: ChartBox | null;
}

const WIDTH = 1060;
const HEIGHT = 240;
const MARGINS = { left: 48, right: 12, top: 12, bottom: 26 };
const GRID_LINES = 4;
/** A sliver of sky between stacked colours, so they never touch. */
const GAP = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Every fifth day is named along the bottom. */
const LABEL_EVERY = 5;

/** The window's days, oldest first, as local YYYY-MM-DD, ending today. */
export function windowDays(now: number, days: number): string[] {
  return Array.from({ length: days }, (_, index) => localDayKey(now - (days - 1 - index) * DAY_MS));
}

/** "29 Sept": a local YYYY-MM-DD day as the charts name it. */
export const dayLabel = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
};

/** C: work tokens a day, stacked by agent in pipeline order from the bottom. */
export function dailyChart(
  runs: readonly AgentRun[],
  days: readonly string[],
  picked: string | null,
): DailyChart {
  const byDay = days.map((day) => {
    const mine = runs.filter((run) => localDayKey(Date.parse(run.endedAt)) === day);
    return AGENT_GROUPS.map((group) => ({
      group,
      tokens: mine
        .filter((run) => groupOf(run.agent).id === group.id)
        .reduce((total, run) => total + run.workTokens, 0),
    })).filter((part) => part.tokens > 0);
  });
  const totals = byDay.map((parts) => parts.reduce((total, part) => total + part.tokens, 0));
  const top = niceCeiling(Math.max(1, ...totals));
  const plotHeight = HEIGHT - MARGINS.top - MARGINS.bottom;
  const y = (value: number): number => tenth(MARGINS.top + (1 - value / top) * plotHeight);
  const slot = (WIDTH - MARGINS.left - MARGINS.right) / days.length;
  const barWidth = Math.max(4, slot - 6);
  const barX = (index: number): number =>
    tenth(MARGINS.left + index * slot + (slot - barWidth) / 2);
  const rows = Array.from({ length: GRID_LINES + 1 }, (_, index) =>
    gridRow(
      y((top / GRID_LINES) * index),
      MARGINS.left,
      WIDTH - MARGINS.right,
      formatTokens((top / GRID_LINES) * index),
    ),
  );
  const pickedIndex = picked ? days.indexOf(picked) : -1;
  return {
    width: WIDTH,
    height: HEIGHT,
    grid: rows.map((row) => row.line),
    axis: [
      ...rows.map((row) => row.label),
      ...days.flatMap((day, index) =>
        index % LABEL_EVERY === 0 || index === days.length - 1
          ? [
              {
                x: barX(index) + barWidth / 2,
                y: HEIGHT - 6,
                text: dayLabel(day),
                anchor: 'middle' as const,
              },
            ]
          : [],
      ),
    ],
    segments: byDay.flatMap((parts, index) => {
      let base = 0;
      return parts.map((part, order) => {
        const top = y(base + part.tokens);
        const bottom = y(base) - (order > 0 ? GAP : 0);
        base += part.tokens;
        return {
          x: barX(index),
          y: top,
          width: tenth(barWidth),
          height: tenth(Math.max(1, bottom - top)),
          colour: part.group.colour,
          isTop: order === parts.length - 1,
        };
      });
    }),
    hits: days.map((day, index) => ({
      day,
      x: tenth(MARGINS.left + index * slot),
      y: MARGINS.top,
      width: tenth(slot),
      height: plotHeight,
      tip: byDay[index].length
        ? [
            `${dayLabel(day)} · ${formatTokens(totals[index])} work tokens`,
            ...[...byDay[index]]
              .reverse()
              .map((part) => `${part.group.label} ${formatTokens(part.tokens)}`),
            'Click for that day’s runs',
          ].join('\n')
        : `${dayLabel(day)} · no agent runs`,
    })),
    baseline: { x1: MARGINS.left, x2: WIDTH - MARGINS.right, y1: y(0), y2: y(0) },
    picked:
      pickedIndex >= 0
        ? {
            x: barX(pickedIndex) - 3,
            y: MARGINS.top,
            width: tenth(barWidth + 6),
            height: plotHeight,
          }
        : null,
  };
}
