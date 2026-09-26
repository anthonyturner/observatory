import { PastWeek } from '../../../../core/usage/usage-document';
import { dayText, percentText } from '../usage-text';
import {
  AXIS_LABEL_RISE,
  ChartBox,
  ChartHit,
  ChartLine,
  ChartText,
  Margins,
  gridRow,
  percentY,
} from './chart-marks';

const HEIGHT = 120;
const MARGINS: Margins = { left: 40, right: 12, top: 16, bottom: 22 };
/** Bands are laid out for at least this many weeks, so one week is not a slab. */
const MIN_BANDS = 4;
const MAX_BAR_WIDTH = 46;
const BAND_GAP = 8;
const VALUE_LIFT = 4;
const MIN_BAR_HEIGHT = 1;

export interface PastWeeksChart {
  readonly width: number;
  readonly height: number;
  readonly grid: readonly ChartLine[];
  readonly axis: readonly ChartText[];
  readonly bars: readonly ChartHit[];
  readonly values: readonly ChartText[];
}

/** Each earlier week as a bar, as far as it got before its reset. */
export function pastWeeksChart(
  weeks: readonly PastWeek[],
  width: number,
  locale?: string,
): PastWeeksChart {
  const band = (width - MARGINS.left - MARGINS.right) / Math.max(weeks.length, MIN_BANDS);
  const barWidth = Math.min(MAX_BAR_WIDTH, band - BAND_GAP);
  const y = percentY(HEIGHT, MARGINS);
  const rows = [
    gridRow(y(0), MARGINS.left, width - MARGINS.right, '0%'),
    gridRow(y(100), MARGINS.left, width - MARGINS.right, '100%'),
  ];
  const placed = weeks.map((week, index) => {
    const centre = MARGINS.left + band * index + band / 2;
    const top = y(week.peak);
    const day = dayText(week.resetsAt, locale);
    const bar: ChartBox = {
      x: centre - barWidth / 2,
      y: top,
      width: barWidth,
      height: Math.max(y(0) - top, MIN_BAR_HEIGHT),
    };
    return {
      bar: { ...bar, tip: `Week to ${day}\n${percentText(week.peak)} used by its reset` },
      value: {
        x: centre,
        y: top - VALUE_LIFT,
        text: percentText(week.peak),
        anchor: 'middle' as const,
      },
      label: { x: centre, y: HEIGHT - AXIS_LABEL_RISE, text: day, anchor: 'middle' as const },
    };
  });
  return {
    width,
    height: HEIGHT,
    grid: rows.map((row) => row.line),
    axis: [...rows.map((row) => row.label), ...placed.map((each) => each.label)],
    bars: placed.map((each) => each.bar),
    values: placed.map((each) => each.value),
  };
}
