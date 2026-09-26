import { HandState, PointerSample, nearness } from './hand';

const at = (
  x: number,
  y: number,
  t: number,
  kind: PointerSample['kind'] = 'mouse',
): PointerSample => ({
  id: 1,
  x,
  y,
  t,
  kind,
});

function hand(isStill = false): HandState {
  return new HandState(() => isStill);
}

describe('HandState', () => {
  it('ignores a wobble under the slop, then turns the ball with a drag', () => {
    const h = hand();
    h.press(at(100, 100, 0));
    h.move(at(103, 100, 10), 100);
    expect(h.hasDragged).toBe(false);
    expect(h.pose.yaw).toBe(0);
    h.move(at(150, 100, 20), 100);
    expect(h.hasDragged).toBe(true);
    // A drag across the whole ball (2 radii) turns it half round.
    expect(h.pose.yaw).toBeCloseTo((50 * Math.PI) / 200);
  });

  it('coasts after a flick, and runs down', () => {
    const h = hand();
    h.press(at(0, 0, 0));
    h.move(at(40, 0, 16), 100);
    h.release(at(40, 0, 20), true);
    h.advance(1);
    const released = h.pose.yaw;
    h.advance(1.05);
    expect(h.pose.yaw).toBeGreaterThan(released);
    for (let s = 1.1; s < 10; s += 0.05) h.advance(s);
    expect(h.isBusy).toBe(true); // still over the ball, so the glow holds
    const settled = h.pose.yaw;
    h.advance(10.05);
    expect(h.pose.yaw).toBe(settled);
  });

  it('does not coast when the hand stopped before letting go', () => {
    const h = hand();
    h.press(at(0, 0, 0));
    h.move(at(40, 0, 16), 100);
    h.release(at(40, 0, 200), true);
    h.advance(1);
    const released = h.pose.yaw;
    h.advance(1.05);
    expect(h.pose.yaw).toBe(released);
  });

  it('stops a spinning ball when caught', () => {
    const h = hand();
    h.nudge('right');
    h.press(at(0, 0, 0));
    h.advance(1);
    h.advance(1.05);
    expect(h.pose.yaw).toBe(0);
  });

  it('turns by a fixed step per arrow key when motion is off', () => {
    const h = hand(true);
    h.nudge('right');
    h.nudge('down');
    expect(h.pose.yaw).toBeCloseTo((18 * Math.PI) / 180);
    expect(h.pose.pitch).toBeCloseTo((18 * Math.PI) / 180);
  });

  it('lights the glow under the pointer and lets it go when the pointer leaves', () => {
    const h = hand(true);
    h.point(10, 20);
    h.advance(0);
    expect(h.pose).toMatchObject({ x: 10, y: 20, glow: 1 });
    h.leave();
    h.advance(0.1);
    expect(h.pose.glow).toBe(0);
    expect(h.isBusy).toBe(false);
  });

  it('keeps the glow on a mouse let go over the ball, not on a lifted finger', () => {
    const mouse = hand(true);
    mouse.press(at(0, 0, 0));
    mouse.release(at(0, 0, 10), true);
    mouse.advance(0);
    expect(mouse.pose.glow).toBe(1);
    const finger = hand(true);
    finger.press(at(0, 0, 0, 'other'));
    finger.release(at(0, 0, 10, 'other'), true);
    finger.advance(0);
    expect(finger.pose.glow).toBe(0);
  });
});

describe('nearness', () => {
  it('is 1 at the hand and 0 from its reach out', () => {
    expect(nearness(0, 10)).toBe(1);
    expect(nearness(10, 10)).toBe(0);
    expect(nearness(5, 10)).toBeGreaterThan(0);
    expect(nearness(5, 10)).toBeLessThan(1);
  });
});
