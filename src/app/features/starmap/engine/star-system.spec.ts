import { QUICK_COLOUR, SkyItem } from './sky-model';
import { issuePlanets, massOf } from './star-system';

const item = (issues: number[]): SkyItem => ({
  pr: 1,
  title: '',
  bucket: 'unreviewed',
  idleDays: 1,
  additions: 1,
  deletions: 1,
  issues,
});

describe('massOf', () => {
  it('weighs nothing under twenty lines', () => {
    expect(massOf({ cost: 18, quick: false, colour: '#fff' })).toBeNull();
    expect(massOf({ cost: null, quick: false, colour: '#fff' })).toBeNull();
  });

  it('reaches further and weighs more on a log scale, in quick-win colour for a quick win', () => {
    const small = massOf({ cost: 99, quick: true, colour: '#fff' });
    const big = massOf({ cost: 9999, quick: false, colour: '#abc' });
    expect(small).toEqual({ log: 2, weight: 2 / 3, reach: 3, colour: QUICK_COLOUR });
    expect(big?.reach).toBeCloseTo(4.5);
    expect(big?.weight).toBe(1);
    expect(big?.colour).toBe('#abc');
  });
});

describe('issuePlanets', () => {
  it('gives a pull request one planet per issue it closes, up to four', () => {
    expect(issuePlanets({ item: item([]) })).toEqual([]);
    expect(issuePlanets({ item: undefined })).toEqual([]);
    expect(issuePlanets({ item: item([3, 5, 8, 13, 21]) }).map((p) => p.issue)).toEqual([
      3, 5, 8, 13,
    ]);
  });

  it('spaces their orbits outward, the outer ones slower', () => {
    const [inner, outer] = issuePlanets({ item: item([3, 5]) });
    expect(outer.orbit).toBeGreaterThan(inner.orbit);
    expect(outer.speed).toBeLessThan(inner.speed);
  });
});
