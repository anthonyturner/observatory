import { ProjectSnapshot } from '../projects/project.types';
import { MAX_COMETS, cometsFor, flightAt } from './comets';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  name,
  repo: `o/${name}`,
  dashboardUrl: '',
  open: 0,
  counts: COUNTS,
  ...overrides,
});
const SIZE = { width: 1280, height: 720 };

describe('cometsFor', () => {
  it('makes one comet per open issue, in its project colour', () => {
    const comets = cometsFor([
      project('calm', { issues: 2 }),
      project('stuck', { issues: 3, counts: { ...COUNTS, failing: 1 } }),
    ]);
    expect(comets).toHaveLength(5);
    expect(comets.filter((c) => c.colour === 'var(--sev-blocked)')).toHaveLength(3);
    expect(comets.filter((c) => c.colour === 'var(--sev-clear)')).toHaveLength(2);
  });

  it('adds no comets for a project GitHub could not read', () => {
    expect(cometsFor([project('lost', { issues: 9, error: 'rate limit' })])).toEqual([]);
  });

  it('keeps every other comet when one issue is added', () => {
    const before = cometsFor([project('a', { issues: 4 })]);
    const after = cometsFor([project('a', { issues: 5 })]);
    expect(after.slice(0, 4)).toEqual(before);
  });

  it('stops at the cap', () => {
    expect(cometsFor([project('huge', { issues: 5000 })])).toHaveLength(MAX_COMETS);
  });
});

describe('flightAt', () => {
  const [comet] = cometsFor([project('a', { issues: 1 })]);

  it('falls down and to the left, head ahead of its tail', () => {
    const start = comet.periodS - comet.offsetS;
    const early = flightAt(comet, start + 0.2, SIZE);
    const later = flightAt(comet, start + 0.6, SIZE);
    expect(early && later).toBeTruthy();
    expect(later!.headY).toBeGreaterThan(early!.headY);
    expect(later!.headX).toBeLessThan(early!.headX);
    expect(early!.tailY).toBeLessThan(early!.headY);
  });

  it('is out of the sky between falls, and back on the next loop', () => {
    const start = comet.periodS - comet.offsetS;
    expect(flightAt(comet, start + comet.periodS * 0.9, SIZE)).toBeNull();
    expect(flightAt(comet, start + comet.periodS + 0.2, SIZE)).not.toBeNull();
  });

  it('fades in rather than popping', () => {
    const start = comet.periodS - comet.offsetS;
    expect(flightAt(comet, start, SIZE)?.alpha).toBe(0);
  });
});
