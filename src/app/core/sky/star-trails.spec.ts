import { TRAIL_TURN, advanceTurn, surgeAt, surgeFrom, trailReach, trailStars } from './star-trails';

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

describe('spin-ups', () => {
  it('start in proportion to the work done, and halve every four seconds', () => {
    const surge = surgeFrom(null, 2, 10);

    expect(surgeAt(surge, 10)).toBe(6);
    expect(surgeAt(surge, 14)).toBeCloseTo(3);
    expect(surgeAt(surge, 40)).toBeLessThan(0.05);
  });

  it('add to what is left of the last one, up to a cap', () => {
    const first = surgeFrom(null, 1, 0);

    expect(surgeAt(surgeFrom(first, 1, 4), 4)).toBeCloseTo(4.5);
    expect(surgeAt(surgeFrom(first, 50, 4), 4)).toBe(12);
  });

  it('are nothing when there has been none', () => {
    expect(surgeAt(null, 99)).toBe(0);
  });
});
