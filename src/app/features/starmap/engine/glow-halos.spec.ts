import { GlowHalos } from './glow-halos';

interface Call {
  readonly what: string;
  readonly value?: unknown;
}

/** jsdom has no 2D canvas: each canvas gets a context that writes down what it is asked. */
function setUp() {
  const calls = new Map<HTMLCanvasElement, Call[]>();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    const log = calls.get(this) ?? [];
    calls.set(this, log);
    return {
      clearRect: () => log.push({ what: 'clear' }),
      drawImage: (from: HTMLCanvasElement) => log.push({ what: 'draw', value: from }),
      set filter(value: string) {
        log.push({ what: 'filter', value });
      },
    } as unknown as RenderingContext;
  } as typeof HTMLCanvasElement.prototype.getContext);
  const glow = document.createElement('canvas');
  glow.width = 800;
  glow.height = 400;
  const halos = new GlowHalos(document);
  halos.update(glow, 1600);
  const [tight, wide] = [...calls.keys()];
  return { calls, glow, halos, tight, wide };
}

const blurOf = (log: Call[] | undefined): number =>
  Number(
    /blur\(([\d.]+)px\)/.exec(String(log?.find((call) => call.what === 'filter')?.value))?.[1],
  );

describe('GlowHalos', () => {
  afterEach(() => vi.restoreAllMocks());

  it('holds the tight halo at half the glow layer and the wide one at half again', () => {
    const { tight, wide } = setUp();

    expect([tight.width, tight.height]).toEqual([400, 200]);
    expect([wide.width, wide.height]).toEqual([200, 100]);
  });

  it('blurs each as far across the screen as a 6px and a 22px blur at full size', () => {
    const { calls, tight, wide } = setUp();

    // 1600 device pixels over 400, so 4 to a pixel of the tight halo: 6 / 4.
    expect(blurOf(calls.get(tight))).toBeCloseTo(1.5);
    // 8 to a pixel of the wide one, which adds what the tight one lacks: sqrt(22² - 6²) / 8.
    expect(blurOf(calls.get(wide))).toBeCloseTo(Math.sqrt(22 ** 2 - 6 ** 2) / 8);
  });

  it('measures the blur in device pixels, so a sharper screen blurs fewer pixels of the layer', () => {
    const { calls, glow, halos, tight } = setUp();
    calls.get(tight)?.splice(0);

    halos.update(glow, 3200);

    expect(blurOf(calls.get(tight))).toBeCloseTo(0.75);
  });

  it('blurs the wide halo from the tight one, not from the glow layer again', () => {
    const { calls, glow, tight, wide } = setUp();
    const source = (canvas: HTMLCanvasElement) =>
      calls.get(canvas)?.find((call) => call.what === 'draw')?.value;

    expect(source(tight)).toBe(glow);
    expect(source(wide)).toBe(tight);
  });

  it('adds the tight halo at 0.7 and the wide at 0.22', () => {
    const { halos } = setUp();
    const alphas: number[] = [];
    const target = {
      set globalAlpha(value: number) {
        alphas.push(value);
      },
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    halos.draw(target, 800, 400);

    expect(alphas).toEqual([0.7, 0.22]);
  });

  it('follows the glow layer when the window is resized', () => {
    const { glow, halos, tight, wide } = setUp();
    glow.width = 400;
    glow.height = 200;

    halos.update(glow, 800);

    expect([tight.width, wide.width]).toEqual([200, 100]);
  });
});
