import { DoneItem } from '../../../core/queue/done-work';
import { CameraController } from './camera-controller';
import { DoneLayer, isDoneHit, labelLeft } from './done-layer';
import { SkyFrame } from './sky-frame';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const item: DoneItem = {
  key: 'pr12',
  kind: 'merged',
  number: 12,
  title: 'Ship the dial',
  at: NOW - 86_400_000 * 3,
  day: '2026-10-02',
};

/** A 2D context that records nothing: the layer's geometry is what is under test. */
const quietContext = (): CanvasRenderingContext2D =>
  new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, name) =>
      name === 'createRadialGradient'
        ? () => ({ addColorStop: () => undefined })
        : name === 'measureText'
          ? () => ({ width: 40 })
          : () => undefined,
    set: () => true,
  });

const frame = (chart: SkyFrame['chart']): SkyFrame =>
  ({
    ctx: quietContext(),
    width: 1600,
    height: 900,
    camera: { current: { x: 0, y: 0, scale: 1 } } as CameraController,
    t: 0,
    wall: 0,
    frozen: true,
    chart,
  }) as unknown as SkyFrame;

describe('DoneLayer', () => {
  it('finds a light where it drew it, and hands it over as a done hit', () => {
    const layer = new DoneLayer();
    layer.set([item], NOW);
    const f = frame('prs');
    const drawn: [number, number][] = [];
    const ctx = new Proxy(f.ctx, {
      get: (target, name) =>
        name === 'arc'
          ? (x: number, y: number) => drawn.push([x, y])
          : (target as unknown as Record<string | symbol, unknown>)[name],
    });

    layer.flat(ctx, f);
    const [x, y] = drawn[0];
    const hit = layer.pick(x + 2, y - 2);

    expect(isDoneHit(hit)).toBe(true);
    expect(hit?.done.key).toBe('pr12');
    expect(layer.pick(x + 40, y + 40)).toBeNull();
  });

  it('draws nothing, and so finds nothing, off the pull request sky', () => {
    const layer = new DoneLayer();
    layer.set([item], NOW);
    layer.flat(quietContext(), frame('logs'));
    expect(layer.pick(800, 450)).toBeNull();
  });

  it('says when the light under the pointer changes', () => {
    const layer = new DoneLayer();
    expect(layer.hoverOn(item)).toBe(true);
    expect(layer.hoverOn(item)).toBe(false);
    expect(layer.hoverOn(null)).toBe(true);
  });
});

describe('labelLeft', () => {
  it('opens toward the middle: right of a light on the left half, left of one on the right', () => {
    expect(labelLeft(300, 200, 1600)).toBe(314);
    expect(labelLeft(1300, 200, 1600)).toBe(1086);
  });

  it('stays clear of a panel on the right edge', () => {
    // The screen is 1600 wide with a 390 panel on its right: 1210 of clear sky.
    expect(labelLeft(1205, 200, 1210)).toBe(991);
    expect(labelLeft(1300, 200, 1210)).toBe(1002);
  });

  it('keeps the label on screen', () => {
    expect(labelLeft(100, 400, 1600)).toBe(114);
    expect(labelLeft(1590, 200, 1600)).toBe(1376);
    expect(labelLeft(820, 900, 1600)).toBe(8);
  });
});
