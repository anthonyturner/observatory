import { Satellite } from '../../../core/live-agents/satellites';
import { SatelliteLayer, isLit, lanesOf, orbitOffset, parkingPoint } from './satellite-layer';
import { SkyFrame } from './sky-frame';

const mark = (
  key: string,
  pr: number | null,
  state: Satellite['state'] = 'working',
): Satellite => ({
  key,
  name: `agent ${key}`,
  state,
  pr,
  stateText: 'Working',
});
const SOLO = { index: 0, count: 1 };

describe('lanesOf', () => {
  it('numbers the satellites round one star apart from those at another or parked', () => {
    const lanes = lanesOf([
      { key: 'a', host: 7 },
      { key: 'b', host: null },
      { key: 'c', host: 7 },
      { key: 'd', host: null },
    ]);

    expect(lanes.get('a')).toEqual({ index: 0, count: 2 });
    expect(lanes.get('c')).toEqual({ index: 1, count: 2 });
    expect(lanes.get('b')).toEqual({ index: 0, count: 2 });
    expect(lanes.get('d')).toEqual({ index: 1, count: 2 });
  });
});

describe('orbitOffset', () => {
  it('circles the star, tilted, at the orbit’s reach', () => {
    const early = orbitOffset(SOLO, 40, 0, false);
    const later = orbitOffset(SOLO, 40, 3, false);

    expect(early.dx).toBeCloseTo(40);
    expect(later.dx).not.toBeCloseTo(early.dx);
    expect(Math.hypot(later.dx, later.dy / 0.4)).toBeCloseTo(40);
  });

  it('holds one place when motion is off, and spreads a star’s satellites round it', () => {
    expect(orbitOffset(SOLO, 40, 0, true)).toEqual(orbitOffset(SOLO, 40, 90, true));

    const first = orbitOffset({ index: 0, count: 2 }, 40, 0, true);
    const second = orbitOffset({ index: 1, count: 2 }, 40, 0, true);
    expect(Math.hypot(first.dx - second.dx, first.dy - second.dy)).toBeGreaterThan(40);
  });
});

describe('parkingPoint', () => {
  const clear = { width: 1000, top: 100 };

  it('keeps every parked satellite across the top of the free sky', () => {
    for (const index of [0, 1, 2, 3]) {
      const { x, y } = parkingPoint({ index, count: 4 }, clear, 12, false);
      expect(x).toBeGreaterThan(100);
      expect(x).toBeLessThan(900);
      expect(y).toBeGreaterThanOrEqual(100);
      expect(y).toBeLessThan(140);
    }
  });

  it('holds still when motion is off', () => {
    const lane = { index: 1, count: 3 };

    expect(parkingPoint(lane, clear, 0, true)).toEqual(parkingPoint(lane, clear, 500, true));
  });
});

describe('isLit', () => {
  it('blinks faster for a working agent than a quiet one', () => {
    const blinks = (state: Satellite['state']): number => {
      let changes = 0;
      let before = isLit(state, 0, false, 0);
      for (let ms = 50; ms <= 12_000; ms += 50) {
        const now = isLit(state, ms / 1000, false, 0);
        if (now !== before) changes++;
        before = now;
      }
      return changes;
    };

    expect(blinks('working')).toBeGreaterThan(blinks('waiting'));
    expect(blinks('waiting')).toBeGreaterThan(blinks('quiet'));
  });

  it('stays lit, never blinking, when motion is off', () => {
    for (let t = 0; t < 10; t += 0.37) expect(isLit('working', t, true, 0)).toBe(true);
  });
});

const STILL = { t: 0, frozen: true };

const fakeFrame = (
  chart: SkyFrame['chart'] = 'prs',
  pr: number | null = null,
  { t, frozen } = STILL,
): SkyFrame =>
  ({
    width: 1000,
    height: 700,
    t,
    frozen,
    chart,
    stars: pr === null ? [] : [{ item: { pr }, mag: 6, ax: 0, ay: 0, az: 0 }],
    camera: { current: { scale: 1 } },
    toScreen: () => [200, 400],
  }) as unknown as SkyFrame;

