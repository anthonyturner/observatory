import { CrewMark } from '../../../core/crew/crew.types';
import { FLIGHT_S, Flight, Undock } from '../memory/undock';
import { SkyFrame } from './sky-frame';
import {
  CrewLayer,
  LEAVE_MS,
  PoseClock,
  SHOW_ENDED_MS,
  crewOrbit,
  crewPose,
  undockedPose,
} from './crew-layer';

const NOW = 1_000_000;
const ORBIT = 30;
const working: CrewMark = { pr: 7, phase: 'working', endedAt: null };
const clock = (fields: Partial<PoseClock> = {}): PoseClock => ({
  t: 0,
  frozen: false,
  now: NOW,
  orbit: ORBIT,
  ...fields,
});

describe('crewPose', () => {
  it('circles a working crew round its star, under way', () => {
    const early = crewPose(working, clock({ t: 0 }));
    const later = crewPose(working, clock({ t: 1 }));

    expect(early?.isFlying).toBe(true);
    expect(early?.badge).toBeNull();
    expect(early?.ship?.dx).toBeCloseTo(ORBIT);
    expect(later?.ship?.dx).not.toBeCloseTo(early?.ship?.dx ?? 0);
    expect(Math.hypot(later?.ship?.dx ?? 0, (later?.ship?.dy ?? 0) / 0.45)).toBeCloseTo(ORBIT);
  });

  it('parks a working crew in one place, with no flame, when motion is off', () => {
    const first = crewPose(working, clock({ frozen: true, t: 0 }));
    const second = crewPose(working, clock({ frozen: true, t: 50 }));

    expect(first?.isFlying).toBe(false);
    expect(second?.ship).toEqual(first?.ship);
  });

  it('flies a returning crew off, fading, with its tick or cross', () => {
    const done: CrewMark = { pr: 7, phase: 'succeeded', endedAt: NOW - LEAVE_MS / 2 };
    const pose = crewPose(done, clock());

    expect(pose?.badge).toBe('ok');
    expect(pose?.isFlying).toBe(true);
    expect(pose?.ship?.alpha).toBeCloseTo(0.5);
    expect(Math.hypot(pose?.ship?.dx ?? 0, pose?.ship?.dy ?? 0)).toBeGreaterThan(ORBIT);
  });

  it('leaves only the mark once the ship has gone, or at once when motion is off', () => {
    const failed: CrewMark = { pr: 7, phase: 'failed', endedAt: NOW - LEAVE_MS };
    const justEnded: CrewMark = { ...failed, endedAt: NOW };

    expect(crewPose(failed, clock())).toEqual({ ship: null, isFlying: false, badge: 'bad' });
    expect(crewPose(justEnded, clock({ frozen: true }))?.ship).toBeNull();
  });

  it('clears the mark a while after the crew came back', () => {
    const old: CrewMark = { pr: 7, phase: 'succeeded', endedAt: NOW - SHOW_ENDED_MS };

    expect(crewPose(old, clock())).toBeNull();
  });
});

describe('undockedPose', () => {
  const docked: Flight = { stage: 'docked', p: 0, since: -0.2 };
  const flying = (p: number): Flight => ({ stage: 'flying', p, since: p * FLIGHT_S.crew });
  const still = (fields: Partial<PoseClock> = {}) => ({
    t: 3,
    frozen: false,
    orbit: ORBIT,
    ...fields,
  });

  it('keeps circling the place the star stood until it casts off', () => {
    const pose = undockedPose(docked, still());

    expect(pose).toEqual(crewPose(working, clock({ t: 3 })));
  });

  it('flies off from where it was on its orbit, outward and fading, with no tick or cross', () => {
    const start = undockedPose(flying(0), still({ t: 3 }));
    const later = undockedPose(flying(0.5), still({ t: 3 + 0.5 * FLIGHT_S.crew }));
    const orbitAtStart = crewPose(working, clock({ t: 3 }));

    expect(start?.ship?.dx).toBeCloseTo(orbitAtStart?.ship?.dx ?? NaN);
    expect(start?.ship?.dy).toBeCloseTo(orbitAtStart?.ship?.dy ?? NaN);
    expect(later?.badge).toBeNull();
    expect(later?.isFlying).toBe(true);
    expect(later?.ship?.alpha).toBeCloseTo(0.5);
    const reach = Math.hypot(later?.ship?.dx ?? 0, (later?.ship?.dy ?? 0) / 0.45);
    expect(reach).toBeGreaterThan(ORBIT);
  });

  it('flies as long as a returning crew does', () => {
    expect(FLIGHT_S.crew * 1000).toBe(LEAVE_MS);
  });

  it('draws nothing once home, or at all when motion is off', () => {
    expect(undockedPose({ stage: 'home', p: 1, since: 9 }, still())).toBeNull();
    expect(undockedPose(docked, still({ frozen: true }))).toBeNull();
    expect(undockedPose(flying(0.4), still({ frozen: true }))).toBeNull();
  });
});

