import { DoneItem } from '../../../core/queue/done-work';
import { DONE_INNER, DONE_OUTER, placeDone } from './done-spiral';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const DAY = 86_400_000;
const done = (n: number, daysAgo: number): DoneItem => ({
  key: `pr${n}`,
  kind: 'merged',
  number: n,
  title: String(n),
  at: NOW - daysAgo * DAY,
  day: '',
});

describe('placeDone', () => {
  it('puts newer work further out along the arm, older work toward the core', () => {
    const places = placeDone([done(1, 50), done(2, 10), done(3, 0)], NOW);
    const radius = (n: number) => places.find((p) => p.item.number === n)?.r ?? 0;

    expect(radius(3)).toBeGreaterThan(radius(2));
    expect(radius(2)).toBeGreaterThan(radius(1));
    for (const place of places) {
      expect(place.r).toBeGreaterThanOrEqual(DONE_INNER);
      expect(place.r).toBeLessThanOrEqual(DONE_OUTER + 0.02);
    }
  });

  it('uses both arms, and keeps each light in the same place on every load', () => {
    const items = Array.from({ length: 40 }, (_, i) => done(i + 1, i));
    const [a, b] = [placeDone(items, NOW), placeDone(items, NOW)];

    expect(new Set(a.map((p) => p.arm))).toEqual(new Set([0, 1]));
    expect(a).toEqual(b);
  });

  it('spreads a young repository over the whole arm', () => {
    const places = placeDone([done(1, 9), done(2, 0)], NOW);
    const radius = (n: number) => places.find((p) => p.item.number === n)?.r ?? 0;

    expect(radius(1)).toBeLessThan(DONE_INNER + 0.02);
    expect(radius(2)).toBeGreaterThan(DONE_OUTER - 0.02);
  });

  it('ranks arrivals oldest first, so the core fills before the tips', () => {
    const places = placeDone([done(3, 0), done(1, 50)], NOW);
    expect(places.map((p) => [p.item.number, p.rank])).toEqual([
      [1, 0],
      [3, 1],
    ]);
  });
});
