import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { MailNews } from '../mail/mail-memory';
import { MailWatch } from '../mail/mail-watch';
import { MailMessage } from '../mail/mail.types';
import { PageVisibility } from '../presence/page-visibility';
import { NoticeBoard } from './notice-board';
import { Notice } from './notice.types';

const merged = (number: number): ActivityItem => ({
  kind: 'merged',
  repo: 'me/alpha',
  label: 'alpha',
  number,
  title: `Pull ${number}`,
});
const issue = (number: number): ActivityItem => ({
  kind: 'issue',
  repo: 'me/beta',
  label: 'beta',
  number,
  title: `Issue ${number}`,
});

const message = (uid: number): MailMessage => ({
  uid,
  from: 'Apple',
  fromAddress: 'no_reply@apple.example',
  subject: `Receipt ${uid}`,
  receivedAt: '2026-10-03T12:10:00.000Z',
  isUnread: true,
});

/** Each notice's rows: pull request and issue numbers, or message UIDs. */
const rowsOf = (notice: Notice): number[] => {
  switch (notice.kind) {
    case 'mail':
      return notice.messages.map((each) => each.uid);
    case 'mail-sign-in':
      return [];
    default:
      return notice.items.map((item) => item.number);
  }
};

function setUp() {
  const checks = new Subject<readonly ActivityItem[]>();
  const mail = new Subject<MailNews>();
  const isHidden = signal(false);
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivityWatch, useValue: { checks } },
      { provide: MailWatch, useValue: { news: mail } },
      { provide: PageVisibility, useValue: { isHidden } },
    ],
  });
  const board = TestBed.inject(NoticeBoard);
  TestBed.tick();
  const check = (...items: ActivityItem[]): void => {
    checks.next(items);
    TestBed.tick();
  };
  const read = (news: MailNews): void => {
    mail.next(news);
    TestBed.tick();
  };
  const settle = (): void => TestBed.tick();
  const numbers = (): number[][] => board.notices().map(rowsOf);
  return { board, check, read, settle, isHidden, numbers };
}

describe('NoticeBoard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows one notice per kind from a check, merged pull requests first', () => {
    const { board, check, numbers } = setUp();

    check(merged(10), merged(11), issue(7));

    expect(board.notices().map((notice) => notice.kind)).toEqual(['merged', 'issue']);
    expect(numbers()).toEqual([[10, 11], [7]]);
  });

  it('announces each check once as a sentence', () => {
    const { board, check } = setUp();

    check(merged(10), issue(7));

    expect(board.announcement()).toBe(
      'Pull request merged in me/alpha, #10: Pull 10; New issue in me/beta, #7: Issue 7.',
    );
  });

  it('keeps at most three, the oldest leaving for a new one', () => {
    const { check, numbers } = setUp();

    check(merged(1));
    check(merged(2));
    check(merged(3));
    check(merged(4));

    expect(numbers()).toEqual([[2], [3], [4]]);
  });

  it('shows the first three kinds of a check with four, rather than push out its merge', () => {
    const { board, check } = setUp();

    check(
      merged(10),
      { ...issue(5), kind: 'issue-closed' },
      { ...merged(11), kind: 'pull-opened' },
      issue(7),
    );

    expect(board.notices().map((notice) => notice.kind)).toEqual([
      'merged',
      'issue-closed',
      'pull-opened',
    ]);
    expect(board.announcement()).toContain('and 1 more');
  });

  it('lets a notice leave after ten seconds, and two more for each extra row', () => {
    const { check, numbers } = setUp();
    check(merged(1));
    check(issue(2), issue(3), issue(4));

    vi.advanceTimersByTime(10_000);
    expect(numbers()).toEqual([[2, 3, 4]]);

    vi.advanceTimersByTime(4_000);
    expect(numbers()).toEqual([]);
  });

  it('holds every countdown while the pointer is over the stack', () => {
    const { board, check, settle, numbers } = setUp();
    check(merged(1));
    vi.advanceTimersByTime(5_000);

    board.setPointerOver(true);
    settle();
    vi.advanceTimersByTime(60_000);
    expect(numbers()).toEqual([[1]]);

    board.setPointerOver(false);
    settle();
    vi.advanceTimersByTime(4_999);
    expect(numbers()).toEqual([[1]]);
    vi.advanceTimersByTime(1);
    expect(numbers()).toEqual([]);
  });

  it('resumes with at least four seconds, and redraws the line from where it stopped', () => {
    const { board, check, settle, numbers } = setUp();
    check(merged(1));
    const id = board.notices()[0].id;
    vi.advanceTimersByTime(9_000);

    board.setFocusWithin(true);
    settle();
    board.setFocusWithin(false);
    settle();

    expect(board.countdowns().get(id)).toEqual(
      expect.objectContaining({ fromScale: 0.1, ms: 4_000 }),
    );
    vi.advanceTimersByTime(3_999);
    expect(numbers()).toEqual([[1]]);
    vi.advanceTimersByTime(1);
    expect(numbers()).toEqual([]);
  });

  it('starts counting only once the tab is back, gathering news of a kind meanwhile', () => {
    const { check, settle, isHidden, numbers } = setUp();
    isHidden.set(true);
    settle();

    check(merged(1));
    check(merged(2), issue(3));
    vi.advanceTimersByTime(60_000);
    expect(numbers()).toEqual([[1, 2], [3]]);

    isHidden.set(false);
    settle();
    check(merged(4));
    expect(numbers()).toEqual([[1, 2], [3], [4]]);

    vi.advanceTimersByTime(12_000);
    expect(numbers()).toEqual([]);
  });

  it('dismisses a notice, and lets go of the pause once none is left', () => {
    const { board, check, settle, numbers } = setUp();
    check(merged(1));
    board.setPointerOver(true);
    settle();

    board.dismiss(board.notices()[0].id);
    settle();

    expect(numbers()).toEqual([]);
    expect(board.isPaused()).toBe(false);
  });

  it('shows new mail as one notice per account, after the projects’ news, and says each message', () => {
    const { board, check, read, numbers } = setUp();
    check(merged(1));

    read({
      newMail: [
        { account: 'icloud', messages: [message(7), message(6)] },
        { account: 'gmail', messages: [message(3)] },
      ],
      signInFailed: [],
    });

    expect(board.notices().map((notice) => notice.kind)).toEqual(['merged', 'mail', 'mail']);
    expect(numbers()).toEqual([[1], [7, 6], [3]]);
    expect(board.announcement()).toBe(
      'New email in iCloud from Apple: Receipt 7; New email in iCloud from Apple: Receipt 6; ' +
        'New email in Gmail from Apple: Receipt 3.',
    );
  });

  it('shows a refused sign-in as its own notice, which leaves like any other', () => {
    const { board, read, numbers } = setUp();

    read({ newMail: [], signInFailed: ['gmail'] });

    expect(board.notices()).toEqual([{ id: 1, kind: 'mail-sign-in', account: 'gmail' }]);
    expect(board.announcement()).toBe("Couldn't sign in to Gmail.");
    vi.advanceTimersByTime(10_000);
    expect(numbers()).toEqual([]);
  });

  it('keeps at most three across projects and mail', () => {
    const { board, check, read } = setUp();
    check(merged(1), issue(2));

    read({ newMail: [{ account: 'gmail', messages: [message(3)] }], signInFailed: ['icloud'] });

    expect(board.notices().map((notice) => notice.kind)).toEqual(['issue', 'mail', 'mail-sign-in']);
  });
});
