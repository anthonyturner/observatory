import { Ledger } from '../queue/ledger';
import { shippedWork } from './shipped';

const ledger = (rows: Ledger['rows'], titles: Record<string, string> = {}): Ledger => ({
  generatedAt: '2026-10-05T12:00:00Z',
  rows,
  titles,
  finished: [],
  mergedBranches: [],
});

describe('shippedWork', () => {
  it('gathers merged pull requests across projects, newest first, and leaves the rest out', () => {
    const items = shippedWork(
      new Map([
        [
          'o/app',
          ledger(
            [
              { day: '2026-10-01', open: 1, opened: [3], merged: [1], closed: [2] },
              { day: '2026-10-04', open: 0, opened: [], merged: [4], closed: [] },
            ],
            { '1': 'First', '4': 'Fourth' },
          ),
        ],
        ['o/site', ledger([{ day: '2026-10-03', open: 0, opened: [], merged: [9], closed: [] }])],
      ]),
    );

    expect(items.map((item) => [item.key, item.title])).toEqual([
      ['o/app#4', 'Fourth'],
      ['o/site#9', 'Pull request 9'],
      ['o/app#1', 'First'],
    ]);
  });

  it('is empty with no ledgers', () => {
    expect(shippedWork(new Map())).toEqual([]);
  });
});
