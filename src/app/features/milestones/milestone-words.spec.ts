import {
  DAY_MS,
  Milestone,
  MilestonesReport,
  parseMilestonesReport,
} from '../../core/milestones/milestones-report';
import { BARE_REPORT, RAW_REPORT } from '../../core/milestones/testing/milestones-fixture';
import { discussionGroups } from './discussion-list/discussion-groups';
import {
  discussionsNote,
  dueWords,
  emptyMessage,
  milestonesStamp,
  progressWords,
} from './milestone-words';

const NOW = Date.parse('2026-10-08T13:00:00Z');
const DAY_START = Date.parse('2026-10-08T00:00:00Z');

function reportOf(body: unknown): MilestonesReport {
  const report = parseMilestonesReport(body);
  if (!report) throw new Error('the fixture is not a report');
  return report;
}

const milestone = (more: Partial<Milestone> = {}): Milestone => ({
  number: 1,
  title: 'v1',
  description: null,
  url: 'https://github.com/me/app/milestone/1',
  isOpen: true,
  dueOn: null,
  closedAt: null,
  open: 1,
  closed: 3,
  items: [],
  ...more,
});

describe('dueWords', () => {
  it('counts calendar days to the date, and past it once its day is over', () => {
    const due = (days: number) => dueWords(milestone({ dueOn: DAY_START + days * DAY_MS }), NOW);

    expect(due(4)).toMatch(/^due .+, in 4 days$/);
    expect(due(1)).toMatch(/, in 1 day$/);
    expect(due(0)).toMatch(/, today$/);
    expect(due(-1)).toMatch(/, 1 day overdue$/);
    expect(due(-7)).toMatch(/, 7 days overdue$/);
    expect(dueWords(milestone(), NOW)).toBe('no due date');
  });
});

describe('progressWords', () => {
  it('says how many of its items are done', () => {
    expect(progressWords(milestone())).toBe('3 of 4 done');
    expect(progressWords(milestone({ open: 0, closed: 0 }))).toBe('nothing on it yet');
  });
});

describe('the screen’s notes', () => {
  const report = reportOf(RAW_REPORT);
  const bare = reportOf(BARE_REPORT);

  it('says plainly when there are no milestones, and when Discussions are off', () => {
    expect(emptyMessage(bare)?.headline).toBe('No milestones');
    expect(discussionsNote(bare)).toBe('Discussions are off for this project.');
    expect(emptyMessage(report)).toBeNull();
    expect(discussionsNote(report)).toBeNull();
  });

  it('points at the list when every milestone is closed', () => {
    const closedOnly = { ...report, milestones: { ...report.milestones, open: [] } };

    expect(emptyMessage(closedOnly)).toEqual({
      headline: 'No open milestones',
      detail: '1 milestone closed lately: see List.',
    });
  });

  it('stamps the project with its open milestones', () => {
    expect(milestonesStamp('me/app', report)).toBe('me/app · 3 open milestones');
    const backlog = { ...report, milestones: { ...report.milestones, openCount: 31 } };
    expect(milestonesStamp('me/app', backlog)).toBe('me/app · 3 of 31 open milestones');
    expect(milestonesStamp('me/app', null)).toBe('me/app');
  });
});

describe('discussionGroups', () => {
  it('groups the threads by category, the most lately active first, with their answer', () => {
    const { discussions } = reportOf(RAW_REPORT);

    const groups = discussionGroups(discussions.threads, NOW);

    expect(groups.map((group) => [group.name, group.rows.map((row) => row.key)])).toEqual([
      ['Q&A', ['7', '9']],
      ['Ideas', ['8']],
    ]);
    expect(groups[0].rows.map((row) => row.answer)).toEqual(['Answered', 'Unanswered']);
    expect(groups[1].rows[0].answer).toBeNull();
    expect(groups[0].rows[0].meta).toBe('2 comments · by ann · 3h ago');
  });
});
