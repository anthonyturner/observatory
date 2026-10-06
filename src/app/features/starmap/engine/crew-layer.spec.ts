import { CrewMark } from '../../../core/crew/crew.types';
import { CrewLayer, LEAVE_MS, PoseClock, SHOW_ENDED_MS, crewPose } from './crew-layer';

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
