import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { median } from '../../../../core/stats/median';
import { formatTokens } from '../../../../core/usage/usage-format';
import { ChartLine, ChartText, tenth } from '../../../../shared/charts/chart-marks';
import { STANDARD_WINDOW, formatMinutes, groupTotals, niceCeiling } from './agent-stats';

export interface ContextDot {
  readonly id: string;
  /** The chart group it is drawn in. */
  readonly group: string;
  readonly cx: number;
  readonly cy: number;
  readonly colour: string;
  readonly tip: string;
}

export interface ContextRow {
  readonly id: string;
  readonly label: string;
  readonly y: number;
  /** The median run's peak, as a tick across the row. */
  readonly median: ChartLine;
}

export interface ContextChart {
  readonly width: number;
  readonly height: number;
  readonly labelX: number;
  readonly rows: readonly ContextRow[];
  readonly dots: readonly ContextDot[];
  readonly grid: readonly ChartLine[];
  readonly axis: readonly ChartText[];
  /** The standard window's line, and the band past it where only a 1M-context run can go. */
  readonly window: ChartLine | null;
  readonly band: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
  readonly windowLabel: ChartText | null;
}

const WIDTH = 520;
const LEFT = 96;
const RIGHT = 16;
const TOP = 8;
const ROW = 34;
const AXIS = 26;
const TICKS = 4;
/** Dots in a row spread a little up and down, so a crowd still shows its size. */
const JITTER = [0, -6, 6, -3, 3, -8, 8, -1.5, 1.5];

/** B: each run at its peak context, by agent, with each agent's median. */
export function contextChart(runs: readonly AgentRun[]): ContextChart {
  const totals = groupTotals(runs);
  const plotHeight = totals.length * ROW;
  const most = Math.max(STANDARD_WINDOW, ...runs.map((run) => run.peakContext));
  const end = niceCeiling(most);
  const x = (value: number): number => tenth(LEFT + (value / end) * (WIDTH - LEFT - RIGHT));
  const ticks = Array.from({ length: TICKS + 1 }, (_, index) => (end / TICKS) * index);
  const pastWindow = end > STANDARD_WINDOW;
  return {
    width: WIDTH,
    height: TOP + plotHeight + AXIS,
    labelX: LEFT - 12,
    rows: totals.map((each, index) => {
      const y = TOP + index * ROW + ROW / 2;
      const medianX = x(median(each.runs.map((run) => run.peakContext)) ?? 0);
      return {
        id: each.group.id,
        label: each.group.label,
        y,
        median: { x1: medianX, x2: medianX, y1: y - 11, y2: y + 11 },
      };
    }),
    dots: totals.flatMap((each, index) =>
      each.runs.map((run, order) => ({
        id: run.id,
        group: each.group.id,
        cx: x(run.peakContext),
        cy: TOP + index * ROW + ROW / 2 + JITTER[order % JITTER.length],
        colour: each.group.colour,
        tip: [
          `${run.agent} · ${run.project}`,
          `peak context ${formatTokens(run.peakContext)}`,
          `${formatTokens(run.workTokens)} work tokens · ${formatMinutes(run.durationMs / 60_000)}`,
          run.description,
        ]
          .filter(Boolean)
          .join('\n'),
      })),
    ),
    grid: ticks.map((tick) => ({ x1: x(tick), x2: x(tick), y1: TOP, y2: TOP + plotHeight })),
    axis: ticks.map((tick, index) => ({
      x: x(tick),
      y: TOP + plotHeight + 18,
      text: formatTokens(tick),
      anchor: index === ticks.length - 1 ? 'end' : index === 0 ? 'start' : 'middle',
    })),
    window: pastWindow
      ? { x1: x(STANDARD_WINDOW), x2: x(STANDARD_WINDOW), y1: TOP, y2: TOP + plotHeight }
      : null,
    band: pastWindow
      ? {
          x: x(STANDARD_WINDOW),
          y: TOP,
          width: tenth(x(end) - x(STANDARD_WINDOW)),
          height: plotHeight,
        }
      : null,
    windowLabel: pastWindow
      ? { x: x(STANDARD_WINDOW) + 5, y: TOP + 11, text: 'past the 200k window', anchor: 'start' }
      : null,
  };
}
