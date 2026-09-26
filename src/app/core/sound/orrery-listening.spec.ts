import { layoutWorlds } from '../orrery/world-layout';
import { ProjectSnapshot } from '../projects/project.types';
import { systemSoundOf } from './orrery-listening';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (repo: string, overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  name: repo,
  repo,
  dashboardUrl: '',
  open: 3,
  counts: COUNTS,
  ...overrides,
});

describe('systemSoundOf', () => {
  const worlds = layoutWorlds([
    project('o/calm'),
    project('o/stuck', { open: 7, counts: { ...COUNTS, failing: 2 } }),
  ]);

  it('hears every world, innermost first, with what is open and blocked', () => {
    const sound = systemSoundOf(worlds, 0);
    expect(sound.voices.map((v) => v.key)).toEqual(['o/stuck', 'o/calm']);
    expect(sound.totalOpen).toBe(10);
    expect(sound.blocked).toBe(1);
  });

  it('pans each world to where its orbit has carried it, never hard to one side', () => {
    const now = systemSoundOf(worlds, 0).voices[0].pan;
    const later = systemSoundOf(worlds, 20).voices[0].pan;
    expect(now).not.toBe(later);
    for (const time of [0, 7, 30]) {
      for (const v of systemSoundOf(worlds, time).voices)
        expect(Math.abs(v.pan)).toBeLessThanOrEqual(0.85);
    }
  });
});
