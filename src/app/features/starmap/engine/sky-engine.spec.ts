import { SkyHost, SkyEngine } from './sky-engine';
import { SkyRenderer } from './sky-frame';

/** A display that fires its refreshes by hand, on a clock the test sets. */
class Display {
  now = 1000;
  private waiting: (() => void) | null = null;
  readonly defaultView = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    requestAnimationFrame: (callback: () => void) => {
      this.waiting = callback;
      return 1;
    },
  };

  /** Fires one refresh, `ms` after the last. */
  refresh(ms: number): void {
    this.now += ms;
    const callback = this.waiting;
    this.waiting = null;
    callback?.();
  }
}

const setUp = (frozen = false) => {
  const display = new Display();
  vi.spyOn(performance, 'now').mockImplementation(() => display.now);
  const frames = vi.fn();
  const renderer: SkyRenderer & { mount(): void } = {
    kind: 'webgl',
    mount: () => undefined,
    setScene: () => undefined,
    frame: frames,
    toScreen: () => [0, 0],
    resize: () => undefined,
    dispose: () => undefined,
  };
  // jsdom has no 2D canvas; the renderer's own scratch canvases can go without one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const canvas = document.createElement('canvas');
  const ctx = { setTransform: () => undefined, clearRect: () => undefined };
  canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
  const host: SkyHost = {
    document: {
      hidden: false,
      defaultView: display.defaultView,
      createElement: (tag: string) => document.createElement(tag),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as Document,
    canvas,
    frozen: () => frozen,
    insets: () => ({ top: 0, bottom: 0, side: 0 }),
    picked: () => undefined,
    loadWebGL: () => Promise.resolve(renderer),
  };
  const engine = new SkyEngine(host);
  return { engine, display, frames, canvas };
};

/** Lets the engine's 3D renderer arrive, then lets the camera finish its first ease. */
const settle = async (engine: SkyEngine, display: Display): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  for (let i = 0; i < 600 && !engine.camera.settled(); i++) display.refresh(16);
};

/** How many frames draw over `refreshes` display refreshes `ms` apart. */
const drawnOver = (
  display: Display,
  frames: ReturnType<typeof vi.fn>,
  refreshes: number,
  ms: number,
) => {
  const before = frames.mock.calls.length;
  for (let i = 0; i < refreshes; i++) display.refresh(ms);
  return frames.mock.calls.length - before;
};

describe('SkyEngine frame rate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws only ambient drift at about 30 frames a second on a 60 Hz display', async () => {
    const { engine, display, frames } = setUp();
    await settle(engine, display);

    const drawn = drawnOver(display, frames, 60, 1000 / 60);

    expect(drawn).toBeGreaterThanOrEqual(28);
    expect(drawn).toBeLessThanOrEqual(31);
  });

  it('draws every refresh while the camera eases', async () => {
    const { engine, display, frames } = setUp();
    await settle(engine, display);
    engine.pan(1, 0);

    expect(drawnOver(display, frames, 5, 1000 / 60)).toBe(5);
  });

  it('draws every refresh while dragging', async () => {
    const { engine, display, frames, canvas } = setUp();
    await settle(engine, display);
    canvas.dispatchEvent(new Event('pointerdown'));

    expect(drawnOver(display, frames, 20, 1000 / 60)).toBe(20);
  });

  it('draws every refresh while a layer is animating', async () => {
    const { engine, display, frames } = setUp();
    await settle(engine, display);
    engine.layers = [{ animating: () => true }];

    expect(drawnOver(display, frames, 20, 1000 / 60)).toBe(20);
  });

  it('draws at once when kicked awake, even right after a frame', async () => {
    const { engine, display, frames } = setUp(true);
    await settle(engine, display);

    const before = frames.mock.calls.length;
    engine.resize();
    engine.resize();

    expect(frames.mock.calls.length - before).toBe(2);
  });
});
