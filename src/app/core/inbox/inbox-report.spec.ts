import { INBOX_NOW, inboxBody, inboxItemBody } from './testing/inbox-fixture';
import { parseInboxReport } from './inbox-report';

describe('parseInboxReport', () => {
  it('reads the report, with times as milliseconds', () => {
    const report = parseInboxReport(inboxBody([inboxItemBody('1')]));

    expect(report?.generatedAt).toBe(Date.parse(INBOX_NOW));
    expect(report?.items).toEqual([
      {
        id: '1',
        repo: 'me/app',
        reason: 'review_requested',
        subjectType: 'PullRequest',
        number: 7,
        title: 'Thread 1',
        updatedAt: Date.parse('2026-10-08T09:00:00Z'),
        url: 'https://github.com/me/app/pull/7',
      },
    ]);
  });

  it('drops a thread with no id, or a link off GitHub, and a number that is not one', () => {
    const report = parseInboxReport(
      inboxBody([
        inboxItemBody('1', { id: 1 }),
        inboxItemBody('2', { url: 'javascript:alert(1)' }),
        inboxItemBody('3', { number: -4 }),
      ]),
    );

    expect(report?.items.map((item) => [item.id, item.number])).toEqual([['3', null]]);
  });

  it('keeps the note on why nothing could be read', () => {
    const report = parseInboxReport(
      inboxBody([], { status: 'no-access', note: 'The GitHub token cannot read notifications' }),
    );

    expect(report?.status).toBe('no-access');
    expect(report?.note).toBe('The GitHub token cannot read notifications');
  });

  it('is null for anything but a report', () => {
    expect(parseInboxReport({ error: 'sign in first' })).toBeNull();
    expect(parseInboxReport(inboxBody([], { generatedAt: 'soon' }))).toBeNull();
  });
});
