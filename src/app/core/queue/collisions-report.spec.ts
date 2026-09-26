import {
  CollisionsReport,
  collisionSummary,
  collisionThreads,
  collisionsOf,
  parseCollisions,
} from './collisions-report';

const report: CollisionsReport = {
  repo: 'me/a',
  check: 'checked',
  pairs: [
    { a: 1, b: 2, files: ['a.ts', 'b.ts'], conflicts: ['a.ts'] },
    { a: 1, b: 3, files: ['c.ts'], conflicts: [] },
    { a: 2, b: 3, files: ['d.ts'], conflicts: null },
  ],
};

describe('parseCollisions', () => {
  it('reads anything but a list of conflicts as unchecked, never as safe', () => {
    const parsed = parseCollisions({
      repo: 'me/a',
      check: 'checked',
      pairs: [
        { a: 1, b: 2, files: ['a.ts'], conflicts: 'yes' },
        { a: 1, b: 3, files: ['c.ts'], conflicts: [] },
        { a: 'x', b: 3 },
      ],
    });

    expect(parsed?.pairs).toEqual([
      { a: 1, b: 2, files: ['a.ts'], conflicts: null },
      { a: 1, b: 3, files: ['c.ts'], conflicts: [] },
    ]);
  });

  it('refuses an unknown check', () => {
    expect(parseCollisions({ repo: 'me/a', check: 'maybe', pairs: [] })).toBeNull();
  });
});

describe('collisionThreads', () => {
  it('draws pairs that would conflict and unchecked ones, not clean ones', () => {
    expect(collisionThreads(report)).toEqual([
      { a: 1, b: 2, kind: 'conflict' },
      { a: 2, b: 3, kind: 'unchecked' },
    ]);
    expect(collisionThreads(null)).toEqual([]);
  });
});

describe('collisionsOf', () => {
  it('lists the others, conflicts first, with the files that matter', () => {
    expect(collisionsOf(report, 1)).toEqual([
      { other: 2, kind: 'conflict', files: ['a.ts'] },
      { other: 3, kind: 'clean', files: ['c.ts'] },
    ]);
    expect(collisionsOf(report, 3).map((each) => each.kind)).toEqual(['unchecked', 'clean']);
  });
});

describe('collisionSummary', () => {
  it('counts the pairs that would conflict, or says why none were checked', () => {
    expect(collisionSummary(report)).toBe('1 pair would conflict');
    expect(collisionSummary({ ...report, check: 'no-clone' })).toBe(
      '3 pairs share files · unchecked: no local clone',
    );
    expect(collisionSummary({ ...report, pairs: [report.pairs[1]] })).toBe(
      'no pull requests collide',
    );
    expect(collisionSummary({ ...report, pairs: [] })).toBeNull();
  });
});
