import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { messageOf, messagesIn, sessionLogFiles } from './session-log.ts';

const reply = (id: string, output: number, model = 'claude-opus-5', tools: string[] = []) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: '2026-09-26T10:00:00Z',
    sessionId: 's1',
    cwd: 'E:\repos\observatory',
    message: {
      id,
      model,
      content: [{ type: 'text', text: 'ok' }, ...tools.map((name) => ({ type: 'tool_use', name }))],
      usage: {
        input_tokens: 10,
        output_tokens: output,
        cache_read_input_tokens: 1000,
        cache_creation_input_tokens: 50,
      },
    },
  });

describe('messageOf', () => {
  it('reads an assistant reply’s usage', () => {
    assert.deepEqual(messageOf(reply('m1', 7)), {
      id: 'm1',
      at: Date.parse('2026-09-26T10:00:00Z'),
      model: 'claude-opus-5',
      input: 10,
      output: 7,
      cacheRead: 1000,
      cacheWrite: 50,
      session: 's1',
      cwd: 'E:\repos\observatory',
      tools: [],
    });
  });

  it('names each tool the reply calls', () => {
    assert.deepEqual(messageOf(reply('m3', 1, 'claude-opus-5', ['Bash', 'Agent']))?.tools, [
      'Bash',
      'Agent',
    ]);
  });

  it('skips other lines, placeholders and lines that do not parse', () => {
    assert.equal(messageOf('{"type":"user","message":{"id":"u"}}'), null);
    assert.equal(messageOf(reply('m2', 1, '<synthetic>')), null);
    assert.equal(messageOf('{not json'), null);
  });
});

describe('messagesIn', () => {
  it('counts a streamed reply once, at its largest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-logs-'));
    const file = join(dir, 'session.jsonl');
    writeFileSync(
      file,
      [reply('m1', 3), reply('m1', 9), '{"type":"user"}', reply('m2', 4)].join('\n'),
    );

    const messages = await messagesIn(file);

    assert.deepEqual(
      messages.map((message) => [message.id, message.output]),
      [
        ['m1', 9],
        ['m2', 4],
      ],
    );
  });
});

describe('sessionLogFiles', () => {
  it('finds logs in nested folders and nothing else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'observatory-tree-'));
    mkdirSync(join(dir, 'project', 'sub'), { recursive: true });
    writeFileSync(join(dir, 'project', 'a.jsonl'), '');
    writeFileSync(join(dir, 'project', 'sub', 'b.jsonl'), '');
    writeFileSync(join(dir, 'project', 'notes.txt'), '');

    assert.equal([...sessionLogFiles(dir)].length, 2);
    assert.deepEqual([...sessionLogFiles(join(dir, 'missing'))], []);
  });
});
