import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { modelUsage, tokenTotals, topTools } from './usage-breakdown.ts';
import type { AssistantMessage, TokenDay } from './usage-types.ts';

const message = (model: string, more: Partial<AssistantMessage> = {}): AssistantMessage => ({
  id: 'm',
  at: 0,
  model,
  input: 1,
  output: 2,
  cacheRead: 100,
  cacheWrite: 3,
  session: 's1',
  cwd: '',
  tools: [],
  ...more,
});

const day = (families: Record<string, number>, more: Partial<TokenDay> = {}): TokenDay => ({
  day: '2026-09-26',
  families,
  cacheRead: 10,
  messages: 2,
  sessions: 1,
  toolCalls: 3,
  subagents: 1,
  ...more,
});

describe('tokenTotals', () => {
  it('adds the days up and counts each session once across them', () => {
    const totals = tokenTotals(
      [day({ opus: 5, sonnet: 1 }), day({ opus: 4 })],
      [
        message('a', { session: 's1' }),
        message('b', { session: 's1' }),
        message('c', { session: '' }),
      ],
    );

    assert.deepEqual(totals, {
      tokens: 10,
      cacheRead: 20,
      messages: 4,
      sessions: 1,
      toolCalls: 6,
      subagents: 2,
    });
  });
});

describe('modelUsage', () => {
  it('sums each model, the one that did the most work first', () => {
    const models = modelUsage([
      message('claude-sonnet-5'),
      message('claude-opus-5', { output: 50 }),
      message('claude-sonnet-5'),
    ]);

    assert.deepEqual(models, [
      {
        model: 'claude-opus-5',
        family: 'opus',
        input: 1,
        output: 50,
        cacheRead: 100,
        cacheWrite: 3,
        messages: 1,
      },
      {
        model: 'claude-sonnet-5',
        family: 'sonnet',
        input: 2,
        output: 4,
        cacheRead: 200,
        cacheWrite: 6,
        messages: 2,
      },
    ]);
  });
});

describe('topTools', () => {
  it('counts calls by tool, most first, as many as asked', () => {
    const tools = topTools(
      [message('a', { tools: ['Read', 'Bash'] }), message('a', { tools: ['Bash', 'Edit'] })],
      2,
    );

    assert.deepEqual(tools, [
      { name: 'Bash', count: 2 },
      { name: 'Read', count: 1 },
    ]);
  });
});
