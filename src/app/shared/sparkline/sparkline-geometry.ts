/** The sparkline's drawing space; the SVG stretches it to fit its box. */
export const SPARK_WIDTH = 240;
export const SPARK_HEIGHT = 28;
const SPARK_PADDING = 3;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** What to draw: the line's path (null when there are too few points to
 *  make one) and the latest value's dot. */
export interface SparklineShape {
  readonly path: string | null;
  readonly lastPoint: Point | null;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Plots `values` left to right. A gap (a non-finite value) lifts the pen;
 *  `max` fixes the top of the scale, or the largest value sets it. */
export function sparklineShape(values: readonly number[], max?: number): SparklineShape {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return { path: null, lastPoint: null };

  const top = max ?? (Math.max(...finite) || 1);
  const pointAt = (index: number, value: number): Point => ({
    x: round((index / (values.length - 1)) * SPARK_WIDTH),
    y: round(
      SPARK_HEIGHT -
        SPARK_PADDING -
        (Math.min(value, top) / top) * (SPARK_HEIGHT - SPARK_PADDING * 2),
    ),
  });

  let path = '';
  let penDown = false;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      penDown = false;
      return;
    }
    const { x, y } = pointAt(index, value);
    path += `${penDown ? 'L' : 'M'}${x},${y}`;
    penDown = true;
  });

  const lastIndex = values.length - 1;
  const lastValue = values[lastIndex];
  const lastPoint = Number.isFinite(lastValue) ? pointAt(lastIndex, lastValue) : null;
  return { path, lastPoint };
}
