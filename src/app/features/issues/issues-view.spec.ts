import { IssueItem } from '../../core/issues/issues-report';
import { issueGroups, issueMatches, issuesStamp } from './issues-view';

const issue = (number: number, overrides: Partial<IssueItem> = {}): IssueItem => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/me/a/issues/${number}`,
  labels: [],
  assignees: [],
  pulls: [],
  idleDays: 1,
  ...overrides,
});

const items = [
  issue(1, { title: 'Crash on start', labels: ['bug'] }),
  issue(2, { pulls: [50] }),
  issue(3, { assignees: ['kim'] }),
];

describe('issueGroups', () => {
  it('puts nobody-on-it first, then in progress', () => {
    const groups = issueGroups(items, '');

    expect(groups.map((group) => [group.title, group.items.map((item) => item.number)])).toEqual([
      ['Nobody on it', [1, 3]],
      ['In progress', [2]],
    ]);
  });

  it('leaves out a group the search empties', () => {
    expect(issueGroups(items, 'crash').map((group) => group.id)).toEqual(['unclaimed']);
  });
});

describe('issueMatches', () => {
  it('matches the title, #number, a label or an assignee, every word', () => {
    expect(issueMatches(items[0], 'crash START')).toBe(true);
    expect(issueMatches(items[0], '#1')).toBe(true);
    expect(issueMatches(items[0], 'bug')).toBe(true);
    expect(issueMatches(items[2], 'kim')).toBe(true);
    expect(issueMatches(items[0], 'crash kim')).toBe(false);
  });
});

describe('issuesStamp', () => {
  const now = new Date(2026, 8, 26, 15, 0).getTime();

  it('counts what is open, nobody on, and closed recently', () => {
    const state = {
      status: 'ready',
      report: {
        generatedAt: new Date(2026, 8, 26, 9, 42).toISOString(),
        repo: 'me/a',
        items,
        closedRecently: 4,
        closedWindowDays: 30,
      },
    } as const;

    expect(issuesStamp(state, now)).toBe(
      '3 open · 2 nobody on · 4 closed in 30 days · refreshed 09:42',
    );
  });

  it('says it is reading or out of reach', () => {
    expect(issuesStamp({ status: 'reading' }, now)).toBe('reading the issues');
    expect(issuesStamp({ status: 'unreachable' }, now)).toBe('API out of reach');
  });
});
