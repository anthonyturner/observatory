import { SkyFrame } from './sky-frame';
import { SkyStar } from './sky-model';
import { StackLayer, chainLinks } from './stack-layer';

const star = (pr: number, ax: number, dim = 1): SkyStar & { dim: number } =>
  ({ ax, ay: 100, az: 0, mag: 4, item: { pr }, dim }) as unknown as SkyStar & { dim: number };

interface FrameFields {
  readonly chart?: string;
  readonly frozen?: boolean;
  readonly t?: number;
}

function frame(stars: readonly SkyStar[], fields: FrameFields = {}): SkyFrame {
  return {
    chart: fields.chart ?? 'prs',
    frozen: fields.frozen ?? false,
    t: fields.t ?? 0,
    stars,
    camera: { current: { scale: 1 } },
    born: () => 1,
    dim: (s: SkyStar & { dim: number }) => s.dim,
    toScreen: (x: number, y: number) => [x, y],
  } as unknown as SkyFrame;
}

function canvas() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
  };
}

const draw = (layer: StackLayer, f: SkyFrame) => {
  const c = canvas();
  layer.flat(c as unknown as CanvasRenderingContext2D, f);
  return c;
};

describe('chainLinks', () => {
  it('spaces links evenly along the chain, alternately face on and edge on', () => {
    const links = chainLinks(0, 0, 110, 0);

    expect(links.length).toBe(10);
    expect(links.map((l) => l.isFaceOn).slice(0, 3)).toEqual([true, false, true]);
    expect(links[0].x).toBeCloseTo(110 - links[9].x);
    expect(links.every((l) => l.y === 0)).toBe(true);
  });

  it('has no links when the ends are closer than one', () => {
    expect(chainLinks(0, 0, 5, 5)).toEqual([]);
  });
});

describe('StackLayer', () => {
  const stars = [star(1, 0), star(2, 300), star(3, 600, 0.1)];

  it('draws a chain between each stacked pull request and its base', () => {
    const layer = new StackLayer();
    layer.links = [{ child: 2, parent: 1 }];

    const c = draw(layer, frame(stars, { frozen: true }));

    expect(c.ellipse).toHaveBeenCalled();
    expect(c.lineTo).toHaveBeenCalled();
    expect(c.arc).not.toHaveBeenCalled();
  });

  it('runs a glint toward the base while the sky moves, and holds it still when motion is off', () => {
    const layer = new StackLayer();
    layer.links = [{ child: 2, parent: 1 }];

    expect(draw(layer, frame(stars, { t: 1 })).arc).toHaveBeenCalledTimes(1);
    expect(draw(layer, frame(stars, { frozen: true, t: 1 })).arc).not.toHaveBeenCalled();
  });

  it('dims a chain to a star the filter passes over', () => {
    const layer = new StackLayer();
    layer.links = [{ child: 3, parent: 2 }];
    const alphas: number[] = [];
    const c = canvas();
    c.stroke = vi.fn(() => alphas.push(c.globalAlpha));

    layer.flat(c as unknown as CanvasRenderingContext2D, frame(stars, { frozen: true }));

    expect(Math.max(...alphas)).toBeCloseTo(0.07);
  });

  it('leaves a broken chain, named, on a pull request whose base merged', () => {
    const layer = new StackLayer();
    layer.landed = [{ pr: 1, landed: { number: 9, branch: 'feat/9', into: 'main' } }];
    const words = canvas();

    const c = draw(layer, frame(stars));
    layer.labels(words as unknown as CanvasRenderingContext2D, frame(stars));

    expect(c.ellipse).toHaveBeenCalled();
    expect(words.fillText).toHaveBeenCalledWith(
      'BASE #9 MERGED · UPDATE',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('draws nothing off the review queue, while replaying, or for a star not on the sky', () => {
    const layer = new StackLayer();
    layer.links = [{ child: 2, parent: 1 }];
    const gone = new StackLayer();
    gone.links = [{ child: 2, parent: 99 }];

    expect(draw(layer, frame(stars, { chart: 'logs' })).stroke).not.toHaveBeenCalled();
    layer.paused = true;
    expect(draw(layer, frame(stars)).stroke).not.toHaveBeenCalled();
    expect(draw(gone, frame(stars)).stroke).not.toHaveBeenCalled();
  });
});
