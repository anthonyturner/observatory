import { QueueItem } from './queue-report';
import { layoutStars, starGrowth, starPosition, starPulse } from './star-layout';

const item = (number: number, overrides: Partial<QueueItem> = {}): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [],
  failingChecks: 0,
  additions: 1,
  deletions: 1,
  idleDays: 0,
  ageDays: 0,
  isSeen: false,
  hidden: null,
  ...overrides,
});

describe('layoutStars', () => {
  const items = [
    item(1, { bucket: 'conflicted', idleDays: 49 }),
    item(2, { bucket: 'conflicted' }),
    item(3),
    item(4, { bucket: 'unlinked' }),
  ];

  it('makes one constellation per bucket in use, left to right in bucket order', () => {
    const { constellations } = layoutStars(items);

    expect(constellations.map((c) => c.bucket)).toEqual(['conflicted', 'unlinked', 'unreviewed']);
    expect(constellations[0].centreX).toBeLessThan(constellations[1].centreX);
    expect(constellations[1].centreX).toBeLessThan(constellations[2].centreX);
  });

  it('burns brighter the longer a pull request has sat, and rings only the blocked', () => {
    const { stars } = layoutStars(items);
    const [old, fresh] = stars;

    expect(old.magnitude).toBeGreaterThan(fresh.magnitude);
    expect(stars.filter((star) => star.isUrgent).map((star) => star.item.number)).toEqual([1, 2]);
  });

  it('lights stars in queue order', () => {
    const delays = layoutStars(items).stars.map((star) => star.delay);

    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });

  it('keeps a star in the same place on every load', () => {
    expect(layoutStars(items).stars[0].x).toBe(layoutStars(items).stars[0].x);
  });

  it('bounds what it draws, and an empty sky still has a frame', () => {
    const { bounds, stars } = layoutStars(items);

    expect(stars.every((star) => star.x >= bounds.left && star.x <= bounds.right)).toBe(true);
    expect(layoutStars([]).bounds).toEqual({ left: 0, top: 0, right: 3600, bottom: 2000 });
  });
});

describe('star motion', () => {
  const [star] = layoutStars([item(1)]).stars;

  it('drifts within its radius', () => {
    const moved = starPosition(star, 5);

    expect(Math.hypot(moved.x - star.x, moved.y - star.y)).toBeLessThanOrEqual(
      star.driftRadius + 0.01,
    );
  });

  it('twinkles within a band and grows in after its delay', () => {
    expect(starPulse(star, 3)).toBeGreaterThan(0.5);
    expect(starGrowth(star, 0)).toBe(0);
    expect(starGrowth(star, 5)).toBe(1);
  });
});
