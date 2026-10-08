/** An issue or pull request on a milestone, as `GET /api/milestones` sends it. */
export const rawItem = (
  number: number,
  state: string,
  isPull = false,
): Record<string, unknown> => ({
  number,
  title: `Item ${number}`,
  url: `https://github.com/me/app/${isPull ? 'pull' : 'issues'}/${number}`,
  isPull,
  state,
});

/** A milestone as `GET /api/milestones` sends it. */
export const rawMilestone = (number: number, more: object = {}): Record<string, unknown> => ({
  number,
  title: `v${number}`,
  description: null,
  url: `https://github.com/me/app/milestone/${number}`,
  isOpen: true,
  dueOn: null,
  closedAt: null,
  open: 2,
  closed: 3,
  items: [rawItem(10 + number, 'open'), rawItem(20 + number, 'merged', true)],
  ...more,
});

/** A discussion as `GET /api/milestones` sends it. */
export const rawThread = (number: number, more: object = {}): Record<string, unknown> => ({
  number,
  title: `Thread ${number}`,
  url: `https://github.com/me/app/discussions/${number}`,
  category: 'Q&A',
  isAnswerable: true,
  isAnswered: false,
  comments: 2,
  author: 'ann',
  updatedAt: '2026-10-08T10:00:00Z',
  ...more,
});

/** The report the day it was made: one overdue, one due soon, one open-ended, one closed. */
export const RAW_REPORT = {
  generatedAt: '2026-10-08T13:00:00Z',
  repo: 'me/app',
  milestones: {
    note: null,
    openCount: 3,
    open: [
      rawMilestone(1, { title: 'Beta', dueOn: '2026-10-01T00:00:00Z' }),
      rawMilestone(2, { title: 'Launch', dueOn: '2026-10-12T00:00:00Z', open: 1, closed: 9 }),
      rawMilestone(3, { title: 'Someday', open: 4, closed: 0 }),
    ],
    closed: [
      rawMilestone(4, {
        title: 'Alpha',
        isOpen: false,
        closedAt: '2026-09-20T00:00:00Z',
        open: 0,
        closed: 6,
      }),
    ],
  },
  discussions: {
    note: null,
    isEnabled: true,
    total: 12,
    threads: [
      rawThread(7, { isAnswered: true }),
      rawThread(8, { category: 'Ideas', isAnswerable: false, updatedAt: '2026-10-07T10:00:00Z' }),
      rawThread(9, { updatedAt: '2026-10-06T10:00:00Z' }),
    ],
  },
};

/** A project with neither: no milestones, and Discussions off. */
export const BARE_REPORT = {
  ...RAW_REPORT,
  milestones: { note: null, open: [], openCount: 0, closed: [] },
  discussions: { note: null, isEnabled: false, total: 0, threads: [] },
};
