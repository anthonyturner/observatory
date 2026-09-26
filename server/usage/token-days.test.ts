import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familyOf, localDayKey, tokenDays } from './token-days.ts';
import type { AssistantMessage } from './usage-types.ts';

const NOW = new Date(2026, 8, 26, 15, 0).getTime();
const HOUR = 3_600_000;

const message = (id: string, at: number, model: string, output: number): AssistantMessage => ({
  id,
  at,
  model,
  input: 10,
  output,
  cacheRead: 99_999,
  cacheWrite: 5,
});

describe('tokenDays', () => {
  it('sums work tokens by local day and family, leaving cache reads out', () => {
    const rows = tokenDays(
      [
        message('a', NOW - HOUR, 'claude-opus-5', 100),
        message('b', NOW - 2 * HOUR, 'claude-sonnet-5', 20),
        message('c', NOW - 24 * HOUR, 'claude-opus-5', 1),
      ],
      NOW,
      3,
    );

    assert.deepEqual(rows, [
      { day: localDayKey(NOW - 48 * HOUR), families: {} },
      { day: localDayKey(NOW - 24 * HOUR), families: { opus: 16 } },
      { day: localDayKey(NOW), families: { opus: 115, sonnet: 35 } },
    ]);
  });

  it('ignores messages outside the window', () => {
    const rows = tokenDays([message('old', NOW - 10 * 24 * HOUR, 'claude-opus-5', 1)], NOW, 2);

    assert.ok(rows.every((row) => Object.keys(row.families).length === 0));
  });
});

describe('familyOf', () => {
  it('names a model by its family, whatever its version', () => {
    assert.equal(familyOf('claude-opus-5-5'), 'opus');
    assert.equal(familyOf('claude-haiku-4-5-20251001'), 'haiku');
    assert.equal(familyOf('gpt-5'), 'other');
  });
});
