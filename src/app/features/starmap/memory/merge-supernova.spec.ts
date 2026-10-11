import { STREAK_S } from './departure-exit';
import {
  MERGE_SPAN_S,
  NOVA_S,
  mergeCue,
  novaLook,
  novaProgress,
  streakProgress,
} from './merge-supernova';
import { Point } from '../sound/doppler';

describe('the merge supernova', () => {
  it('goes off first, then hands over to the streak', () => {
    const handover = NOVA_S / MERGE_SPAN_S;

    expect(MERGE_SPAN_S).toBeCloseTo(NOVA_S + STREAK_S);
    expect(novaProgress(-0.1)).toBeNull();
    expect(novaProgress(handover / 2)).toBeCloseTo(0.5);
    expect(novaProgress(handover + 0.01)).toBeNull();
    expect(streakProgress(handover / 2)).toBe(0);
    expect(streakProgress(handover)).toBeCloseTo(0);
    expect(streakProgress(1)).toBe(1);
  });
});

describe('novaLook', () => {
  it('flares bright and small, then spreads thin and fades', () => {
    const start = novaLook(0);
    const end = novaLook(1);

    expect(start.flashAlpha).toBeGreaterThan(0.8);
    expect(end.flashAlpha).toBe(0);
    expect(end.ringAlpha).toBe(0);
    expect(end.ringRadius).toBeGreaterThan(start.ringRadius * 5);
  });
});

describe('mergeCue', () => {
  const width = 1000;
  const height = 800;
  const flat = (x: number) => (): Point => ({ x, y: 0, z: 0 });
  const scene = (x: number, extra: object = {}) => ({
    now: 10,
    width,
    height,
    frozen: false,
    project: flat(x),
    ...extra,
  });
  const merged = (startAt: number) => ({ kind: 'merged', startAt, fromX: 0, fromY: 0, fromZ: 0 });

  it('waits for the supernova and sits where it happens on screen', () => {
    expect(mergeCue(merged(12.5), scene(250))).toMatchObject({ delayS: 2.5, pan: -0.5 });
    expect(mergeCue(merged(10), scene(1000)).pan).toBe(0.8);
  });

  it('never goes backwards in time or off the screen', () => {
    const late = mergeCue(merged(8), scene(-400));
    const blind = mergeCue(merged(10), scene(300, { width: 0 }));

    expect(late).toMatchObject({ delayS: 0, pan: -0.8 });
    expect(blind.pan).toBe(0);
    expect(blind.whoosh.every((stop) => stop.pan === 0)).toBe(true);
  });
});

describe('the whoosh in a merge cue', () => {
  const width = 1000;
  const height = 800;
  /** A world point is its own place on screen, one for one. */
  const identity = (x: number, y: number, z: number): Point => ({ x, y, z });
  const scene = (extra: object = {}) => ({
    now: 0,
    width,
    height,
    frozen: false,
    project: identity,
    ...extra,
  });
  const streak = (fromX: number, angle: number) => ({
    kind: 'merged',
    startAt: 0,
    fromX,
    fromY: 100,
    fromZ: 0,
    angle,
  });

  it('follows the streak across its whole length, panned by where its head is', () => {
    const cue = mergeCue(streak(100, 0), scene());
    const pans = cue.whoosh.map((stop) => stop.pan);
    const times = cue.whoosh.map((stop) => stop.at);

    expect(times[0]).toBeGreaterThan(0);
    expect(times.at(-1)).toBeLessThan(STREAK_S);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(pans[0]).toBeLessThan(0);
    expect([...pans].sort((a, b) => a - b)).toEqual(pans);
    expect(pans.at(-1)).toBeGreaterThan(0);
  });

  it('rises while the head comes toward you, most at first as it is fastest', () => {
    // Heading down the screen toward the viewer's seat at the bottom.
    const cue = mergeCue(streak(500, Math.PI / 2), scene());
    const shifts = cue.whoosh.map((stop) => stop.doppler);

    expect(shifts.every((each) => each > 1)).toBe(true);
    expect(shifts[0]).toBeGreaterThan(shifts.at(-1) ?? 0);
    expect(shifts.every((each) => each < 2 ** (3 / 12) + 1e-9)).toBe(true);
  });

  it('drops while the head draws away, never below three semitones down', () => {
    const cue = mergeCue({ ...streak(500, -Math.PI / 2), fromY: 700 }, scene());
    const shifts = cue.whoosh.map((stop) => stop.doppler);

    expect(shifts.every((each) => each < 1)).toBe(true);
    expect(shifts.every((each) => each > 2 ** (-3 / 12) - 1e-9)).toBe(true);
  });

  it('shifts by depth too: a head that gains depth toward the viewer closes faster', () => {
    const flatSky = (x: number, y: number, z: number): Point => ({ x, y, z: z * 0 });
    const deep = mergeCue(streak(500, Math.PI / 2), scene());
    const flatted = mergeCue(streak(500, Math.PI / 2), scene({ project: flatSky }));

    // Late in the path the head has slowed, so neither shift is pinned at the limit.
    expect(deep.whoosh.at(-1)?.doppler).toBeGreaterThan(flatted.whoosh.at(-1)?.doppler ?? 0);
  });

  it('is silent when motion is off, since there is no streak to hear', () => {
    const cue = mergeCue(streak(100, 0), scene({ frozen: true }));

    expect(cue.whoosh).toEqual([]);
    expect(cue.pan).toBeLessThan(0);
  });
});
