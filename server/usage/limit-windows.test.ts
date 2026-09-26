import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { limitsFrom, projectWeek, thin } from './limit-windows.ts';
import type { LimitSample, Point } from './usage-types.ts';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-09-26T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const WEEK_RESET = iso(NOW + 72 * HOUR);

const sample = (
  at: number,
  weekPct: number | null,
  fivePct: number | null,
  fiveReset = NOW + 2 * HOUR,
): LimitSample => ({
  at: iso(at),
  week: weekPct === null ? null : { pct: weekPct, resetsAt: WEEK_RESET },
  five: fivePct === null ? null : { pct: fivePct, resetsAt: iso(fiveReset) },
});

describe('limitsFrom', () => {
  it('takes each window from the newest reading that carries it', () => {
    const limits = limitsFrom([sample(NOW - 2 * HOUR, 10, 30), sample(NOW - HOUR, null, 45)], NOW);

    assert.equal(limits?.week?.pct, 10);
    assert.equal(limits?.five?.pct, 45);
    assert.deepEqual(limits?.five?.points, [
      [NOW - 2 * HOUR, 30],
      [NOW - HOUR, 45],
    ]);
  });

  it('marks a window whose reset has passed as expired, with no projection', () => {
    const lapsed = limitsFrom([sample(NOW - 3 * HOUR, 10, 50, NOW - HOUR)], NOW);

    assert.equal(lapsed?.five?.expired, true);
    assert.equal(lapsed?.week?.expired, false);
  });

  it('keeps only readings of the current window as points', () => {
    const limits = limitsFrom(
      [sample(NOW - 6 * HOUR, 5, 90, NOW - 4 * HOUR), sample(NOW - HOUR, 6, 10)],
      NOW,
    );

    assert.deepEqual(limits?.five?.points, [[NOW - HOUR, 10]]);
  });

  it('has nothing to say before the first reading', () => {
    assert.equal(limitsFrom([], NOW), null);
  });
});

describe('projectWeek', () => {
  it('carries the recent pace on to the reset', () => {
    const points: Point[] = [
      [NOW - 10 * HOUR, 10],
      [NOW, 20],
    ];

    assert.deepEqual(projectWeek(points, WEEK_RESET, NOW), {
      perHour: 1,
      atReset: 92,
      fullAt: null,
    });
  });

  it('says when the week runs out if the pace would pass 100%', () => {
    const points: Point[] = [
      [NOW - 2 * HOUR, 60],
      [NOW, 80],
    ];

    assert.equal(projectWeek(points, WEEK_RESET, NOW)?.fullAt, iso(NOW + 2 * HOUR));
  });

  it('has no pace from readings less than an hour apart', () => {
    assert.equal(
      projectWeek(
        [
          [NOW - 60_000, 1],
          [NOW, 2],
        ],
        WEEK_RESET,
        NOW,
      ),
      null,
    );
  });
});

describe('thin', () => {
  it('keeps the peak of every slice', () => {
    const points: Point[] = [
      [1, 5],
      [2, 9],
      [3, 1],
      [4, 2],
    ];

    assert.deepEqual(thin(points, 2), [
      [2, 9],
      [4, 2],
    ]);
  });
});
