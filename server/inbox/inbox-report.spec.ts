import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type GitHubNotification, NOTIFICATION_LIMIT } from '../github/notification-reader.ts';
import { inboxFailureOf, inboxReport } from './inbox-report.ts';

const NOW = new Date('2026-10-08T12:00:00Z');

const thread = (id: string, updatedAt: string): GitHubNotification => ({
  id,
  reason: 'mention',
  repo: 'me/app',
  title: `Thread ${id}`,
  subjectType: 'Issue',
  subjectUrl: `https://api.github.com/repos/me/app/issues/${id}`,
  updatedAt,
});

const reading = (threads: GitHubNotification[]) => ({ notifications: async () => threads });
const refusing = (message: string) => ({
  notifications: async (): Promise<GitHubNotification[]> => {
    throw new Error(message);
  },
});

describe('inboxReport', () => {
  it('lists every unread thread newest first, each with its page and number', async () => {
    const report = await inboxReport(
      reading([thread('1', '2026-10-07T00:00:00Z'), thread('2', '2026-10-08T00:00:00Z')]),
      NOW,
    );

    assert.equal(report.status, 'read');
    assert.equal(report.note, null);
    assert.equal(report.isCapped, false);
    assert.deepEqual(
      report.items.map((item) => [item.id, item.number, item.url]),
      [
        ['2', 2, 'https://github.com/me/app/issues/2'],
        ['1', 1, 'https://github.com/me/app/issues/1'],
      ],
    );
    assert.equal(report.generatedAt, NOW.toISOString());
  });

  it('says when there were more than it reads at once', async () => {
    const many = Array.from({ length: NOTIFICATION_LIMIT }, (_, index) =>
      thread(String(index + 1), '2026-10-08T00:00:00Z'),
    );

    assert.equal((await inboxReport(reading(many), NOW)).isCapped, true);
  });

  it('says plainly when the token may not read notifications', async (context) => {
    context.mock.method(console, 'error', () => undefined);
    const report = await inboxReport(refusing('gh: Not Found (HTTP 404)'), NOW);

    assert.equal(report.status, 'no-access');
    assert.match(String(report.note), /notifications or repo scope/);
    assert.deepEqual(report.items, []);
  });
});

describe('inboxFailureOf', () => {
  it('reads a refusal as no access and anything else as GitHub not answering', () => {
    assert.equal(inboxFailureOf(new Error('GitHub: HTTP 403 {"message":"x"}')).status, 'no-access');
    assert.equal(inboxFailureOf(new Error('GitHub: HTTP 401 Bad credentials')).status, 'no-access');
    assert.equal(inboxFailureOf(new Error('fetch failed')).status, 'failed');
    assert.equal(inboxFailureOf('HTTP 502').status, 'failed');
  });
});
