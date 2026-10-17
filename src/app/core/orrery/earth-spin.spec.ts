import { EarthSpin, IDLE_TURN } from './earth-spin';

const FRAME = 1 / 30;
const RADIUS = 100;

/** Runs `seconds` of frames, not dragging. */
function coast(spin: EarthSpin, seconds: number, hasMotion = true): void {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += FRAME) {
    spin.advance(FRAME, false, hasMotion);
  }
}

/** The turn over the next frame, without keeping it. */
function speedOf(spin: EarthSpin): number {
  const before = spin.angle;
  spin.advance(FRAME, false, true);
  return (spin.angle - before + 2 * Math.PI) % (2 * Math.PI) / FRAME;
}

describe('EarthSpin', () => {
  it('turns slowly eastward when left alone', () => {
    const spin = new EarthSpin();

    coast(spin, 10);

    expect(spin.angle).toBeCloseTo(IDLE_TURN * 10, 1);
  });

  it('follows the pointer while dragged: a drag of one radius turns it by a radian', () => {
    const spin = new EarthSpin();

    spin.drag(RADIUS, RADIUS);
    spin.advance(FRAME, true, true);

    expect(spin.angle).toBeCloseTo(1);
  });

  it('turns west for a drag to the left', () => {
    const spin = new EarthSpin();

    spin.drag(-RADIUS / 2, RADIUS);
    spin.advance(FRAME, true, true);

    expect(spin.angle).toBeCloseTo(2 * Math.PI - 0.5);
  });

  it('still turns by a drag made in the frame the pointer let go', () => {
    const spin = new EarthSpin();

    spin.drag(RADIUS, RADIUS);
    spin.advance(FRAME, false, true);

    expect(spin.angle).toBeGreaterThan(1);
  });

  it('keeps turning at the speed of the drag once let go', () => {
    const spin = new EarthSpin();
    spin.drag(RADIUS * 0.1, RADIUS);
    spin.advance(FRAME, true, true);

    expect(speedOf(spin)).toBeGreaterThan(IDLE_TURN * 10);
  });

  it('settles back to the idle rate in about two seconds', () => {
    const spin = new EarthSpin();
    spin.drag(RADIUS * 0.1, RADIUS);
    spin.advance(FRAME, true, true);
    const flick = speedOf(spin);

    coast(spin, 2);
    const settled = speedOf(spin);

    expect(flick).toBeGreaterThan(settled * 5);
    expect(settled).toBeGreaterThan(IDLE_TURN);
    expect(settled).toBeLessThan(IDLE_TURN * 3);
    coast(spin, 4);
    expect(speedOf(spin)).toBeCloseTo(IDLE_TURN, 2);
  });

  it('settles from a westward flick up to the idle rate too, without stalling on the way', () => {
    const spin = new EarthSpin();
    spin.drag(-RADIUS * 0.1, RADIUS);
    spin.advance(FRAME, true, true);

    coast(spin, 3);

    expect(speedOf(spin)).toBeCloseTo(IDLE_TURN, 1);
  });

  it('holding the pointer still stops the Earth, so letting go from rest does not throw it', () => {
    const spin = new EarthSpin();
    spin.drag(RADIUS * 0.1, RADIUS);
    spin.advance(FRAME, true, true);

    spin.advance(FRAME, true, true);

    expect(speedOf(spin)).toBeLessThan(IDLE_TURN * 0.2);
  });

  it('caps how hard a flick can throw it', () => {
    const spin = new EarthSpin();
    spin.drag(RADIUS * 50, RADIUS);
    spin.advance(FRAME, true, true);

    expect(speedOf(spin)).toBeLessThanOrEqual(3 * Math.PI + 1e-6);
  });

  it('does not spin on its own, or coast after a drag, when motion is off', () => {
    const spin = new EarthSpin();
    coast(spin, 10, false);
    expect(spin.angle).toBe(0);

    spin.drag(RADIUS, RADIUS);
    spin.advance(FRAME, true, false);
    const dragged = spin.angle;
    coast(spin, 5, false);

    expect(dragged).toBeCloseTo(1);
    expect(spin.angle).toBe(dragged);
  });
});
