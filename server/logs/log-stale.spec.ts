import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NO_OLDER, occurrencesByWindow, olderFrom, splitByAge } from './log-stale.ts';

const fault = (
  lastAt: string,
  window = 'desktop',
  level: 'error' | 'warn' = 'error',
  count = 1,
) => ({ level, window, count, lastAt });

describe('splitByAge', () => {
  it('splits at a day before the newest line, and the cutoff itself is not older', () => {
    const edge = fault('2026-09-21T12:00:00');
    const before = fault('2026-09-21T11:59:59');
    const after = fault('2026-09-22T01:00:00');

    const { current, older } = splitByAge([after, edge, before], '2026-09-22T12:00:00');

    assert.deepEqual(current, [after, edge]);
    assert.deepEqual(older, [before]);
  });

  it('crosses a month boundary', () => {
    const { older } = splitByAge([fault('2026-09-29T11:00:00')], '2026-10-01T00:00:00');

    assert.equal(older.length, 1);
  });

  it('has nothing older when there is no newest line, or it is not a time', () => {
    const faults = [fault('2026-09-01T00:00:00')];

    assert.deepEqual(splitByAge(faults, null), { current: faults, older: [] });
    assert.deepEqual(splitByAge(faults, '2026-99-99T00:00:00'), { current: faults, older: [] });
  });
});

describe('occurrencesByWindow', () => {
  it('adds up errors and warnings per window', () => {
    assert.deepEqual(
      occurrencesByWindow([
        fault('x', 'a', 'error', 3),
        fault('x', 'a', 'warn', 2),
        fault('x', 'b', 'warn', 5),
        fault('x', 'a', 'error', 1),
      ]),
      [
        { id: 'a', error: 4, warn: 2 },
        { id: 'b', error: 0, warn: 5 },
      ],
    );
  });
});

describe('olderFrom', () => {
  it('keeps what has the shape of older faults and defaults anything else', () => {
    const older = { count: 1, faults: [{ id: 1 }], windows: [{ id: 'a', error: 1, warn: 0 }] };

    assert.deepEqual(olderFrom(older), older);
    assert.deepEqual(olderFrom(undefined), NO_OLDER);
    assert.deepEqual(olderFrom({ count: 'many', faults: [], windows: [] }), NO_OLDER);
    assert.deepEqual(olderFrom({ count: 1, faults: {}, windows: [] }), NO_OLDER);
  });
});
