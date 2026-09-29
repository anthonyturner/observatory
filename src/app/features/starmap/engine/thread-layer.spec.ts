import { SkyFrame } from './sky-frame';
import { SkyStar } from './sky-model';
import { ThreadLayer } from './thread-layer';

const star = (ax: number): SkyStar => ({ ax, ay: 100, az: 0, colour: '#ff6f5e' }) as SkyStar;

function frame(renderer: 'canvas' | 'webgl', chart = 'logs'): SkyFrame {
  return {
    renderer,
    chart,
    t: 0,
    toScreen: (x: number, y: number) => [x, y],
  } as unknown as SkyFrame;
}

function drawn(layer: ThreadLayer, f: SkyFrame): number {
  const c = {
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
  };
  layer.beneath(c as unknown as CanvasRenderingContext2D, f);
  return c.quadraticCurveTo.mock.calls.length;
}

describe('ThreadLayer', () => {
  const layer = new ThreadLayer();
  layer.trace = { traced: star(0), twins: [star(200), star(400)] };

  it('draws the threads flat in the 2D sky, one to each twin', () => {
    expect(drawn(layer, frame('canvas'))).toBe(2);
    expect(layer.threads3D(frame('canvas'))).toBe(layer.trace);
  });

  it('leaves them to the 3D scene when the sky is 3D, rather than drawing them flat on top', () => {
    expect(drawn(layer, frame('webgl'))).toBe(0);
    expect(layer.threads3D(frame('webgl'))?.twins.length).toBe(2);
  });

  it('draws none off the log sky, or with no twins', () => {
    expect(layer.threads3D(frame('webgl', 'prs'))).toBeNull();
    const lone = new ThreadLayer();
    lone.trace = { traced: star(0), twins: [] };
    expect(lone.threads3D(frame('webgl'))).toBeNull();
  });
});
