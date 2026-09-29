import { CoreLook, Rgb, breathing, nextLook, rippleAt } from './core-look';
import { CORE_INKS, CORE_STATES, TierMoment } from './core-states';

const GREEN: Rgb = [0, 1, 0];
const RED: Rgb = [1, 0, 0];

function first(isStill = false): CoreLook {
  return nextLook(null, { state: CORE_STATES.idle, tint: GREEN, time: 0, wall: 10, isStill });
}

describe('nextLook', () => {
  it('brightens a listening core with the voice, and holds it still when motion is off', () => {
    const at = (voiceLevel: number, isStill = false): number =>
      nextLook(null, {
        state: CORE_STATES.listening,
        tint: GREEN,
        time: 0,
        wall: 10,
        isStill,
        voiceLevel,
      }).glow;

    expect(at(0)).toBe(CORE_STATES.listening.glow);
    expect(at(1)).toBeCloseTo(CORE_STATES.listening.glow * 1.5);
    expect(at(1, true)).toBe(CORE_STATES.listening.glow);
  });

  it('does not swell a state without a swell, whatever the level', () => {
    const look = nextLook(null, {
      state: CORE_STATES.idle,
      tint: GREEN,
      time: 0,
      wall: 10,
      isStill: false,
      voiceLevel: 1,
    });
    expect(look.glow).toBe(CORE_STATES.idle.glow);
  });

  it('takes the state’s look at once on the first frame', () => {
    const look = first();
    expect(look.tint).toEqual(GREEN);
    expect(look.glow).toBe(1);
    expect(look.spin).toBe(0);
  });

  it('eases toward a new state rather than cutting to it', () => {
    const look = nextLook(first(), {
      state: CORE_STATES.error,
      tint: RED,
      time: 0.1,
      wall: 10.1,
      isStill: false,
    });
    expect(look.tint[0]).toBeGreaterThan(0);
    expect(look.tint[0]).toBeLessThan(1);
  });

  it('cuts straight to the new state when still', () => {
    const look = nextLook(first(true), {
      state: CORE_STATES.error,
      tint: RED,
      time: 9.4,
      wall: 10.1,
      isStill: true,
    });
    expect(look.tint).toEqual(RED);
    expect(look.level).toBe(CORE_STATES.error.glow);
  });

  it('turns with scene time, but never catches up a long gap at once', () => {
    const input = { state: CORE_STATES.idle, tint: GREEN, isStill: false };
    const short = nextLook(first(), { ...input, time: 0.1, wall: 10.1 });
    const long = nextLook(first(), { ...input, time: 60, wall: 70 });
    expect(short.spin).toBeGreaterThan(0);
    expect(long.spin).toBeCloseTo(short.spin * 2.5);
  });
});

describe('breathing and ripple', () => {
  it('breathes about 1 by the state’s depth', () => {
    const { breathe, period } = CORE_STATES.idle;
    expect(breathing(CORE_STATES.idle, period / 4)).toBeCloseTo(1 + breathe);
  });

  it('has no ripple when the state has none', () => {
    expect(rippleAt(0.5, 3, 0)).toBe(0);
  });
});

describe('CORE_STATES', () => {
  const moment = (overrides: Partial<TierMoment> = {}): TierMoment => ({
    time: 1,
    age: 0,
    isStill: false,
    spokenTier: 0,
    ...overrides,
  });

  it('lights only the tier a reply took', () => {
    const [a, b, c] = CORE_STATES['answered-2'].tiers(moment({ isStill: true }));
    expect(b).toBe(1);
    expect(a).toBeLessThan(0.5);
    expect(c).toBeLessThan(0.5);
  });

  it('holds routing’s arcs at half when still', () => {
    expect(CORE_STATES.routing.tiers(moment({ isStill: true }))).toEqual([0.5, 0.5, 0.5]);
  });

  it('holds a running task’s tier-3 arc lit when still', () => {
    expect(CORE_STATES.running.tiers(moment({ isStill: true }))[2]).toBe(1);
  });

  it('names each tint once', () => {
    expect(new Set(CORE_INKS).size).toBe(CORE_INKS.length);
  });
});
