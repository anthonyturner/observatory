import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AnswerBook, mergedAnswers } from './transcript-answers.ts';

const at = (minute: number): string => new Date(Date.UTC(2026, 9, 7, 9, minute)).toISOString();

const result = (minute: number, call: string, toolUseResult: Record<string, unknown>): string =>
  JSON.stringify({
    type: 'user',
    timestamp: at(minute),
    message: { content: [{ type: 'tool_result', tool_use_id: call, content: 'report' }] },
    toolUseResult,
  });

const notice = (minute: number, task: string, status: string, type = 'queue-operation'): string =>
  JSON.stringify({
    type,
    timestamp: at(minute),
    content: `<task-notification>\n<task-id>${task}</task-id>\n<status>${status}</status>`,
  });

describe('AnswerBook', () => {
  it('records answered calls, but not a background launch, which answers at once', () => {
    const book = new AnswerBook();

    book.add([
      result(4, 'call-1', { status: 'completed' }),
      result(5, 'call-2', { status: 'async_launched', isAsync: true }),
    ]);

    assert.deepEqual([...book.calls], [['call-1', Date.parse(at(4))]]);
  });

  it('records a background task once it is reported done, not while it runs', () => {
    const book = new AnswerBook();

    book.add([notice(6, 'abc123', 'completed'), notice(7, 'def456', 'running')]);

    assert.deepEqual([...book.tasks], [['abc123', Date.parse(at(6))]]);
  });

  it('keeps the latest answer to an id, and skips lines that will not parse', () => {
    const book = new AnswerBook();

    book.add([notice(9, 'abc', 'failed'), notice(3, 'abc', 'completed'), '{"<task-id>']);

    assert.deepEqual([...book.tasks], [['abc', Date.parse(at(9))]]);
  });
});

describe('mergedAnswers', () => {
  it('holds every transcript’s answers, the latest per id', () => {
    const first = new AnswerBook();
    const second = new AnswerBook();
    first.add([result(1, 'call', {}), notice(1, 'task', 'completed')]);
    second.add([result(2, 'call', {})]);

    const merged = mergedAnswers([first, second]);

    assert.equal(merged.calls.get('call'), Date.parse(at(2)));
    assert.equal(merged.tasks.get('task'), Date.parse(at(1)));
  });
});
