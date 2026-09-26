import { PullBucket } from '../projects/projects-report';
import { changeCount, changeMarks, changesSince } from './changes';
import { Frame } from './history-report';
import { QueueItem } from './queue-report';

const item = (number: number, bucket: PullBucket): QueueItem => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket,
  closes: [],
  failingChecks: 0,
  additions: 1,
  deletions: 1,
  idleDays: 0,
  ageDays: 0,
  isSeen: false,
  hidden: null,
});

const frame = (
  at: string,
  items: [number, PullBucket][],
  departed: Frame['departed'] = [],
): Frame => ({
  at,
  items: items.map(([number, bucket]) => ({ number, title: `Change ${number}`, bucket })),
  departed,
});

const frames = [
  frame('2026-09-24T10:00:00Z', [
    [1, 'unreviewed'],
    [2, 'conflicted'],
    [3, 'unlinked'],
    [4, 'unreviewed'],
  ]),
  frame(
    '2026-09-25T10:00:00Z',
    [
      [1, 'failing'],
      [2, 'unreviewed'],
      [3, 'unlinked'],
      [5, 'unreviewed'],
    ],
    [{ number: 4, title: 'Change 4', fate: 'merged' }],
  ),
];
const READ_AT = Date.parse('2026-09-26T09:00:00Z');
const now = [item(1, 'failing'), item(2, 'unreviewed'), item(3, 'unlinked'), item(5, 'unreviewed')];

describe('changesSince', () => {
  it('compares with the frame at or before your last visit', () => {
    const changes = changesSince(frames, now, Date.parse('2026-09-24T12:00:00Z'), READ_AT);

    expect(changes?.basis).toBe('visit');
    expect(changes?.since).toBe('2026-09-24T10:00:00Z');
    expect(changes?.opened.map((pull) => pull.number)).toEqual([5]);
    expect(changes?.blocked.map((pull) => pull.number)).toEqual([1]);
    expect(changes?.unblocked.map((pull) => pull.number)).toEqual([2]);
    expect(changes?.merged).toEqual([{ number: 4, title: 'Change 4' }]);
    expect(changes?.closed).toEqual([]);
  });

  it('finds nothing once you have looked since the last frame', () => {
    expect(
      changeCount(changesSince(frames, now, Date.parse('2026-09-26T00:00:00Z'), READ_AT)),
    ).toBe(0);
  });

  it('finds nothing once you have looked at this very read', () => {
    expect(changesSince(frames, now, READ_AT, READ_AT)).toBeNull();
  });

  it('compares with the refresh before on a first visit', () => {
    const changes = changesSince(frames, now, null, READ_AT);

    expect(changes?.basis).toBe('refresh');
    expect(changes?.since).toBe('2026-09-24T10:00:00Z');
  });

  it('has nothing to say without a frame from before', () => {
    expect(changesSince([], now, null, READ_AT)).toBeNull();
    expect(changesSince(frames.slice(0, 1), now, null, READ_AT)).toBeNull();
  });

  it('does not report a departure that is open again', () => {
    const reopened = [...now, item(4, 'unreviewed')];

    expect(
      changesSince(frames, reopened, Date.parse('2026-09-24T12:00:00Z'), READ_AT)?.merged,
    ).toEqual([]);
  });
});

describe('changeMarks', () => {
  it('marks each open pull request that changed, and none that left', () => {
    const marks = changeMarks(
      changesSince(frames, now, Date.parse('2026-09-24T12:00:00Z'), READ_AT),
    );

    expect([...marks]).toEqual([
      [5, 'opened'],
      [1, 'blocked'],
      [2, 'unblocked'],
    ]);
    expect(changeMarks(null).size).toBe(0);
  });
});
