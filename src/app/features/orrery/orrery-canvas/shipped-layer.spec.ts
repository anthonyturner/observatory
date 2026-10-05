import { OrreryCamera } from '../../../core/orrery/orrery-camera';
import { ShippedItem } from '../../../core/orrery/shipped';
import { SceneFrame } from './orrery-scene';
import { ShippedLayer, placeShipped } from './shipped-layer';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const DAY = 86_400_000;
const item = (n: number, daysAgo: number, repo = 'o/app'): ShippedItem => ({
  key: `${repo}#${n}`,
  repo,
  number: n,
  title: `Ship ${n}`,
  at: NOW - daysAgo * DAY,
});

describe('placeShipped', () => {
  it('runs from the oldest at one end of the band to the newest at the other', () => {
    const places = placeShipped([item(1, 30), item(2, 15), item(3, 0)], NOW);
    const along = (n: number) => places.find((p) => p.item.number === n)?.u ?? 0;

    expect(along(1)).toBeLessThan(along(2));
    expect(along(2)).toBeLessThan(along(3));
    for (const place of places) expect(Math.abs(place.v)).toBeLessThanOrEqual(0.08);
  });

  it('keeps every speck in the same place on every load', () => {
    const items = Array.from({ length: 30 }, (_, i) => item(i + 1, i));
    expect(placeShipped(items, NOW)).toEqual(placeShipped(items, NOW));
  });
});

/** A 2D context that records where circles go and draws nothing. */
function recordingContext(arcs: [number, number][]): CanvasRenderingContext2D {
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, name) =>
      name === 'createRadialGradient'
        ? () => ({ addColorStop: () => undefined })
        : name === 'measureText'
          ? () => ({ width: 40 })
          : name === 'arc'
            ? (x: number, y: number) => arcs.push([x, y])
            : () => undefined,
    set: () => true,
  });
}

const frame = {
  view: { width: 1600, height: 900 },
  camera: { current: { x: 0, y: 0, scale: 1 } } as OrreryCamera,
  time: 0,
  sinceShown: 10,
  isStill: true,
  selectedKey: null,
} as SceneFrame;

describe('ShippedLayer', () => {
  it('finds a speck where it drew it', () => {
    const layer = new ShippedLayer();
    layer.set([item(4, 2)], NOW);
    const arcs: [number, number][] = [];

    layer.draw(recordingContext(arcs), frame, 0, [], () => '200, 220, 255');
    const [x, y] = arcs[0];

    expect(layer.pick(x + 2, y)?.key).toBe('o/app#4');
    expect(layer.pick(x + 30, y + 30)).toBeNull();
  });

  it('leaves out a speck a world sits in front of', () => {
    const layer = new ShippedLayer();
    layer.set([item(4, 2)], NOW);
    const arcs: [number, number][] = [];
    layer.draw(recordingContext(arcs), frame, 0, [], () => '1, 2, 3');
    const [x, y] = arcs[0];

    layer.draw(recordingContext([]), frame, 0, [{ key: 'w', x, y, radius: 20 }], () => '1, 2, 3');

    expect(layer.pick(x, y)).toBeNull();
  });
});
