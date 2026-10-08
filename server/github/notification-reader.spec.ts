import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NOTIFICATION_LIMIT, notificationsOf, readNotifications } from './notification-reader.ts';

const thread = (id: string) => ({
  id,
  unread: true,
  reason: 'review_requested',
  updated_at: '2026-10-08T12:00:00Z',
  subject: {
    title: 'Add the inbox',
    type: 'PullRequest',
    url: 'https://api.github.com/repos/me/app/pulls/7',
  },
  repository: { full_name: 'me/app' },
});

describe('notificationsOf', () => {
  it('reads each thread, and leaves out one with no id or repository', () => {
    const threads = notificationsOf([
      thread('11'),
      { ...thread('12'), id: 12 },
      { ...thread('13'), repository: {} },
    ]);

    assert.deepEqual(threads, [
      {
        id: '11',
        reason: 'review_requested',
        repo: 'me/app',
        title: 'Add the inbox',
        subjectType: 'PullRequest',
        subjectUrl: 'https://api.github.com/repos/me/app/pulls/7',
        updatedAt: '2026-10-08T12:00:00Z',
      },
    ]);
  });

  it('keeps a CI run, which has no subject URL', () => {
    const [run] = notificationsOf([
      {
        ...thread('14'),
        reason: 'ci_activity',
        subject: { title: 'CI failed', type: 'CheckSuite', url: null },
      },
    ]);

    assert.equal(run.subjectUrl, null);
    assert.equal(run.subjectType, 'CheckSuite');
  });

  it('reads anything but a list as none', () => {
    assert.deepEqual(notificationsOf({ message: 'Requires authentication' }), []);
  });
});

describe('readNotifications', () => {
  const pageOf = (page: number, size: number) =>
    Array.from({ length: size }, (_, index) => thread(`${page}${index}`));

  it('reads pages until one comes back short', async () => {
    const asked: string[] = [];
    const sizes = [50, 3];
    const threads = await readNotifications(async (path) => {
      asked.push(path);
      return pageOf(asked.length, sizes[asked.length - 1]);
    });

    assert.deepEqual(asked, [
      'notifications?per_page=50&page=1',
      'notifications?per_page=50&page=2',
    ]);
    assert.equal(threads.length, 53);
  });

  it('stops at its limit however many are unread', async () => {
    let pages = 0;
    const threads = await readNotifications(async () => pageOf(++pages, 50));

    assert.equal(threads.length, NOTIFICATION_LIMIT);
    assert.equal(pages, NOTIFICATION_LIMIT / 50);
  });
});
