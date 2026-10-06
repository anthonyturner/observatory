import { IssuesReport } from '../issues/issues-report';
import { doneWork } from './done-work';
import { Ledger } from './ledger';

const ledger: Ledger = {
  generatedAt: '2026-10-05T12:00:00Z',
  rows: [
    { day: '2026-10-03', open: 3, opened: [7], merged: [4], closed: [] },
    { day: '2026-10-04', open: 2, opened: [], merged: [5], closed: [6] },
  ],
  titles: { '4': 'Add the dial', '5': 'Fix the sun', '6': 'Abandoned idea' },
  finished: [],
  mergedBranches: [],
};

const issue = (number: number, closedAt: string, stateReason: string | null) => ({
  number,
  title: `Issue ${number}`,
  url: '',
  labels: [],
  assignees: [],
  author: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: closedAt,
  closedAt,
  stateReason,
  comet: false,
  prs: [],
});

const issues: IssuesReport = {
  generatedAt: '2026-10-05T12:00:00Z',
  repo: 'o/r',
  days: 60,
  total: { open: 0, closed: 2, comets: 0 },
  open: [],
  closed: [
    issue(9, '2026-10-05T09:00:00Z', 'COMPLETED'),
    issue(8, '2026-10-02T09:00:00Z', 'NOT_PLANNED'),
  ],
};

describe('doneWork', () => {
  it('lists merged and closed pull requests and closed issues, newest first', () => {
    expect(doneWork(ledger, issues).map((item) => [item.key, item.kind])).toEqual([
      ['issue9', 'issue'],
      ['pr6', 'closed'],
      ['pr5', 'merged'],
      ['pr4', 'merged'],
      ['issue8', 'dropped'],
    ]);
  });

  it('names each pull request from the ledger and keys pull requests and issues apart', () => {
    const [first] = doneWork(ledger, null);
    expect(first).toEqual(
      expect.objectContaining({ key: 'pr6', title: 'Abandoned idea', day: '2026-10-04' }),
    );
  });

  it('is empty until something has been read', () => {
    expect(doneWork(null, null)).toEqual([]);
  });
});
