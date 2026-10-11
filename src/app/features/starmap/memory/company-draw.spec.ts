import { issuePlanets } from '../engine/star-system';
import { SkyFrame } from '../engine/sky-frame';
import { Meteor } from '../engine/meteor-layer';
import { Departed, drawCompany } from './company-draw';
import { Departure, EMPTY_SYSTEM, endingOf } from './departure';
import { GLOW_S, PULL_AT_S, PULL_S } from './departure-company';
import { PRELUDE_S } from './departure-exit';
import { NewsEvent } from './news';

/** A canvas that records the circles it is told to draw and what it filled them with. */
function recorder() {
  const circles: { x: number; y: number; radius: number }[] = [];
  const stops: string[] = [];
  const lines: number[] = [];
  const gradient = { addColorStop: (_at: number, colour: string) => void stops.push(colour) };
  const ctx = {
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    moveTo: () => undefined,
    lineTo: (x: number) => void lines.push(x),
    arc: (x: number, y: number, radius: number) => void circles.push({ x, y, radius }),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, circles, stops, lines };
}

const star: Departed = { x: 400, y: 300, size: 7 };
const frame = (wall: number, frozen = false): SkyFrame => ({ wall, frozen }) as unknown as SkyFrame;
const meteor: Meteor = { repo: 'a/b', pr: 7, commits: 4 };

const leaving = (departure: Departure | undefined, startAt = 100): NewsEvent => ({
  kind: 'merged',
  pr: 7,
  title: 'x',
  bucket: 'fresh',
  startAt,
  departure,
});

const merged = (issues: number[], meteorToo = false): Departure => ({
  system: {
    ...EMPTY_SYSTEM,
    planets: issuePlanets({ item: { issues } as never }),
    meteor: meteorToo ? meteor : null,
  },
  ending: endingOf('merged'),
});

describe('drawCompany', () => {
  it('draws the star’s last light and a planet for each issue', () => {
    const { ctx, circles } = recorder();

    drawCompany(
      ctx,
      frame(100.1),
      leaving({ ...merged([1, 2]), ending: endingOf('closed') }),
      star,
    );

    // A halo and a core for the light, a body for each planet.
    expect(circles).toHaveLength(2 + 2);
    expect(circles[1]).toMatchObject({ x: 400, y: 300 });
  });

  it('glows a resolving planet green', () => {
    const { ctx, stops } = recorder();

    drawCompany(ctx, frame(100 + GLOW_S), leaving(merged([1])), star);

    expect(stops.some((colour) => colour.includes('95, 227, 161'))).toBe(true);
  });

  it('draws a closed pull request’s planets without any green', () => {
    const { ctx, stops } = recorder();
    const departure = { ...merged([1]), ending: endingOf('closed') };

    drawCompany(ctx, frame(100.3), leaving(departure), star);

    expect(stops.some((colour) => colour.includes('95, 227, 161'))).toBe(false);
  });

  it('pulls the meteor in during its window only', () => {
    const during = recorder();
    const before = recorder();

    drawCompany(during.ctx, frame(100 + PULL_AT_S + PULL_S / 2), leaving(merged([], true)), star);
    drawCompany(before.ctx, frame(100 + PULL_AT_S / 2), leaving(merged([], true)), star);

    expect(during.lines).toHaveLength(1);
    expect(before.lines).toHaveLength(0);
  });

  it('draws nothing before the exit starts or once the prelude is over', () => {
    for (const wall of [99.9, 100 + PRELUDE_S, 105]) {
      const { ctx, circles } = recorder();

      drawCompany(ctx, frame(wall), leaving(merged([1], true)), star);

      expect(circles).toEqual([]);
    }
  });

  it('draws nothing for news with no departure or that has not started', () => {
    const { ctx, circles } = recorder();

    drawCompany(ctx, frame(100.1), leaving(undefined), star);
    drawCompany(ctx, frame(100.1), { ...leaving(merged([1])), startAt: undefined }, star);

    expect(circles).toEqual([]);
  });

  it('with motion off, draws the light and the planet in place but no meteor', () => {
    const { ctx, circles, lines } = recorder();

    drawCompany(ctx, frame(100 + PULL_AT_S + PULL_S / 2, true), leaving(merged([1], true)), star);

    // The light's halo and core, and the one planet's green halo and body.
    expect(circles).toHaveLength(2 + 2);
    expect(lines).toHaveLength(0);
  });
});
