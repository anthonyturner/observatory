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

/* pr-starmap's own layoutQueue, run on the same queue (assets/dashboard.html). */
const PR_STARMAP = [
  { pr: 58, x: 724.714, y: 773.827, z: -221.956, mag: 17, spin: 2.6185, delay: 0.1, drift: 29.58 },
  {
    pr: 85,
    x: 1262.651,
    y: 731.086,
    z: -243.028,
    mag: 17,
    spin: 1.2898,
    delay: 0.135,
    drift: 31.26,
  },
  {
    pr: 537,
    x: 1780.253,
    y: 1084.754,
    z: -124.949,
    mag: 8.503,
    spin: 0.7076,
    delay: 0.17,
    drift: 10.26,
  },
  {
    pr: 195,
    x: 2732.823,
    y: 627.948,
    z: -121.156,
    mag: 17,
    spin: 0.3412,
    delay: 0.205,
    drift: 23.28,
  },
];

describe('layoutQueue', () => {
  it('places every star exactly where pr-starmap does', () => {
    const sky = new SkyLayout();
    layoutQueue(QUEUE, sky);

    expect(
      sky.stars.map((s) => ({
        pr: s.item?.pr,
        x: +s.x.toFixed(3),
        y: +s.y.toFixed(3),
        z: +s.z.toFixed(3),
        mag: +s.mag.toFixed(3),
        spin: +s.spin.toFixed(4),
        delay: +s.delay.toFixed(3),
        drift: +s.driftRadius.toFixed(3),
      })),
    ).toEqual(PR_STARMAP);
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
});

describe('buildField', () => {
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
