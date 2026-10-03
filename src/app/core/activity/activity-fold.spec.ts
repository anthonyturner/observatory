import { foldClosings } from './activity-fold';
import { DepartedPull } from './activity-memory';
import { ActivityItem } from './activity.types';

const item = (kind: ActivityItem['kind'], repo: string, number: number): ActivityItem => ({
  kind,
  repo,
  label: repo,
  number,
  title: `${kind} ${number}`,
});

const merge = (repo: string, number: number, closes: number[]): DepartedPull => ({
  repo,
  label: repo,
  number,
  closes,
});

describe('foldClosings', () => {
  it('tells an issue a merge closed inside the merge, not on its own', () => {
    const items = [item('merged', 'me/alpha', 12), item('issue-closed', 'me/alpha', 10)];

    const told = foldClosings(items, [merge('me/alpha', 12, [10])]);

    expect(told).toEqual([{ ...items[0], closing: [{ number: 10, title: 'issue-closed 10' }] }]);
  });

  it('leaves apart an issue of the same number in another repository', () => {
    const items = [item('merged', 'me/alpha', 12), item('issue-closed', 'me/beta', 10)];

    expect(foldClosings(items, [merge('me/alpha', 12, [10])])).toEqual(items);
  });

  it('folds an issue two merges both closed into the first only', () => {
    const items = [
      item('merged', 'me/alpha', 12),
      item('merged', 'me/alpha', 13),
      item('issue-closed', 'me/alpha', 10),
    ];

    const told = foldClosings(items, [merge('me/alpha', 12, [10]), merge('me/alpha', 13, [10])]);

    expect(told.map((each) => each.closing?.length ?? 0)).toEqual([1, 0]);
  });

  it('leaves a merge whose issue has not closed yet as it was', () => {
    const items = [item('merged', 'me/alpha', 12)];

    expect(foldClosings(items, [merge('me/alpha', 12, [10])])).toEqual(items);
  });
});
