import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ActivityWatch } from '../../../core/activity/activity-watch';
import { ActivityItem } from '../../../core/activity/activity.types';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { NoticeBoard } from '../../../core/notices/notice-board';
import { PlaylistPlacement } from '../../../core/playlist/playlist-placement';
import { PageVisibility } from '../../../core/presence/page-visibility';
import { NoticeStack } from './notice-stack';

const merged = (number: number, repo = 'me/alpha'): ActivityItem => ({
  kind: 'merged',
  repo,
  label: repo.split('/')[1],
  number,
  title: `Pull ${number}`,
});
const issue = (number: number, repo = 'me/beta'): ActivityItem => ({
  kind: 'issue',
  repo,
  label: repo.split('/')[1],
  number,
  title: `Issue ${number}`,
});

function render() {
  const checks = new Subject<readonly ActivityItem[]>();
  const isStill = signal(false);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivityWatch, useValue: { checks } },
      { provide: PageVisibility, useValue: { isHidden: signal(false) } },
      { provide: MotionPreference, useValue: { isStill } },
    ],
  });
  const fixture = TestBed.createComponent(NoticeStack);
  document.body.append(fixture.nativeElement as HTMLElement);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const check = (...items: ActivityItem[]): void => {
    checks.next(items);
    fixture.detectChanges();
  };
  const notices = (): HTMLElement[] => Array.from(element.querySelectorAll('[data-notice]'));
  const links = (notice: Element): HTMLAnchorElement[] => Array.from(notice.querySelectorAll('a'));
  const press = (key: string, target: EventTarget = document.activeElement ?? document.body) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  return { fixture, element, check, notices, links, press, isStill };
}

