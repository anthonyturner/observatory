import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CollisionsReport } from '../collisions/collisions-report.ts';
import { collisionsFrom, usageFrom, withPushedConflicts } from './pushed-data.ts';

const live: CollisionsReport = {
  generatedAt: '2026-09-26T12:00:00Z',
  repo: 'me/app',
  check: 'no-clone',
  pairs: [
    { a: 1, b: 2, files: ['a.ts'], conflicts: null },
    { a: 2, b: 3, files: ['b.ts'], conflicts: null },
  ],
};

const pushed = (pairs: CollisionsReport['pairs']): CollisionsReport => ({
  generatedAt: '2026-09-26T11:00:00Z',
  repo: 'me/app',
  check: 'checked',
  pairs,
});

describe('withPushedConflicts', () => {
  it('shows the unchecked pairs when nothing was pushed, or the push could not check', () => {
    assert.equal(withPushedConflicts(live, null), live);
    assert.equal(withPushedConflicts(live, { ...pushed([]), check: 'unreachable' }), live);
  });

  it('gives every live pair its pushed conflicts, and says checked when all were', () => {
    const report = withPushedConflicts(
      live,
      pushed([
        { a: 1, b: 2, files: ['a.ts'], conflicts: ['a.ts'] },
        { a: 2, b: 3, files: ['b.ts'], conflicts: [] },
        { a: 4, b: 5, files: ['gone.ts'], conflicts: ['gone.ts'] },
      ]),
    );

    assert.equal(report.check, 'checked');
    assert.equal(report.generatedAt, live.generatedAt);
    assert.deepEqual(
      report.pairs.map((pair) => pair.conflicts),
      [['a.ts'], []],
    );
  });

  it('leaves a pair the push did not know unchecked, and the report not checked', () => {
    const report = withPushedConflicts(
      live,
      pushed([{ a: 1, b: 2, files: ['a.ts'], conflicts: [] }]),
    );

    assert.equal(report.check, 'no-clone');
    assert.equal(report.pairs[1].conflicts, null);
  });
});

describe('collisionsFrom', () => {
  it('reads a report and refuses anything else', () => {
    const report = pushed([{ a: 1, b: 2, files: ['a.ts'], conflicts: null }]);

    assert.deepEqual(collisionsFrom(report), report);
    assert.equal(collisionsFrom(null), null);
    assert.equal(collisionsFrom({ ...report, check: 'maybe' }), null);
    assert.equal(collisionsFrom({ ...report, pairs: [{ a: '1', b: 2, files: [] }] }), null);
  });
});

describe('usageFrom', () => {
  it('reads a usage report and refuses anything else', () => {
    const usage = { generatedAt: 'x', limits: null, tokens: { days: 30, rows: [] } };

    assert.deepEqual(usageFrom(usage), usage);
    assert.equal(usageFrom({ generatedAt: 'x' }), null);
    assert.equal(usageFrom('usage'), null);
  });
});
