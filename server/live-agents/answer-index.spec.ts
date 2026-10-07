import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { AnswerIndex } from './answer-index.ts';

const root = mkdtempSync(join(tmpdir(), 'answer-index-'));
after(() => rmSync(root, { recursive: true, force: true }));

const answer = (call: string, minute: number): string =>
  `${JSON.stringify({
    type: 'user',
    timestamp: new Date(Date.UTC(2026, 9, 7, 9, minute)).toISOString(),
    message: { content: [{ type: 'tool_result', tool_use_id: call }] },
  })}\n`;

describe('AnswerIndex', () => {
  it('picks up answers written after the first read, reading only the new bytes', async () => {
    const file = join(root, 'session.jsonl');
    writeFileSync(file, answer('call-1', 1));
    const index = new AnswerIndex();

    await index.answersIn(file);
    appendFileSync(file, answer('call-2', 2));
    const answers = await index.answersIn(file);

    assert.deepEqual([...answers.calls.keys()], ['call-1', 'call-2']);
  });

  it('reads a transcript seen for the first time no further back than it is told', async () => {
    const file = join(root, 'long.jsonl');
    const late = answer('late', 2);
    writeFileSync(file, `${answer('early', 1)}${late}`);

    const answers = await new AnswerIndex(late.length).answersIn(file);

    assert.deepEqual([...answers.calls.keys()], ['late']);
  });

  it('reads a transcript written afresh from its start, and forgets ones no longer live', async () => {
    const file = join(root, 'rewritten.jsonl');
    writeFileSync(file, `${answer('old', 1)}${answer('old-2', 1)}`);
    const index = new AnswerIndex();
    await index.answersIn(file);

    writeFileSync(file, answer('new', 2));
    const answers = await index.answersIn(file);
    index.keepOnly(new Set());

    assert.deepEqual([...answers.calls.keys()], ['new']);
    assert.deepEqual([...(await index.answersIn(join(root, 'gone.jsonl'))).calls], []);
  });
});
