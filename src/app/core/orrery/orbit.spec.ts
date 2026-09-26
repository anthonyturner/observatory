import { ORBIT_SQUASH, growth, orbitPoint } from './orbit';
import { OrreryWorld } from './world-layout';

describe('orbitPoint', () => {
  it('runs as an ellipse, as wide as the orbit and flattened by the view', () => {
    const right = orbitPoint(100, 0);
    const front = orbitPoint(100, Math.PI / 2);

    expect(right.x).toBeCloseTo(100);
    expect(right.y).toBeCloseTo(0);
    expect(front.y).toBeCloseTo(100 * ORBIT_SQUASH);
    expect(front.z).toBeGreaterThan(0);
    expect(orbitPoint(100, -Math.PI / 2).z).toBeLessThan(0);
  });

  it('leans with its tilt', () => {
    expect(orbitPoint(100, Math.PI / 2, 0.1).y).toBeCloseTo(100 * (ORBIT_SQUASH + 0.1));
  });
});

describe('growth', () => {
  const world = { delay: 0.5 } as OrreryWorld;

  it('waits for its delay, then eases in to full size', () => {
    expect(growth(world, 0.2)).toBe(0);
    expect(growth(world, 1)).toBeGreaterThan(0.8);
    expect(growth(world, 5)).toBe(1);
  });
});
