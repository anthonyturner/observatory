import { SkyFrame } from '../engine/sky-frame';
import { issuePlanets } from '../engine/star-system';
import { EMBER_SPAN_S } from './closed-ember';
import { EMPTY_SYSTEM, endingOf } from './departure';
import { PRELUDE_S } from './departure-exit';
import { MERGE_SPAN_S } from './merge-supernova';
import { NewsEvent } from './news';
import { NewsLayer } from './news-layer';
import { SQUASH_SPAN_S } from './squash-collapse';

const merge = (startAt: number): NewsEvent => ({
  kind: 'merged',
  pr: 7,
  title: 'x',
  bucket: 'unreviewed',
  startAt,
  fromX: 1,
  fromY: 2,
  fromZ: 3,
});

const frame = (wall: number, frozen: boolean): SkyFrame =>
  ({ chart: 'prs', stars: [], wall, frozen }) as unknown as SkyFrame;

describe('NewsLayer on a merge', () => {
  const layer = new NewsLayer();
  layer.news = {
    events: [merge(10), { ...merge(10), kind: 'blocked', onStar: true } as NewsEvent],
    acknowledged: false,
  };

  it('plays the supernova in 3D as a merged burst at its departure point', () => {
    const [burst] = layer.effects3D(frame(10.2, false));

    expect(burst.mode).toBe('merged');
    expect(burst.still).toBe(false);
    expect(burst.from).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('still plays when motion is off, as a flash, where other bursts are skipped', () => {
    const modes = layer.effects3D(frame(10.2, true)).map((burst) => [burst.mode, burst.still]);

    expect(modes).toEqual([['merged', true]]);
  });

  it('keeps a still sky drawing until the merge has played', () => {
    expect(layer.animating(9)).toBe(true);
    expect(layer.animating(10 + MERGE_SPAN_S - 0.1)).toBe(true);
    expect(layer.animating(10 + MERGE_SPAN_S)).toBe(false);
  });
});

describe('NewsLayer on a squash and a close', () => {
  const squash = (startAt: number): NewsEvent => ({ ...merge(startAt), kind: 'squashed' });
  const close = (startAt: number): NewsEvent => ({ ...merge(startAt), kind: 'closed' });
  const layer = new NewsLayer();
  layer.news = { events: [squash(10), close(10)], acknowledged: false };

  it('plays each in 3D as its own burst at its departure point', () => {
    const bursts = layer.effects3D(frame(10.2, false));

    expect(bursts.map((burst) => burst.mode)).toEqual(['squashed', 'closed']);
    expect(bursts.every((burst) => burst.from.x === 1 && !burst.still)).toBe(true);
  });

  it('still plays both when motion is off, as the merge nova does', () => {
    const bursts = layer.effects3D(frame(10.2, true));

    expect(bursts.map((burst) => [burst.mode, burst.still])).toEqual([
      ['squashed', true],
      ['closed', true],
    ]);
  });

  it('keeps a still sky drawing until each has played', () => {
    const longest = Math.max(SQUASH_SPAN_S, EMBER_SPAN_S);

    expect(layer.animating(10 + longest - 0.1)).toBe(true);
    expect(layer.animating(10 + longest)).toBe(false);
  });
});

describe('NewsLayer on the company of a leaving star', () => {
  const withPlanet: NewsEvent = {
    ...merge(10),
    departure: {
      system: { ...EMPTY_SYSTEM, planets: issuePlanets({ item: { issues: [3] } as never }) },
      ending: endingOf('merged'),
    },
  };
  const circles = (events: NewsEvent[], chart: string, wall: number): number => {
    const layer = new NewsLayer();
    layer.news = { events, acknowledged: false };
    let drawn = 0;
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      fill: () => undefined,
      arc: () => void drawn++,
      createRadialGradient: () => ({ addColorStop: () => undefined }),
    } as unknown as CanvasRenderingContext2D;
    const f = {
      chart,
      wall,
      frozen: false,
      camera: { current: { scale: 1 } },
      toScreen: (x: number, y: number) => [x, y],
    } as unknown as SkyFrame;

    layer.flat(ctx, f);
    return drawn;
  };

  it('draws it before the star goes, on the queue sky', () => {
    expect(circles([withPlanet], 'prs', 10.2)).toBeGreaterThan(0);
  });

  it('draws nothing once the star is going, or on another sky', () => {
    expect(circles([withPlanet], 'prs', 10 + PRELUDE_S)).toBe(0);
    expect(circles([withPlanet], 'logs', 10.2)).toBe(0);
  });

  it('draws nothing for news that is no exit, though it carries a departure', () => {
    expect(circles([{ ...withPlanet, kind: 'left' }], 'prs', 10.2)).toBe(0);
  });
});
