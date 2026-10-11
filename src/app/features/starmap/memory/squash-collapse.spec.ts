import { PRELUDE_S, STREAK_S } from './departure-exit';
import {
  COLLAPSE_S,
  SQUASH_SPAN_S,
  collapseLook,
  collapseProgress,
  implosionCue,
  squashStreakProgress,
} from './squash-collapse';
import { Point } from '../sound/doppler';

describe('the squash collapse', () => {
  it('collapses first, then hands over to the streak', () => {
    const through = (seconds: number): number => seconds / SQUASH_SPAN_S;
    const handover = through(PRELUDE_S + COLLAPSE_S);

    expect(SQUASH_SPAN_S).toBeCloseTo(PRELUDE_S + COLLAPSE_S + STREAK_S);
    expect(collapseProgress(-0.1)).toBeNull();
    expect(collapseProgress(through(PRELUDE_S / 2))).toBeNull();
    expect(collapseProgress(through(PRELUDE_S + COLLAPSE_S / 2))).toBeCloseTo(0.5);
    expect(collapseProgress(handover + 0.01)).toBeNull();
    expect(squashStreakProgress(through(PRELUDE_S + COLLAPSE_S / 2))).toBe(0);
    expect(squashStreakProgress(1)).toBe(1);
  });
});

describe('collapseLook', () => {
  it('draws the star in to a point, faster as it goes, with its ring falling in after it', () => {
    const start = collapseLook(0);
    const middle = collapseLook(0.5);
    const end = collapseLook(1);

    expect(start.coreRadius).toBeGreaterThan(middle.coreRadius);
    expect(middle.coreRadius).toBeGreaterThan(end.coreRadius);
    expect(start.coreRadius - middle.coreRadius).toBeLessThan(middle.coreRadius - end.coreRadius);
    expect(end.coreRadius).toBeLessThan(0.3);
    expect(start.ringRadius).toBeGreaterThan(10 * end.ringRadius);
    expect(start.ringAlpha).toBe(0);
    expect(end.ringAlpha).toBeCloseTo(0);
  });

  it('brightens as it compresses and flashes once, just before the point is reached', () => {
    expect(collapseLook(1).coreAlpha).toBeGreaterThan(collapseLook(0).coreAlpha);
    expect(collapseLook(0).flashAlpha).toBe(0);
    expect(collapseLook(0.9).flashAlpha).toBeGreaterThan(0.9);
    expect(collapseLook(1).flashAlpha).toBeCloseTo(0);
  });
});

describe('implosionCue', () => {
  const flat = (x: number) => (): Point => ({ x, y: 0, z: 0 });
  const scene = (x: number, extra: object = {}) => ({
    now: 10,
    width: 1000,
    height: 800,
    frozen: false,
    project: flat(x),
    ...extra,
  });
  const squashed = { kind: 'squashed', startAt: 12, fromX: 0, fromY: 0, fromZ: 0, angle: 0 };

  it('waits for the collapse and sits where it happens on screen', () => {
    expect(implosionCue(squashed, scene(250))).toMatchObject({ delayS: 2 + PRELUDE_S, pan: -0.5 });
  });

  it('sweeps in and follows the streak when the sky moves', () => {
    const cue = implosionCue(squashed, scene(250));

    expect(cue.sweeps).toBe(true);
    expect(cue.whoosh).toHaveLength(8);
  });

  it('keeps only the snap when motion is off, as the sky keeps only the flash', () => {
    const cue = implosionCue(squashed, scene(250, { frozen: true }));

    expect(cue).toMatchObject({ sweeps: false, whoosh: [], delayS: 2 + PRELUDE_S });
  });
});
