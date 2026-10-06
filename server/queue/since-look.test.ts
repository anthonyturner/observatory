import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TriagedItem, TriagedQueue } from '../triage/triaged-queue.ts';
import { sinceLookDiffOf, sinceLookOf, withSinceLook } from './since-look.ts';

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

const item = (number: number, headSha: string, lookedSha: string | null): TriagedItem => ({
  number,
  title: `Pull ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  isDraft: false,
  bucket: 'unreviewed',
  closes: [],
  failingChecks: 0,
  additions: 1,
  deletions: 0,
  updatedAt: '2026-09-20T00:00:00Z',
  branch: 'b',
  headSha,
  base: 'main',
  mergeable: 'MERGEABLE',
  changedFiles: 1,
  idleDays: 3,
  ageDays: 4,
  isSeen: true,
  hidden: null,
  lookedSha,
});

const queue = (items: TriagedItem[]): TriagedQueue => ({
  generatedAt: '2026-09-29T00:00:00Z',
  repo: 'me/app',
  items,
});

describe('sinceLookOf', () => {
  it('counts the commits on a head that only moved forward', () => {
    assert.deepEqual(sinceLookOf({ status: 'ahead', aheadBy: 3 }), { newCommits: 3 });
  });

  it('cannot count across a rewritten branch, as after a force-push', () => {
    assert.deepEqual(sinceLookOf({ status: 'diverged', aheadBy: 2 }), { newCommits: null });
    assert.deepEqual(sinceLookOf({ status: 'behind', aheadBy: 0 }), { newCommits: null });
  });
});

describe('withSinceLook', () => {
  it('compares only a pull request whose head moved since it was looked at', async () => {
    const asked: string[] = [];
    const read = async (base: string, head: string) => {
      asked.push(`${base}...${head}`);
      return { newCommits: 2 };
    };

    const looked = await withSinceLook(
      queue([item(1, NEW, OLD), item(2, NEW, NEW), item(3, NEW, null)]),
      read,
    );

    assert.deepEqual(
      looked.items.map((each) => each.sinceLook),
      [{ newCommits: 2 }, null, null],
    );
    assert.deepEqual(asked, [`${OLD}...${NEW}`]);
  });

  it('still says the head moved when GitHub cannot compare the two', async () => {
    const looked = await withSinceLook(queue([item(1, NEW, OLD)]), async () => {
      throw new Error('GitHub: HTTP 404 No common ancestor');
    });

    assert.deepEqual(looked.items[0].sinceLook, { newCommits: null });
  });
});

describe('sinceLookDiffOf', () => {
  const extras = { diff: 'diff --git a/x b/x', fetchedAt: '2026-09-29T00:00:00Z' };

  it('carries the diff between the two heads', () => {
    const diff = sinceLookDiffOf({ base: OLD, head: NEW, since: { newCommits: 1 } }, extras);

    assert.equal(diff.diff, extras.diff);
    assert.equal(diff.newCommits, 1);
    assert.equal(diff.diffBytes, extras.diff.length);
  });

  it('carries no diff after a force-push, so the screen falls back to the whole one', () => {
    const diff = sinceLookDiffOf({ base: OLD, head: NEW, since: { newCommits: null } }, extras);

    assert.equal(diff.diff, '');
    assert.equal(diff.newCommits, null);
  });
});
