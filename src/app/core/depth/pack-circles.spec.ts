import { packCircles } from './pack-circles';

const GAP = 2;

function overlaps(radii: number[], gap: number): boolean {
  const spots = packCircles(radii, gap);
  return spots.some((a, i) =>
    spots.some(
      (b, j) => j > i && Math.hypot(a.x - b.x, a.y - b.y) < radii[i] + radii[j] + gap - 1e-9,
    ),
  );
}

describe('packCircles', () => {
  it('puts a lone circle at the origin', () => {
    expect(packCircles([9], GAP)).toEqual([{ x: 0, y: 0 }]);
  });

  it('puts the largest at the origin, whatever order they come in', () => {
    const spots = packCircles([3, 12, 5], GAP);

    expect(spots[1]).toEqual({ x: 0, y: 0 });
  });

  it('leaves no two circles touching, with the gap between them', () => {
    const radii = Array.from({ length: 60 }, (_, i) => 2 + ((i * 7) % 23));

    expect(overlaps(radii, GAP)).toBe(false);
  });

  it('keeps a crowd of equal circles close round the first, not strung out', () => {
    const spots = packCircles(
      Array.from({ length: 30 }, () => 5),
      GAP,
    );
    const farthest = Math.max(...spots.map(({ x, y }) => Math.hypot(x, y)));

    expect(farthest).toBeLessThan(5 * 2 * 4);
  });

  it('packs the same input the same way every time', () => {
    const radii = [4, 9, 4, 7, 9];

    expect(packCircles(radii, GAP)).toEqual(packCircles(radii, GAP));
  });

  it('packs nothing into nothing', () => {
    expect(packCircles([], GAP)).toEqual([]);
  });
});
