import {
  FLIGHT_S,
  GLINT_S,
  Meteor,
  MeteorLayer,
  MeteorShow,
  StarState,
  headDistance,
  meteorHeading,
  meteorKey,
  meteorLook,
  meteorStage,
  meteorsOf,
  panOf,
  strengthOf,
} from './meteor-layer';
import { SkyFrame } from './sky-frame';
import { SkyStar } from './sky-model';

const looked = (number: number, newCommits: number | null | undefined) => ({
  number,
  sinceLook: newCommits === undefined ? null : { newCommits },
});

describe('meteorsOf', () => {
  it('gives a meteor to each pull request with new commits, and none to the rest', () => {
    const meteors = meteorsOf([looked(1, 2), looked(2, undefined), looked(3, 5)]);

    expect(meteors).toEqual([
      { pr: 3, commits: 5 },
      { pr: 1, commits: 2 },
    ]);
  });

  it('gives a rewritten branch one too, whose commits cannot be counted', () => {
    expect(meteorsOf([looked(7, null)])).toEqual([{ pr: 7, commits: null }]);
  });

  it('keeps the biggest changes when there are more than the cap', () => {
    const items = [looked(1, 1), looked(2, 9), looked(3, 4), looked(4, 9)];

    expect(meteorsOf(items, 3).map((m) => m.pr)).toEqual([2, 4, 3]);
  });
});

describe('meteorLook', () => {
  it('lengthens the tail and brightens the meteor as commits grow, within bounds', () => {
    const looks = [1, 2, 5, 15, 400].map(meteorLook);

    looks.slice(1).forEach((look, i) => {
      expect(look.tailPx).toBeGreaterThanOrEqual(looks[i].tailPx);
      expect(look.brightness).toBeGreaterThanOrEqual(looks[i].brightness);
    });
    expect(looks[0].tailPx).toBeGreaterThan(70);
    expect(looks[3]).toEqual(looks[4]);
    expect(looks[4].brightness).toBeCloseTo(1);
    expect(looks[0].brightness).toBeGreaterThan(0.5);
  });

  it('shows a rewritten branch as a few commits’ worth', () => {
    expect(meteorLook(null)).toEqual(meteorLook(3));
    expect(strengthOf(0)).toBe(0);
  });
});

describe('meteorHeading', () => {
  it('comes from above, never flat, and the same way for a pull request every time', () => {
    for (const pr of [1, 2, 17, 412, 9001]) {
      const { x, y } = meteorHeading(pr);

      expect(Math.hypot(x, y)).toBeCloseTo(1);
      expect(y).toBeLessThan(-0.3);
      expect(meteorHeading(pr)).toEqual({ x, y });
    }
  });
});

describe('meteorStage', () => {
  it('waits, flies, glints, then goes', () => {
    expect(meteorStage(0.9, 1).stage).toBe('waiting');
    expect(meteorStage(1, 1)).toEqual({ stage: 'flying', p: 0 });
    expect(meteorStage(1 + FLIGHT_S / 2, 1)).toEqual({ stage: 'flying', p: 0.5 });
    expect(meteorStage(1 + FLIGHT_S, 1)).toEqual({ stage: 'glinting', p: 0 });
    expect(meteorStage(1 + FLIGHT_S + GLINT_S, 1).stage).toBe('gone');
  });
});

describe('headDistance', () => {
  it('comes in faster as it falls and ends on the star’s rim, never on the star', () => {
    const rim = 12;

    expect(headDistance(rim, 1)).toBe(rim);
    expect(headDistance(rim, 0)).toBeGreaterThan(rim + 100);
    const early = headDistance(rim, 0) - headDistance(rim, 0.25);
    const late = headDistance(rim, 0.75) - headDistance(rim, 1);
    expect(late).toBeGreaterThan(early);
    for (let p = 0; p <= 1; p += 0.1) expect(headDistance(rim, p)).toBeGreaterThanOrEqual(rim);
  });
});

