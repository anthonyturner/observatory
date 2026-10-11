import { parsePullEnding } from './pull-ending';

describe('parsePullEnding', () => {
  it('reads how a pull request ended, its threads and the issues it closed', () => {
    expect(
      parsePullEnding({
        how: 'squash',
        threads: { resolved: 3, unresolved: 1 },
        closes: [12, 14],
      }),
    ).toEqual({ how: 'squash', threads: { resolved: 3, unresolved: 1 }, closes: [12, 14] });
  });

  it('takes no issues closed to mean none, and drops anything that is not an issue number', () => {
    expect(
      parsePullEnding({ how: 'closed', threads: { resolved: 0, unresolved: 0 }, closes: [7, 'x'] })
        ?.closes,
    ).toEqual([7]);
    expect(
      parsePullEnding({ how: 'closed', threads: { resolved: 0, unresolved: 0 } })?.closes,
    ).toEqual([]);
  });

  it('is nothing when the way is unknown or the threads are not counts', () => {
    const threads = { resolved: 0, unresolved: 0 };

    expect(parsePullEnding({ how: 'sideways', threads, closes: [] })).toBeNull();
    expect(parsePullEnding({ how: 'merge', threads: { resolved: -1, unresolved: 0 } })).toBeNull();
    expect(parsePullEnding({ how: 'merge' })).toBeNull();
    expect(parsePullEnding(undefined)).toBeNull();
  });
});
