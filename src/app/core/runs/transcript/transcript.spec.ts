import { RUN_FOLDER, claudeEvent, recordedEvents } from '../testing/run-fixtures';
import { RunEvent } from '../runs.types';
import { Transcript } from './transcript';
import { FoldEntry, TranscriptEntry } from './transcript.types';

function read(events: readonly RunEvent[]): Transcript {
  const transcript = new Transcript(RUN_FOLDER);
  for (const event of events) transcript.read(event);
  return transcript;
}

const folds = (entries: readonly TranscriptEntry[]): FoldEntry[] =>
  entries.filter((entry): entry is FoldEntry => entry.kind === 'fold');

const foldNamed = (entries: readonly TranscriptEntry[], name: string): FoldEntry => {
  const fold = folds(entries).find((each) => each.name === name);
  if (!fold) throw new Error(`no ${name} row`);
  return fold;
};

describe('Transcript', () => {
  describe('a recorded run', () => {
    const transcript = read(recordedEvents());
    const entries = transcript.entries();

    it('reads it in order: hooks, the session, Claude’s words, each tool, a warning, the verdict', () => {
      expect(entries.map((entry) => (entry.kind === 'fold' ? entry.name : entry.kind))).toEqual([
        'Hooks',
        'quiet',
        'text',
        'Read',
        'Bash',
        'Write',
        'quiet',
        'result',
      ]);
      expect(entries[1]).toEqual(
        expect.objectContaining({ text: `Session started · claude-opus-5-5 · in ${RUN_FOLDER}` }),
      );
      expect(entries[2]).toEqual(expect.objectContaining({ text: 'I’ll read the test first.' }));
    });

    it('folds the hooks into one row that says how each went', () => {
      const hooks = foldNamed(entries, 'Hooks');

      expect(hooks.arg).toBe('1 ran');
      expect(hooks.isPlain).toBe(true);
      expect(hooks.detail).toEqual([
        {
          kind: 'hooks',
          title: 'Your Claude Code hooks',
          hooks: [
            {
              name: 'SessionStart:startup',
              said: ' · success · “Write your spoken line to C:\\Users\\me\\.claude\\agent-speak\\cues\\next.txt”',
            },
          ],
        },
      ]);
    });

    it('marks a tool with its result, and shortens a path inside the run’s folder', () => {
      const tool = foldNamed(entries, 'Read');

      expect(tool.status).toBe('ok');
      expect(tool.arg).toBe('src\\sum.spec.ts');
      expect(tool.detail).toEqual([
        expect.objectContaining({ title: 'Called with' }),
        expect.objectContaining({ title: 'Result', text: expect.stringContaining('sum(2, 2)') }),
      ]);
    });

    it('frames a refused tool as not allowed, with Claude Code’s own words', () => {
      const tool = foldNamed(entries, 'Bash');

      expect(tool.status).toBe('refused');
      expect(tool.arg).toBe('npm test -- sum');
      expect(tool.refusal).toEqual({
        isExpected: false,
        tag: 'Not allowed',
        why: 'Claude asked to run this. Your Claude Code settings don’t allow it, and a run from Home can’t ask you, so it was not done. Claude carries on without it.',
        claudeSaid: 'Claude Code: Bash(npm test -- sum) is not in your allow rules',
      });
      expect(tool.detail).toEqual([expect.objectContaining({ title: 'Called with' })]);
    });

    it('reads a refusal a hook asked for as expected, and does not count it', () => {
      const tool = foldNamed(entries, 'Write');

      expect(tool.status).toBe('skipped');
      expect(tool.refusal).toEqual(
        expect.objectContaining({
          isExpected: true,
          tag: 'Expected · from a hook',
          why: expect.stringContaining(
            'One of your SessionStart hooks asked Claude to write this.',
          ),
        }),
      );
      expect(transcript.facts()).toEqual(
        expect.objectContaining({ refused: 1, lastRefused: 'Bash' }),
      );
    });

    it('warns once near a limit, and says nothing while the plan allows the run', () => {
      const warnings = entries.filter((entry) => entry.kind === 'quiet' && entry.isWarning);

      expect(warnings).toEqual([
        expect.objectContaining({
          text: expect.stringMatching(/^Close to your weekly limit; it resets at \d\d:\d\d\.$/),
        }),
      ]);
    });

    it('ends on the verdict, with the time, the cost and the turns', () => {
      expect(entries.at(-1)).toEqual(
        expect.objectContaining({
          kind: 'result',
          isBad: false,
          heading: '✓ Done · 1 m 23 s · $0.42 · 6 turns',
          lines: ['Fixed the off-by-one in sum.ts.'],
        }),
      );
      expect(transcript.facts()).toEqual(
        expect.objectContaining({ costUsd: 0.4213, hasFailed: false, isThinking: false }),
      );
    });
  });

  it('knows Claude is thinking until it says something', () => {
    const thinking = read([claudeEvent(0, { type: 'system', subtype: 'thinking_tokens' })]);
    expect(thinking.facts().isThinking).toBe(true);

    thinking.read(claudeEvent(1, { type: 'assistant', message: { content: 'Done thinking.' } }));
    expect(thinking.facts().isThinking).toBe(false);
  });

  it('says why a run stopped with an error, and remembers it failed', () => {
    const transcript = read([
      claudeEvent(0, {
        type: 'result',
        subtype: 'error_max_turns',
        is_error: true,
        num_turns: 1,
        total_cost_usd: 0.004,
        errors: ['Reached maximum number of turns (1)'],
      }),
    ]);

    expect(transcript.entries()).toEqual([
      expect.objectContaining({
        kind: 'result',
        isBad: true,
        heading: '✕ Stopped with an error · $0.004 · 1 turn',
        lines: [
          'Claude Code stopped because it reached its turn limit.',
          'Reached maximum number of turns (1)',
        ],
      }),
    ]);
    expect(transcript.facts().hasFailed).toBe(true);
  });

  it('indents what an agent Claude started does', () => {
    const transcript = read([
      claudeEvent(0, {
        type: 'assistant',
        parent_tool_use_id: 'toolu_task',
        message: {
          content: [
            { type: 'text', text: 'Searching.' },
            { type: 'tool_use', id: 't1', name: 'Grep', input: { pattern: 'sum', path: 'src' } },
          ],
        },
      }),
    ]);

    expect(transcript.entries()).toEqual([
      expect.objectContaining({ kind: 'text', isNested: true }),
      expect.objectContaining({ name: 'Grep', arg: 'sum in src', isNested: true }),
    ]);
  });

  it('keeps a result whose call was trimmed away, saying so', () => {
    const transcript = read([
      claudeEvent(0, {
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'gone', content: 'ok', is_error: true }],
        },
      }),
    ]);

    expect(transcript.entries()).toEqual([
      expect.objectContaining({
        name: 'Tool',
        arg: 'its call was trimmed from the output',
        status: 'err',
      }),
    ]);
  });

  it('names an MCP tool by its server and tool', () => {
    const transcript = read([
      claudeEvent(0, {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'mcp__github__get_issue', input: { issue: '12' } },
          ],
        },
      }),
    ]);

    expect(folds(transcript.entries())[0]).toEqual(
      expect.objectContaining({ name: 'github · get_issue', arg: '12', status: 'run' }),
    );
  });

  it('never drops what it does not know: an unknown event opens on its JSON', () => {
    const transcript = read([
      claudeEvent(0, { type: 'system', subtype: 'compact_boundary' }),
      { n: 1, at: 0, kind: 'mystery', data: null },
    ]);

    expect(transcript.entries()).toEqual([
      expect.objectContaining({
        name: 'Event',
        arg: 'system/compact_boundary',
        detail: [expect.objectContaining({ title: 'As Claude Code sent it' })],
      }),
      expect.objectContaining({ kind: 'quiet', text: 'event: mystery' }),
    ]);
  });

  it('reads the runner’s own lines round Claude Code’s', () => {
    const transcript = read([
      { n: 0, at: 0, kind: 'trimmed', data: { dropped: 40 } },
      { n: 1, at: 0, kind: 'text', data: 'not json' },
      { n: 2, at: 0, kind: 'stderr', data: 'warning: slow disk' },
      { n: 3, at: 0, kind: 'cut', data: { head: '{"type":"user"', size: 300000 } },
      { n: 4, at: 0, kind: 'state', data: { state: 'stopping', stopping: 'time-limit' } },
      {
        n: 5,
        at: 0,
        kind: 'state',
        data: { state: 'failed', why: 'Claude Code exited with code 1' },
      },
    ]);

    expect(transcript.entries().map((entry) => (entry.kind === 'quiet' ? entry.text : ''))).toEqual(
      [
        'Earlier output trimmed to save memory (40 events).',
        'not json',
        'stderr · warning: slow disk',
        'One event was too long to keep (300000 characters). It began: {"type":"user"…',
        'Stopping: the time limit was reached.',
        'Run failed: Claude Code exited with code 1.',
      ],
    );
  });

  it('starts a new Hooks row once something else has come between', () => {
    const hook = (n: number, id: string) =>
      claudeEvent(n, { type: 'system', subtype: 'hook_started', hook_id: id, hook_name: id });
    const transcript = read([
      hook(0, 'a'),
      hook(1, 'b'),
      claudeEvent(2, { type: 'assistant', message: { content: 'Working.' } }),
      hook(3, 'c'),
    ]);

    expect(folds(transcript.entries()).map((fold) => fold.arg)).toEqual([
      '2 ran, 2 still running',
      '1 ran, 1 still running',
    ]);
  });
});
