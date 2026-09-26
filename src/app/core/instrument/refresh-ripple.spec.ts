import { floorLift, rippleEllipses, rippleRings } from './refresh-ripple';

describe('rippleRings', () => {
  it('has no wave before any data, with motion off, or once it has passed', () => {
    expect(rippleRings(null, false)).toEqual([]);
    expect(rippleRings(0.5, true)).toEqual([]);
    expect(rippleRings(10, false)).toEqual([]);
  });

  it('sends a second ring after the first, each spreading and fading', () => {
    expect(rippleRings(0.2, false)).toHaveLength(1);
    const [first, second] = rippleRings(1, false);
    expect(second.spread).toBeLessThan(first.spread);
    expect(first.alpha).toBeLessThan(second.alpha);
  });
});

describe('floorLift', () => {
  it('brightens the floor as the wave starts and settles back to 1', () => {
    expect(floorLift(0, false)).toBeGreaterThan(1);
    expect(floorLift(1, false)).toBeLessThan(floorLift(0, false));
    expect(floorLift(10, false)).toBe(1);
    expect(floorLift(0, true)).toBe(1);
    expect(floorLift(null, false)).toBe(1);
  });
});

describe('rippleEllipses', () => {
  it('lays each ring under the core, growing with its spread', () => {
    const [ring] = rippleEllipses([{ spread: 0.5, alpha: 0.3 }], {
      coreRadius: 100,
      depth: 500,
      width: 1000,
    });
    expect(ring.centreY).toBeGreaterThan(0);
    expect(ring.radiusX).toBeCloseTo(275);
    expect(ring.radiusY).toBeCloseTo(0.5 * (500 - ring.centreY));
    expect(ring.alpha).toBe(0.3);
  });
});
