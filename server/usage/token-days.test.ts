import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dayKeys, familyOf, localDayKey, tokenDays } from './token-days.ts';
import type { AssistantMessage } from './usage-types.ts';

const NOW = new Date(2026, 8, 26, 15, 0).getTime();
const HOUR = 3_600_000;

const message = (
  id: string,
  at: number,
  model: string,
  output: number,
  more: Partial<AssistantMessage> = {},
): AssistantMessage => ({
  id,
  at,
  model,
  input: 10,
  output,
  cacheRead: 99_999,
  cacheWrite: 5,
  session: 's1',
  cwd: '',
  tools: [],
  ...more,
});

const EMPTY = { families: {}, cacheRead: 0, messages: 0, sessions: 0, toolCalls: 0, subagents: 0 };

describe('tokenDays', () => {
  it('sums work tokens by local day and family, with cache reads apart', () => {
    const rows = tokenDays(
      [
        message('a', NOW - HOUR, 'claude-opus-5', 100),
        message('b', NOW - 2 * HOUR, 'claude-sonnet-5', 20, { session: 's2' }),
        message('c', NOW - 24 * HOUR, 'claude-opus-5', 1),
      ],
      NOW,
      3,
    );

    assert.deepEqual(rows, [
      { day: localDayKey(NOW - 48 * HOUR), ...EMPTY },
      {
        day: localDayKey(NOW - 24 * HOUR),
        ...EMPTY,
        families: { opus: 16 },
        cacheRead: 99_999,
        messages: 1,
        sessions: 1,
      },
      {
        day: localDayKey(NOW),
        ...EMPTY,
        families: { opus: 115, sonnet: 35 },
        cacheRead: 199_998,
        messages: 2,
        sessions: 2,
      },
    ]);
  });

  it('counts tool calls, and the ones that start a subagent', () => {
    const [row] = tokenDays(
      [message('a', NOW, 'claude-opus-5', 1, { tools: ['Bash', 'Agent', 'Task', 'Read'] })],
      NOW,
      1,
    );

    assert.equal(row.toolCalls, 4);
    assert.equal(row.subagents, 2);
  });

  it('ignores messages outside the window', () => {
    const rows = tokenDays([message('old', NOW - 10 * 24 * HOUR, 'claude-opus-5', 1)], NOW, 2);

    assert.ok(rows.every((row) => row.messages === 0));
  });
});

describe('dayKeys', () => {
  it('lists the days ending today, oldest first', () => {
    assert.deepEqual(dayKeys(NOW, 2), [localDayKey(NOW - 24 * HOUR), localDayKey(NOW)]);
  });
});

describe('familyOf', () => {
  it('names a model by its family, whatever its version', () => {
    assert.equal(familyOf('claude-opus-5-5'), 'opus');
    assert.equal(familyOf('claude-haiku-4-5-20251001'), 'haiku');
    assert.equal(familyOf('gpt-5'), 'other');
  });
});
