import { ProjectCounts, ProjectSnapshot } from '../projects/project.types';
import { cometCount, layoutWorlds, outermostOrbit, sunRadius } from './world-layout';

const quiet: ProjectCounts = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};
const project = (name: string, extra: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: 0,
  counts: quiet,
  ...extra,
});

describe('layoutWorlds', () => {
  it('puts the most urgent project innermost', () => {
    const [first, second] = layoutWorlds([
      project('calm'),
      project('stuck', { open: 2, counts: { ...quiet, conflicted: 2 } }),
    ]);

    expect(first.project.name).toBe('stuck');
    expect(first.orbit).toBeLessThan(second.orbit);
  });

  it('sends neglected projects further out, and slower', () => {
    const [fresh, neglected] = layoutWorlds([
      project('fresh', { oldestIdleDays: 0 }),
      project('neglected', { oldestIdleDays: 40 }),
    ]);

    expect(neglected.orbit - fresh.orbit).toBeGreaterThan(40 * 7);
    expect(neglected.speed).toBeLessThan(fresh.speed);
  });

  it('marks what is wrong: a ring for conflicts, moons for blocked, comets for unclaimed', () => {
    const [world] = layoutWorlds([
      project('busy', { open: 9, counts: { ...quiet, conflicted: 5, failing: 4, unclaimed: 3 } }),
    ]);

    expect(world.hasRing).toBe(true);
    expect(world.moons).toBe(6);
    expect(world.comets).toBe(2);
    expect(world.color).toBe('var(--sev-blocked)');
    expect(world.radius).toBeGreaterThan(layoutWorlds([project('empty')])[0].radius);
  });

  it('keeps a world in the same place on every load', () => {
    const once = layoutWorlds([project('a')])[0];
    const again = layoutWorlds([project('a')])[0];

    expect(again.angle).toBe(once.angle);
    expect(again.tilt).toBe(once.tilt);
  });
});

describe('orrery measures', () => {
  it('counts comets on a log scale, capped at five', () => {
    expect([0, 1, 3, 7, 500].map(cometCount)).toEqual([0, 1, 2, 3, 5]);
  });

  it('grows the sun with open pull requests, up to a point', () => {
    const small = sunRadius(layoutWorlds([project('a', { open: 2 })]));
    const huge = sunRadius(layoutWorlds([project('a', { open: 500 })]));

    expect(small).toBe(37);
    expect(huge).toBe(76);
  });

  it('finds the outermost orbit, with a floor for an empty system', () => {
    expect(outermostOrbit([])).toBe(260);
    expect(outermostOrbit(layoutWorlds([project('a'), project('b')]))).toBe(324);
  });
});
