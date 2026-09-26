import { CoreFrame, CoreRenderer } from './core-renderer';
import { CoreView } from './core-view';
import { PreferredCoreRenderer } from './preferred-core-renderer';

class FakeRenderer implements CoreRenderer {
  mounted = false;
  disposed = false;
  view: CoreView | null = null;
  frames = 0;

  constructor(
    private readonly drawable = true,
    private readonly failsToDraw = false,
  ) {}

  mount(): void {
    this.mounted = true;
  }

  canDraw(): boolean {
    return this.drawable;
  }

  setProjects(): void {
    return;
  }

  setView(view: CoreView): void {
    this.view = view;
  }

  frame(): void {
    if (this.failsToDraw) throw new Error('context lost');
    this.frames++;
  }

  dispose(): void {
    this.disposed = true;
  }
}

const VIEW = { radius: 100 } as CoreView;
const FRAME = {} as CoreFrame;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

function setup(preferred: FakeRenderer | Promise<never>) {
  const fallbacks: FakeRenderer[] = [];
  const reasons: unknown[] = [];
  let redraws = 0;
  const renderer = new PreferredCoreRenderer({
    preferred: () => (preferred instanceof FakeRenderer ? Promise.resolve(preferred) : preferred),
    fallback: () => {
      const fallback = new FakeRenderer();
      fallbacks.push(fallback);
      return fallback;
    },
    onFallback: (reason) => reasons.push(reason),
  });
  renderer.mount(document.createElement('div'), () => redraws++);
  renderer.setView(VIEW);
  return { renderer, fallbacks, reasons, redraws: () => redraws };
}

describe('PreferredCoreRenderer', () => {
  it('draws with the fallback at once, then switches and asks for a frame', async () => {
    const preferred = new FakeRenderer();
    const { renderer, fallbacks, redraws } = setup(preferred);
    renderer.frame(FRAME);
    expect(fallbacks[0].frames).toBe(1);

    await settle();
    renderer.frame(FRAME);
    expect(preferred.frames).toBe(1);
    expect(preferred.view).toBe(VIEW);
    expect(fallbacks[0].disposed).toBe(true);
    expect(redraws()).toBe(1);
  });

  it('keeps the fallback, quietly, when the preferred renderer cannot draw here', async () => {
    const preferred = new FakeRenderer(false);
    const { renderer, fallbacks, reasons } = setup(preferred);
    await settle();
    renderer.frame(FRAME);
    expect(preferred.disposed).toBe(true);
    expect(fallbacks[0].frames).toBe(1);
    expect(reasons).toEqual([]);
  });

  it('reports a preferred renderer that fails to load, and keeps the fallback', async () => {
    const { renderer, fallbacks, reasons } = setup(Promise.reject(new Error('offline')));
    await settle();
    renderer.frame(FRAME);
    expect(fallbacks[0].frames).toBe(1);
    expect(reasons).toHaveLength(1);
  });

  it('falls back for good when a preferred frame throws, and still draws that frame', async () => {
    const { renderer, fallbacks, reasons } = setup(new FakeRenderer(true, true));
    await settle();
    renderer.frame(FRAME);
    expect(reasons).toHaveLength(1);
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks[1].frames).toBe(1);
    expect(fallbacks[1].view).toBe(VIEW);
  });

  it('never switches after it has been disposed', async () => {
    const preferred = new FakeRenderer();
    const { renderer } = setup(preferred);
    renderer.dispose();
    await settle();
    expect(preferred.mounted).toBe(false);
  });
});
