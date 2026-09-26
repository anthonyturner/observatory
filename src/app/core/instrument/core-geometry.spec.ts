import { Bead } from './beads';
import { PlacedBead, beadAt } from './core-geometry';

const bead = (key: string): Bead => ({ key }) as Bead;
const placed = (key: string, x: number, y: number, radius = 4): PlacedBead => ({
  bead: bead(key),
  x,
  y,
  radius,
});

describe('beadAt', () => {
  const beads = [placed('a', 100, 100), placed('b', 130, 100)];

  it('finds the bead under the point', () => {
    expect(beadAt(beads, 102, 101)?.key).toBe('a');
  });

  it('prefers the nearer of two in reach', () => {
    expect(beadAt(beads, 120, 100)?.key).toBe('b');
  });

  it('gives a small bead a target big enough for a finger', () => {
    expect(beadAt([placed('tiny', 0, 0, 1)], 11, 0)?.key).toBe('tiny');
  });

  it('finds nothing away from every bead, or at no point', () => {
    expect(beadAt(beads, 300, 300)).toBeNull();
    expect(beadAt(beads, Number.NaN, Number.NaN)).toBeNull();
  });
});
