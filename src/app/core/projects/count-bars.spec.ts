import { countBarsOf } from './count-bars';
import { ProjectSnapshot } from './project.types';

const base: ProjectSnapshot = {
  name: 'a',
  repo: 'me/a',
  dashboardUrl: '/p/me/a',
  open: 6,
  counts: { conflicted: 0, failing: 1, unknown: 0, unlinked: 0, unreviewed: 4, unclaimed: 0 },
};

describe('countBarsOf', () => {
  it('keeps only non-zero counts, worst kind first', () => {
    expect(countBarsOf(base).map((bar) => bar.label)).toEqual(['checks failing', 'waiting on you']);
  });

  it('gives the largest count a full bar and every bar a minimum length', () => {
    const [failing, waiting] = countBarsOf(base);

    expect(waiting.widthPercent).toBe(100);
    expect(failing.widthPercent).toBe(39);
  });

  it('has no bars when nothing is waiting', () => {
    const quiet = { ...base, counts: { ...base.counts, failing: 0, unreviewed: 0 } };

    expect(countBarsOf(quiet)).toEqual([]);
  });
});
