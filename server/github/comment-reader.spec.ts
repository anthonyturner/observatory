import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMMENT_LIMIT, pullCommentsOf, readPullComments } from './comment-reader.ts';

const comment = (number: number, extra: object = {}) => ({
  issue_url: `https://api.github.com/repos/me/app/issues/${number}`,
  html_url: `https://github.com/me/app/pull/${number}#issuecomment-${number * 10}`,
  created_at: '2026-10-05T09:00:00Z',
  body: `Review of ${number}`,
  author_association: 'OWNER',
  ...extra,
});

describe('pullCommentsOf', () => {
  it('keeps the team’s comments on pull requests, with the pull request number', () => {
    assert.deepEqual(pullCommentsOf([comment(12), comment(13, { author_association: 'MEMBER' })]), [
      {
        pull: 12,
        url: 'https://github.com/me/app/pull/12#issuecomment-120',
        postedAt: '2026-10-05T09:00:00Z',
        body: 'Review of 12',
      },
      {
        pull: 13,
        url: 'https://github.com/me/app/pull/13#issuecomment-130',
        postedAt: '2026-10-05T09:00:00Z',
        body: 'Review of 13',
      },
    ]);
  });

  it('leaves out issue comments, strangers’ comments and comments missing a field', () => {
    const kept = pullCommentsOf([
      comment(1, { html_url: 'https://github.com/me/app/issues/1#issuecomment-10' }),
      comment(2, { author_association: 'NONE' }),
      comment(3, { author_association: undefined }),
      comment(4, { body: '' }),
      comment(5, { issue_url: 'https://api.github.com/repos/me/app/issues/x' }),
      comment(6),
    ]);

    assert.deepEqual(
      kept.map((each) => each.pull),
      [6],
    );
  });

  it('reads anything that is not a list as none', () => {
    assert.deepEqual(pullCommentsOf({ message: 'Not Found' }), []);
    assert.deepEqual(pullCommentsOf(null), []);
  });
});

describe('readPullComments', () => {
  it('reads pages of a hundred until a short one, newest first', async () => {
    const paths: string[] = [];
    const full = Array.from({ length: 100 }, (_, index) => comment(index + 1));
    const comments = await readPullComments(async (path) => {
      paths.push(path);
      return paths.length === 1 ? full : [comment(500)];
    }, 'me/app');

    assert.equal(comments.length, 101);
    assert.deepEqual(paths, [
      'repos/me/app/issues/comments?sort=created&direction=desc&per_page=100&page=1',
      'repos/me/app/issues/comments?sort=created&direction=desc&per_page=100&page=2',
    ]);
  });

  it('stops at the limit', async () => {
    let requests = 0;
    const full = Array.from({ length: 100 }, (_, index) => comment(index + 1));
    await readPullComments(async () => {
      requests++;
      return full;
    }, 'me/app');

    assert.equal(requests, COMMENT_LIMIT / 100);
  });
});