describe('panOf', () => {
  it('follows the screen from left to right, short of the extremes', () => {
    expect(panOf(0, 1000)).toBeCloseTo(-0.8);
    expect(panOf(500, 1000)).toBe(0);
    expect(panOf(1000, 1000)).toBeCloseTo(0.8);
    expect(panOf(5000, 1000)).toBeCloseTo(0.8);
    expect(panOf(10, 0)).toBe(0);
  });
});

describe('MeteorShow', () => {
  const ready = (): StarState => 'ready';
  const meteor = (pr: number, commits: number | null = 2): Meteor => ({ pr, commits });

  /** Runs the show for `seconds`, returning the pull requests in the order they landed. */
  function run(
    show: MeteorShow,
    seconds: number,
    state: (pr: number) => StarState = ready,
  ): number[] {
    const landed: number[] = [];
    for (let at = 0; at < seconds; at += 0.05) {
      show.advance(0.05, state).landed.forEach((m) => landed.push(m.pr));
    }
    return landed;
  }

  it('staggers the landings, in the order given', () => {
    const show = new MeteorShow();
    show.set([meteor(1), meteor(2), meteor(3)]);
    const when = new Map<number, number>();
    for (let at = 0; at < 6; at += 0.05) {
      show.advance(0.05, ready).landed.forEach((m) => when.set(m.pr, at));
    }

    expect([...when.keys()]).toEqual([1, 2, 3]);
    expect((when.get(2) ?? 0) - (when.get(1) ?? 0)).toBeGreaterThan(0.3);
    expect((when.get(3) ?? 0) - (when.get(2) ?? 0)).toBeGreaterThan(0.3);
  });

  it('lands each once, and is idle after the last glint', () => {
    const show = new MeteorShow();
    show.set([meteor(1), meteor(2)]);

    expect(run(show, 8)).toEqual([1, 2]);
    expect(show.busy).toBe(false);
  });

  it('never replays what it has shown, but plays a pull request again when its count grows', () => {
    const show = new MeteorShow();
    show.set([meteor(1, 2)]);
    run(show, 5);
    show.set([meteor(1, 2)]);
    expect(show.busy).toBe(false);

    show.set([meteor(1, 3)]);
    expect(run(show, 5)).toEqual([1]);
  });

  it('holds a meteor until its star has arrived, and drops one whose star is gone', () => {
    const show = new MeteorShow();
    show.set([meteor(1), meteor(2)]);
    const state = (pr: number): StarState => (pr === 1 ? 'arriving' : 'absent');

    expect(run(show, 4, state)).toEqual([]);
    expect(run(show, 8)).toEqual([1]);
  });

  it('tells the flight from the glint', () => {
    const show = new MeteorShow();
    show.set([meteor(1)]);
    const stages = new Set<string>();
    for (let at = 0; at < 5; at += 0.05) {
      show.advance(0.05, ready).flights.forEach((f) => stages.add(f.stage));
    }

    expect([...stages].sort()).toEqual(['flying', 'glinting']);
  });
});

