import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CloneFinder } from './clone-finder.ts';
import { collisionsReport, uncheckedCollisions } from './collisions-report.ts';
import type { PairMerger } from './pair-merger.ts';

const github = {
  pullFiles: async () => [
    { number: 1, files: ['a.ts'] },
    { number: 2, files: ['a.ts', 'b.ts'] },
    { number: 3, files: ['b.ts'] },
  ],
};
const clones = (path: string | null): CloneFinder => ({ cloneOf: async () => path });

function merger(conflicting: string, failing = false): PairMerger & { closed: number } {
  const state = {
    closed: 0,
    async open() {
      if (failing) throw new Error('offline');
      return {
        conflicts: async (a: number, b: number) => {
          if (`${a}-${b}` === conflicting) return ['a.ts'];
          if (b === 3) throw new Error('merge-tree broke');
          return [];
        },
        close: async () => {
          state.closed++;
        },
      };
    },
  };
  return state;
}

describe('collisionsReport', () => {
  it('merges each pair that shares a file in the clone', async () => {
    const report = await collisionsReport(
      { pullFiles: async () => (await github.pullFiles()).slice(0, 2) },
      clones('/c'),
      merger('1-2'),
      'me/a',
    );

    assert.equal(report.check, 'checked');
    assert.deepEqual(report.pairs, [{ a: 1, b: 2, files: ['a.ts'], conflicts: ['a.ts'] }]);
  });

  it('cleans up even when a merge fails', async () => {
    const pairs = merger('1-2');

    await assert.rejects(collisionsReport(github, clones('/c'), pairs, 'me/a'));
    assert.equal(pairs.closed, 1);
  });

  it('calls every pair unchecked without a clone, or when nothing could be fetched', async () => {
    const noClone = await collisionsReport(github, clones(null), merger(''), 'me/a');
    const offline = await collisionsReport(github, clones('/c'), merger('', true), 'me/a');

    assert.equal(noClone.check, 'no-clone');
    assert.equal(offline.check, 'unreachable');
    assert.ok(noClone.pairs.every((pair) => pair.conflicts === null));
    assert.equal(offline.pairs.length, 2);
  });
});

describe('uncheckedCollisions', () => {
  it('lists every pair that shares a file, none of them called safe', async () => {
    const report = await uncheckedCollisions(github, 'me/a', Date.parse('2026-09-26T00:00:00Z'));

    assert.deepEqual(report, {
      generatedAt: '2026-09-26T00:00:00.000Z',
      repo: 'me/a',
      check: 'no-clone',
      pairs: [
        { a: 1, b: 2, files: ['a.ts'], conflicts: null },
        { a: 2, b: 3, files: ['b.ts'], conflicts: null },
      ],
    });
  });
});
