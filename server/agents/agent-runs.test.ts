import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { type RunCache, agentTranscripts, runOf, runsSince } from './agent-runs.ts';

const user = (at: string, more: Record<string, unknown> = {}): string =>
  JSON.stringify({
    type: 'user',
    timestamp: at,
    sessionId: 's1',
    cwd: 'E:\\repos\\observatory',
    gitBranch: 'feat/217-agent-usage',
    ...more,
  });

const reply = (
  id: string,
  at: string,
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number },
  tools: string[] = [],
): string =>
  JSON.stringify({
    type: 'assistant',
    timestamp: at,
    sessionId: 's1',
    cwd: 'E:\\repos\\observatory',
    message: {
      id,
      model: 'claude-opus-5-5',
      usage: {
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_input_tokens: usage.cacheRead,
        cache_creation_input_tokens: usage.cacheWrite,
      },
      content: tools.map((name) => ({ type: 'tool_use', name })),
    },
  });

const META = JSON.stringify({
  agentType: 'agent-playbook:dev',
  description: 'Implement issue 217',
});

const LINES = [
  user('2026-09-30T10:00:00.000Z'),
  reply(
    'm1',
    '2026-09-30T10:00:05.000Z',
    { input: 10, output: 50, cacheRead: 0, cacheWrite: 20_000 },
    ['Read'],
  ),
  reply(
    'm2',
    '2026-09-30T10:01:00.000Z',
    { input: 5, output: 80, cacheRead: 20_000, cacheWrite: 3_000 },
    ['Edit', 'Bash'],
  ),
  // A streamed reply repeats its usage as it grows; it counts once, at its largest.
  reply('m2', '2026-09-30T10:01:02.000Z', {
    input: 5,
    output: 120,
    cacheRead: 20_000,
    cacheWrite: 3_000,
  }),
  user('2026-09-30T10:04:00.000Z'),
];

describe('runOf', () => {
  it('reads the agent, its description, branch, session, folder and time taken', () => {
    const run = runOf('a1', META, LINES);

    assert.equal(run?.agentType, 'agent-playbook:dev');
    assert.equal(run?.description, 'Implement issue 217');
    assert.equal(run?.branch, 'feat/217-agent-usage');
    assert.equal(run?.session, 's1');
    assert.equal(run?.cwd, 'E:\\repos\\observatory');
    assert.equal(run?.endedAt - run!.startedAt, 4 * 60_000);
    assert.equal(run?.model, 'claude-opus-5-5');
  });

  it('adds up each reply once, and counts its tool calls', () => {
    const run = runOf('a1', META, LINES);

    assert.deepEqual(run?.tokens, {
      input: 15,
      output: 170,
      cacheRead: 20_000,
      cacheWrite: 23_000,
    });
    assert.equal(run?.workTokens, 15 + 170 + 23_000);
    assert.equal(run?.toolUses, 3);
  });

  it('takes peak context from the fullest single request, not the sum over the run', () => {
    const run = runOf('a1', META, LINES);
    const sumOfContexts = 10 + 20_000 + (5 + 20_000 + 3_000);

    assert.equal(run?.peakContext, 5 + 20_000 + 3_000);
    assert.notEqual(run?.peakContext, sumOfContexts);
  });

  it('leaves the agent unnamed when there is no metadata, and skips a run with no replies', () => {
    assert.equal(runOf('a1', null, LINES)?.agentType, null);
    assert.equal(runOf('a1', '{not json', LINES)?.agentType, null);
    assert.equal(runOf('a2', META, [user('2026-09-30T10:00:00.000Z')]), null);
  });
});

describe('runsSince', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-runs-'));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const subagents = join(dir, 'e--repos-observatory', 's1', 'subagents');
  mkdirSync(subagents, { recursive: true });
  writeFileSync(join(subagents, 'agent-a1.jsonl'), LINES.join('\n'));
  writeFileSync(join(subagents, 'agent-a1.meta.json'), META);
  // The session's own log is not a subagent run.
  writeFileSync(join(dir, 'e--repos-observatory', 's1.jsonl'), LINES.join('\n'));

  const memoryCache = (): RunCache & { writes: number } => {
    let stored = {};
    return {
      writes: 0,
      read: () => stored,
      write(runs) {
        stored = runs;
        this.writes++;
      },
    };
  };

  it('finds only transcripts inside a subagents folder', () => {
    assert.deepEqual(
      [...agentTranscripts(dir)].map((each) => each.id),
      ['a1'],
    );
  });

  it('reads each run once, then serves it from the cache while its files are unchanged', () => {
    const cache = memoryCache();
    const first = runsSince(dir, 0, cache);
    const cached = cache.read();
    const second = runsSince(dir, 0, cache);

    assert.equal(first.length, 1);
    assert.deepEqual(second, first);
    assert.deepEqual(cache.read(), cached);
  });

  it('skips transcripts last changed before the window', () => {
    assert.deepEqual(runsSince(dir, Date.now() + 60_000, memoryCache()), []);
  });
});
