import { ActivityItem } from '../../core/activity/activity.types';
import { MailMessage } from '../../core/mail/mail.types';
import { noticeView } from './notice-view';

const merged: ActivityItem = {
  kind: 'merged',
  repo: 'me/observatory',
  label: 'Observatory',
  number: 280,
  title: 'Fold the playlist bar',
};
const issue: ActivityItem = {
  kind: 'issue',
  repo: 'me/beta',
  label: 'beta',
  number: 12,
  title: 'Crash on load',
};

describe('noticeView', () => {
  it('names a single item in its head and its dismiss button', () => {
    const view = noticeView({ id: 1, kind: 'merged', items: [merged] });

    expect(view.tag).toBe('Merged');
    expect(view.heading).toBeNull();
    expect(view.dismissLabel).toBe('Dismiss: pull request merged, Observatory #280');
  });

  it('heads a group with how many it holds', () => {
    const view = noticeView({ id: 2, kind: 'issue', items: [issue, { ...issue, number: 13 }] });

    expect(view.tag).toBe('New issue');
    expect(view.heading).toBe('2 new issues');
    expect(view.dismissLabel).toBe('Dismiss: 2 new issues');
    expect(view.rows.map((row) => row.badge)).toEqual(['#12', '#13']);
  });

  it('links a merged pull request to GitHub and a new issue to its star map', () => {
    const [pull] = noticeView({ id: 1, kind: 'merged', items: [merged] }).rows;
    const [opened] = noticeView({ id: 2, kind: 'issue', items: [issue] }).rows;

    expect(pull.link).toEqual({
      kind: 'external',
      href: 'https://github.com/me/observatory/pull/280',
    });
    expect(opened.link).toEqual({
      kind: 'route',
      path: ['/p', 'me', 'beta'],
      query: { issue: 12 },
    });
  });

  it('tags and heads a pull request opened and an issue closed', () => {
    const opened = noticeView({
      id: 3,
      kind: 'pull-opened',
      items: [{ ...merged, kind: 'pull-opened' }],
    });
    const closed = noticeView({
      id: 4,
      kind: 'issue-closed',
      items: [
        { ...issue, kind: 'issue-closed' },
        { ...issue, kind: 'issue-closed', number: 13 },
      ],
    });

    expect(opened.tag).toBe('PR opened');
    expect(opened.dismissLabel).toBe('Dismiss: pull request opened, Observatory #280');
    expect(closed.tag).toBe('Issue closed');
    expect(closed.heading).toBe('2 issues closed');
  });

  it('links a pull request opened to GitHub and an issue closed to its star map', () => {
    const [pull] = noticeView({
      id: 3,
      kind: 'pull-opened',
      items: [{ ...merged, kind: 'pull-opened' }],
    }).rows;
    const [shut] = noticeView({
      id: 4,
      kind: 'issue-closed',
      items: [{ ...issue, kind: 'issue-closed' }],
    }).rows;

    expect(pull.link).toEqual({
      kind: 'external',
      href: 'https://github.com/me/observatory/pull/280',
    });
    expect(shut.link).toEqual({ kind: 'route', path: ['/p', 'me', 'beta'], query: { issue: 12 } });
  });

  it('names under a merge each issue it closed, linked to the star map', () => {
    const folded: ActivityItem = { ...merged, closing: [{ number: 270, title: 'Bar stutters' }] };

    const [row] = noticeView({ id: 5, kind: 'merged', items: [folded] }).rows;

    expect(row.closing).toEqual([
      {
        key: 'me/observatory#270',
        number: 270,
        title: 'Bar stutters',
        link: { kind: 'route', path: ['/p', 'me', 'observatory'], query: { issue: 270 } },
      },
    ]);
  });

  describe('mail', () => {
    const message = (uid: number, changes: Partial<MailMessage> = {}): MailMessage => ({
      uid,
      from: 'Apple',
      fromAddress: 'no_reply@apple.example',
      subject: 'Your receipt',
      receivedAt: '2026-10-03T12:10:00.000Z',
      isUnread: true,
      ...changes,
    });
    const HOME_MAIL = { kind: 'route', path: ['/'], query: {}, fragment: 'mail' };

    it('heads one new message with its sender and account, its subject linked to Home’s Mail', () => {
      const view = noticeView({ id: 6, kind: 'mail', account: 'icloud', messages: [message(7)] });

      expect(view.tag).toBe('New mail');
      expect(view.heading).toBeNull();
      expect(view.rows).toEqual([
        {
          key: 'icloud#7',
          label: 'Apple',
          badge: 'iCloud',
          title: 'Your receipt',
          link: HOME_MAIL,
          closing: [],
        },
      ]);
      expect(view.dismissLabel).toBe('Dismiss: new email in iCloud from Apple');
    });

    it('heads several with the count in their account, and lists each sender and subject', () => {
      const view = noticeView({
        id: 7,
        kind: 'mail',
        account: 'gmail',
        messages: [message(3), message(2, { from: '', subject: '' })],
      });

      expect(view.heading).toBe('2 new emails in Gmail');
      expect(view.rows.map(({ label, badge, title }) => [label, badge, title])).toEqual([
        ['Apple', null, 'Your receipt'],
        ['(unknown sender)', null, '(no subject)'],
      ]);
      expect(view.dismissLabel).toBe('Dismiss: 2 new emails in Gmail');
    });

    it('says a refused sign-in plainly, with no password, and links to Home’s Mail', () => {
      const view = noticeView({ id: 8, kind: 'mail-sign-in', account: 'gmail' });

      expect(view.tag).toBe('Mail');
      expect(view.rows.map(({ label, title, link }) => [label, title, link])).toEqual([
        ['Gmail', "Couldn't sign in: check the address and app password", HOME_MAIL],
      ]);
      expect(view.dismissLabel).toBe('Dismiss: Gmail sign-in refused');
    });
  });
});
