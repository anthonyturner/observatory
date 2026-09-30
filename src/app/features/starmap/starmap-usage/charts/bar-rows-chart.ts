import { clipLabel } from '../usage-text';
import { ChartBox, ChartHit, ChartText, tenth } from '../../../../shared/charts/chart-marks';

/** One horizontal bar: a label, a value, and what its tooltip says. */
export interface BarItem {
  readonly label: string;
  readonly value: number;
  readonly text: string;
  readonly tip: string;
  /** Lit; the rest are dimmed when one item is picked out. */
  readonly isStrong: boolean;
}

export interface BarRow {
  readonly label: ChartText;
  readonly bar: ChartBox;
  readonly value: ChartText;
  readonly hit: ChartHit;
  readonly isStrong: boolean;
}

export interface BarRowsChart {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly BarRow[];
}

const ROW_HEIGHT = 24;
const TOP = 4;
const MAX_LABEL_WIDTH = 170;
const LABEL_SHARE = 0.34;
const VALUE_ROOM = 56;
const LABEL_GAP = 8;
const VALUE_GAP = 6;
const BASELINE = 12;
const BAR_INSET = 2;
const BAR_TRIM = 10;
const MIN_BAR_WIDTH = 2;

/** Horizontal bars, one row each, the longest reaching the value column. */
export function barRowsChart(items: readonly BarItem[], width: number): BarRowsChart {
  const left = Math.min(MAX_LABEL_WIDTH, Math.round(width * LABEL_SHARE));
  const max = Math.max(1, ...items.map((item) => item.value));
  return {
    width,
    height: items.length * ROW_HEIGHT + TOP,
    rows: items.map((item, index) => {
      const top = index * ROW_HEIGHT + TOP;
      const barWidth = Math.max(MIN_BAR_WIDTH, ((width - left - VALUE_ROOM) * item.value) / max);
      return {
        isStrong: item.isStrong,
        label: {
          x: left - LABEL_GAP,
          y: top + BASELINE,
          text: clipLabel(item.label),
          anchor: 'end',
        },
        bar: { x: left, y: top + BAR_INSET, width: tenth(barWidth), height: ROW_HEIGHT - BAR_TRIM },
        value: {
          x: tenth(left + barWidth + VALUE_GAP),
          y: top + BASELINE,
          text: item.text,
          anchor: 'start',
        },
        hit: { x: 0, y: top, width, height: ROW_HEIGHT, tip: item.tip },
      };
    }),
  };
}
