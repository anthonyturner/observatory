import { drawLabels } from './canvas-sky';
import { SkyFrame } from './sky-frame';
import { QUICK_COLOUR, SkyCluster, SkyStar } from './sky-model';

interface Said {
  readonly words: string;
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly colour: string;
  readonly font: string;
}

const WIDTH = 1000;
const HEIGHT = 600;

/** jsdom has no 2D canvas: this context writes down each line of text and what it was drawn with. */
function recorder() {
  const said: Said[] = [];
  const fonts: string[] = [];
  const depth = { saves: 0, restores: 0 };
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    textAlign: 'start',
    _font: '',
    get font() {
      return this._font;
    },
    set font(value: string) {
      this._font = value;
      fonts.push(value);
    },
    save: () => depth.saves++,
    restore: () => depth.restores++,
    fillText(words: string, x: number, y: number) {
      said.push({
        words,
        x,
        y,
        alpha: ctx.globalAlpha,
        colour: String(ctx.fillStyle),
        font: ctx._font,
      });
    },
  };
  return { ctx, said, fonts, depth };
}

const star = (fields: Partial<SkyStar> = {}): SkyStar =>
  ({
    tag: '#1',
    caption: 'A pull request',
    quick: false,
    custom: false,
    mag: 10,
    ax: 500,
    ay: 300,
    az: 0,
    ...fields,
  }) as unknown as SkyStar;

const cluster = (fields: Partial<SkyCluster> = {}): SkyCluster =>
  ({
    label: 'Needs review',
    sub: '3 open',
    colour: '#82aaff',
    cx: 500,
    labelY: 100,
    z: 0,
    halo: false,
    stars: [star()],
    ...fields,
  }) as unknown as SkyCluster;

function frame(
  stars: SkyStar[],
  { clusters = [] as SkyCluster[], scale = 1, born = 1, dim = 1 } = {},
) {
  const { ctx, ...record } = recorder();
  const f = {
    ctx,
    width: WIDTH,
    height: HEIGHT,
    camera: { current: { scale } },
    stars,
    clusters,
    born: () => born,
    dim: () => dim,
    dimCluster: () => 1,
    toScreen: (x: number, y: number) => [x, y],
  } as unknown as SkyFrame;
  drawLabels(f);
  return { ...record, ctx };
}

describe('drawLabels', () => {
  it('writes each star its tag, centred, below it and clear of its disc', () => {
    const { said } = frame([star({ tag: '#42', ax: 400, ay: 300 })]);

    expect(said).toHaveLength(1);
    // Radius 10 at scale 1, then 1.6 radii and 17 pixels below the star.
    expect(said[0]).toMatchObject({ words: '#42', x: 400, y: 300 + 10 * 1.6 + 17 });
    expect(said[0].colour).toBe('#eaf0ff');
  });

  it('puts a quick win above its star in its own colour', () => {
    const { said } = frame([star({ quick: true })]);

    expect(said.map((s) => s.words)).toEqual(['#1', '✦ quick win']);
    expect(said[1]).toMatchObject({ colour: QUICK_COLOUR, y: 300 - 10 * 1.6 - 10 });
  });

  it('fades a label with its star: dimmed by the filter and still arriving', () => {
    const { said } = frame([star()], { dim: 0.1, born: 0.8 });

    expect(said[0].alpha).toBeCloseTo(0.85 * 0.1 * 0.8);
  });

  it('leaves out stars it has no words for, or that have barely arrived', () => {
    const none = frame([star({ tag: '' }), star({ custom: true })]);
    const arriving = frame([star()], { born: 0.5 });

    expect(none.said).toEqual([]);
    expect(arriving.said).toEqual([]);
  });

  it('writes captions only once zoomed in, cut to 40 characters', () => {
    const caption = 'x'.repeat(60);
    const wide = frame([star({ caption })], { scale: 1.3 });
    const close = frame([star({ caption })], { scale: 1.5 });

    expect(wide.said.map((s) => s.words)).toEqual(['#1']);
    expect(close.said.map((s) => s.words)).toEqual(['#1', `${'x'.repeat(38)}…`]);
    expect(close.said[1].alpha).toBeCloseTo(0.5);
  });

  it('writes star tags only above half scale, and constellation names always', () => {
    const far = frame([star()], { clusters: [cluster()], scale: 0.4 });

    expect(far.said.map((s) => s.words)).toEqual(['Needs review', '3 open']);
  });

  it('names each constellation with its line of detail under it, and skips a halo', () => {
    const { said } = frame([], { clusters: [cluster(), cluster({ halo: true })] });

    expect(said.map((s) => s.words)).toEqual(['Needs review', '3 open']);
    expect(said[0]).toMatchObject({ x: 500, y: 100, alpha: 0.9 });
    expect(said[1]).toMatchObject({ x: 500, y: 120, alpha: 0.5 });
  });

  it('leaves out words wholly off the screen but keeps ones hanging in from outside', () => {
    const { said } = frame([
      star({ tag: '#gone', ax: -200, ay: 300 }),
      star({ tag: '#below', ax: 500, ay: HEIGHT + 200 }),
      // The star is above the screen but its tag sits 33 pixels below it.
      star({ tag: '#hangs', ax: 500, ay: -20 }),
      star({ tag: '#edge', ax: -3, ay: 300 }),
    ]);

    expect(said.map((s) => s.words)).toEqual(['#hangs', '#edge']);
  });

  it('keeps a long name that is centred off screen but runs back onto it', () => {
    const name = 'a very long constellation name that spans a lot of screen';
    const { said } = frame([], { clusters: [cluster({ label: name, cx: -100 })] });

    expect(said.map((s) => s.words)).toContain(name);
  });

  it('sets the text style once for all the stars, not once per star', () => {
    const stars = Array.from({ length: 50 }, (_, i) => star({ tag: `#${i}`, ax: 20 * i }));
    const { said, fonts, depth, ctx } = frame(stars);

    expect(said).toHaveLength(50);
    expect(fonts).toHaveLength(1);
    expect(ctx.textAlign).toBe('center');
    expect(depth).toEqual({ saves: 1, restores: 1 });
  });
});
