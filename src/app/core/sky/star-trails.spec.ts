import { TRAIL_TURN, trailReach, trailStars } from './star-trails';

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