describe('NoticeStack', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('holds the notices in a labelled region, and never in an alert', () => {
    const { element, check } = render();

    check(merged(10));

    const region = element.querySelector('section[role="region"]');
    expect(region?.getAttribute('aria-label')).toBe('Notifications');
    expect(region?.querySelectorAll(':scope > ul > li')).toHaveLength(1);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('announces each check once in a polite live region', () => {
    const { element, check } = render();

    check(merged(10), issue(7));

    const live = element.querySelector('[aria-live="polite"]');
    expect(live?.textContent?.trim()).toBe(
      'Pull request merged in me/alpha, #10: Pull 10; New issue in me/beta, #7: Issue 7.',
    );
  });

  it('never takes focus as a notice arrives', () => {
    const { check } = render();
    const before = document.activeElement;

    check(merged(10));

    expect(document.activeElement).toBe(before);
  });

  it('links a merged pull request to GitHub in a new tab, saying so to a screen reader', () => {
    const { check, notices, links } = render();

    check(merged(280, 'me/observatory'));

    const [link] = links(notices()[0]);
    expect(link.getAttribute('href')).toBe('https://github.com/me/observatory/pull/280');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.querySelector('.visually-hidden')?.textContent).toBe(', in a new tab');
  });

  it('links a new issue to its project’s star map, whichever page is open', () => {
    const { check, notices, links } = render();

    check(issue(12, 'me/beta'));

    expect(links(notices()[0])[0].getAttribute('href')).toBe('/p/me/beta?issue=12');
    expect(notices()[0].textContent).toContain('beta');
    expect(notices()[0].textContent).toContain('#12');
  });

  it('groups two or more of a kind from one check into one notice, a link for each', () => {
    const { check, notices, links } = render();

    check(merged(1), merged(2, 'me/gamma'), merged(3));

    expect(notices()).toHaveLength(1);
    expect(notices()[0].textContent).toContain('3 pull requests merged');
    expect(links(notices()[0]).map((link) => link.textContent?.trim())).toEqual([
      'Pull 1 ↗, in a new tab',
      'Pull 2 ↗, in a new tab',
      'Pull 3 ↗, in a new tab',
    ]);
  });

  it('shows at most three, the oldest leaving for a new one', () => {
    const { check, notices } = render();

    for (const number of [1, 2, 3, 4]) check(merged(number));

    expect(notices().map((notice) => notice.textContent)).toEqual([
      expect.stringContaining('#2'),
      expect.stringContaining('#3'),
      expect.stringContaining('#4'),
    ]);
  });

  it('dismisses a notice once its link is followed', () => {
    const { check, notices, links, fixture } = render();
    check(merged(10));

    links(notices()[0])[0].dispatchEvent(new MouseEvent('click', { cancelable: true }));
    fixture.detectChanges();

    expect(TestBed.inject(NoticeBoard).notices()).toEqual([]);
  });

  it('moves focus to the newest notice’s first link on F8', () => {
    const { check, notices, links, press } = render();
    check(merged(1));
    check(issue(2));

    const event = press('F8');

    expect(document.activeElement).toBe(links(notices()[1])[0]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('dismisses the focused notice on Esc without the page also acting on it', () => {
    const { check, notices, links, press } = render();
    const pageKeys: string[] = [];
    const pageKeydown = (event: KeyboardEvent): number => pageKeys.push(event.key);
    document.addEventListener('keydown', pageKeydown, { capture: true });
    check(merged(1));
    check(issue(2));
    press('F8');

    press('Escape');
    document.removeEventListener('keydown', pageKeydown, { capture: true });

    expect(
      TestBed.inject(NoticeBoard)
        .notices()
        .map((notice) => notice.kind),
    ).toEqual(['merged']);
    expect(pageKeys).not.toContain('Escape');
    expect(document.activeElement).toBe(links(notices()[0])[0]);
  });

  it('moves focus on to the next notice when one is dismissed', () => {
    const { check, notices, press } = render();
    check(merged(1));
    check(issue(2));
    const first = notices()[0];
    (first.querySelector('a') as HTMLElement).focus();

    press('Escape');

    expect(document.activeElement).toBe(notices()[0].querySelector('a'));
    expect(notices()[0].textContent).toContain('#2');
  });

  it('gives focus back to where it was once the last notice is dismissed', () => {
    const { check, press } = render();
    const field = document.createElement('button');
    document.body.append(field);
    field.focus();
    check(merged(1));

    press('F8');
    press('Escape');

    expect(document.activeElement).toBe(field);
  });

  it('moves focus on when the focused notice is pushed out by a new one', () => {
    const { check, notices } = render();
    for (const number of [1, 2, 3]) check(merged(number));
    (notices()[0].querySelector('a') as HTMLElement).focus();

    check(merged(4));

    expect(notices()[0].textContent).toContain('#2');
    expect(document.activeElement).toBe(notices()[0].querySelector('a'));
    expect(TestBed.inject(NoticeBoard).isPaused()).toBe(true);
  });

  it('gives focus back, and lets the countdowns run, when a focused notice leaves on its own', () => {
    const { check, notices, fixture, press } = render();
    const field = document.createElement('button');
    document.body.append(field);
    field.focus();
    check(merged(1));
    press('F8');
    const board = TestBed.inject(NoticeBoard);

    board.dismiss(board.notices()[0].id);
    fixture.detectChanges();
    check(merged(2));

    expect(notices()).toHaveLength(1);
    expect(document.activeElement).toBe(field);
    expect(board.isPaused()).toBe(false);
  });

  it('leaves Esc to the page when focus is not in a notice', () => {
    const { check, press } = render();
    check(merged(1));

    const event = press('Escape', document.body);

    expect(event.defaultPrevented).toBe(false);
    expect(TestBed.inject(NoticeBoard).notices()).toHaveLength(1);
  });

  it('holds the countdowns while the pointer is over the stack', () => {
    const { element, check, fixture } = render();
    check(merged(1));

    element.querySelector('section')?.dispatchEvent(new PointerEvent('pointerenter'));
    fixture.detectChanges();

    expect(TestBed.inject(NoticeBoard).isPaused()).toBe(true);
  });

  it('draws a countdown line, but none when motion is reduced', () => {
    const { element, check, isStill, fixture } = render();
    check(merged(1));
    const line = element.querySelector<HTMLElement>('.notice__countdown');
    expect(line?.style.getPropertyValue('--countdown-from')).toBe('1');
    expect(line?.style.animationDuration).toBe('10000ms');

    isStill.set(true);
    fixture.detectChanges();

    expect(element.querySelector('.notice__countdown')).toBeNull();
    expect(element.querySelector('.notices--still')).not.toBeNull();
  });

  it('steps aside for the run dock while it is open beside the page', () => {
    const { element, fixture } = render();

    TestBed.inject(PlaylistPlacement).setBesideDock(true);
    fixture.detectChanges();

    expect(element.querySelector('.notices--beside-dock')).not.toBeNull();
  });
});
