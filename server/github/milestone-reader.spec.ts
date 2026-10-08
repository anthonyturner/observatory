import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MILESTONES_QUERY, milestoneReader, milestonesOf } from './milestone-reader.ts';

const total = (totalCount: number) => ({ totalCount });

/** One milestone as `MILESTONES_QUERY` answers it. */
const milestone = (number: number, more: object = {}) => ({
  number,
  title: `v${number}`,
  description: '',
  url: `https://github.com/me/app/milestone/${number}`,
  state: 'OPEN',
  dueOn: '2026-10-20T07:00:00Z',
  closedAt: null,
  openIssues: total(2),
  closedIssues: total(3),
  openPulls: total(1),
  closedPulls: total(4),
  issues: {
    nodes: [
      { number: 7, title: 'Add a thing', url: 'https://github.com/me/app/issues/7', state: 'OPEN' },
      { number: 8, title: 'No state', url: 'https://github.com/me/app/issues/8' },
    ],
  },
  pullRequests: {
    nodes: [
      { number: 9, title: 'Add it', url: 'https://github.com/me/app/pull/9', state: 'MERGED' },
    ],
  },
  ...more,
});

describe('milestonesOf', () => {
  it('reads each milestone’s counts and items, the open ones before the closed', () => {
    const { marks, openCount } = milestonesOf({
      repository: {
        open: { totalCount: 31, nodes: [milestone(1)] },
        closed: {
          nodes: [milestone(2, { state: 'CLOSED', closedAt: '2026-10-01T00:00:00Z', dueOn: null })],
        },
      },
    });

    assert.deepEqual(
      marks.map((mark) => [mark.number, mark.isOpen, mark.dueOn, mark.closedAt]),
      [
        [1, true, '2026-10-20T07:00:00Z', null],
        [2, false, null, '2026-10-01T00:00:00Z'],
      ],
    );
    assert.equal(openCount, 31);
    const [first] = marks;
    assert.deepEqual(
      [first.openIssues, first.closedIssues, first.openPulls, first.closedPulls],
      [2, 3, 1, 4],
    );
    assert.equal(first.description, null);
    assert.deepEqual(
      first.items.map((item) => [item.number, item.isPull, item.state]),
      [
        [7, false, 'open'],
        [9, true, 'merged'],
      ],
    );
  });

  it('reads an answer with no repository, or a milestone with no number, as none', () => {
    assert.deepEqual(milestonesOf({ repository: null }), { marks: [], openCount: 0 });
    assert.deepEqual(milestonesOf({ repository: { open: { nodes: [{ title: 'x' }] } } }), {
      marks: [],
      openCount: 0,
    });
  });
});

describe('milestoneReader', () => {
  it('asks for the repository’s milestones by owner and name', async () => {
    const asked: unknown[] = [];
    const reader = milestoneReader(async (query, variables) => {
      asked.push(query, variables);
      return { repository: { open: { nodes: [milestone(3)] }, closed: { nodes: [] } } };
    });

    const { marks, openCount } = await reader.milestones('me/app');

    assert.deepEqual(asked, [MILESTONES_QUERY, { owner: 'me', name: 'app' }]);
    assert.equal(marks[0].title, 'v3');
    assert.equal(openCount, 1);
  });
});
