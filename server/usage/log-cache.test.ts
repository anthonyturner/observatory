import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { messagesSince } from './log-cache.ts';

const reply = (id: string, timestamp: string) =>
  JSON.stringify({
    type: 'assistant',
    timestamp,
    message: { id, model: 'claude-sonnet-5', usage: { input_tokens: 1, output_tokens: 2 } },
  }) + '\n';

function setUp() {
  const root = mkdtempSync(join(tmpdir(), 'observatory-cache-'));
  const logs = join(root, 'projects');
  mkdirSync(join(logs, 'a'), { recursive: true });
  mkdirSync(join(logs, 'b'), { recursive: true });
  return { logs, cache: join(root, 'cache.json') };
}

describe('messagesSince', () => {
  it('counts a reply once when a resumed session copies it into a new file', async () => {
    const { logs, cache } = setUp();
    writeFileSync(join(logs, 'a', 'one.jsonl'), reply('m1', '2026-09-26T10:00:00Z'));
    writeFileSync(
      join(logs, 'b', 'two.jsonl'),
      reply('m1', '2026-09-26T10:00:00Z') + reply('m2', '2026-09-26T11:00:00Z'),
    );

    const messages = await messagesSince(logs, 0, cache);

    assert.deepEqual(messages.map((message) => message.id).sort(), ['m1', 'm2']);
  });

  it('leaves out messages before the window', async () => {
    const { logs, cache } = setUp();
    writeFileSync(
      join(logs, 'a', 'one.jsonl'),
      reply('old', '2026-08-01T00:00:00Z') + reply('new', '2026-09-26T00:00:00Z'),
    );

    const messages = await messagesSince(logs, Date.parse('2026-09-01T00:00:00Z'), cache);

    assert.deepEqual(
      messages.map((message) => message.id),
      ['new'],
    );
  });

  it('picks up a file that grew since the last read', async () => {
    const { logs, cache } = setUp();
    const file = join(logs, 'a', 'one.jsonl');
    writeFileSync(file, reply('m1', '2026-09-26T10:00:00Z'));
    await messagesSince(logs, 0, cache);

    appendFileSync(file, reply('m2', '2026-09-26T10:05:00Z'));

    assert.equal((await messagesSince(logs, 0, cache)).length, 2);
  });
});
