import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summaryOf, toolCallOf } from './transcript-summary.ts';

const at = (minute: number): string => new Date(Date.UTC(2026, 9, 7, 9, minute)).toISOString();

const prompt = (minute: number, content: unknown = 'Do the thing', more = {}): string =>
  JSON.stringify({
    type: 'user',
    timestamp: at(minute),
    message: { role: 'user', content },
    ...more,
  });

const reply = (minute: number, stop: string | null, content: unknown[] = [], more = {}): string =>
  JSON.stringify({
    type: 'assistant',
    timestamp: at(minute),
    message: { role: 'assistant', stop_reason: stop, content },
    ...more,
  });

const toolUse = (name: string, input: Record<string, unknown>) => ({
  type: 'tool_use',
  id: `call-${name}`,
  name,
  input,
});

describe('summaryOf', () => {
  it('takes the latest folder and branch, since a session moves between checkouts', () => {
    const summary = summaryOf([
      prompt(0, 'start', { cwd: 'E:\\repos\\app', gitBranch: 'main' }),
      reply(1, 'tool_use', [], { cwd: 'E:\\repos\\app-wt-7', gitBranch: 'feat/7-x' }),
      JSON.stringify({ type: 'attachment', timestamp: at(2) }),
    ]);

    assert.equal(summary.cwd, 'E:\\repos\\app-wt-7');
    assert.equal(summary.branch, 'feat/7-x');
    assert.equal(summary.lastLineAt, Date.parse(at(2)));
  });

  it('reads the turn as ended when the last reply ended it, and not once a new prompt arrives', () => {
    const ended = [prompt(0), reply(1, null, [{ type: 'thinking' }]), reply(1, 'end_turn')];

    assert.equal(summaryOf(ended).isTurnEnded, true);
    assert.equal(summaryOf([...ended, prompt(2)]).isTurnEnded, false);
    assert.equal(summaryOf([prompt(0), reply(1, 'tool_use')]).isTurnEnded, false);
  });

  it('keeps the turn ended past meta lines, and reads an interruption as ended', () => {
    const meta = prompt(2, 'local command output', { isMeta: true });
    const interrupted = prompt(3, [{ type: 'text', text: '[Request interrupted by user]' }]);

    assert.equal(summaryOf([prompt(0), reply(1, 'end_turn'), meta]).isTurnEnded, true);
    assert.equal(summaryOf([prompt(0), reply(1, 'tool_use'), interrupted]).isTurnEnded, true);
  });

  it('names the last tool call and what it was aimed at', () => {
    const summary = summaryOf([
      reply(0, 'tool_use', [toolUse('Bash', { command: 'npm test' })]),
      reply(1, 'tool_use', [toolUse('Read', { file_path: 'src/app.ts' })]),
    ]);

    assert.equal(summary.lastTool, 'Read src/app.ts');
  });

  it('marks a claude -p session headless and takes the latest title', () => {
    const summary = summaryOf([
      prompt(0, 'go', { entrypoint: 'sdk-cli' }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'First' }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Design the agents list' }),
    ]);

    assert.equal(summary.isHeadless, true);
    assert.equal(summary.title, 'Design the agents list');
    assert.equal(summaryOf([prompt(0, 'go', { entrypoint: 'claude-vscode' })]).isHeadless, false);
  });

  it('skips a line that will not parse, and tells bookkeeping from a conversation', () => {
    const bookkeeping = JSON.stringify({ type: 'file-history-snapshot', timestamp: at(0) });

    assert.equal(summaryOf([bookkeeping, '{"type":"user","mess']).isConversation, false);
    assert.equal(summaryOf(['not json', prompt(1)]).isConversation, true);
  });
});

describe('toolCallOf', () => {
  it('folds a long command onto one short line', () => {
    const call = toolCallOf(toolUse('Bash', { command: `echo\n${'x'.repeat(400)}` }));

    assert.ok(call?.startsWith('Bash echo xxx'));
    assert.equal(call?.length, 200);
    assert.ok(call?.endsWith('…'));
  });

  it('names a call with no telling input by its tool alone', () => {
    assert.equal(toolCallOf(toolUse('TodoWrite', { todos: [] })), 'TodoWrite');
    assert.equal(toolCallOf({ type: 'tool_use' }), null);
  });
});
