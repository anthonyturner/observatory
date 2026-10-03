import { ActivityItem } from '../../core/activity/activity.types';
import { noticeView } from './notice-view';

const merged: ActivityItem = {
  kind: 'merged',
  repo: 'me/observatory',
  label: 'Observatory',
  number: 280,
  title: 'Fold the playlist bar',
};
const issue: ActivityItem = {
  kind: 'issue',
  repo: 'me/beta',
  label: 'beta',
  number: 12,
  title: 'Crash on load',
};

describe('noticeView', () => {
  it('names a single item in its head and its dismiss button', () => {
    const view = noticeView({ id: 1, kind: 'merged', items: [merged] });

    expect(view.tag).toBe('Merged');
    expect(view.heading).toBeNull();
    expect(view.dismissLabel).toBe('Dismiss: pull request merged, Observatory #280');
  });

  it('heads a group with how many it holds', () => {
    const view = noticeView({ id: 2, kind: 'issue', items: [issue, { ...issue, number: 13 }] });

    expect(view.tag).toBe('New issue');
    expect(view.heading).toBe('2 new issues');
    expect(view.dismissLabel).toBe('Dismiss: 2 new issues');
    expect(view.rows.map((row) => row.number)).toEqual([12, 13]);
  });

  it('links a merged pull request to GitHub and a new issue to its star map', () => {
    const [pull] = noticeView({ id: 1, kind: 'merged', items: [merged] }).rows;
    const [opened] = noticeView({ id: 2, kind: 'issue', items: [issue] }).rows;

    expect(pull.link).toEqual({
      kind: 'external',
      href: 'https://github.com/me/observatory/pull/280',
    });
    expect(opened.link).toEqual({
      kind: 'route',
      path: ['/p', 'me', 'beta'],
      query: { issue: 12 },
    });
  });
});
