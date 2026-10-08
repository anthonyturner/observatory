import { commitStars, starRadius } from './commit-stars-layout';

const week = (start: number, total: number) => ({ start, total, days: [total, 0, 0, 0, 0, 0, 0] });

describe('starRadius', () => {
  it('grows by area with the week’s commits, the busiest week largest', () => {
    expect(starRadius(100, 100)).toBe(5);
    expect(starRadius(25, 100)).toBe(3);
    expect(starRadius(0, 100)).toBe(1);
    expect(starRadius(0, 0)).toBe(1);
  });
});

describe('commitStars', () => {
  it('lays the weeks out oldest at the left, a quiet week dark, with a line through them all', () => {
    const strip = commitStars([week(1, 4), week(2, 0), week(3, 16)]);

    expect(strip.stars.map((star) => star.x)).toEqual([8, 120, 232]);
    expect(strip.stars.map((star) => star.r)).toEqual([3, 1, 5]);
    expect(strip.stars.map((star) => star.isDark)).toEqual([false, true, false]);
    expect(strip.line.split(' ')).toHaveLength(3);
  });

  it('keeps a lone week at the left edge', () => {
    expect(commitStars([week(1, 3)]).stars[0].x).toBe(8);
  });
});