describe('MeteorLayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const star = (pr: number, ax: number): SkyStar =>
    ({ ax, ay: 100, az: 0, mag: 4, item: { pr } }) as unknown as SkyStar;

  function frame(t: number, fields: { frozen?: boolean; chart?: string; born?: number } = {}) {
    return {
      chart: fields.chart ?? 'prs',
      frozen: fields.frozen ?? false,
      t,
      wall: t,
      width: 1000,
      height: 600,
      stars: [star(7, 900)],
      camera: { current: { scale: 1 } },
      born: () => fields.born ?? 1,
      dim: () => 1,
      toScreen: (x: number, y: number) => [x, y],
    } as unknown as SkyFrame;
  }

  function canvas() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    };
  }

  /** Plays frames a twentieth of a second apart, from `from` to `to` seconds. */
  function play(layer: MeteorLayer, from: number, to: number, fields = {}) {
    const c = canvas();
    for (let t = from; t < to; t += 0.05) {
      layer.flat(c as unknown as CanvasRenderingContext2D, frame(t, fields));
    }
    return c;
  }

  it('lands the meteor on the star’s side of the screen and tells the sound', () => {
    const landed = vi.fn();
    const layer = new MeteorLayer(vi.fn(), landed);
    layer.set([{ pr: 7, commits: 4 }]);

    play(layer, 0, 5);

    expect(landed).toHaveBeenCalledTimes(1);
    expect(landed.mock.calls[0][0]).toMatchObject({ pr: 7, pan: panOf(900, 1000) });
    expect(landed.mock.calls[0][0].strength).toBeCloseTo(strengthOf(4));
    layer.dispose();
  });

  it('streaks in while the sky moves', () => {
    const layer = new MeteorLayer(vi.fn(), vi.fn());
    layer.set([{ pr: 7, commits: 4 }]);

    const c = play(layer, 0, 1.4);

    expect(c.lineTo).toHaveBeenCalled();
    layer.dispose();
  });

  it('shows only a glint, with no streak, when motion is off', () => {
    const landed = vi.fn();
    const layer = new MeteorLayer(vi.fn(), landed);
    layer.set([{ pr: 7, commits: 4 }]);

    const c = play(layer, 0, 5, { frozen: true });

    expect(landed).toHaveBeenCalledTimes(1);
    expect(c.lineTo).not.toHaveBeenCalled();
    expect(c.moveTo).not.toHaveBeenCalled();
    expect(c.createRadialGradient).toHaveBeenCalled();
    layer.dispose();
  });

  it('keeps asking a still sky to redraw until the glint is over, then stops', () => {
    const redraw = vi.fn();
    const layer = new MeteorLayer(redraw, vi.fn());
    layer.set([{ pr: 7, commits: 4 }]);
    redraw.mockClear();
    const c = canvas();
    const still = (wall: number): void =>
      layer.flat(
        c as unknown as CanvasRenderingContext2D,
        {
          ...frame(0, { frozen: true }),
          wall,
        } as SkyFrame,
      );

    still(0);
    vi.advanceTimersByTime(60);
    expect(redraw).toHaveBeenCalledTimes(1);

    for (let wall = 0.2; wall < 6; wall += 0.2) {
      still(wall);
      vi.advanceTimersByTime(60);
    }
    redraw.mockClear();
    vi.advanceTimersByTime(1000);

    expect(redraw).not.toHaveBeenCalled();
    layer.dispose();
  });

  it('waits for the sky to arrive, and draws nothing off the review queue', () => {
    const landed = vi.fn();
    const layer = new MeteorLayer(vi.fn(), landed);
    layer.set([{ pr: 7, commits: 4 }]);

    const arriving = play(layer, 0, 5, { born: 0.4 });
    const elsewhere = play(layer, 5, 10, { chart: 'logs' });

    expect(landed).not.toHaveBeenCalled();
    expect(arriving.save).not.toHaveBeenCalled();
    expect(elsewhere.save).not.toHaveBeenCalled();
    layer.dispose();
  });

  it('keeps every mark outside the star it lands on', () => {
    const layer = new MeteorLayer(vi.fn(), vi.fn());
    layer.set([{ pr: 7, commits: 400 }]);
    const c = play(layer, 0, 2.2);
    const radius = 4 * 1 * 1.15 + 2;

    // The glow and ring are centred on the star and add light to it; the head is the one dot off it.
    const heads = c.arc.mock.calls
      .map(([x, y]) => Math.hypot(x - 900, y - 100))
      .filter((distance) => distance > 0);
    expect(heads.length).toBeGreaterThan(0);
    expect(Math.min(...heads)).toBeGreaterThanOrEqual(radius - 1e-9);
    layer.dispose();
  });

  it('names a meteor by its pull request and count', () => {
    expect(meteorKey({ pr: 7, commits: 3 })).not.toBe(meteorKey({ pr: 7, commits: null }));
  });
});
