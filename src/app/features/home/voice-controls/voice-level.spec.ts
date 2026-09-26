import { LEVEL_DASHES, levelWeights } from './voice-level';

describe('levelWeights', () => {
  it('gives every dash a weight, fullest in the middle', () => {
    const weights = levelWeights();
    const middle = Math.max(...weights.slice(15, 21));

    expect(weights.length).toBe(LEVEL_DASHES);
    expect(middle).toBeGreaterThan(weights[0]);
    expect(middle).toBeGreaterThan(weights[LEVEL_DASHES - 1]);
  });

  it('is uneven, so neighbours differ, and always the same', () => {
    const weights = levelWeights();

    expect(new Set(weights.slice(0, 5)).size).toBeGreaterThan(1);
    expect(levelWeights()).toEqual(weights);
  });

  it('keeps every weight positive', () => {
    expect(levelWeights().every((weight) => weight > 0)).toBe(true);
  });
});
