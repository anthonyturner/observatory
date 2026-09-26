import { seededRandom } from '../instrument/seeded-random';
import { burning, layoutLogs } from './log-layout';
import { LOG_FIXTURE, TEST_PALETTE } from './testing/log-fixture';

// The expected numbers are what pr-starmap's own layoutLogs() and makeStar()
// give for LOG_FIXTURE, so a drift from its sky fails here.

describe('layoutLogs', () => {
  const layout = layoutLogs(LOG_FIXTURE, TEST_PALETTE);

  it('puts the worst window at the centre and rings the rest from twelve o’clock', () => {
    expect(
      layout.clusters.map(({ cx, cy, z, labelY, label, sub, colour }) => ({
        cx,
        cy,
        z,
        labelY,
        label,
        sub,
        colour,
      })),
    ).toEqual([
      {
        cx: 1800,
        cy: 1000,
        z: -190,
        labelY: 1116.162445840514,
        label: 'desktop',
        sub: '1,000 LINES · 5 ERR · 2 WARN',
        colour: 'red',
      },
      {
        cx: 1800,
        cy: 180,
        z: -95,
        labelY: 238,
        label: 'ally ult tracker',
        sub: '300 LINES · 2 ERR · 0 WARN',
        colour: 'red',
      },
      {
        cx: 3099.0381056766582,
        cy: 1410,
        z: 0,
        labelY: 1468,
        label: 'hero lookup',
        sub: '150 LINES · 0 ERR · 10 WARN',
        colour: 'amber',
      },
      {
        cx: 500.9618943233422,
        cy: 1410.0000000000002,
        z: 95,
        labelY: 1468.0000000000002,
        label: 'ban list',
        sub: '49 LINES · 0 ERR · 0 WARN',
        colour: 'green',
      },
    ]);
  });

  it('leaves out a window whose faults all fell past the cap', () => {
    expect(layout.clusters.some((cluster) => cluster.win.id === 'capped')).toBe(false);
  });

  it('winds each window’s faults out from its loudest, as pr-starmap places them', () => {
    expect(
      layout.stars.map(({ kind, key, urgent, tag, x, y, mag, driftRadius }) => ({
        kind,
        key,
        urgent,
        tag,
        x,
        y,
        mag,
        driftRadius,
      })),
    ).toEqual([
      {
        kind: 'fault',
        key: 'error',
        urgent: true,
        tag: '×4',
        x: 1804.346775403712,
        y: 995.8739830884151,
        mag: 7.911663380285988,
        driftRadius: 10.71508495181978,
      },
      {
        kind: 'fault',
        key: 'error',
        urgent: false,
        tag: '×1',
        x: 1742.449747938877,
        y: 1025.4599135595208,
        mag: 5.4,
        driftRadius: 8.6,
      },
      {
        kind: 'fault',
        key: 'warn',
        urgent: true,
        tag: '×2',
        x: 1814.4214150028088,
        y: 944.7366644624198,
        mag: 6.511428751370197,
        driftRadius: 9.53594000115385,
      },
      {
        kind: 'fault',
        key: 'error',
        urgent: false,
        tag: '×2',
        x: 1801.068980062846,
        y: 186.04771065944806,
        mag: 6.511428751370197,
        driftRadius: 9.53594000115385,
      },
      {
        kind: 'fault',
        key: 'warn',
        urgent: true,
        tag: '×10',
        x: 3105.0128038700295,
        y: 1414.9572345395572,
        mag: 10.072920075410865,
        driftRadius: 12.535090589819676,
      },
      {
        kind: 'quiet',
        key: 'quiet',
        urgent: false,
        tag: '',
        x: 500.9618943233422,
        y: 1410.0000000000002,
        mag: 7.386313713864835,
        driftRadius: 10,
      },
    ]);
  });

  it('seeds each star so its motion draws are pr-starmap’s', () => {
    // makeStar draws twinkle first, spin seventh and depth eighth.
    const draws = layout.stars.map((star) => {
      const random = seededRandom(star.seed);
      const values = Array.from({ length: 8 }, () => random());
      return { twinkle: values[0] * Math.PI * 2, spin: values[6] * Math.PI, depth: values[7] };
    });

    expect(draws[0].twinkle).toBeCloseTo(3.848767841200606, 12);
    expect(draws[0].spin).toBeCloseTo(2.0094870147429127, 12);
    expect(-190 + (draws[0].depth - 0.5) * 150).toBeCloseTo(-188.89535607071593, 9);
    expect(draws[5].twinkle).toBeCloseTo(1.2723839362181726, 12);
    expect(95 + (draws[5].depth - 0.5) * 150).toBeCloseTo(94.60758922388777, 9);
  });

  it('draws nothing without a snapshot', () => {
    expect(layoutLogs(null, TEST_PALETTE)).toEqual({ clusters: [], stars: [] });
  });
});

describe('burning', () => {
  it('holds while a fault fired within three days of the newest line', () => {
    const [recent, older] = LOG_FIXTURE.faults.filter((fault) => fault.window !== 'hero_lookup');
    expect(burning(LOG_FIXTURE, recent)).toBe(true);
    expect(burning(LOG_FIXTURE, older)).toBe(false);
  });
});
