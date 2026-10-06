import { CameraController } from './camera-controller';
import { CometIssue, CometLayer, layoutComets } from './comet-layer';
import { SkyFrame } from './sky-frame';

const comet: CometIssue = { issue: 7, ageDays: 20, idleDays: 10 };

/** A 2D context that keeps every opacity it is given. */
const recordingContext = (alphas: number[]): CanvasRenderingContext2D =>
  new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, name) =>
      name === 'createRadialGradient' || name === 'createLinearGradient'
        ? () => ({ addColorStop: () => undefined })
        : () => undefined,
    set: (_target, name, value: unknown) => {
      if (name === 'globalAlpha' && typeof value === 'number') alphas.push(value);
      return true;
    },
  });

const frame = (ctx: CanvasRenderingContext2D): SkyFrame =>
  ({
    ctx,
    width: 10_000,
    height: 10_000,
    camera: { current: { x: 0, y: 0, scale: 1 } } as CameraController,
    t: 0,
    wall: 0,
    frozen: true,
    chart: 'prs',
    toScreen: (x: number, y: number) => [x, y],
  }) as unknown as SkyFrame;

const brightest = (layer: CometLayer): number => {
  const alphas: number[] = [];
  const ctx = recordingContext(alphas);
  layer.beneath(ctx, frame(ctx));
  return Math.max(...alphas);
};

describe('CometLayer', () => {
  it('fades its comets past the work-in-progress limit, and brightens them again', () => {
    const layer = new CometLayer();
    layer.comets = layoutComets([comet], 40);

    expect(brightest(layer)).toBe(1);
    layer.faded = true;
    expect(brightest(layer)).toBeCloseTo(0.3);
    layer.faded = false;
    expect(brightest(layer)).toBe(1);
  });

  it('still lets a faded comet be picked', () => {
    const layer = new CometLayer();
    layer.comets = layoutComets([comet], 40);
    layer.faded = true;
    brightest(layer);
    const [drawn] = layer.comets;

    expect(layer.pick(drawn.ax, drawn.ay)).toBe(comet);
  });
});
