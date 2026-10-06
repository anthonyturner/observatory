import { AgentsReport } from '../agents/agents-report';
import { Frame, FrameItem } from './history-report';
import { FinishedPull } from './ledger';
import {
  NO_HANDOFF,
  WEEK_MS,
  agentWeeks,
  cycleWeeks,
  finishedIn,
  retroWeeks,
  whereTheyWaited,
} from './weekly-retro';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-06T12:00:00Z');
const hoursAgo = (hours: number): number => NOW - hours * HOUR;

const pull = (
  number: number,
  openedHoursAgo: number,
  finishedHoursAgo: number,
  fate: FinishedPull['fate'] = 'merged',
): FinishedPull => ({
  number,
  openedAt: hoursAgo(openedHoursAgo),
  finishedAt: hoursAgo(finishedHoursAgo),
  fate,
});

const item = (number: number, bucket: FrameItem['bucket']): FrameItem => ({
  number,
  title: `#${number}`,
  bucket,
  idleDays: 0,
});

const frame = (hoursBack: number, items: readonly FrameItem[]): Frame => ({
  at: new Date(hoursAgo(hoursBack)).toISOString(),
  items,
  departed: [],
});

const card = (agent: string, prs: readonly number[]): AgentsReport['agents'][number] => ({
  agent,
  basis: 'named',
  prs,
  opened: prs.length,
  merged: 0,
  open: 0,
  conflicting: 0,
  unlinked: 0,
  medianMergeHours: null,
  medianLines: null,
});

describe('retroWeeks', () => {
  it('lays out whole weeks ending now, oldest first', () => {
    const weeks = retroWeeks(NOW, 3);

    expect(weeks.map((week) => week.end)).toEqual([NOW - 2 * WEEK_MS, NOW - WEEK_MS, NOW]);
    expect(weeks.every((week) => week.end - week.start === WEEK_MS)).toBe(true);
  });
});

describe('finishedIn', () => {
  it('keeps what finished after the week began, up to and including its end', () => {
    const week = { start: hoursAgo(168), end: NOW };
    const inside = pull(1, 200, 0);
    const before = pull(2, 300, 168);

    expect(finishedIn([inside, before], week)).toEqual([inside]);
  });
});

describe('cycleWeeks', () => {
  it('counts each week’s merges and closes, with the median hours from open to merge', () => {
    const finished = [
      pull(1, 10, 8),
      pull(2, 30, 24),
      pull(3, 50, 40),
      pull(4, 20, 5, 'closed'),
      pull(5, 200, 190),
    ];

    const [lastWeek, thisWeek] = cycleWeeks(finished, retroWeeks(NOW, 2));

    expect(thisWeek).toEqual(expect.objectContaining({ merged: 3, closed: 1 }));
    expect(thisWeek.medianCycleHours).toBe(6);
    expect(lastWeek).toEqual(expect.objectContaining({ merged: 1, closed: 0 }));
    expect(lastWeek.medianCycleHours).toBe(10);
  });

  it('has no median for a week where nothing merged', () => {
    const [week] = cycleWeeks([pull(1, 10, 2, 'closed')], retroWeeks(NOW, 1));

    expect(week.medianCycleHours).toBeNull();
  });
});

describe('whereTheyWaited', () => {
  it('holds each bucket a frame saw until the next frame', () => {
    const frames = [
      frame(30, [item(1, 'conflicted')]),
      frame(20, [item(1, 'failing')]),
      frame(14, [item(1, 'unreviewed')]),
    ];

    const waits = whereTheyWaited(frames, [pull(1, 40, 10)]);

    expect(waits.buckets.find((each) => each.bucket === 'conflicted')?.hours).toBe(10);
    expect(waits.buckets.find((each) => each.bucket === 'failing')?.hours).toBe(6);
    expect(waits.buckets.find((each) => each.bucket === 'unreviewed')?.hours).toBe(4);
  });

  it('stops at the finish when the next frame came later, and starts no earlier than the opening', () => {
    const frames = [frame(30, [item(1, 'unreviewed')]), frame(2, [])];

    const waits = whereTheyWaited(frames, [pull(1, 24, 20)]);

    expect(waits.buckets.find((each) => each.bucket === 'unreviewed')).toEqual({
      bucket: 'unreviewed',
      hours: 4,
      pulls: 1,
    });
  });

  it('leaves out pull requests that did not finish, and says how many finished ones it saw', () => {
    const frames = [frame(30, [item(1, 'failing'), item(9, 'conflicted')]), frame(20, [])];

    const waits = whereTheyWaited(frames, [pull(1, 40, 25), pull(2, 40, 25)]);

    expect(waits.buckets.find((each) => each.bucket === 'conflicted')?.hours).toBe(0);
    expect(waits.observed).toBe(1);
    expect(waits.finished).toBe(2);
    expect(waits.since).toBe(hoursAgo(30));
  });

  it('lists every bucket in the queue’s order, even with no frames', () => {
    const waits = whereTheyWaited([], [pull(1, 10, 2)]);

    expect(waits.buckets.map((each) => each.bucket)).toEqual([
      'conflicted',
      'failing',
      'unknown',
      'unlinked',
      'unreviewed',
    ]);
    expect(waits.since).toBeNull();
  });
});

describe('agentWeeks', () => {
  const report: AgentsReport = {
    since: null,
    attributed: 3,
    agents: [card('builder', [1, 2]), card('fixer', [3])],
  };

  it('splits the finished work by the agent whose card claims it, busiest first', () => {
    const rows = agentWeeks(report, [
      pull(3, 5, 1),
      pull(1, 10, 4),
      pull(2, 12, 2),
      pull(7, 9, 1, 'closed'),
    ]);

    expect(rows).toEqual([
      { agent: 'builder', merged: 2, closed: 0, medianCycleHours: 8 },
      { agent: 'fixer', merged: 1, closed: 0, medianCycleHours: 4 },
      { agent: NO_HANDOFF, merged: 0, closed: 1, medianCycleHours: null },
    ]);
  });

  it('puts everything in one row when no handoffs were recorded', () => {
    expect(agentWeeks(null, [pull(1, 3, 1)])).toEqual([
      { agent: NO_HANDOFF, merged: 1, closed: 0, medianCycleHours: 2 },
    ]);
  });
});
