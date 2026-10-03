import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ActivityWatch } from '../activity/activity-watch';
import { ActivityItem } from '../activity/activity.types';
import { PageVisibility } from '../presence/page-visibility';
import { NoticeBoard } from './notice-board';

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

function setUp() {
  const checks = new Subject<readonly ActivityItem[]>();
  const isHidden = signal(false);
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivityWatch, useValue: { checks } },
      { provide: PageVisibility, useValue: { isHidden } },
    ],
  });
  const board = TestBed.inject(NoticeBoard);
  TestBed.tick();
  const check = (...items: ActivityItem[]): void => {
    checks.next(items);
    TestBed.tick();
  };
  const settle = (): void => TestBed.tick();
  const numbers = (): number[][] =>
    board.notices().map((notice) => notice.items.map((i) => i.number));
  return { board, check, settle, isHidden, numbers };
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
});
