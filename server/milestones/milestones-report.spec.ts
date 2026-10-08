import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DiscussionReader, DiscussionsMark } from '../github/discussion-reader.ts';
import type { MilestoneMark, MilestoneReader } from '../github/milestone-reader.ts';
import { milestonesReport } from './milestones-report.ts';

const NOW = Date.parse('2026-10-08T12:00:00Z');

const mark = (number: number, more: Partial<MilestoneMark> = {}): MilestoneMark => ({
  number,
  title: `v${number}`,
  description: null,
  url: `https://github.com/me/app/milestone/${number}`,
  isOpen: true,
  dueOn: null,
  closedAt: null,
  openIssues: 1,
  closedIssues: 2,
  openPulls: 3,
  closedPulls: 4,
  items: [],
  ...more,
});

const DISCUSSIONS: DiscussionsMark = { isEnabled: true, total: 0, threads: [] };

const reader = (
  milestones: () => Promise<MilestoneMark[]>,
  discussions: () => Promise<DiscussionsMark> = async () => DISCUSSIONS,
): MilestoneReader & DiscussionReader => ({ milestones, discussions });

describe('milestonesReport', () => {
  it('puts the soonest due first and those with none last, and the latest closed first', async () => {
    const report = await milestonesReport(
      reader(async () => [
        mark(1),
        mark(2, { dueOn: '2026-11-01T00:00:00Z' }),
        mark(3, { dueOn: '2026-10-10T00:00:00Z' }),
        mark(4, { isOpen: false, closedAt: '2026-09-01T00:00:00Z' }),
        mark(5, { isOpen: false, closedAt: '2026-10-01T00:00:00Z' }),
      ]),
      'me/app',
      NOW,
    );

    assert.deepEqual(
      report.milestones.open.map((view) => view.number),
      [3, 2, 1],
    );
    assert.deepEqual(
      report.milestones.closed.map((view) => view.number),
      [5, 4],
    );
    assert.equal(report.generatedAt, '2026-10-08T12:00:00.000Z');
  });

  it('counts issues and pull requests together, and lists the open items first', async () => {
    const items = [
      { number: 4, title: 'a', url: 'u', isPull: false, state: 'closed' as const },
      { number: 2, title: 'b', url: 'u', isPull: true, state: 'open' as const },
      { number: 6, title: 'c', url: 'u', isPull: true, state: 'merged' as const },
    ];
    const report = await milestonesReport(
      reader(async () => [mark(1, { items })]),
      'me/app',
      NOW,
    );

    const [view] = report.milestones.open;
    assert.deepEqual([view.open, view.closed], [4, 6]);
    assert.deepEqual(
      view.items.map((item) => item.number),
      [2, 6, 4],
    );
  });

  it('keeps the milestones when the discussions are refused, with a plain note', async () => {
    const report = await milestonesReport(
      reader(
        async () => [mark(1)],
        async () => {
          throw new Error(
            'GitHub: Resource not accessible by integration (at repository.discussions)',
          );
        },
      ),
      'me/app',
      NOW,
    );

    assert.equal(report.milestones.open.length, 1);
    assert.equal(report.discussions.note, 'This token is not allowed to read the discussions.');
    assert.deepEqual(report.discussions.threads, []);
  });

  it('keeps the discussions when the milestones fail, with a plain note', async (t) => {
    t.mock.method(console, 'error', () => undefined);
    const report = await milestonesReport(
      reader(async () => {
        throw new Error('GitHub: HTTP 502');
      }),
      'me/app',
      NOW,
    );

    assert.match(report.milestones.note ?? '', /did not answer for the milestones/);
    assert.equal(report.discussions.note, null);
    assert.equal(report.discussions.isEnabled, true);
  });
});
