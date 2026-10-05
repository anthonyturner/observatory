import { ActivityItem } from '../activity/activity.types';
import { OpenItem, openItemsOf, questionOf } from './open-items';

const item = (kind: ActivityItem['kind'], number: number, extra: Partial<ActivityItem> = {}) =>
  ({
    kind,
    repo: 'me/alpha',
    label: 'alpha',
    number,
    title: `Item ${number}`,
    ...extra,
  }) as ActivityItem;

const open = (kind: OpenItem['kind'], number: number): OpenItem => ({
  kind,
  repo: 'me/alpha',
  label: 'alpha',
  number,
  title: `Item ${number}`,
  href: `/p/me/alpha?${kind === 'pull' ? 'pr' : 'issue'}=${number}`,
});

describe('openItemsOf', () => {
  it('keeps opened pull requests and new issues, each with its place on the star map', () => {
    expect(openItemsOf([item('pull-opened', 12), item('issue', 7)])).toEqual([
      open('pull', 12),
      open('issue', 7),
    ]);
  });

  it('never lists a merged pull request or a closed issue', () => {
    expect(openItemsOf([item('merged', 1), item('issue-closed', 2)])).toEqual([]);
  });

  it('drops an item the same batch says has since merged or closed', () => {
    const items = [
      item('pull-opened', 12),
      item('issue', 7),
      item('issue', 8),
      item('merged', 12, { closing: [{ number: 7, title: 'Item 7' }] }),
      item('issue-closed', 8),
    ];

    expect(openItemsOf(items)).toEqual([]);
  });

  it('tells the same number in two projects apart', () => {
    const elsewhere = item('pull-opened', 12, { repo: 'me/beta', label: 'beta' });

    expect(openItemsOf([elsewhere, item('merged', 12)]).map((open) => open.repo)).toEqual([
      'me/beta',
    ]);
  });

  it('escapes the owner and name in its address', () => {
    const [opened] = openItemsOf([item('issue', 3, { repo: 'me/a b' })]);

    expect(opened.href).toBe('/p/me/a%20b?issue=3');
  });
});

describe('questionOf', () => {
  it('asks about it, or any of them, after the projects’ news alone', () => {
    expect(questionOf([open('pull', 1)], false)).toBe('Would you like to open it?');
    expect(questionOf([open('pull', 1), open('issue', 2)], false)).toBe(
      'Would you like to open any of them?',
    );
  });

  it('names what it means when mail was said too', () => {
    expect(questionOf([open('issue', 2)], true)).toBe('Would you like to open the issue?');
    expect(questionOf([open('pull', 1), open('pull', 3)], true)).toBe(
      'Would you like to open any of the pull requests?',
    );
    expect(questionOf([open('issue', 2), open('pull', 1)], true)).toBe(
      'Would you like to open any of the pull requests or issues?',
    );
  });
});
