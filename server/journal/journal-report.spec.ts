import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PullComment } from '../github/comment-reader.ts';
import { journalEntries, journalReport } from './journal-report.ts';

const LESSON = (tag: string): string =>
  `## Second draft\nFirst version: ${tag} one.\nFeedback: ${tag} two.\nChanged: ${tag} three.\nPrinciples: deep-modules`;

const comment = (pull: number, postedAt: string, body: string): PullComment => ({
  pull,
  url: `https://github.com/me/app/pull/${pull}#issuecomment-${pull}`,
  postedAt,
  body,
});

describe('journalEntries', () => {
  it('lists the lessons newest comment first, each with its pull request and comment link', () => {
    const entries = journalEntries([
      comment(7, '2026-10-01T09:00:00Z', LESSON('old')),
      comment(9, '2026-10-05T09:00:00Z', LESSON('new')),
    ]);

    assert.deepEqual(
      entries.map((entry) => [entry.pull, entry.firstVersion]),
      [
        [9, 'new one.'],
        [7, 'old one.'],
      ],
    );
    assert.equal(entries[0].url, 'https://github.com/me/app/pull/9#issuecomment-9');
    assert.equal(entries[0].postedAt, '2026-10-05T09:00:00Z');
  });

  it('skips comments that carry no lesson, and shows none when no review has one', () => {
    assert.deepEqual(journalEntries([comment(1, '2026-10-01T00:00:00Z', '## Self-review\nFine.')]), []);
    assert.deepEqual(journalEntries([]), []);
  });
});

describe('journalReport', () => {
  it('reads the repository’s pull-request comments and stamps the report', async () => {
    const asked: string[] = [];
    const report = await journalReport(
      {
        pullComments: async (repo) => {
          asked.push(repo);
          return [comment(3, '2026-10-02T00:00:00Z', LESSON('x'))];
        },
      },
      'me/app',
      Date.UTC(2026, 9, 8),
    );

    assert.deepEqual(asked, ['me/app']);
    assert.equal(report.repo, 'me/app');
    assert.equal(report.generatedAt, '2026-10-08T00:00:00.000Z');
    assert.equal(report.entries.length, 1);
  });
});
