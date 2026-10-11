import { Point } from '../sound/doppler';
import {
  MAX_SPARKS,
  RESOLVED_SPARK,
  SPARK_S,
  SparkEvent,
  UNRESOLVED_SPARK,
  sparkColour,
  sparkCounts,
  sparkCues,
  sparksInFlight,
  sparksOf,
} from './comment-sparks';
import { PRELUDE_S } from './departure-exit';
import { exitBeat } from './exits';

const ending = (resolved: number, unresolved: number): SparkEvent['departure'] => ({
  ending: {
    fate: 'merged',
    how: 'merge',
    threads: { resolved, unresolved },
    closes: null,
  },
});

const exit = (kind: string, resolved: number, unresolved: number, startAt = 10): SparkEvent => ({
  kind,
  pr: 7,
  startAt,
  fromX: 400,
  fromY: 300,
  fromZ: 20,
  departure: ending(resolved, unresolved),
});

const kinds = ['merged', 'squashed', 'closed'] as const;

describe('how many sparks', () => {
  it('follows the real thread counts while they fit under the cap', () => {
    expect(sparkCounts({ resolved: 3, unresolved: 2 })).toEqual({ resolved: 3, unresolved: 2 });
    expect(sparkCounts({ resolved: 0, unresolved: MAX_SPARKS })).toEqual({
      resolved: 0,
      unresolved: MAX_SPARKS,
    });
  });

  it('shares the cap in proportion when there are more threads than it', () => {
    expect(sparkCounts({ resolved: 30, unresolved: 10 })).toEqual({ resolved: 9, unresolved: 3 });
    expect(sparkCounts({ resolved: 0, unresolved: 100 })).toEqual({ resolved: 0, unresolved: 12 });
  });

  it('never drops a kind of thread that exists, however lopsided the counts', () => {
    expect(sparkCounts({ resolved: 99, unresolved: 1 })).toEqual({ resolved: 11, unresolved: 1 });
    expect(sparkCounts({ resolved: 1, unresolved: 99 })).toEqual({ resolved: 1, unresolved: 11 });
  });

  it('reads a count that is not a whole number as none', () => {
    expect(sparkCounts({ resolved: -4, unresolved: Number.NaN })).toEqual({
      resolved: 0,
      unresolved: 0,
    });
  });
});

describe('sparksOf', () => {
  it('makes one spark per counted thread, red for unresolved and gold for resolved', () => {
    const sparks = sparksOf({ resolved: 3, unresolved: 2 }, 7);

    expect(sparks).toHaveLength(5);
    expect(sparks.filter((spark) => spark.unresolved)).toHaveLength(2);
    expect(sparkColour(true)).toBe(UNRESOLVED_SPARK);
    expect(sparkColour(false)).toBe(RESOLVED_SPARK);
    expect(UNRESOLVED_SPARK).not.toBe(RESOLVED_SPARK);
  });

  it('makes none for a pull request with no threads, or with threads nobody counted', () => {
    expect(sparksOf({ resolved: 0, unresolved: 0 }, 7)).toEqual([]);
    expect(sparksOf(null, 7)).toEqual([]);
    expect(sparksOf(undefined, 7)).toEqual([]);
  });

  it('peels them off the same way for the same pull request every time', () => {
    const threads = { resolved: 4, unresolved: 4 };

    expect(sparksOf(threads, 7)).toEqual(sparksOf(threads, 7));
    expect(sparksOf(threads, 7)).not.toEqual(sparksOf(threads, 8));
  });
});

