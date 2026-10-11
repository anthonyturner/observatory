import { PullState } from '../../../core/activity/activity-lookups';
import { CrewMark } from '../../../core/crew/crew.types';
import { Satellite } from '../../../core/live-agents/satellites';
import { Meteor } from '../engine/meteor-layer';
import { SkyItem } from '../engine/sky-model';
import { endingOf, endingOfPull, systemsOf } from './departure';

const item = (pr: number, issues: number[] = []): SkyItem => ({
  pr,
  title: `#${pr}`,
  bucket: 'fresh',
  idleDays: 1,
  additions: 10,
  deletions: 2,
  issues,
});
const satellite = (key: string, pr: number | null): Satellite => ({
  key,
  name: key,
  state: 'working',
  pr,
  stateText: 'Working',
});
const crew = (pr: number): CrewMark => ({ pr, phase: 'working', endedAt: null });
const meteor = (pr: number): Meteor => ({ repo: 'me/a', pr, commits: 2 });

describe('systemsOf', () => {
  it('gathers what each star carries: planets, crew, satellites and meteor', () => {
    const systems = systemsOf({
      items: [item(1, [11, 12]), item(2)],
      crews: [crew(1)],
      satellites: [satellite('a', 1), satellite('b', 1), satellite('c', 2)],
      meteors: [meteor(2)],
    });

    const first = systems.get(1);
    expect(first?.planets.map((planet) => planet.issue)).toEqual([11, 12]);
    expect(first?.crew).toEqual(crew(1));
    expect(first?.satellites.map((each) => each.key)).toEqual(['a', 'b']);
    expect(first?.meteor).toBeNull();
    const second = systems.get(2);
    expect(second?.planets).toEqual([]);
    expect(second?.crew).toBeNull();
    expect(second?.satellites.map((each) => each.key)).toEqual(['c']);
    expect(second?.meteor).toEqual(meteor(2));
  });

  it('leaves out a satellite on the parking orbit, which belongs to no star', () => {
    const systems = systemsOf({
      items: [item(1)],
      crews: [],
      satellites: [satellite('parked', null)],
      meteors: [],
    });

    expect(systems.get(1)?.satellites).toEqual([]);
  });

  it('knows no system for a pull request that is not in the sky', () => {
    const systems = systemsOf({ items: [], crews: [crew(9)], satellites: [], meteors: [] });

    expect(systems.size).toBe(0);
  });
});

describe('endingOf', () => {
  it('knows a closed pull request was closed, whatever way was recorded', () => {
    expect(endingOf('closed').how).toBe('closed');
    expect(endingOf('merged', 'squash').how).toBe('squash');
    expect(endingOf('merged').how).toBeNull();
  });

  it('has not read the threads or the issues closed', () => {
    expect(endingOf('merged', 'merge')).toEqual({
      fate: 'merged',
      how: 'merge',
      threads: null,
      closes: null,
    });
  });
});

describe('endingOfPull', () => {
  const threads = { resolved: 2, unresolved: 1 };

  it('carries what GitHub said about a merged pull request', () => {
    const merged: PullState = {
      state: 'MERGED',
      title: 'x',
      ending: { how: 'squash', threads, closes: [4] },
    };

    expect(endingOfPull(merged)).toEqual({
      fate: 'merged',
      how: 'squash',
      threads,
      closes: [4],
    });
  });

  it('is a closed ending for a closed pull request, even from an API that said no more', () => {
    expect(endingOfPull({ state: 'CLOSED', title: 'x' })).toEqual({
      fate: 'closed',
      how: 'closed',
      threads: null,
      closes: null,
    });
  });

  it('is nothing while the pull request is still open', () => {
    expect(endingOfPull({ state: 'OPEN', title: 'x' })).toBeNull();
  });
});
