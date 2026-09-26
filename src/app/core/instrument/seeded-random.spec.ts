import { continuedSeed, seededRandom } from './seeded-random';

describe('continuedSeed', () => {
  it('starts a generator where another stands after that many draws', () => {
    const random = seededRandom(104729);
    const skipped = Array.from({ length: 13 }, () => random());
    const carried = seededRandom(continuedSeed(104729, skipped.length));

    expect(Array.from({ length: 5 }, () => carried())).toEqual(
      Array.from({ length: 5 }, () => random()),
    );
  });

  it('is the seed itself before any draw', () => {
    expect(continuedSeed(42, 0)).toBe(42);
  });
});
