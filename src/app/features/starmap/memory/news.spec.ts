import { Frame } from '../../../core/queue/history-report';
import { Ledger } from '../../../core/queue/ledger';
import { SkyCluster } from '../engine/sky-model';
import { Lookup, PullState } from '../../../core/activity/activity-lookups';
import { EMPTY_SYSTEM, StarSystem, endingOf } from './departure';
import {
  MemoryItem,
  baseline,
  departuresAnswered,
  diffItems,
  frameItems,
  kindOf,
  knownEndings,
  play,
} from './news';

const item = (pr: number, bucket: MemoryItem['bucket']): MemoryItem => ({
  pr,
  title: `#${pr}`,
  bucket,
  idleDays: 1,
});

const frame = (
  at: string,
  items: [number, Frame['items'][number]['bucket']][],
  departed: Frame['departed'] = [],
): Frame => ({
  at,
  items: items.map(([number, bucket]) => ({ number, title: `#${number}`, bucket, idleDays: 1 })),
  departed,
});

describe('diffItems', () => {
  it('finds what opened, became blocked, was unblocked and left, worst first', () => {
    const before = [
      item(1, 'unreviewed'),
      item(2, 'conflicted'),
      item(3, 'unlinked'),
      item(4, 'unknown'),
      item(5, 'unreviewed'),
    ];
    const after = [
      item(1, 'failing'),
      item(2, 'unreviewed'),
      item(3, 'unlinked'),
      item(6, 'unreviewed'),
    ];

    const events = diffItems(before, after, new Map([[4, endingOf('merged')]]));

    expect(events.map((e) => [e.kind, e.pr])).toEqual([
      ['blocked', 1],
      ['opened', 6],
      ['merged', 4],
      ['unblocked', 2],
      ['left', 5],
    ]);
  });
});

describe('kindOf', () => {
  it('reads an ending as a merge, a squash or a close, and no ending as just leaving', () => {
    expect(kindOf(endingOf('merged', 'merge'))).toBe('merged');
    expect(kindOf(endingOf('merged', 'squash'))).toBe('squashed');
    expect(kindOf(endingOf('merged'))).toBe('merged');
    expect(kindOf(endingOf('closed'))).toBe('closed');
    expect(kindOf(null)).toBe('left');
  });
});

describe('diffItems departures', () => {
  const system = { ...EMPTY_SYSTEM, meteor: { repo: 'me/a', pr: 5, commits: 3 } };

  it('gives each pull request that left its ending and the system its star carried', () => {
    const endings = new Map([
      [4, endingOf('merged', 'squash')],
      [5, endingOf('closed')],
    ]);
    const systems = new Map<number, StarSystem>([[5, system]]);

    const events = diffItems(
      [item(4, 'fresh'), item(5, 'fresh'), item(6, 'fresh')],
      [item(6, 'fresh')],
      endings,
      systems,
    );

    expect(events.map((e) => [e.kind, e.pr])).toEqual([
      ['squashed', 4],
      ['closed', 5],
    ]);
    expect(events[0].departure).toEqual({ system: EMPTY_SYSTEM, ending: endings.get(4) });
    expect(events[1].departure?.system).toBe(system);
  });

  it('gives no departure to a change that happened on a star still in the sky', () => {
    const [event] = diffItems([item(1, 'unreviewed')], [item(1, 'failing')]);

    expect(event.kind).toBe('blocked');
    expect(event.departure).toBeUndefined();
  });

  it('lets a pull request nobody knows the ending of simply leave', () => {
    const [event] = diffItems([item(3, 'fresh')], []);

    expect(event.kind).toBe('left');
    expect(event.departure).toEqual({ system: EMPTY_SYSTEM, ending: null });
  });
});

