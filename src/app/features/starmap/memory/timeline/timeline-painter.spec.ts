import { Frame } from '../../../../core/queue/history-report';
import { LedgerRow } from '../../../../core/queue/ledger';
import { frameAtX, timelineCaption, timelineScale, timelineTip } from './timeline-painter';

const row = (day: string, extra: Partial<LedgerRow> = {}): LedgerRow => ({
  day,
  open: 3,
  opened: [],
  merged: [],
  closed: [],
  ...extra,
});

const rows = [row('2026-09-24'), row('2026-09-25'), row('2026-09-26')];
const frames: Frame[] = [
  { at: new Date('2026-09-25T06:00:00').toISOString(), items: [], departed: [] },
  { at: new Date('2026-09-26T06:00:00').toISOString(), items: [], departed: [] },
];

describe('frameAtX', () => {
  const scale = timelineScale(rows, 300);

  it('finds the refresh at or before a point, now past the newest, nothing before memory', () => {
    expect(frameAtX(scale, frames, 20)).toBeUndefined();
    expect(frameAtX(scale, frames, 150)).toBe(0);
    expect(frameAtX(scale, frames, 230)).toBe(1);
    expect(frameAtX(scale, frames, 299)).toBeNull();
  });
});

describe('timelineTip', () => {
  it('says what the day held, naming two and counting the rest', () => {
    expect(
      timelineTip(row('2026-09-26', { opened: [1, 2, 3], merged: [4], closed: [5] }), 'en-US'),
    ).toBe('Sep 26 · 3 open · 3 opened (#1 #2 +1) · 1 merged (#4) · 1 closed');
  });
});

describe('timelineCaption', () => {
  it('counts the days and says when memory began', () => {
    expect(timelineCaption(rows, [])).toBe('Open pull requests · last 2 days');
    expect(timelineCaption(rows, frames)).toContain('· memory since');
  });
});