describe('sparksInFlight', () => {
  it.each(kinds)('keeps time with the %s exit, from when its star begins to go', (kind) => {
    const ev = exit(kind, 3, 3);
    const begin = exitBeat(ev, 'begin') ?? 0;

    expect(begin).toBe(10 + PRELUDE_S);
    expect(sparksInFlight(ev, begin - 0.01)).toEqual([]);
    expect(sparksInFlight(ev, begin + 0.5).length).toBeGreaterThan(0);
  });

  it.each(kinds)('has landed every spark before the %s exit is over', (kind) => {
    const ev = exit(kind, 6, 6);
    const end = exitBeat(ev, 'end') ?? 0;

    expect(sparksInFlight(ev, end - 0.001)).toEqual([]);
  });

  it('moves with the exit when it starts later', () => {
    const early = exit('merged', 2, 2, 10);
    const late = exit('merged', 2, 2, 14);

    expect(sparksInFlight(late, 14.6)).toEqual(sparksInFlight(early, 10.6));
  });

  it('flies each spark outward from where the star stood, fading as it goes', () => {
    const ev = exit('merged', 0, 1);
    const begin = exitBeat(ev, 'begin') ?? 0;
    const [spark] = sparksOf({ resolved: 0, unresolved: 1 }, 7);
    const at = (q: number) => sparksInFlight(ev, begin + spark.lagS + q * SPARK_S)[0];
    const away = (q: number) => Math.hypot(at(q).x - 400, at(q).y - 300);

    expect(away(0.7)).toBeGreaterThan(away(0.3));
    expect(at(0.9).alpha).toBeLessThan(at(0.4).alpha);
    expect(at(0.4).unresolved).toBe(true);
    expect(at(0.4).z).toBe(20);
  });

  it('shows no sparks for news with no exit, no start, or no threads', () => {
    expect(sparksInFlight(exit('blocked', 3, 3), 10.5)).toEqual([]);
    expect(sparksInFlight({ ...exit('merged', 3, 3), startAt: undefined }, 10.5)).toEqual([]);
    expect(sparksInFlight(exit('merged', 0, 0), 10.5)).toEqual([]);
    expect(sparksInFlight({ ...exit('merged', 3, 3), departure: undefined }, 10.5)).toEqual([]);
  });

  it('never has more in the air than the cap', () => {
    const ev = exit('merged', 500, 500);
    const begin = exitBeat(ev, 'begin') ?? 0;

    for (let t = 0; t < 3; t += 0.05) {
      expect(sparksInFlight(ev, begin + t).length).toBeLessThanOrEqual(MAX_SPARKS);
    }
  });
});

describe('sparkCues', () => {
  const scene = (extra: object = {}) => ({
    now: 10,
    width: 1000,
    frozen: false,
    project: (): Point => ({ x: 750, y: 0, z: 0 }),
    ...extra,
  });

  it('crackles once per spark, from when the star begins to go and from where it stood', () => {
    const [cue] = sparkCues([exit('merged', 3, 2, 12)], scene());

    expect(cue.delayS).toBeCloseTo(2 + PRELUDE_S);
    expect(cue.pan).toBeCloseTo(0.5);
    expect(cue.pops).toHaveLength(5);
    expect(cue.pops.filter((pop) => pop.unresolved)).toHaveLength(2);
    expect(Math.min(...cue.pops.map((pop) => pop.atS))).toBeGreaterThanOrEqual(0);
  });

  it('pitches an open thread below a settled one', () => {
    const [{ pops }] = sparkCues([exit('closed', 6, 6)], scene());
    const mean = (open: boolean) => {
      const hz = pops.filter((pop) => pop.unresolved === open).map((pop) => pop.hz);
      return hz.reduce((a, b) => a + b) / hz.length;
    };

    expect(mean(true)).toBeLessThan(mean(false));
  });

  it('is silent with no threads, no exit, no start, or motion off', () => {
    expect(sparkCues([exit('merged', 0, 0)], scene())).toEqual([]);
    expect(sparkCues([exit('blocked', 2, 2)], scene())).toEqual([]);
    expect(sparkCues([{ ...exit('merged', 2, 2), startAt: undefined }], scene())).toEqual([]);
    expect(sparkCues([exit('merged', 2, 2)], scene({ frozen: true }))).toEqual([]);
  });

  it('plays no more than four in one refresh', () => {
    const many = kinds.flatMap((kind) => [10, 11].map((at) => exit(kind, 1, 1, at)));

    expect(sparkCues(many, scene())).toHaveLength(4);
  });
});
