import { TRAIL_TURN, advanceTurn, trailReach, trailStars } from './star-trails';

describe('trailStars', () => {
  it('gives the same 600 faint stars on every load', () => {
    const stars = trailStars();

    expect(stars.length).toBe(600);
    expect(trailStars()).toEqual(stars);
    expect(stars.every((star) => star.alpha > 0 && star.alpha <= 0.62)).toBe(true);
  });

  it('keeps a few bright stars among many faint ones', () => {
    const bright = trailStars().filter((star) => star.widthPx >= 1.1).length;

    expect(bright).toBeGreaterThan(10);
    expect(bright).toBeLessThan(80);
  });
});

describe('trailReach', () => {
  it('reaches the window corner furthest from the pole, and a little past it', () => {
    expect(trailReach(1000, 800, 500, 300)).toBeCloseTo(Math.hypot(500, 500) + 40);
  });
});

describe('TRAIL_TURN', () => {
  it('turns the sky once every twenty minutes', () => {
    expect(TRAIL_TURN * 20 * 60).toBeCloseTo(Math.PI * 2);
  });
});

describe('advanceTurn', () => {
  it('turns counterclockwise at the natural pace times the speed', () => {
    expect(advanceTurn(0, 0.1, 1)).toBeCloseTo(0.1 * TRAIL_TURN);
    expect(advanceTurn(1, 0.1, 50)).toBeCloseTo(1 + 5 * TRAIL_TURN);
  });

  it('holds still at speed 0, and when time stands still or runs back', () => {
    expect(advanceTurn(2, 0.1, 0)).toBe(2);
    expect(advanceTurn(2, 0, 25)).toBe(2);
    expect(advanceTurn(2, -8, 25)).toBe(2);
  });

  it('never leaps a long gap in one frame', () => {
    expect(advanceTurn(0, 40, 1)).toBeCloseTo(0.25 * TRAIL_TURN);
  });
});
