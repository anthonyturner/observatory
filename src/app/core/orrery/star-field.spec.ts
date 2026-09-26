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

  it('twinkles between a fifth and all of its brightness', () => {
    const [star] = starField(1);
    const levels = Array.from({ length: 50 }, (_, index) => twinkle(star, index / 5));

    expect(Math.min(...levels)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...levels)).toBeLessThanOrEqual(1);
  });
});
