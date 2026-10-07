import { PlacedRelease, PlacedWeek } from './release-layout';
import { Stage } from './release-path';
import { ringSpeck, speckDraws, tailSpeck } from './release-specks';

const STAGE: Stage = { left: 0, top: 0, width: 1000, height: 600 };

const RELEASE: PlacedRelease = {
  key: 'v1',
  tag: 'v1',
  publishedAt: 0,
  t: 0.5,
  x: 500,
  y: 300,
  depth: 1,
  radius: 20,
  count: 3,
  bump: 'minor',
  isPrerelease: false,
  order: 0,
  hasLabel: true,
};

const WEEK: PlacedWeek = {
  key: '2026-09-28',
  start: 0,
  count: 3,
  t: 0.6,
  reach: 0.05,
  spread: 20,
};

describe('speckDraws', () => {
  it('draws the same for the same pull request, and differently for another', () => {
    expect(speckDraws(42)).toEqual(speckDraws(42));
    expect(speckDraws(42)).not.toEqual(speckDraws(43));
    expect(Math.abs(speckDraws(42).across)).toBeLessThanOrEqual(1);
  });
});

describe('ringSpeck', () => {
  it('circles outside its star and turns with the scene’s time', () => {
    const draws = speckDraws(7);
    const now = ringSpeck(RELEASE, draws, 0);
    const later = ringSpeck(RELEASE, draws, 5);

    expect(Math.hypot(now.x - RELEASE.x, now.y - RELEASE.y)).toBeGreaterThan(RELEASE.radius * 0.5);
    expect([later.x, later.y]).not.toEqual([now.x, now.y]);
    expect(now.alpha).toBeGreaterThan(0);
  });

  it('dims a speck on the far side of the ring', () => {
    const specks = Array.from({ length: 40 }, (_, number) =>
      ringSpeck(RELEASE, speckDraws(number), 0),
    );
    const behind = specks.filter((speck) => speck.isBehind);

    expect(behind.length).toBeGreaterThan(0);
    expect(Math.max(...behind.map((speck) => speck.alpha))).toBeLessThanOrEqual(0.4);
  });
});

describe('tailSpeck', () => {
  it('stays inside its week’s stretch of tail, and holds still at a fixed time', () => {
    const draws = speckDraws(11);
    const speck = tailSpeck(WEEK, draws, { time: 3, stage: STAGE });

    expect(tailSpeck(WEEK, draws, { time: 3, stage: STAGE })).toEqual(speck);
    expect(speck.alpha).toBeGreaterThanOrEqual(0);
    expect(speck.alpha).toBeLessThanOrEqual(1);
    expect(speck.x).toBeGreaterThan(0);
    expect(speck.x).toBeLessThan(STAGE.width);
  });
});
