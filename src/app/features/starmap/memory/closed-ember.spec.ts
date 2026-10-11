import { HOLE } from '../engine/black-hole';
import {
  COOL_S,
  EMBER_SPAN_S,
  SINK_S,
  coolLook,
  coolProgress,
  emberColour,
  sinkCue,
  sinkHead,
  sinkLook,
  sinkProgress,
} from './closed-ember';
import { Point } from '../sound/doppler';
import { PRELUDE_S } from './departure-exit';

describe('the closed ember', () => {
  it('cools first, then sinks', () => {
    const through = (seconds: number): number => seconds / EMBER_SPAN_S;
    const handover = through(PRELUDE_S + COOL_S);

    expect(EMBER_SPAN_S).toBeCloseTo(PRELUDE_S + COOL_S + SINK_S);
    expect(coolProgress(-0.1)).toBeNull();
    expect(coolProgress(through(PRELUDE_S / 2))).toBeNull();
    expect(coolProgress(through(PRELUDE_S + COOL_S / 2))).toBeCloseTo(0.5);
    expect(coolProgress(handover + 0.01)).toBeNull();
    expect(sinkProgress(through(PRELUDE_S + COOL_S / 2))).toBe(0);
    expect(sinkProgress(1)).toBeCloseTo(1);
  });
});

describe('emberColour', () => {
  it('runs from the star’s last light to the ember, and stays between', () => {
    expect(emberColour(0)).toBe('#ffe3b8');
    expect(emberColour(1)).toBe('#e08a6a');
    expect(emberColour(-3)).toBe(emberColour(0));
    expect(emberColour(7)).toBe(emberColour(1));
  });
});

describe('coolLook and sinkLook', () => {
  it('contracts and dulls as it cools, without going out', () => {
    const start = coolLook(0);
    const end = coolLook(1);

    expect(end.radius).toBeLessThan(start.radius);
    expect(end.alpha).toBeLessThan(start.alpha);
    expect(end.alpha).toBeGreaterThan(0.5);
    expect(end.colour).toBe(emberColour(1));
  });

  it('is the ember it cooled to as it sinks, smaller, and fades into the shadow at the end', () => {
    expect(sinkLook(0).colour).toBe(coolLook(1).colour);
    expect(sinkLook(1).radius).toBeLessThan(sinkLook(0).radius);
    expect(sinkLook(0.5).alpha).toBe(sinkLook(0).alpha);
    expect(sinkLook(1).alpha).toBe(0);
  });
});

describe('sinkHead', () => {
  const from = { x: HOLE.x + 400, y: HOLE.y, z: 60 };

  it('starts where the star stood and ends at the hole, in its plane', () => {
    expect(sinkHead(from, 0)).toEqual(from);
    const end = sinkHead(from, 1);

    expect(end.x).toBeCloseTo(HOLE.x);
    expect(end.y).toBeCloseTo(HOLE.y);
    expect(end.z).toBeCloseTo(0);
  });

  it('falls quicker the closer it gets, and turns about the hole as it goes', () => {
    const distance = (s: number): number => {
      const at = sinkHead(from, s);
      return Math.hypot(at.x - HOLE.x, at.y - HOLE.y);
    };

    expect(distance(0.5)).toBeLessThan(distance(0));
    expect(distance(0.25) - distance(0.5)).toBeLessThan(distance(0.5) - distance(0.75));
    expect(sinkHead(from, 0.5).y).not.toBeCloseTo(HOLE.y);
  });
});

describe('sinkCue', () => {
  const flat = (x: number) => (): Point => ({ x, y: 0, z: 0 });
  const scene = (extra: object = {}) => ({
    now: 10,
    width: 1000,
    height: 800,
    frozen: false,
    project: (x: number, y: number, z: number): Point => ({ x: x / 4, y, z }),
    ...extra,
  });
  const closed = { kind: 'closed', startAt: 12, fromX: HOLE.x + 800, fromY: HOLE.y, fromZ: 0 };

  it('waits for the cooling and sits where it begins on screen', () => {
    expect(sinkCue(closed, scene({ project: flat(250) }))).toMatchObject({
      delayS: 2 + PRELUDE_S,
      pan: -0.5,
    });
  });

  it('follows the ember down into the hole, panned by where it is drawn', () => {
    const cue = sinkCue(closed, scene());
    const pans = cue.sink.map((stop) => stop.pan);

    expect(cue.sink).toHaveLength(8);
    expect(cue.sink.at(-1)?.at).toBeLessThan(SINK_S);
    expect(pans[0]).toBeGreaterThan(pans.at(-1) ?? 0);
  });

  it('plays only the cooling when motion is off, as the sky does', () => {
    expect(sinkCue(closed, scene({ frozen: true })).sink).toEqual([]);
  });
});
