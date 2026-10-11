import { OrreryCamera } from '../../../core/orrery/orrery-camera';
import { ShippedItem } from '../../../core/orrery/shipped';
import { FLIGHT_S, LAUNCH_LAG_S } from '../../../core/orrery/merge-arrival';
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

describe('ShippedLayer arrivals', () => {
  const moving = { ...frame, isStill: false } as SceneFrame;
  const home = { key: 'o/app', x: 300, y: 400, radius: 20 };
  const colour = () => '1, 2, 3';

  function setUp() {
    const layer = new ShippedLayer();
    const merged = item(9, 0);
    layer.set([merged], NOW);
    layer.arrive(merged);
    return { layer, merged };
  }

  it('sets a new merge off from its world, and shows its speck only once it has landed', () => {
    const { layer } = setUp();
    const arcs: [number, number][] = [];

    const launches = layer.draw(recordingContext(arcs), moving, 100, [home], colour);

    expect(launches).toHaveLength(1);
    expect(launches[0].repo).toBe('o/app');
    expect(launches[0].fromX).toBe(300);
    expect(layer.pick(launches[0].toX, 0)).toBeNull();

    // Mid-flight it is drawn on its way, but is not yet something to point at.
    layer.draw(recordingContext(arcs), moving, 100 + LAUNCH_LAG_S + FLIGHT_S / 2, [home], colour);
    expect(arcs.length).toBeGreaterThan(0);
    expect(layer.pick(launches[0].toX, 0)).toBeNull();

    const landed: [number, number][] = [];
    layer.draw(
      recordingContext(landed),
      moving,
      100 + LAUNCH_LAG_S + FLIGHT_S + 0.1,
      [home],
      colour,
    );
    const [x, y] = landed[0];
    expect(layer.pick(x, y)?.key).toBe('o/app#9');
  });

  it('launches each merge once', () => {
    const { layer } = setUp();
    layer.draw(recordingContext([]), moving, 100, [home], colour);

    expect(layer.draw(recordingContext([]), moving, 100.5, [home], colour)).toEqual([]);
  });

  it('just shows the speck, with no flight, when motion is off or its world is not in view', () => {
    const still = setUp();
    expect(still.layer.draw(recordingContext([]), frame, 100, [home], colour)).toEqual([]);

    const away = setUp();
    expect(away.layer.draw(recordingContext([]), moving, 100, [], colour)).toEqual([]);
    const arcs: [number, number][] = [];
    away.layer.draw(recordingContext(arcs), moving, 110, [], colour);
    expect(arcs.length).toBeGreaterThan(0);
  });
});
