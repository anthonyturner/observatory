import { FIELD_TINT_COUNT, starField, twinkle } from './star-field';

describe('starField', () => {
  it('is the same sky on every load', () => {
    expect(starField(20)).toEqual(starField(20));
  });

  it('keeps every star faint, small and on a valid tint', () => {
    for (const star of starField()) {
      expect(star.alpha).toBeLessThanOrEqual(0.46);
      expect(star.radius).toBeLessThanOrEqual(1.4);
      expect(star.tint).toBeLessThan(FIELD_TINT_COUNT);
    }
  });

  it('is mostly faint stars and a few bright ones, the brightest also the largest', () => {
    const field = starField(2000);
    const faint = field.filter((star) => star.alpha < 0.15).length;
    const bright = field.filter((star) => star.alpha > 0.3).length;
    const largest = field.reduce((a, b) => (b.radius > a.radius ? b : a));

    expect(faint).toBeGreaterThan(bright * 3);
    expect(largest.alpha).toBeGreaterThan(0.3);
  });

  it('spreads a wider sky without moving a star off its bearing', () => {
    const [near] = starField(1);
    const [wide] = starField(1, 2);

    expect(wide.x).toBeCloseTo(near.x * 2);
    expect(wide.y).toBeCloseTo(near.y * 2);
  });

  it('twinkles between a fifth and all of its brightness', () => {
    const [star] = starField(1);
    const levels = Array.from({ length: 50 }, (_, index) => twinkle(star, index / 5));

    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...levels)).toBeLessThanOrEqual(1);
  });

  it('sits every star far behind the system for the 3D sky', () => {
    for (const star of starField()) {
      expect(star.z).toBeLessThanOrEqual(-12000);
      expect(star.z).toBeGreaterThanOrEqual(-42000);
    }
  });
});
