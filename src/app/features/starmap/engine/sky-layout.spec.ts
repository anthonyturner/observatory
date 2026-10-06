import { HOLE } from './black-hole';
import { SkyLayout, buildField, carryOver, layoutQueue } from './sky-layout';
import { SkyItem } from './sky-model';

const item = (
  pr: number,
  bucket: SkyItem['bucket'],
  idleDays: number,
  additions: number | null,
  deletions: number | null,
): SkyItem => ({ pr, title: String(pr), bucket, idleDays, additions, deletions, issues: [] });

const QUEUE = [
  item(58, 'conflicted', 49, 96, 95),
  item(85, 'conflicted', 53, 500, 28),
  item(537, 'unknown', 3, null, null),
  item(195, 'unreviewed', 34, 12, 3),
];

/** The closest any two stars of one constellation sit. */
const closestPair = (stars: readonly { x: number; y: number }[]): number => {
  let closest = Infinity;
  stars.forEach((a, i) =>
    stars
      .slice(i + 1)
      .forEach((b) => (closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y)))),
  );
  return closest;
};

const BLOCKED = Array.from({ length: 30 }, (_, i) => item(1000 + i, 'conflicted', i * 2, 40, 10));

describe('layoutQueue', () => {
  it('keeps stars of a crowded constellation a clear gap apart', () => {
    const sky = new SkyLayout();
    layoutQueue([...BLOCKED, ...QUEUE], sky);

    for (const cluster of sky.clusters) {
      if (cluster.stars.length > 1) expect(closestPair(cluster.stars)).toBeGreaterThan(80);
    }
  });

  it('gives each constellation its own stretch of sky', () => {
    const sky = new SkyLayout();
    layoutQueue([...BLOCKED, ...QUEUE], sky);

    const spans = sky.clusters.map((c) => [
      Math.min(...c.stars.map((s) => s.x)),
      Math.max(...c.stars.map((s) => s.x)),
    ]);
    spans.slice(1).forEach(([left], i) => expect(left).toBeGreaterThan(spans[i][1] + 150));
  });

  it('puts every star in the same place on every load, brighter the longer it has sat', () => {
    const [a, b] = [new SkyLayout(), new SkyLayout()];
    layoutQueue(QUEUE, a);
    layoutQueue(QUEUE, b);

    expect(a.stars.map((s) => [s.x, s.y, s.z])).toEqual(b.stars.map((s) => [s.x, s.y, s.z]));
    const mag = (pr: number) => a.stars.find((s) => s.item?.pr === pr)?.mag ?? 0;
    expect(mag(85)).toBeGreaterThan(mag(537));
  });

  it('makes one constellation per bucket in use, labelled as pr-starmap labels it', () => {
    const sky = new SkyLayout();
    layoutQueue(QUEUE, sky);

    expect(sky.clusters.map((c) => [c.label, c.sub])).toEqual([
      ['Aporia', 'CANNOT MERGE · 2'],
      ['Nebulosa', 'MERGEABILITY UNKNOWN · 1'],
      ['Vigilia', 'WAITING ON YOU · 1'],
    ]);
    expect(sky.stars.find((s) => s.item?.pr === 195)?.quick).toBe(true);
    expect(sky.stars.find((s) => s.item?.pr === 58)?.urgent).toBe(true);
  });

  it('draws only pull requests idle past the threshold toward the black hole', () => {
    const [free, held] = [new SkyLayout(), new SkyLayout()];
    layoutQueue(QUEUE, free);
    layoutQueue(QUEUE, held, 14);
    const star = (sky: SkyLayout, pr: number) => sky.stars.find((s) => s.item?.pr === pr);
    const toHole = (pr: number, sky: SkyLayout): number => {
      const s = star(sky, pr);
      return s ? Math.hypot(s.x - HOLE.x, s.y - HOLE.y) : NaN;
    };

    expect(toHole(85, held)).toBeLessThan(toHole(85, free));
    expect(star(held, 85)?.ax).toBe(star(held, 85)?.x);
    expect(star(held, 85)?.colour).not.toBe(star(free, 85)?.colour);
    expect([star(held, 537)?.x, star(held, 537)?.colour]).toEqual([
      star(free, 537)?.x,
      star(free, 537)?.colour,
    ]);
  });
});

describe('buildField', () => {
  it("is mostly faint stars and a few bright ones, within each layer's limits", () => {
    const field = buildField();
    const faint = field.filter((s) => s.a < 0.15).length;
    const bright = field.filter((s) => s.a > 0.3).length;

    expect(faint).toBeGreaterThan(bright * 3);
    for (const s of field) {
      expect(s.a).toBeLessThanOrEqual(0.55);
      expect(s.r).toBeLessThanOrEqual(1.6);
    }
  });

  it('is the same field every time: 520 far stars and 220 near ones', () => {
    const [a, b] = [buildField(), buildField()];
    expect(a.length).toBe(740);
    expect(a[0]).toEqual(b[0]);
  });
});

describe('carryOver', () => {
  it('lets a star already shown glide from where it was, and newcomers arrive in turn', () => {
    const before = new SkyLayout();
    layoutQueue(QUEUE.slice(0, 2), before);
    before.stars[0].ax = 11;
    const after = new SkyLayout();
    layoutQueue(QUEUE, after);

    carryOver(before.stars, after.stars, 100);

    const kept = after.stars.find((s) => s.item?.pr === 58);
    expect(kept?.fromX).toBe(11);
    expect(kept?.moveAt).toBe(100);
    expect(after.stars.find((s) => s.item?.pr === 537)?.delay).toBe(0.2);
    expect(after.stars.find((s) => s.item?.pr === 195)?.delay).toBeCloseTo(0.28);
  });
});
