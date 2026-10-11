import {
  Acts,
  PRELUDE_S,
  STREAK_REACH,
  STREAK_RISE,
  beatsOf,
  delayOf,
  firstActProgress,
  panAt,
  pathStops,
  secondActProgress,
  spanOf,
  streakHead,
  streakTravel,
} from './departure-exit';
import { Point } from '../sound/doppler';

const acts: Acts = { firstS: 1, secondS: 3 };

describe('an exit with two acts', () => {
  it('takes its beats from the prelude and its acts, in order', () => {
    expect(beatsOf(acts)).toEqual({
      beginS: PRELUDE_S,
      turnS: PRELUDE_S + 1,
      endS: PRELUDE_S + 4,
    });
    expect(spanOf(acts)).toBe(PRELUDE_S + 4);
  });

  it('runs the first act after the prelude, then hands over to the second', () => {
    const span = spanOf(acts);
    const turn = (PRELUDE_S + 1) / span;

    expect(firstActProgress(-0.1, acts)).toBeNull();
    expect(firstActProgress((PRELUDE_S + 0.5) / span, acts)).toBeCloseTo(0.5);
    expect(firstActProgress(turn + 0.01, acts)).toBeNull();
    expect(secondActProgress(turn - 0.01, acts)).toBe(0);
    expect(secondActProgress(turn, acts)).toBeCloseTo(0);
    expect(secondActProgress((PRELUDE_S + 2.5) / span, acts)).toBeCloseTo(0.5);
    expect(secondActProgress(1, acts)).toBe(1);
  });
});

describe('the streak', () => {
  it('travels fast at first, slowing to its reach', () => {
    expect(streakTravel(0)).toBe(0);
    expect(streakTravel(1)).toBe(STREAK_REACH);
    expect(streakTravel(0.5) - streakTravel(0)).toBeGreaterThan(
      streakTravel(1) - streakTravel(0.5),
    );
  });

  it('puts the head along its heading, and gains depth as it goes', () => {
    const from = { x: 10, y: 20, z: 30 };
    const head = streakHead(from, 0, 1);

    expect(head.x).toBeCloseTo(10 + STREAK_REACH);
    expect(head.y).toBeCloseTo(20);
    expect(head.z).toBeCloseTo(30 + STREAK_REACH * STREAK_RISE);
    expect(streakHead(from, 0, 0)).toEqual(from);
  });
});

describe('what a cue reads from the sky', () => {
  const scene = {
    now: 10,
    width: 1000,
    height: 800,
    frozen: false,
    project: (x: number, y: number, z: number): Point => ({ x, y, z }),
  };

  it('pans by screen x, kept off the speakers’ edges, and centred on a screen with no width', () => {
    expect(panAt(250, 1000)).toBe(-0.5);
    expect(panAt(1000, 1000)).toBe(0.8);
    expect(panAt(-400, 1000)).toBe(-0.8);
    expect(panAt(300, 0)).toBe(0);
  });

  it('waits until the star begins to go, after the prelude, and never backwards', () => {
    expect(delayOf({ kind: 'merged', startAt: 12.5 }, scene)).toBeCloseTo(2.5 + PRELUDE_S);
    expect(delayOf({ kind: 'merged', startAt: 8 }, scene)).toBe(Math.max(0, PRELUDE_S - 2));
  });

  it('cuts a moving source’s path into stretches, in order, panned and pitched by the positions', () => {
    const stops = pathStops((p) => ({ x: 100 + p * 800, y: 100, z: 0 }), 2, scene);
    const times = stops.map((stop) => stop.at);

    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[0]).toBeGreaterThan(0);
    expect(times.at(-1)).toBeLessThan(2);
    expect(stops[0].pan).toBeLessThan(0);
    expect(stops.at(-1)?.pan).toBeGreaterThan(0);
    expect(stops.every((stop) => stop.doppler > 0)).toBe(true);
  });
});
