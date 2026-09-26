import { sparklineShape } from './sparkline-geometry';

describe('sparklineShape', () => {
  it('draws nothing from fewer than two points', () => {
    expect(sparklineShape([5])).toEqual({ path: null, lastPoint: null });
  });

  it('runs from the left edge to the right, the largest value at the top', () => {
    const { path, lastPoint } = sparklineShape([0, 10]);

    expect(path).toBe('M0,25L240,3');
    expect(lastPoint).toEqual({ x: 240, y: 3 });
  });

  it('scales to a fixed maximum when given one', () => {
    expect(sparklineShape([0, 50], 100).lastPoint).toEqual({ x: 240, y: 14 });
  });

  it('lifts the pen over a gap and has no dot when the latest value is missing', () => {
    const { path, lastPoint } = sparklineShape([1, NaN, 1, 1, NaN]);

    expect(path?.match(/M/g)?.length).toBe(2);
    expect(lastPoint).toBeNull();
  });
});
