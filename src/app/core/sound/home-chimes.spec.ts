import { ProjectSnapshot } from '../projects/project.types';
import { BAR_S, barAt } from './ambient-score';
import { CHIME_STEPS, MAX_CHIMERS, chimesFor, homeMotif, homeVoicesOf } from './home-chimes';
import { seededRandom } from '../instrument/seeded-random';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (repo: string, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  name: repo,
  repo,
  dashboardUrl: `/p/${repo}`,
  open: 3,
  counts: COUNTS,
  ...overrides,
});
const bar = barAt(0, seededRandom(1));

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

describe('chimesFor', () => {
  const voices = homeVoicesOf([
    project('o/busy', { open: 40, counts: { ...COUNTS, failing: 1 } }),
    project('o/quiet', { open: 0 }),
  ]);

  it('chimes busier projects more, in their own instrument, inside the bar', () => {
    const chimes = chimesFor(0, bar, voices);
    const busy = chimes.filter((c) => c.severity === 'blocked');
    const quiet = chimes.filter((c) => c.severity === 'clear');
    expect(busy.length).toBeGreaterThan(quiet.length);
    expect(quiet.length).toBe(1);
    for (const chime of chimes) {
      expect(chime.offsetS).toBeGreaterThanOrEqual(0);
      expect(chime.offsetS).toBeLessThan(BAR_S);
    }
  });

  it('stays sparse: never more than half the orrery’s pulses in a bar', () => {
    const chimes = chimesFor(0, bar, voices).filter((c) => c.severity === 'blocked');
    expect(chimes.length).toBeLessThanOrEqual(CHIME_STEPS / 2);
  });

  it('lets no more than ten projects chime', () => {
    const many = homeVoicesOf(Array.from({ length: 20 }, (_, i) => project(`o/p${i}`)));
    const keys = new Set(chimesFor(0, bar, many).map((c) => c.pan));
    expect(keys.size).toBeLessThanOrEqual(MAX_CHIMERS);
  });
});

describe('homeMotif', () => {
  it('rises through the chord in the project’s instrument, from where it sits', () => {
    const [voice] = homeVoicesOf([project('o/a')]);
    const motif = homeMotif(voice, bar);
    expect(motif).toHaveLength(3);
    expect(motif[1].midi).toBeGreaterThan(motif[0].midi - 12);
    expect(motif.every((c) => c.severity === voice.severity && c.pan === voice.pan)).toBe(true);
  });
});
