import { Meteor, strengthOf } from '../engine/meteor-layer';
import { issuePlanets } from '../engine/star-system';
import { companyCue } from './company-cue';
import { Departure, EMPTY_SYSTEM, endingOf } from './departure';
import { PLANET_STAGGER_S, PULL_AT_S } from './departure-company';
import { CueScene, ExitEvent } from './departure-exit';

const scene = (extra: Partial<CueScene> = {}): CueScene => ({
  now: 10,
  width: 1000,
  height: 800,
  frozen: false,
  project: (x, y, z) => ({ x, y, z }),
  ...extra,
});

const meteor: Meteor = { repo: 'a/b', pr: 7, commits: 4 };

const leaving = (departure: Departure | undefined, startAt = 12): ExitEvent => ({
  kind: 'merged',
  startAt,
  fromX: 750,
  fromY: 100,
  fromZ: 0,
  departure,
});

const merged = (issues: number[], carrying: Partial<Departure['system']> = {}): Departure => ({
  system: {
    ...EMPTY_SYSTEM,
    planets: issuePlanets({ item: { issues } as never }),
    ...carrying,
  },
  ending: endingOf('merged'),
});

describe('companyCue', () => {
  it('chimes once for each planet that turns green, when it does, from the side its star stood on', () => {
    const { chimes } = companyCue(leaving(merged([10, 11])), scene());

    expect(chimes.map((each) => each.planet)).toEqual([0, 1]);
    expect(chimes[0].delayS).toBeCloseTo(2);
    expect(chimes[1].delayS).toBeCloseTo(2 + PLANET_STAGGER_S);
    expect(chimes.every((each) => each.pan === 0.5)).toBe(true);
  });

  it('chimes for a planet that stays behind when the merge left its issue open', () => {
    const departure = { ...merged([10, 11]), ending: { ...endingOf('merged'), closes: [11] } };

    expect(companyCue(leaving(departure), scene()).chimes.map((each) => each.planet)).toEqual([1]);
  });

  it('is silent for planets that fall back, as a close leaves them', () => {
    const departure = { ...merged([10]), ending: endingOf('closed') };

    expect(companyCue(leaving(departure), scene()).chimes).toEqual([]);
  });

  it('sucks the meteor in when the pull begins, as hard as the change was big', () => {
    const { suction } = companyCue(leaving(merged([], { meteor })), scene());

    expect(suction?.delayS).toBeCloseTo(2 + PULL_AT_S);
    expect(suction?.strength).toBe(strengthOf(4));
    expect(suction?.pan).toBe(0.5);
  });

  it('never plays behind us: a cue already due plays at once', () => {
    const { chimes, suction } = companyCue(
      leaving(merged([10], { meteor }), 5),
      scene({ now: 10 }),
    );

    expect(chimes[0].delayS).toBe(0);
    expect(suction?.delayS).toBe(0);
  });

  it('with motion off still chimes for the planets that glow in place, but nothing is pulled', () => {
    const cue = companyCue(leaving(merged([10], { meteor })), scene({ frozen: true }));

    expect(cue.chimes).toHaveLength(1);
    expect(cue.suction).toBeNull();
  });

  it('is silent for a star that carried nothing, one with no departure, or one not started', () => {
    expect(companyCue(leaving(merged([])), scene())).toEqual({ chimes: [], suction: null });
    expect(companyCue(leaving(undefined), scene())).toEqual({ chimes: [], suction: null });
    expect(
      companyCue({ ...leaving(merged([10], { meteor })), startAt: undefined }, scene()),
    ).toEqual({
      chimes: [],
      suction: null,
    });
  });
});
