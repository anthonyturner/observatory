import { CollisionsReport, collisionSummary, parseCollisions } from './collisions-report';

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
