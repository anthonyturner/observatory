import { SkyFrame } from '../engine/sky-frame';
import { EMBER_SPAN_S } from './closed-ember';
import { RESOLVED_SPARK, UNRESOLVED_SPARK } from './comment-sparks';
import { EMPTY_SYSTEM } from './departure';
import { exitBeat } from './exits';
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

describe('NewsLayer on review-thread sparks', () => {
  const sparked = (kind: NewsEvent['kind'], startAt: number): NewsEvent => ({
    ...merge(startAt),
    kind,
    departure: {
      system: EMPTY_SYSTEM,
      ending: {
        fate: 'merged',
        how: 'merge',
        threads: { resolved: 2, unresolved: 3 },
        closes: null,
      },
    },
  });
  const layerOf = (...events: NewsEvent[]): NewsLayer => {
    const layer = new NewsLayer();
    layer.news = { events, acknowledged: false };
    return layer;
  };
  const during = (event: NewsEvent): number => (exitBeat(event, 'begin') ?? 0) + 0.8;

  it('hands the 3D scene the sparks in the air, timed from the exit’s beats', () => {
    const event = sparked('merged', 10);
    const layer = layerOf(event);

    const end = exitBeat(event, 'end') ?? 0;

    expect(layer.effects3D(frame(end - 0.01, false))[0].sparks).toEqual([]);
    expect(layer.effects3D(frame(during(event), false))[0].sparks?.length).toBeGreaterThan(0);
  });

  it('shows none with motion off, or for a pull request with no threads to show', () => {
    const event = sparked('closed', 10);

    expect(layerOf(event).effects3D(frame(during(event), true))[0].sparks).toEqual([]);
    expect(layerOf(merge(10)).effects3D(frame(during(merge(10)), false))[0].sparks).toEqual([]);
  });

  it('draws them on the 2D sky in red and gold, and not at all with motion off', () => {
    const event = sparked('squashed', 10);
    const inks = (frozen: boolean): string[] => {
      const painted: string[] = [];
      const ctx = new Proxy(
        { fillStyle: '' },
        {
          get: (target, name) =>
            name === 'fill'
              ? () => painted.push(target.fillStyle)
              : name in target
                ? target[name as 'fillStyle']
                : () => undefined,
          set: (target, name, value) => {
            (target as Record<string, unknown>)[name as string] = value;
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      const f = {
        ...frame(during(event), frozen),
        renderer: 'canvas',
        camera: { current: { scale: 1 } },
        toScreen: (x: number, y: number) => [x, y],
      } as unknown as SkyFrame;
      layerOf(event).above(ctx, f);
      return painted;
    };

    const moving = inks(false);
    expect(moving).toContain(UNRESOLVED_SPARK);
    expect(moving).toContain(RESOLVED_SPARK);
    expect(inks(true)).not.toContain(UNRESOLVED_SPARK);
  });
});