describe('crewOrbit', () => {
  it('clears the planets but stays on screen', () => {
    expect(crewOrbit(1)).toBe(18);
    expect(crewOrbit(10)).toBeCloseTo(44);
    expect(crewOrbit(1000)).toBe(80);
  });
});

describe('CrewLayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('redraws a still sky when a returned crew’s mark is due to go', () => {
    let now = NOW;
    const redraw = vi.fn();
    const layer = new CrewLayer(() => now, redraw);

    layer.set([{ pr: 7, phase: 'succeeded', endedAt: NOW - SHOW_ENDED_MS + 1_000 }]);
    expect(redraw).toHaveBeenCalledTimes(1);

    now += 1_001;
    vi.advanceTimersByTime(1_001);
    expect(redraw).toHaveBeenCalledTimes(2);
    layer.dispose();
  });

  it('waits on nothing while every crew is at work', () => {
    const redraw = vi.fn();
    const layer = new CrewLayer(() => NOW, redraw);

    layer.set([working]);
    vi.advanceTimersByTime(SHOW_ENDED_MS * 2);

    expect(redraw).toHaveBeenCalledTimes(1);
  });
});

describe('CrewLayer casting off', () => {
  const undock = (kind: Undock['kind'] = 'crew'): Undock => ({
    kind,
    key: kind === 'crew' ? 'crew:7' : 'agent',
    pr: 7,
    name: 'Crew',
    from: { x: 1, y: 2, z: 3 },
    startAt: 10,
  });
  const frame = (fields: Partial<SkyFrame> = {}): SkyFrame =>
    ({
      chart: 'prs',
      t: 0,
      wall: 10.5,
      frozen: false,
      stars: [],
      camera: { current: { scale: 1 } },
      toScreen: () => [300, 200],
      ...fields,
    }) as unknown as SkyFrame;
  /** Counts the ships drawn: each has one hull. */
  function ships(layer: CrewLayer, f: SkyFrame): { count: number; at: number[] } {
    const hulls: number[][] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_, name) =>
          name === 'ellipse' ? (...args: number[]) => void hulls.push(args) : () => undefined,
        set: () => true,
      },
    ) as CanvasRenderingContext2D;
    layer.flat(ctx, f);
    return { count: hulls.length, at: hulls.map(([x]) => x) };
  }

  it('flies the crew ship of a star that left, though no star is in the sky', () => {
    const layer = new CrewLayer(
      () => NOW,
      () => undefined,
    );
    layer.setUndocks([undock()]);

    expect(ships(layer, frame()).count).toBe(1);
    expect(ships(layer, frame({ wall: 9 })).count).toBe(1);
  });

  it('draws it no more once it is home, with motion off, or off the queue sky', () => {
    const layer = new CrewLayer(
      () => NOW,
      () => undefined,
    );
    layer.setUndocks([undock()]);

    expect(ships(layer, frame({ wall: 10 + FLIGHT_S.crew + 0.01 })).count).toBe(0);
    expect(ships(layer, frame({ frozen: true })).count).toBe(0);
    expect(ships(layer, frame({ chart: 'logs' })).count).toBe(0);
  });

  it('leaves the satellites to their own layer', () => {
    const layer = new CrewLayer(
      () => NOW,
      () => undefined,
    );
    layer.setUndocks([undock('satellite')]);

    expect(ships(layer, frame()).count).toBe(0);
  });
});
