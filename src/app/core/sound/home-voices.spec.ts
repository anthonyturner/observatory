import { ProjectSnapshot } from '../projects/project.types';
import { barAt } from './ambient-score';
import { homeMotif, homeVoicesOf } from './home-voices';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (repo: string, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  name: repo,
  repo,
  dashboardUrl: `/p/${repo}`,
  open: 3,
  counts: COUNTS,
  ...overrides,
});
const bar = barAt(0);

describe('homeVoicesOf', () => {
  it('hears the projects in ring order, worst first, panned to their dots', () => {
    const voices = homeVoicesOf([
      project('o/calm'),
      project('o/stuck', { counts: { ...COUNTS, failing: 1 } }),
    ]);
    expect(voices.map((v) => [v.key, v.severity])).toEqual([
      ['o/stuck', 'blocked'],
      ['o/calm', 'clear'],
    ]);
    // The worst sits at twelve o'clock, so it plays from the middle.
    expect(voices[0].pan).toBeCloseTo(0);
    for (const v of voices) expect(Math.abs(v.pan)).toBeLessThanOrEqual(0.8);
  });
});

describe('homeMotif', () => {
  it('rises through the chord from where the project sits', () => {
    const [voice] = homeVoicesOf([project('o/a')]);
    const motif = homeMotif(voice, bar);
    expect(motif).toHaveLength(3);
    expect(motif[1].midi).toBeGreaterThan(motif[0].midi - 12);
    expect(motif.every((note) => note.pan === voice.pan)).toBe(true);
  });
});