/** Takes every drawing call and ignores it. */
function fakeCanvas(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const calls: Record<string, unknown> = {
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 80 }),
  };
  return new Proxy(calls, {
    get: (target, name) => target[String(name)] ?? (() => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

describe('SatelliteLayer', () => {
  const layer = (): SatelliteLayer => new SatelliteLayer(() => ({ side: 0, top: 100 }));

  it('pans a satellite by where it was drawn, and nothing before it is drawn', () => {
    const sky = layer();
    sky.set([mark('a', null)]);
    expect(sky.heardOf('a').pan).toBe(0);

    sky.flat(fakeCanvas(), fakeFrame());

    expect(sky.heardOf('a').pan).toBeCloseTo(0.8);
  });

  it('shifts a satellite up while its orbit brings it toward you, and down while it takes it away', () => {
    const heard = (from: number): number => {
      const sky = layer();
      sky.set([mark('a', 7)]);
      sky.flat(fakeCanvas(), fakeFrame('prs', 7, { t: from, frozen: false }));
      sky.flat(fakeCanvas(), fakeFrame('prs', 7, { t: from + 0.1, frozen: false }));
      return sky.heardOf('a').doppler;
    };
    const farSide = -Math.PI / 0.32;

    expect(heard(0)).toBeGreaterThan(1);
    expect(heard(farSide)).toBeLessThan(1);
    expect(heard(0)).toBeLessThan(2 ** (3 / 12) + 1e-9);
  });

  it('shifts nothing when motion is off, on a first frame, or after a stall', () => {
    const sky = layer();
    sky.set([mark('a', 7)]);

    sky.flat(fakeCanvas(), fakeFrame('prs', 7, { t: 0, frozen: false }));
    expect(sky.heardOf('a').doppler).toBe(1);

    sky.flat(fakeCanvas(), fakeFrame('prs', 7, { t: 30, frozen: false }));
    expect(sky.heardOf('a').doppler).toBe(1);

    sky.flat(fakeCanvas(), fakeFrame('prs', 7, { t: 30.1, frozen: false }));
    expect(sky.heardOf('a').doppler).not.toBe(1);

    sky.flat(fakeCanvas(), fakeFrame('prs', 7, { t: 30.2, frozen: true }));
    expect(sky.heardOf('a').doppler).toBe(1);
  });

  it('names a satellite under the pointer, and says when that changed', () => {
    const sky = layer();
    sky.set([mark('a', null)]);
    sky.flat(fakeCanvas(), fakeFrame());
    const { x, y } = parkingPoint({ index: 0, count: 1 }, { width: 1000, top: 100 }, 0, true);

    expect(sky.hoverAt({ x: x + 2, y })).toBe(true);
    expect(sky.hoverAt({ x: x + 3, y })).toBe(false);
    expect(sky.isHovering).toBe(true);
    expect(sky.hoverAt({ x: x + 200, y })).toBe(true);
    expect(sky.isHovering).toBe(false);
    expect(sky.hoverAt({ x, y })).toBe(true);
    expect(sky.hoverAt(null)).toBe(true);
    expect(sky.isHovering).toBe(false);
  });

  it('orbits its pull request’s star, but parks when that star is not in the sky', () => {
    const sky = layer();
    sky.set([mark('a', 7)]);

    sky.flat(fakeCanvas(), fakeFrame('prs', 7));
    const near = sky.heardOf('a').pan;
    sky.flat(fakeCanvas(), fakeFrame('prs', 9));

    expect(near).toBeCloseTo(-0.6, 0);
    expect(sky.heardOf('a').pan).toBeCloseTo(0.8);
  });

  it('draws nothing off the pull request chart', () => {
    const sky = layer();
    sky.set([mark('a', null)]);

    sky.flat(fakeCanvas(), fakeFrame('logs'));

    expect(sky.heardOf('a')).toEqual({ pan: 0, doppler: 1 });
  });
});