describe('departuresAnswered', () => {
  const found = (value: PullState): Lookup<PullState> => ({ status: 'found', value });
  const threads = { resolved: 1, unresolved: 0 };

  it('plays what GitHub says each pull request became, worst news first', () => {
    const events = departuresAnswered(
      [item(2, 'fresh'), item(1, 'fresh')],
      [
        found({ state: 'CLOSED', title: 'x' }),
        found({ state: 'MERGED', title: 'x', ending: { how: 'squash', threads, closes: [8] } }),
      ],
      new Map(),
    );

    expect(events.map((e) => [e.kind, e.pr])).toEqual([
      ['squashed', 1],
      ['closed', 2],
    ]);
    expect(events[0].departure?.ending).toEqual({
      fate: 'merged',
      how: 'squash',
      threads,
      closes: [8],
    });
  });

  it('drops one GitHub says is still open, for it did not leave', () => {
    const events = departuresAnswered(
      [item(1, 'fresh')],
      [found({ state: 'OPEN', title: 'x' })],
      new Map(),
    );

    expect(events).toEqual([]);
  });

  it('lets one GitHub could not answer for just leave', () => {
    const events = departuresAnswered(
      [item(1, 'fresh'), item(2, 'fresh')],
      [{ status: 'denied' }, { status: 'failed' }],
      new Map(),
    );

    expect(events.map((e) => [e.kind, e.pr])).toEqual([
      ['left', 1],
      ['left', 2],
    ]);
  });
});

describe('knownEndings', () => {
  it('takes a frame’s own record over the ledger', () => {
    const ledger: Ledger = {
      generatedAt: 'x',
      rows: [{ day: '2026-09-25', open: 1, opened: [], merged: [7], closed: [8] }],
      titles: {},
      finished: [],
      mergedBranches: [],
    };
    const frames = [
      frame('2026-09-26T00:00:00Z', [], [{ number: 8, title: '#8', fate: 'merged' }]),
    ];

    expect([...knownEndings(frames, ledger)]).toEqual([
      [8, endingOf('merged')],
      [7, endingOf('merged')],
    ]);
  });

  it('keeps how a pull request left, where a frame recorded it', () => {
    const frames = [
      frame(
        '2026-09-26T00:00:00Z',
        [],
        [
          { number: 8, title: '#8', fate: 'merged', how: 'squash' },
          { number: 9, title: '#9', fate: 'closed', how: 'closed' },
        ],
      ),
    ];

    expect(knownEndings(frames, null).get(8)?.how).toBe('squash');
    expect(knownEndings(frames, null).get(9)).toEqual(endingOf('closed'));
  });
});

describe('baseline', () => {
  const frames = [
    frame('2026-09-24T10:00:00Z', []),
    frame('2026-09-25T10:00:00Z', []),
    frame('2026-09-26T10:00:00Z', []),
  ];
  const snapshotAt = '2026-09-26T10:00:05Z';

  it('compares with the frame at or before your last look', () => {
    expect(baseline(frames, '2026-09-25T12:00:00Z', snapshotAt)).toEqual({
      frame: frames[1],
      label: 'since you last looked',
      since: frames[1].at,
    });
  });

  it('has no news when you have seen this snapshot, and falls back to memory’s start', () => {
    expect(baseline(frames, snapshotAt, snapshotAt)).toBeNull();
    expect(baseline(frames, '2026-01-01T00:00:00Z', snapshotAt)?.label).toBe('since memory began');
  });

  it('on a first visit, compares the latest refresh with the one before', () => {
    expect(baseline(frames, null, snapshotAt)?.frame).toBe(frames[1]);
    expect(baseline(frames, null, snapshotAt)?.label).toBe('since the previous refresh');
    expect(baseline(frames.slice(0, 1), null, snapshotAt)).toBeNull();
  });
});

describe('frameItems', () => {
  it('reads a frame in the memory’s shape', () => {
    expect(frameItems(frame('x', [[3, 'failing']]))).toEqual([item(3, 'failing')]);
  });
});

describe('play', () => {
  it('waits for the entrance, then staggers each burst, and sends leavers from their constellation', () => {
    const cluster = {
      cx: 1000,
      cy: 500,
      z: 95,
      stars: [{ key: 'unreviewed' }],
    } as unknown as SkyCluster;
    const events = diffItems([item(1, 'unreviewed')], [item(2, 'unreviewed')]);

    play(events, [cluster], { now: 10, entranceEnd: 12, frozen: false });

    expect(events.map((e) => e.startAt)).toEqual([12, 12.32]);
    const left = events.find((e) => e.kind === 'left');
    expect(Math.abs((left?.fromX ?? 0) - 1000)).toBeLessThanOrEqual(80);
    expect(left?.fromZ).toBe(95);
    expect(events.find((e) => e.kind === 'opened')?.fromX).toBeUndefined();
  });

  it('plays at once when the sky is still', () => {
    const events = diffItems([], [item(2, 'unreviewed')]);
    play(events, [], { now: 10, entranceEnd: 99, frozen: true });
    expect(events[0].startAt).toBe(10.5);
  });
});
