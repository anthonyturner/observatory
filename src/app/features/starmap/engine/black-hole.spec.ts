import {
  FALLEN_GAP,
  FALL_FLOOR,
  HOLE,
  HOLE_CLEAR,
  fallOf,
  isFalling,
  keepApart,
  placeByHole,
  redshift,
} from './black-hole';

const distance = (p: { x: number; y: number }): number => Math.hypot(p.x - HOLE.x, p.y - HOLE.y);

describe('the black hole', () => {
  it('pulls nothing until a pull request is idle past the threshold', () => {
    expect(fallOf(0, 14)).toBe(0);
    expect(fallOf(14, 14)).toBe(0);
    expect(isFalling(14, 14)).toBe(false);
    expect(isFalling(15, 14)).toBe(true);
    expect(fallOf(15, 14)).toBeGreaterThan(0);
  });

  it('pulls harder the longer it sits past the threshold, never past 1', () => {
    const pulls = [15, 23, 44, 90, 400].map((days) => fallOf(days, 14));
    for (let i = 1; i < pulls.length; i++) expect(pulls[i]).toBeGreaterThan(pulls[i - 1]);
    expect(pulls[pulls.length - 1]).toBeLessThanOrEqual(1);
  });

  it('follows the threshold it is given', () => {
    expect(fallOf(10, 7)).toBeGreaterThan(0);
    expect(fallOf(10, 30)).toBe(0);
  });

  it('leaves a star with no pull where it was laid out', () => {
    const home = { x: HOLE.x + 900, y: HOLE.y - 300, z: 120 };
    expect(placeByHole(home, 0)).toEqual(home);
  });

  it('draws a falling star inward along a spiral', () => {
    const home = { x: HOLE.x + 900, y: HOLE.y, z: 120 };
    const half = placeByHole(home, 0.5);
    const full = placeByHole(home, 1);
    expect(distance(half)).toBeLessThan(distance(home));
    expect(distance(full)).toBeLessThan(distance(half));
    // It turns about the hole as it falls, rather than dropping straight in.
    expect(Math.abs(half.y - HOLE.y)).toBeGreaterThan(1);
    expect(Math.abs(full.z)).toBeLessThan(Math.abs(home.z));
  });

  it('never brings a star closer than the floor, so none vanishes', () => {
    for (const reach of [FALL_FLOOR + 1, 600, 2400]) {
      const placed = placeByHole({ x: HOLE.x - reach, y: HOLE.y, z: 0 }, 1);
      expect(distance(placed)).toBeGreaterThanOrEqual(FALL_FLOOR - 1e-6);
    }
  });

  it('keeps every star clear of the hole itself', () => {
    expect(distance(placeByHole({ x: HOLE.x, y: HOLE.y, z: 0 }, 0))).toBeCloseTo(HOLE_CLEAR);
    expect(distance(placeByHole({ x: HOLE.x + 20, y: HOLE.y, z: 0 }, 0.8))).toBeCloseTo(HOLE_CLEAR);
  });

  it('nudges a fallen star off one it landed on, leaving stars that do not fall alone', () => {
    const still = { x: HOLE.x + 500, y: HOLE.y, pull: 0 };
    const fallen = { x: HOLE.x + 510, y: HOLE.y, pull: 0.6 };
    const far = { x: HOLE.x - 900, y: HOLE.y, pull: 0.4 };
    keepApart([still, fallen, far], (p) => p.pull);

    expect(still).toEqual({ x: HOLE.x + 500, y: HOLE.y, pull: 0 });
    expect(Math.hypot(fallen.x - still.x, fallen.y - still.y)).toBeGreaterThanOrEqual(
      FALLEN_GAP - 1e-6,
    );
    expect(far).toEqual({ x: HOLE.x - 900, y: HOLE.y, pull: 0.4 });
  });

  it('never nudges a fallen star past the floor', () => {
    const outer = { x: HOLE.x, y: HOLE.y - FALL_FLOOR - 10, pull: 0.2 };
    const inner = { x: HOLE.x, y: HOLE.y - FALL_FLOOR, pull: 0.9 };
    keepApart([outer, inner], (p) => p.pull);

    expect(Math.hypot(inner.x - HOLE.x, inner.y - HOLE.y)).toBeGreaterThanOrEqual(
      FALL_FLOOR - 1e-6,
    );
  });

  it('reddens a falling star a little, so its bucket colour still reads', () => {
    expect(redshift('#6fd4ff', 0)).toBe('#6fd4ff');
    const full = redshift('#6fd4ff', 1);
    expect(full).toMatch(/^#[0-9a-f]{6}$/);
    expect(full).not.toBe('#6fd4ff');
    // Blue stays the strongest channel: the bucket is still recognisably blue.
    const [r, , b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
  });
});
