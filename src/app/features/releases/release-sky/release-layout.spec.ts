import { ReleaseTimeline, UNRELEASED_KEY } from '../../../core/releases/release-timeline';
import { Release, ShippedPull } from '../../../core/releases/releases-report';
import { bodyRadius, layoutTimeline, tailShare } from './release-layout';
import { FAR_DEPTH, Stage, alongPath, pathAt } from './release-path';

const STAGE: Stage = { left: 0, top: 100, width: 1200, height: 600 };

const pull = (number: number): ShippedPull => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  mergedAt: Date.UTC(2026, 9, 1),
  author: 'me',
});

const release = (tag: string, pulls: number): Release => ({
  tag,
  name: tag,
  publishedAt: Date.UTC(2026, 0, 1),
  url: `https://github.com/me/app/releases/tag/${tag}`,
  isPrerelease: false,
  notes: null,
  pulls: Array.from({ length: pulls }, (_, index) => pull(index + 1)),
});

const week = (key: string, count: number) => ({
  key,
  start: Date.UTC(2026, 8, 28),
  pulls: Array.from({ length: count }, (_, index) => pull(100 + index)),
});

describe('pathAt', () => {
  it('runs from the far past at the left to the leading edge at the right, nearer as it goes', () => {
    const far = pathAt(0, STAGE);
    const near = pathAt(1, STAGE);

    expect(far.x).toBeLessThan(near.x);
    expect(far.depth).toBe(FAR_DEPTH);
    expect(near.depth).toBe(1);
    expect(Math.hypot(near.dx, near.dy)).toBeCloseTo(1);
  });
});

describe('alongPath', () => {
  it('steps evenly along the curve on screen, from one end of the range to the other', () => {
    const ruler = alongPath([0.1, 0.9], STAGE);
    const points = [0, 0.25, 0.5, 0.75, 1].map((share) => pathAt(ruler.tAt(share), STAGE));
    const steps = points
      .slice(1)
      .map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));

    expect(ruler.tAt(0)).toBe(0.1);
    expect(ruler.tAt(1)).toBeCloseTo(0.9);
    expect(ruler.length).toBeGreaterThan(STAGE.width * 0.5);
    for (const step of steps) expect(step / steps[0]).toBeCloseTo(1, 1);
  });
});

describe('bodyRadius and tailShare', () => {
  it('grows a star with what it shipped, up to a cap, and shrinks it with distance', () => {
    expect(bodyRadius(16, 1)).toBeGreaterThan(bodyRadius(1, 1));
    expect(bodyRadius(16, 0.5)).toBeCloseTo(bodyRadius(16, 1) / 2);
    expect(bodyRadius(100_000, 1)).toBe(28);
  });

  it('gives the tail more of the path for more weeks, within bounds', () => {
    expect(tailShare(1)).toBe(0.16);
    expect(tailShare(3)).toBeCloseTo(0.26);
    expect(tailShare(40)).toBe(0.36);
  });
});

describe('layoutTimeline', () => {
  const timeline = (releases: Release[], weeks: ReturnType<typeof week>[]): ReleaseTimeline => ({
    releases: releases.map((each) => ({ release: each, bump: 'minor' })),
    unreleased: weeks.length
      ? { notes: null, pulls: weeks.flatMap((each) => each.pulls), weeks }
      : null,
  });

  it('places releases oldest first along the path, the comet ahead of them all', () => {
    const layout = layoutTimeline(
      timeline([release('v1', 2), release('v2', 9)], [week('2026-09-28', 4)]),
      STAGE,
    );
    const [first, second] = layout.releases;

    expect(first.t).toBeLessThan(second.t);
    expect(second.radius).toBeGreaterThan(first.radius);
    expect(layout.comet?.key).toBe(UNRELEASED_KEY);
    expect(layout.comet?.tailStart).toBeGreaterThan(second.t);
    expect(layout.comet?.t).toBeGreaterThan(layout.comet?.tailStart ?? 1);
    expect(layout.comet?.count).toBe(4);
  });

  it('gives the tail the whole path when nothing has been released, a knot a week', () => {
    const layout = layoutTimeline(
      timeline([], [week('2026-09-21', 30), week('2026-09-28', 90), week('2026-10-05', 50)]),
      STAGE,
    );
    const knots = layout.comet?.weeks ?? [];

    expect(layout.releases).toEqual([]);
    expect(layout.comet?.tailStart).toBeLessThan(0.1);
    expect(knots.map((knot) => knot.count)).toEqual([30, 90, 50]);
    expect(knots[0].t).toBeLessThan(knots[2].t);
    expect(knots[0].spread).toBeGreaterThan(knots[2].spread);
  });

  it('draws no comet when nothing is waiting to be released', () => {
    expect(layoutTimeline(timeline([release('v1', 1)], []), STAGE).comet).toBeNull();
  });

  it('names the newest release always, and an older one only where it clears the last named', () => {
    const crowded = Array.from({ length: 30 }, (_, index) => release(`v${index}`, 1));
    const { releases } = layoutTimeline(timeline(crowded, []), STAGE);
    const named = releases.filter((each) => each.hasLabel);

    expect(releases.at(-1)?.hasLabel).toBe(true);
    expect(named.length).toBeLessThan(releases.length);
    for (let index = 1; index < named.length; index++) {
      expect(named[index].x - named[index - 1].x).toBeGreaterThanOrEqual(96);
    }
  });
});
