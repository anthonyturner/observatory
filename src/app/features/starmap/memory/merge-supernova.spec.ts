import {
  MERGE_SPAN_S,
  NOVA_S,
  STREAK_REACH,
  STREAK_RISE,
  STREAK_S,
  mergeCues,
  novaLook,
  novaProgress,
  streakHead,
  streakProgress,
  streakTravel,
} from './merge-supernova';
import { Point } from '../sound/doppler';

describe('the merge supernova', () => {
  it('goes off first, then hands over to the streak', () => {
    const handover = NOVA_S / MERGE_SPAN_S;

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

describe('mergeCues', () => {
  const width = 1000;
  const height = 800;
  const flat = (x: number) => (): Point => ({ x, y: 0, z: 0 });
  const options = (x: number, extra: object = {}) => ({
    now: 10,
    width,
    height,
    frozen: false,
    project: flat(x),
    ...extra,
  });
  const merged = (startAt: number) => ({ kind: 'merged', startAt, fromX: 0, fromY: 0, fromZ: 0 });

  it('waits for the supernova and sits where it happens on screen', () => {
    const [left] = mergeCues([merged(12.5)], options(250));
    const [edge] = mergeCues([merged(10)], options(1000));

    expect(left).toMatchObject({ delayS: 2.5, pan: -0.5 });
    expect(edge.pan).toBe(0.8);
  });

  it('never goes backwards in time or off the screen', () => {
    const [late] = mergeCues([merged(8)], options(-400));
    const [blind] = mergeCues([merged(10)], options(300, { width: 0 }));

    expect(late).toMatchObject({ delayS: 0, pan: -0.8 });
    expect(blind.pan).toBe(0);
    expect(blind.whoosh.every((stop) => stop.pan === 0)).toBe(true);
  });

  it('cues only merges that have started playing, and not too many', () => {
    const news = [
      { kind: 'blocked', startAt: 10 },
      { kind: 'merged' },
      ...Array.from({ length: 6 }, (_, i) => merged(10 + i)),
    ];

    expect(mergeCues(news, options(500))).toHaveLength(4);
    expect(mergeCues([], options(500))).toEqual([]);
  });
});

describe('the whoosh in a merge cue', () => {
  const width = 1000;
  const height = 800;
  /** A world point is its own place on screen, one for one. */
  const identity = (x: number, y: number, z: number): Point => ({ x, y, z });
  const options = (extra: object = {}) => ({
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
    const [cue] = mergeCues([streak(100, 0)], options());
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
    const [cue] = mergeCues([streak(500, Math.PI / 2)], options());
    const shifts = cue.whoosh.map((stop) => stop.doppler);

    expect(shifts.every((each) => each > 1)).toBe(true);
    expect(shifts[0]).toBeGreaterThan(shifts.at(-1) ?? 0);
    expect(shifts.every((each) => each < 2 ** (3 / 12) + 1e-9)).toBe(true);
  });

  it('drops while the head draws away, never below three semitones down', () => {
    const [cue] = mergeCues([{ ...streak(500, -Math.PI / 2), fromY: 700 }], options());
    const shifts = cue.whoosh.map((stop) => stop.doppler);

    expect(shifts.every((each) => each < 1)).toBe(true);
    expect(shifts.every((each) => each > 2 ** (-3 / 12) - 1e-9)).toBe(true);
  });

  it('shifts by depth too: a head that gains depth toward the viewer closes faster', () => {
    const flatSky = (x: number, y: number, z: number): Point => ({ x, y, z: z * 0 });
    const [deep] = mergeCues([streak(500, Math.PI / 2)], options());
    const [flatted] = mergeCues([streak(500, Math.PI / 2)], options({ project: flatSky }));

    // Late in the path the head has slowed, so neither shift is pinned at the limit.
    expect(deep.whoosh.at(-1)?.doppler).toBeGreaterThan(flatted.whoosh.at(-1)?.doppler ?? 0);
  });

  it('is silent when motion is off, since there is no streak to hear', () => {
    const [cue] = mergeCues([streak(100, 0)], options({ frozen: true }));

    expect(cue.whoosh).toEqual([]);
    expect(cue.pan).toBeLessThan(0);
  });
});
