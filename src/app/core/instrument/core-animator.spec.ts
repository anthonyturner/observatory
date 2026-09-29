import { Bead } from './beads';
import { CoreAnimator, ballRadiusOf, beadGrowth } from './core-animator';
import { Rgb } from './core-look';
import { CoreFrame } from './core-renderer';
import { CORE_INKS, CoreInk } from './core-states';
import { BALL } from './proportions';

const INKS = Object.fromEntries(CORE_INKS.map((ink): [CoreInk, Rgb] => [ink, [0, 1, 0]])) as Record<
  CoreInk,
  Rgb
>;

function frame(overrides: Partial<CoreFrame> = {}): CoreFrame {
  return {
    time: 0,
    wall: 100,
    state: 'idle',
    stateAge: 0,
    spokenTier: 0,
    isStill: false,
    hand: { yaw: 0, pitch: 0, x: 0, y: 0, glow: 0 },
    litKey: null,
    mood: { name: 'calm', stress: 0, reason: 'nothing blocked' },
    sinceRefresh: null,
    voiceLevel: 0,
    ...overrides,
  };
}

const bead = { delay: 0.5 } as Bead;

describe('CoreAnimator', () => {
  it('has no pose before its first frame', () => {
    expect(new CoreAnimator().pose).toBeNull();
  });

  it('grows the core in from its first frame', () => {
    const animator = new CoreAnimator();
    animator.advance(frame(), INKS);
    expect(animator.pose?.intro).toBe(0);
    animator.advance(frame({ wall: 102 }), INKS);
    expect(animator.pose?.intro).toBe(1);
  });

  it('shows everything at once when still', () => {
    const animator = new CoreAnimator();
    animator.advance(frame({ isStill: true }), INKS);
    const pose = animator.pose;
    expect(pose?.intro).toBe(1);
    expect(pose && beadGrowth(pose, bead)).toBe(1);
  });

  it('grows a bead in after its delay', () => {
    const animator = new CoreAnimator();
    animator.advance(frame(), INKS);
    animator.advance(frame({ wall: 100.4 }), INKS);
    expect(animator.pose && beadGrowth(animator.pose, bead)).toBeLessThanOrEqual(0);
    animator.advance(frame({ wall: 102 }), INKS);
    expect(animator.pose && beadGrowth(animator.pose, bead)).toBe(1);
  });

  it('sizes the ball to BALL core radii once grown in, as it breathes', () => {
    const animator = new CoreAnimator();
    animator.advance(frame({ isStill: true }), INKS);
    const pose = animator.pose;
    expect(pose && ballRadiusOf(pose, 100)).toBeCloseTo(100 * BALL * (pose?.breath ?? 0));
  });

  it('lights the tier arcs by the state', () => {
    const animator = new CoreAnimator();
    animator.advance(frame({ state: 'answered-3', isStill: true }), INKS);
    expect(animator.pose?.tierLevels[2]).toBe(1);
  });

  it('lights the arc of the reply being read aloud', () => {
    const animator = new CoreAnimator();
    animator.advance(frame({ state: 'speaking', spokenTier: 1, isStill: true }), INKS);
    const [first, second, third] = animator.pose?.tierLevels ?? [];
    expect(second).toBe(1);
    expect(first).toBeLessThan(1);
    expect(third).toBeLessThan(1);
  });
});

describe('CoreAnimator.replayBeads', () => {
  it('grows the beads in again from the next frame', () => {
    const animator = new CoreAnimator();
    animator.advance(frame(), INKS);
    animator.advance(frame({ wall: 110 }), INKS);
    animator.replayBeads();
    animator.advance(frame({ wall: 110.2 }), INKS);
    expect(animator.pose && beadGrowth(animator.pose, bead)).toBeLessThanOrEqual(0);
    expect(animator.pose?.intro).toBe(1);
  });
});
