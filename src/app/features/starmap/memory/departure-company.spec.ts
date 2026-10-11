import { Meteor } from '../engine/meteor-layer';
import { IssuePlanet, MAX_PLANETS, issuePlanets } from '../engine/star-system';
import { Departure, EMPTY_SYSTEM, endingOf } from './departure';
import {
  COMPANY_S,
  DRIFT_S,
  FALL_S,
  FLARE_S,
  GLOW_S,
  PLANET_STAGGER_S,
  PULL_AT_S,
  PULL_S,
  fateOf,
  ghostLook,
  meteorPull,
  planetOffset,
  planetPoses,
  resolutionsOf,
  resolving,
} from './departure-company';
import { PRELUDE_S } from './departure-exit';

const planets = (...issues: number[]): IssuePlanet[] => issuePlanets({ item: { issues } as never });
const meteor: Meteor = { repo: 'a/b', pr: 7, commits: 4 };

const merged = (issues: number[], closes: number[] | null = null): Departure => ({
  system: { ...EMPTY_SYSTEM, planets: planets(...issues) },
  ending: { ...endingOf('merged', 'squash'), closes },
});
const closed = (issues: number[]): Departure => ({
  system: { ...EMPTY_SYSTEM, planets: planets(...issues) },
  ending: endingOf('closed'),
});

describe('what becomes of a planet', () => {
  it('resolves when the pull request merged and closed that issue', () => {
    expect(fateOf(5, { ...endingOf('merged'), closes: [5, 6] })).toBe('resolve');
  });

  it('resolves when the pull request merged and nobody has said which issues it closed', () => {
    expect(fateOf(5, endingOf('merged'))).toBe('resolve');
  });

  it('falls back when the merge left that issue open', () => {
    expect(fateOf(5, { ...endingOf('merged'), closes: [6] })).toBe('fall');
  });

  it('falls back when the pull request closed without merging, whatever it said it closed', () => {
    expect(fateOf(5, { ...endingOf('closed'), closes: [5] })).toBe('fall');
  });

  it('falls back when the ending is not known', () => {
    expect(fateOf(5, null)).toBe('fall');
  });
});

describe('the time the company takes', () => {
  it('is the prelude every exit holds, and covers the last planet and the meteor', () => {
    const lastPlanet = (MAX_PLANETS - 1) * PLANET_STAGGER_S + Math.max(GLOW_S + DRIFT_S, FALL_S);

    expect(PRELUDE_S).toBe(COMPANY_S);
    expect(COMPANY_S).toBeGreaterThanOrEqual(lastPlanet);
    expect(COMPANY_S).toBeGreaterThanOrEqual(PULL_AT_S + PULL_S + FLARE_S);
  });

  it('leaves no planet to see once it is over', () => {
    const all = merged([1, 2, 3, 4]);
    const dropped = closed([1, 2, 3, 4]);

    expect(planetPoses(all, COMPANY_S, false)).toEqual([]);
    expect(planetPoses(dropped, COMPANY_S, false)).toEqual([]);
  });
});

describe('planets that resolve', () => {
  const departure = merged([10, 11]);

  it('start as they were, orbiting, before their turn', () => {
    const [first, second] = planetPoses(departure, 0, false);

    expect(first).toMatchObject({ issue: 10, green: 0, alpha: 1, orbit: 1.9 });
    expect(second).toMatchObject({ issue: 11, green: 0, alpha: 1 });
  });

  it('glow green in turn, the inner planet first', () => {
    const [first, second] = planetPoses(departure, GLOW_S / 2, false);

    expect(first.green).toBeCloseTo(0.5);
    expect(second.green).toBeLessThan(first.green);
  });

  it('are fully green by the end of the glow, then drift out and fade', () => {
    const [glowing] = planetPoses(departure, GLOW_S, false);
    const [drifting] = planetPoses(departure, GLOW_S + DRIFT_S / 2, false);

    expect(glowing.green).toBe(1);
    expect(glowing.alpha).toBe(1);
    expect(drifting.green).toBe(1);
    expect(drifting.orbit).toBeGreaterThan(glowing.orbit);
    expect(drifting.alpha).toBeLessThan(1);
  });

  it('are gone once they have drifted off', () => {
    const issues = planetPoses(departure, GLOW_S + DRIFT_S + PLANET_STAGGER_S, false).map(
      (pose) => pose.issue,
    );

    expect(issues).toEqual([]);
  });

  it('only the ones the merge closed resolve, the rest fall', () => {
    const half = merged([10, 11], [11]);

    expect(resolving(half).map((each) => each.issue)).toEqual([11]);
    const [fell, resolved] = planetPoses(half, GLOW_S, false);
    expect(fell.green).toBe(0);
    expect(resolved.green).toBeGreaterThan(0);
  });
});

