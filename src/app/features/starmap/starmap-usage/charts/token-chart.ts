import { TokenDay } from '../../../../core/usage/usage-document';
import { formatTokens } from '../../../../core/usage/usage-format';
import { fmtN } from '../../starmap-view';
import { dayText } from '../usage-text';
import {
  AXIS_LABEL_RISE,
  ChartBox,
  ChartHit,
  ChartLine,
  ChartText,
  Margins,
  gridRow,
  tenth,
} from '../../../../shared/charts/chart-marks';
import { FAMILIES } from './usage-families';

const HEIGHT = 200;
const MARGINS: Margins = { left: 48, right: 12, top: 12, bottom: 24 };
const GRID_FRACTIONS = [0, 0.5, 1] as const;
const BAR_GAP = 3;
const MIN_BAR_WIDTH = 2;
/** Background left between stacked segments. */
const SEGMENT_GAP = 2;
const MIN_SEGMENT_HEIGHT = 1;
/** Roughly how much room a day label needs. */
const LABEL_SPACING = 70;
const MIN_LABELS = 2;

/** One family's part of a day's bar. */
export interface Segment extends ChartBox {
  readonly colour: string;
}

export interface TokenChart {
  readonly width: number;
  readonly height: number;
  readonly grid: readonly ChartLine[];
  readonly axis: readonly ChartText[];
  readonly segments: readonly Segment[];
  readonly hits: readonly ChartHit[];
}

const dayTotal = (row: TokenDay): number =>
  FAMILIES.reduce((total, family) => total + (row.families[family.id] ?? 0), 0);

function tipOf(row: TokenDay, locale?: string): string {
  const used = FAMILIES.filter((family) => row.families[family.id]).map(
    (family) => `${family.label} ${formatTokens(row.families[family.id])}`,
  );
  return [
    dayText(row.day, locale),
    ...(used.length ? used : ['nothing used']),
    `cache reads ${formatTokens(row.cacheRead)}`,
    `${fmtN(row.messages)} replies · ${row.sessions} sessions`,
    `${fmtN(row.toolCalls)} tool calls · ${row.subagents} subagents`,
  ].join('\n');
}

/** A day's bar, its families stacked from the bottom with a gap between. */
function stack(row: TokenDay, left: number, barWidth: number, y: (v: number) => number): Segment[] {
  const segments: Segment[] = [];
  let base = y(0);
  for (const family of FAMILIES) {
    const tokens = row.families[family.id] ?? 0;
    if (!tokens) continue;
    const height = y(0) - y(tokens);
    const drawn = Math.max(height - (base < y(0) ? SEGMENT_GAP : 0), MIN_SEGMENT_HEIGHT);
    segments.push({
      x: tenth(left),
      y: tenth(base - height),
      width: tenth(barWidth),
      height: tenth(drawn),
      colour: family.colour,
    });
    base -= height;
  }
  return segments;
}

/** Tokens per day, stacked by model family; every few days labelled, counted
 *  back from today so today always is. */
export function tokenChart(rows: readonly TokenDay[], width: number, locale?: string): TokenChart {
  const max = Math.max(1, ...rows.map(dayTotal));
  const y = (value: number) =>
    MARGINS.top + (1 - value / max) * (HEIGHT - MARGINS.top - MARGINS.bottom);
  const band = (width - MARGINS.left - MARGINS.right) / Math.max(rows.length, 1);
  const barWidth = Math.max(MIN_BAR_WIDTH, band - BAR_GAP);
  const every = Math.ceil(
    rows.length / Math.max(MIN_LABELS, Math.floor((width - MARGINS.left) / LABEL_SPACING)),
  );
  const gridRows = GRID_FRACTIONS.map((fraction) =>
    gridRow(y(max * fraction), MARGINS.left, width - MARGINS.right, formatTokens(max * fraction)),
  );
  const days = rows.map((row, index) => {
    const left = MARGINS.left + band * index + (band - barWidth) / 2;
    const isLabelled = (rows.length - 1 - index) % every === 0;
    return {
      segments: stack(row, left, barWidth, y),
      label: isLabelled
        ? [
            {
              x: tenth(left + barWidth / 2),
              y: HEIGHT - AXIS_LABEL_RISE,
              text: dayText(row.day, locale),
              anchor: 'middle' as const,
            },
          ]
        : [],
      hit: {
        x: tenth(MARGINS.left + band * index),
        y: MARGINS.top,
        width: tenth(band),
        height: HEIGHT - MARGINS.top - MARGINS.bottom,
        tip: tipOf(row, locale),
      },
    };
  });
  return {
    width,
    height: HEIGHT,
    grid: gridRows.map((row) => row.line),
    axis: [...gridRows.map((row) => row.label), ...days.flatMap((day) => day.label)],
    segments: days.flatMap((day) => day.segments),
    hits: days.map((day) => day.hit),
  };
}
