import { MAX_TRAILS, liftFaint, placeTrails, starTrails } from './star-trails';

describe('starTrails', () => {
  it('draws one star per open issue, up to the cap', () => {
    expect(starTrails(0)).toHaveLength(0);
    expect(starTrails(105)).toHaveLength(105);
    expect(starTrails(10_000)).toHaveLength(MAX_TRAILS);
    expect(starTrails(-3)).toHaveLength(0);
  });

  it('adds a star for a new issue without moving the others', () => {
    const before = starTrails(40);
    const after = starTrails(41);
    expect(after.slice(0, 40)).toEqual(before);
  });
});

describe('placeTrails', () => {
  const trails = starTrails(MAX_TRAILS);

  it('keeps every trail between the pole and the reach', () => {
    for (const trail of placeTrails(trails, 800, 120)) {
      expect(trail.radius).toBeGreaterThanOrEqual(26);
      expect(trail.radius).toBeLessThanOrEqual(800);
    }
  });

  it('thins trails near the core and leaves distant ones whole', () => {
    const placed = placeTrails(trails, 800, 120);
    const near = placed.filter((trail) => trail.radius < 100);
    const far = placed.filter((trail) => trail.radius > 400);
    expect(Math.max(...near.map((trail) => trail.fade))).toBeLessThan(1);
    expect(far.every((trail) => trail.fade === 1)).toBe(true);
  });
});

describe('liftFaint', () => {
  it('lifts a faint alpha more than a bright one, and keeps the ends', () => {
    expect(liftFaint(0)).toBeCloseTo(0, 2);
    expect(liftFaint(1)).toBeCloseTo(1);
    expect(liftFaint(0.05) / 0.05).toBeGreaterThan(liftFaint(0.8) / 0.8);
  });
});
