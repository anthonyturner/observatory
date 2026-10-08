import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DISCUSSIONS_QUERY, discussionReader, discussionsOf } from './discussion-reader.ts';

const thread = (number: number, more: object = {}) => ({
  number,
  title: `Thread ${number}`,
  url: `https://github.com/me/app/discussions/${number}`,
  updatedAt: '2026-10-07T10:00:00Z',
  answerChosenAt: null,
  category: { name: 'Q&A', isAnswerable: true },
  comments: { totalCount: 3 },
  author: { login: 'ann' },
  ...more,
});

describe('discussionsOf', () => {
  it('reads each thread’s category, answer and comments, and whether discussions are on', () => {
    const marks = discussionsOf({
      repository: {
        hasDiscussionsEnabled: true,
        discussions: {
          totalCount: 41,
          nodes: [
            thread(1, { answerChosenAt: '2026-10-07T11:00:00Z' }),
            thread(2, { category: { name: 'Ideas', isAnswerable: false }, author: null }),
            { title: 'no number' },
          ],
        },
      },
    });

    assert.equal(marks.isEnabled, true);
    assert.equal(marks.total, 41);
    assert.deepEqual(
      marks.threads.map((each) => [
        each.number,
        each.category,
        each.isAnswerable,
        each.isAnswered,
        each.author,
      ]),
      [
        [1, 'Q&A', true, true, 'ann'],
        [2, 'Ideas', false, false, null],
      ],
    );
    assert.equal(marks.threads[0].comments, 3);
  });

  it('reads a repository with discussions off as off, with none', () => {
    assert.deepEqual(
      discussionsOf({
        repository: { hasDiscussionsEnabled: false, discussions: { totalCount: 0, nodes: [] } },
      }),
      { isEnabled: false, total: 0, threads: [] },
    );
  });
});

describe('discussionReader', () => {
  it('asks for the repository’s discussions by owner and name', async () => {
    const asked: unknown[] = [];
    const reader = discussionReader(async (query, variables) => {
      asked.push(query, variables);
      return { repository: { hasDiscussionsEnabled: true, discussions: { nodes: [thread(5)] } } };
    });

    const marks = await reader.discussions('me/app');

    assert.deepEqual(asked, [DISCUSSIONS_QUERY, { owner: 'me', name: 'app' }]);
    assert.equal(marks.threads[0].title, 'Thread 5');
  });
});
