import {
  AXIS_LABEL_RISE,
  ChartBox,
  ChartHit,
  ChartLine,
  ChartText,
  Margins,
  gridRow,
} from '../../../../shared/charts/chart-marks';

const HEIGHT = 120;
const MARGINS: Margins = { left: 40, right: 12, top: 16, bottom: 22 };
/** Bands are laid out for at least this many columns, so one column is not a slab. */
const MIN_BANDS = 4;
const MAX_BAR_WIDTH = 46;
const BAND_GAP = 8;
const VALUE_LIFT = 4;
const MIN_BAR_HEIGHT = 1;
/** Roughly how wide a label or value runs, such as "2.5 days". */
const LABEL_ROOM = 52;

/** One column: its value, what it reads above it and under it, and its tooltip. */
export interface Column {
  readonly label: string;
  readonly value: number;
  readonly text: string;
  readonly tip: string;
}

/** The plot's range: zero at the bottom, `top` at the top, each gridline labelled. */
export interface ColumnScale {
  readonly top: number;
  readonly bottomLabel: string;
  readonly topLabel: string;
}

export interface ColumnsChart {
  readonly width: number;
  readonly height: number;
  readonly grid: readonly ChartLine[];
  readonly axis: readonly ChartText[];
  readonly bars: readonly ChartHit[];
  readonly values: readonly ChartText[];
}

/** Columns side by side between a gridline at zero and one at the scale's top;
 *  where they are too narrow for their words, every few are worded, the newest always. */
export function columnsChart(
  columns: readonly Column[],
  width: number,
  scale: ColumnScale,
): ColumnsChart {
  const band = (width - MARGINS.left - MARGINS.right) / Math.max(columns.length, MIN_BANDS);
  const barWidth = Math.min(MAX_BAR_WIDTH, band - BAND_GAP);
  const every = Math.ceil(LABEL_ROOM / band);
  const isWorded = (index: number): boolean => (columns.length - 1 - index) % every === 0;
  const top = Math.max(scale.top, Number.MIN_VALUE);
  const y = (value: number): number =>
    MARGINS.top + (1 - Math.min(value, top) / top) * (HEIGHT - MARGINS.top - MARGINS.bottom);
  const rows = [
    gridRow(y(0), MARGINS.left, width - MARGINS.right, scale.bottomLabel),
    gridRow(y(top), MARGINS.left, width - MARGINS.right, scale.topLabel),
  ];
  const placed = columns.map((column, index) => {
    const centre = MARGINS.left + band * index + band / 2;
    const barTop = y(column.value);
    const bar: ChartBox = {
      x: centre - barWidth / 2,
      y: barTop,
      width: barWidth,
      height: Math.max(y(0) - barTop, MIN_BAR_HEIGHT),
    };
    return {
      bar: { ...bar, tip: column.tip },
      value: { x: centre, y: barTop - VALUE_LIFT, text: column.text, anchor: 'middle' as const },
      label: {
        x: centre,
        y: HEIGHT - AXIS_LABEL_RISE,
        text: column.label,
        anchor: 'middle' as const,
      },
    };
  });
  const worded = placed.filter((_, index) => isWorded(index));
  return {
    width,
    height: HEIGHT,
    grid: rows.map((row) => row.line),
    axis: [...rows.map((row) => row.label), ...worded.map((each) => each.label)],
    bars: placed.map((each) => each.bar),
    values: worded.map((each) => each.value),
  };
}
