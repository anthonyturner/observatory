import { SkyFrame } from '../engine/sky-frame';
import { MERGE_SPAN_S } from './merge-supernova';
import { NewsEvent } from './news';
import { NewsLayer } from './news-layer';

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
