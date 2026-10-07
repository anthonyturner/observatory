import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TEXT_CHARS,
  TOOL_INPUT_CHARS,
  TOOL_RESULT_CHARS,
  clipped,
  feedEventOf,
} from './feed-events.ts';
import type { TranscriptLine } from './transcript-lines.ts';

const BOOKKEEPING = [
  'attachment',
  'system',
  'ai-title',
  'queue-operation',
  'file-history-snapshot',
  'last-prompt',
  'bridge-session',
  'atis-latch',
  'pr-link',
];

/** A line as Claude Code writes it, with the fields the feed must never send. */
const line = (type: string, content: unknown, more: Record<string, unknown> = {}): TranscriptLine =>
  ({
    type,
    uuid: 'u1',
    sessionId: 's1',
    cwd: 'E:\\repos\\app',
    timestamp: '2026-10-07T12:00:00.000Z',
    message: { id: 'msg_1', role: type, model: 'claude', usage: { input_tokens: 9 }, content },
    ...more,
  }) as TranscriptLine;

describe('feedEventOf', () => {
  it('keeps a reply’s words and tool calls, and drops its thinking', () => {
    const event = feedEventOf(
      line('assistant', [
        { type: 'thinking', thinking: 'secret plan', signature: 'sig' },
        { type: 'text', text: 'Reading it.' },
        { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'a.ts' }, caller: {} },
      ]),
    );

    assert.deepEqual(event, {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Reading it.' },
          { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'a.ts' } },
        ],
      },
    });
  });

  it('drops a reply that was only thinking', () => {
    assert.equal(feedEventOf(line('assistant', [{ type: 'thinking', thinking: 'hm' }])), null);
  });

  it('keeps a tool result’s text, never the line’s toolUseResult', () => {
    const event = feedEventOf(
      line(
        'user',
        [{ type: 'tool_result', tool_use_id: 'toolu_1', is_error: true, content: 'no such file' }],
        { toolUseResult: { stdout: 'the whole file', file: { content: 'TOKEN=abc' } } },
      ),
    );

    assert.deepEqual(event, {
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', is_error: true, content: 'no such file' },
        ],
      },
    });
    assert.doesNotMatch(JSON.stringify(event), /toolUseResult|whole file|TOKEN/);
  });

  it('keeps a typed prompt, and drops the lines Claude Code adds for itself', () => {
    assert.deepEqual(feedEventOf(line('user', 'Fix the build')), {
      type: 'user',
      message: { content: 'Fix the build' },
    });
    assert.equal(
      feedEventOf(line('user', '<command-name>/clear</command-name>', { isMeta: true })),
      null,
    );
    assert.equal(feedEventOf(line('user', '   ')), null);
  });

  it('drops every line that is not a reply or a prompt', () => {
    for (const type of BOOKKEEPING) {
      assert.equal(
        feedEventOf(line(type, 'anything', { attachment: { type: 'file' } })),
        null,
        type,
      );
    }
  });

  it('names an image rather than sending it, and drops block types it does not know', () => {
    const image = { type: 'image', source: { type: 'base64', data: 'iVBORw0KGgo' } };
    const event = feedEventOf(
      line('user', [
        image,
        { type: 'tool_result', tool_use_id: 't', content: [{ type: 'text', text: 'shot' }, image] },
        { type: 'document', source: { data: 'pdf' } },
      ]),
    );

    assert.deepEqual(event?.message.content, [
      { type: 'text', text: '[image not shown]' },
      {
        type: 'tool_result',
        tool_use_id: 't',
        is_error: false,
        content: 'shot\n[image not shown]',
      },
    ]);
  });

  it('cuts every tool-input string, however deep, to 300 characters', () => {
    const long = 'a'.repeat(5_000);
    const event = feedEventOf(
      line('assistant', [
        {
          type: 'tool_use',
          id: 't',
          name: 'Edit',
          input: { old_string: long, edits: [{ new_string: long }], replace_all: false },
        },
      ]),
    );
    const [call] = event?.message.content as readonly { input: Record<string, unknown> }[];

    assert.equal((call.input['old_string'] as string).length, TOOL_INPUT_CHARS);
    assert.match(call.input['old_string'] as string, /…$/);
    assert.equal(
      ((call.input['edits'] as Record<string, string>[])[0]['new_string'] as string).length,
      TOOL_INPUT_CHARS,
    );
    assert.equal(call.input['replace_all'], false);
  });

  it('cuts a tool result to 2,000 characters and words to 8,000', () => {
    const long = 'b'.repeat(50_000);
    const result = feedEventOf(
      line('user', [{ type: 'tool_result', tool_use_id: 't', content: long }]),
    );
    const reply = feedEventOf(line('assistant', [{ type: 'text', text: long }]));

    assert.equal(
      (result?.message.content[0] as { content: string }).content.length,
      TOOL_RESULT_CHARS,
    );
    assert.equal((reply?.message.content[0] as { text: string }).text.length, TEXT_CHARS);
  });

  it('reads a block or line of an unexpected shape as nothing, never a crash', () => {
    assert.equal(feedEventOf({ type: 'assistant' }), null);
    assert.equal(feedEventOf({ type: 'assistant', message: { content: [null, 7, 'x'] } }), null);
    assert.deepEqual(feedEventOf(line('assistant', [{ type: 'tool_use', input: 'odd' }])), {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: '', name: 'Tool', input: {} }] },
    });
  });
});

describe('clipped', () => {
  it('blanks a bearer token or API key in what it keeps', () => {
    assert.equal(
      clipped('Authorization: Bearer abc.def sk-or-v1-123', 300),
      'Authorization: Bearer [key] [key]',
    );
  });
});
