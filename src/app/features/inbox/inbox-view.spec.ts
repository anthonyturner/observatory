import { parseInboxReport } from '../../core/inbox/inbox-report';
import { inboxBody, inboxItemBody } from '../../core/inbox/testing/inbox-fixture';
import { inboxGroups, inboxLinkName } from './inbox-view';
import { emptyMessage, inboxStamp, reasonWords, subjectWords } from './inbox-words';

const NOW = Date.parse('2026-10-08T12:00:00Z');

function itemsOf(bodies: object[]) {
  return parseInboxReport(inboxBody(bodies))?.items ?? [];
}

describe('inboxGroups', () => {
  const items = itemsOf([
    inboxItemBody('1', { repo: 'me/app', reason: 'subscribed' }),
    inboxItemBody('2', { repo: 'someone/lib', reason: 'mention', subjectType: 'Issue', number: 4 }),
    inboxItemBody('3', { repo: 'me/app', reason: 'review_requested' }),
    inboxItemBody('4', {
      repo: 'me/app',
      reason: 'ci_activity',
      subjectType: 'CheckSuite',
      number: null,
      url: 'https://github.com/me/app/actions',
    }),
  ]);

  it('groups by repository, the most recently active first, then by reason, what waits on you first', () => {
    const groups = inboxGroups(items, new Set(['me/app']), NOW);

    expect(groups.map((group) => [group.repo, group.count, group.isTracked])).toEqual([
      ['me/app', '3 unread', true],
      ['someone/lib', '1 unread', false],
    ]);
    expect(groups[0].reasons.map((reason) => reason.label)).toEqual([
      'Review requested',
      'CI runs',
      'Watching the repository',
    ]);
    expect(groups[0].reasons[0].listLabel).toBe('Review requested in me/app');
    expect(new Set(groups.map((group) => group.headingId)).size).toBe(2);
  });

  it('opens a charted project’s pull request or issue inside Observatory, else on GitHub', () => {
    const groups = inboxGroups(items, new Set(['me/app', 'someone/lib']), NOW);
    const rows = groups.flatMap((group) => group.reasons.flatMap((reason) => reason.rows));
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(byId.get('3')).toEqual(
      expect.objectContaining({ href: '/p/me/app?pr=7', isInside: true }),
    );
    expect(byId.get('2')?.href).toBe('/p/someone/lib?issue=4');
    expect(byId.get('4')).toEqual(
      expect.objectContaining({ href: 'https://github.com/me/app/actions', isInside: false }),
    );
  });

  it('sends a project Observatory does not chart to GitHub', () => {
    const [group] = inboxGroups(itemsOf([inboxItemBody('9')]), new Set(), NOW);

    expect(group.reasons[0].rows[0]).toEqual(
      expect.objectContaining({ href: 'https://github.com/me/app/pull/7', isInside: false }),
    );
  });

  it('names the subject, its number and how long ago it moved', () => {
    const [group] = inboxGroups(itemsOf([inboxItemBody('1')]), new Set(), NOW);
    const [row] = group.reasons[0].rows;

    expect(row.meta).toBe('Pull request #7 · 3h ago');
    expect(row.markLabel).toBe('Mark read: Thread 1');
  });
});

describe('inbox words', () => {
  it('names a reason or subject GitHub adds later in plain words', () => {
    expect(reasonWords('some_new_reason')).toEqual({ label: 'Some new reason', tone: 'quiet' });
    expect(subjectWords('RepositoryAdvisory')).toBe('Repository advisory');
    expect(subjectWords('')).toBe('Notification');
  });

  it('counts the unread, saying when there are more than were read', () => {
    const report = parseInboxReport(inboxBody([inboxItemBody('1')], { isCapped: true }));

    expect(inboxStamp(report)).toBe('1+ unread transmissions');
    expect(inboxStamp(parseInboxReport(inboxBody([inboxItemBody('1')])))).toBe(
      '1 unread transmission',
    );
    expect(inboxStamp(null)).toBe('Incoming transmissions');
  });

  it('says all is clear, or why nothing could be read', () => {
    const empty = parseInboxReport(inboxBody([]));
    const denied = parseInboxReport(inboxBody([], { status: 'no-access', note: 'Needs a scope.' }));

    expect(empty && emptyMessage(empty)?.headline).toBe('All clear');
    expect(denied && emptyMessage(denied)).toEqual({
      headline: 'Could not read your notifications',
      detail: 'Needs a scope.',
    });
  });

  it('names the way to the Inbox with its count', () => {
    expect(inboxLinkName(3)).toBe('Inbox, 3 unread notifications');
    expect(inboxLinkName(0)).toBe('Inbox');
    expect(inboxLinkName(null)).toBe('Inbox');
  });
});
