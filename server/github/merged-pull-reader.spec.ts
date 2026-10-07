import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MERGED_LIMIT, mergedPullsOf, readMergedPulls } from './merged-pull-reader.ts';

const pull = (number: number, mergedAt: string | null) => ({
  number,
  title: `Change ${number}`,
  html_url: `https://github.com/me/app/pull/${number}`,
  merged_at: mergedAt,
  user: { login: 'me' },
});

describe('mergedPullsOf', () => {
  it('keeps the merged pull requests and leaves out the ones closed unmerged', () => {
    const pulls = mergedPullsOf([
      pull(1, '2026-01-01T00:00:00Z'),
      pull(2, null),
      { ...pull(3, '2026-01-02T00:00:00Z'), user: null },
    ]);

    assert.deepEqual(pulls, [
      {
        number: 1,
        title: 'Change 1',
        url: 'https://github.com/me/app/pull/1',
        mergedAt: '2026-01-01T00:00:00Z',
        author: 'me',
      },
      {
        number: 3,
        title: 'Change 3',
        url: 'https://github.com/me/app/pull/3',
        mergedAt: '2026-01-02T00:00:00Z',
        author: '',
      },
    ]);
  });
});

describe('readMergedPulls', () => {
  it('stops at a short page and lists the most recent merge first', async () => {
    const asked: string[] = [];
    const full = Array.from({ length: 100 }, (_, index) =>
      pull(index + 10, `2026-01-01T00:${String(index % 60).padStart(2, '0')}:00Z`),
    );
    const pulls = await readMergedPulls(async (path) => {
      asked.push(path);
      return path.endsWith('page=1') ? full : [pull(1, '2026-02-01T00:00:00Z')];
    }, 'me/app');

    assert.equal(asked.length, 2);
    assert.match(asked[0], /^repos\/me\/app\/pulls\?state=closed&sort=updated/);
    assert.equal(pulls.length, 101);
    assert.equal(pulls[0].number, 1);
  });

  it('reads no more than the limit', async () => {
    let pages = 0;
    const pulls = await readMergedPulls(async () => {
      pages++;
      return Array.from({ length: 100 }, (_, index) =>
        pull(pages * 1000 + index, '2026-01-01T00:00:00Z'),
      );
    }, 'me/app');

    assert.equal(pages, MERGED_LIMIT / 100);
    assert.equal(pulls.length, MERGED_LIMIT);
  });
});
