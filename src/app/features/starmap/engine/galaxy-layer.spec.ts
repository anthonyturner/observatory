import { Scene, WebGLRenderer } from 'three';
import { GalaxyLayer } from './galaxy-layer';
import { Owned } from './gpu-kit';
import { SkyFrame } from './sky-frame';

const frameAt = (change: { x?: number; t?: number; width?: number } = {}) =>
  ({
    width: change.width ?? 1000,
    height: 600,
    t: change.t ?? 0,
    frozen: false,
    camera: { current: { x: change.x ?? 0, y: 0, scale: 1 } },
  }) as unknown as SkyFrame;

function setUp() {
  const scene = new Scene();
  const drawn: unknown[] = [];
  const gl = {
    getRenderTarget: () => null,
    setRenderTarget: (target: unknown) => drawn.push(target),
    render: () => drawn.push('render'),
  } as unknown as WebGLRenderer;
  const layer = new GalaxyLayer(scene, new Owned());
  const draws = () => drawn.filter((d) => d === 'render').length;
  return { scene, gl, layer, drawn, draws };
}

describe('GalaxyLayer', () => {
  it('adds one full-screen layer to the scene', () => {
    const { scene } = setUp();

    expect(scene.children).toHaveLength(1);
  });

  it('draws the disc on the first frame and not again while nothing has moved far', () => {
    const { gl, layer, draws } = setUp();

    layer.update(frameAt(), gl, 0.5);
    layer.update(frameAt(), gl, 0.5);
    layer.update(frameAt({ t: 0.1 }), gl, 0.5);

    expect(draws()).toBe(1);
  });

  it('draws it again once the camera or the arms have moved far enough to show', () => {
    const { gl, layer, draws } = setUp();

    layer.update(frameAt(), gl, 0.5);
    layer.update(frameAt({ x: 5000 }), gl, 0.5);
    layer.update(frameAt({ x: 5000, t: 600 }), gl, 0.5);

    expect(draws()).toBe(3);
  });

  it('draws it again when the window changes shape', () => {
    const { gl, layer, draws } = setUp();

    layer.update(frameAt(), gl, 0.5);
    layer.update(frameAt({ width: 800 }), gl, 0.5);

    expect(draws()).toBe(2);
  });

  it('puts the render target back as it found it', () => {
    const { gl, layer, drawn } = setUp();

    layer.update(frameAt(), gl, 0.5);

    expect(drawn.at(-1)).toBeNull();
  });
});
