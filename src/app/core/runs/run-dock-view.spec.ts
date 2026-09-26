import { toClockFace } from '../time/clock-format';
import {
  SLOW_START_MS,
  dockHeadOf,
  flagsOf,
  noteOf,
  pillOf,
  recentRowsOf,
  timerOf,
} from './run-dock-view';
import { RunRecord } from './run-record';
import { STARTED_AT, claudeEvent, recordedEvents, summaryOf } from './testing/run-fixtures';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const hhmm = (ms: number) => toClockFace(new Date(ms)).hoursMinutes;

function finished(): RunRecord {
  const run = new RunRecord(summaryOf());
  run.replay(recordedEvents());
  run.setState('done');
  return run;
}

describe('the dock’s view of a run', () => {
  it('heads the followed run with Hide and Cancel run while it is live', () => {
    const run = new RunRecord(summaryOf());

    expect(dockHeadOf(run, run)).toEqual({
      name: 'app',
      prompt: 'Fix the failing sum test',
      folder: 'E:\\repos\\app',
      state: 'running',
      stateWord: 'Running',
      canCancel: true,
      isStopping: false,
      hideLabel: 'Hide',
      backLabel: null,
    });
  });

  it('heads an earlier run with its time and the way back', () => {
    const live = new RunRecord(summaryOf({ id: 'run-2' }));
    const earlier = finished();

    expect(dockHeadOf(earlier, live)).toEqual(
      expect.objectContaining({
        name: `app · earlier run, ${hhmm(STARTED_AT)}`,
        canCancel: false,
        backLabel: 'Back to the current run',
      }),
    );
    live.setState('done');
    expect(dockHeadOf(earlier, live)).toEqual(
      expect.objectContaining({ hideLabel: 'Close', backLabel: 'Back to the last run' }),
    );
  });

  it('reads a run that ended cleanly with an error of Claude Code’s own as an error', () => {
    const run = new RunRecord(summaryOf());
    run.read(claudeEvent(0, { type: 'result', subtype: 'error_max_turns', is_error: true }));
    run.setState('done');

    expect(dockHeadOf(run, run).stateWord).toBe('Error');
  });

  it('times a run against its limit, and says what is left near the end', () => {
    const run = new RunRecord(summaryOf());

    expect(timerOf(run, true, STARTED_AT + 3 * MINUTE + 12 * SECOND)).toEqual({
      text: '03:12 of 30:00',
      isLate: false,
    });
    expect(timerOf(run, true, STARTED_AT + 26 * MINUTE)).toEqual({
      text: '26:00 of 30:00 · 4 min left',
      isLate: true,
    });
  });

  it('flags the refusals and the cost, and Thinking only while it thinks live', () => {
    const run = finished();

    expect(flagsOf(run, false)).toEqual([
      { text: '1 refused', tone: 'refused' },
      { text: '$0.42', tone: 'cost' },
    ]);
    const thinking = new RunRecord(summaryOf());
    thinking.read(claudeEvent(0, { type: 'system', subtype: 'thinking_tokens' }));
    expect(flagsOf(thinking, true)).toEqual([{ text: 'Thinking…', tone: 'plain' }]);
  });

  it('says why a start is quiet once it has been for a while', () => {
    const run = new RunRecord(summaryOf({ state: 'starting' }));

    expect(noteOf(run, run, STARTED_AT + SLOW_START_MS - 1)).toBeNull();
    expect(noteOf(run, run, STARTED_AT + 12 * SECOND)?.text).toBe(
      'Waiting for Claude Code’s first output (12 s). Your Claude Code hooks run first, so this can take a while.',
    );
  });

  it('pills the followed run, or the recent ones, or nothing', () => {
    const run = new RunRecord(summaryOf());

    expect(pillOf(run, 0, STARTED_AT + 65 * SECOND)).toEqual({
      text: 'Running · 01:05',
      label: 'Claude Code task: Running · 01:05. Show it',
      isPast: false,
    });
    expect(pillOf(null, 3, 0)).toEqual({
      text: 'Recent runs · 3',
      label: 'Recent Claude Code tasks: 3. Show them',
      isPast: true,
    });
    expect(pillOf(null, 0, 0)).toBeNull();
  });

  it('lists Recent runs with the followed run’s own state, newest first', () => {
    const followed = new RunRecord(summaryOf({ id: 'run-3', state: 'starting' }));
    followed.setState('running');
    const report = {
      current: summaryOf({ id: 'run-3', state: 'starting' }),
      recent: [
        summaryOf({
          id: 'run-2',
          prompt: 'Tidy the README\nand more',
          state: 'done',
          endedAt: STARTED_AT + 83 * SECOND,
          result: { error: false, subtype: 'success', costUsd: 0.1, turns: 3, durationMs: 1 },
        }),
        summaryOf({ id: 'run-1', state: 'cancelled', endedAt: STARTED_AT + 5 * SECOND }),
      ],
    };

    const rows = recentRowsOf(report, followed, 'run-2');

    expect(
      rows.map(({ id, mark, tone, time, meta, isShown }) => ({
        id,
        mark,
        tone,
        time,
        meta,
        isShown,
      })),
    ).toEqual([
      { id: 'run-3', mark: '●', tone: 'live', time: 'now', meta: 'Running', isShown: false },
      {
        id: 'run-2',
        mark: '✓',
        tone: 'ok',
        time: hhmm(STARTED_AT),
        meta: 'Done · 1 m 23 s · $0.10',
        isShown: true,
      },
      {
        id: 'run-1',
        mark: '⊘',
        tone: 'plain',
        time: hhmm(STARTED_AT),
        meta: 'Cancelled · 5 s',
        isShown: false,
      },
    ]);
    expect(rows[1].prompt).toBe('Tidy the README');
    expect(rows[1].label).toBe(
      `Started ${hhmm(STARTED_AT)}: Tidy the README. Done · 1 m 23 s · $0.10.`,
    );
  });

  it('lists the followed run even once the runner has let it go', () => {
    const followed = finished();

    expect(
      recentRowsOf({ current: null, recent: [] }, followed, null).map((row) => row.id),
    ).toEqual(['run-1']);
  });
});