describe('planets that fall back into the field', () => {
  const departure = closed([10]);

  it('never turn green, and drop and fade as they fall', () => {
    const [early] = planetPoses(departure, FALL_S * 0.25, false);
    const [late] = planetPoses(departure, FALL_S * 0.75, false);

    expect(early.green).toBe(0);
    expect(late.drop).toBeGreaterThan(early.drop);
    expect(late.alpha).toBeLessThan(early.alpha);
    expect(late.size).toBeLessThan(early.size);
  });

  it('are gone once they have fallen', () => {
    expect(planetPoses(departure, FALL_S, false)).toEqual([]);
  });
});

describe('with motion off', () => {
  it('a planet that resolves glows green in place and fades, without drifting', () => {
    const departure = merged([10]);
    const [at] = planetPoses(departure, GLOW_S, true);
    const [later] = planetPoses(departure, GLOW_S + DRIFT_S / 2, true);

    expect(at.green).toBe(1);
    expect(later.orbit).toBe(at.orbit);
    expect(later.alpha).toBeLessThan(at.alpha);
    expect(planetPoses(departure, 0, true)[0].angle).toBe(planetPoses(departure, 1, true)[0].angle);
  });

  it('a planet that falls is not drawn: nothing moves', () => {
    expect(planetPoses(closed([10]), 0.2, true)).toEqual([]);
  });
});

describe('where a planet stands', () => {
  it('is offset from the star by its orbit, flattened by the system tilt', () => {
    const level = planetOffset({ angle: 0, orbit: 2, drop: 0 }, 10);
    const dropped = planetOffset({ angle: 0, orbit: 2, drop: 3 }, 10);

    expect(Math.hypot(level.x, level.y)).toBeCloseTo(20);
    expect(level.z).toBeCloseTo(0);
    expect(dropped.y - level.y).toBeCloseTo(30);
    expect(planetOffset({ angle: Math.PI / 2, orbit: 2, drop: 0 }, 10).z).toBeCloseTo(20);
  });
});

describe('the meteor pulled into the core', () => {
  it('is not there before the pull begins or after it ends', () => {
    expect(meteorPull(meteor, PULL_AT_S)).toBeNull();
    expect(meteorPull(meteor, PULL_AT_S + PULL_S + 0.01)).toBeNull();
  });

  it('falls faster as it comes and reaches the core', () => {
    const early = meteorPull(meteor, PULL_AT_S + PULL_S * 0.25);
    const late = meteorPull(meteor, PULL_AT_S + PULL_S * 0.9);

    expect(early?.distancePx).toBeGreaterThan(late?.distancePx ?? Infinity);
    expect(late?.distancePx).toBeLessThan(60);
    expect(late?.tailPx).toBeLessThan(early?.tailPx ?? 0);
  });

  it('comes from above, the way it would have landed', () => {
    expect(meteorPull(meteor, PULL_AT_S + 0.1)?.heading.y).toBeLessThan(0);
  });
});

describe('the star’s last light', () => {
  it('holds steady with no meteor', () => {
    const { system } = merged([]);

    expect(ghostLook({ system }, 0)).toEqual(ghostLook({ system }, COMPANY_S - 0.01));
  });

  it('flares as the meteor reaches the core, then settles', () => {
    const system = { ...EMPTY_SYSTEM, meteor };
    const before = ghostLook({ system }, PULL_AT_S);
    const hit = ghostLook({ system }, PULL_AT_S + PULL_S + 0.01);
    const after = ghostLook({ system }, PULL_AT_S + PULL_S + FLARE_S);

    expect(hit.radius).toBeGreaterThan(before.radius);
    expect(hit.alpha).toBeGreaterThan(before.alpha);
    expect(after).toEqual(before);
  });
});

describe('the issues resolved, for whoever wants to say so', () => {
  it('names each started merge’s resolving issues and when the first turns green', () => {
    const resolved = resolutionsOf([{ pr: 7, startAt: 100, departure: merged([10, 11]) }]);

    expect(resolved).toEqual([{ pr: 7, issues: [10, 11], startAt: 100 }]);
  });

  it('starts at the first planet that resolves, not the first planet', () => {
    const [resolution] = resolutionsOf([
      { pr: 7, startAt: 100, departure: merged([10, 11], [11]) },
    ]);

    expect(resolution.issues).toEqual([11]);
    expect(resolution.startAt).toBeCloseTo(100 + PLANET_STAGGER_S);
  });

  it('says nothing for a pull request that closed, left unexplained, or has no planets', () => {
    expect(
      resolutionsOf([
        { pr: 1, startAt: 100, departure: closed([10]) },
        { pr: 2, startAt: 100, departure: { system: EMPTY_SYSTEM, ending: null } },
        { pr: 3, startAt: 100, departure: merged([]) },
      ]),
    ).toEqual([]);
  });

  it('says nothing for news that has not started or carries no departure', () => {
    expect(
      resolutionsOf([
        { pr: 1, departure: merged([10]) },
        { pr: 2, startAt: 100 },
      ]),
    ).toEqual([]);
  });
});
