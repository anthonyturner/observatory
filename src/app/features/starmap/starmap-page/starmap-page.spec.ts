import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AMBIENT_PLAYER } from '../../../core/sound/sound-preference';
import { anIssue } from '../../../core/issues/testing/issues-fixture';
import { StarmapSound } from '../sound/starmap-sound';
import { StarmapSky } from '../starmap-sky/starmap-sky';
import { StarmapPage } from './starmap-page';

const pull = (number: number, bucket: string, extra: Record<string, unknown> = {}) => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket,
  closes: [number + 100],
  failingChecks: 0,
  additions: 12,
  deletions: 1,
  idleDays: 2,
  ageDays: 5,
  isSeen: false,
  hidden: null,
  ...extra,
});

const items = [
  pull(7, 'failing'),
  pull(9, 'unreviewed'),
  pull(11, 'unreviewed', { hidden: { reason: 'dismissed' } }),
];

function render(fragment: string | null = null) {
  const fragments = new BehaviorSubject<string | null>(fragment);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AMBIENT_PLAYER,
        useValue: () => ({
          start: async () => undefined,
          stop: () => undefined,
          dispose: () => undefined,
          setUnease: () => undefined,
        }),
      },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ owner: 'me', repo: 'a' })),
          fragment: fragments,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(StarmapPage);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http
    .expectOne('/api/queue?repo=me/a')
    .flush({ generatedAt: new Date().toISOString(), repo: 'me/a', items });
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const button = (words: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === words,
    );
  return { fixture, element, http, button, fragments };
}

const issueRow = (number: number, extra: Record<string, unknown>) => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/me/a/issues/${number}`,
  labels: [{ name: 'bug', color: 'd73a4a' }],
  assignees: [],
  author: 'me',
  createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-09-20T12:00:00Z',
  closedAt: null,
  prs: [],
  ...extra,
});

/** Answers the page's read of the issues: one nobody is on, one with pull requests. */
function flushIssues(http: HttpTestingController): void {
  http.expectOne('/api/issues?repo=me/a').flush({
    generatedAt: new Date().toISOString(),
    repo: 'me/a',
    days: 60,
    total: { open: 2, closed: 0, comets: 1 },
    open: [issueRow(1, { comet: true }), issueRow(2, { comet: false, prs: [7, 3] })],
    closed: [],
  });
}

describe('StarmapPage', () => {
  beforeEach(() => localStorage.clear());

  it('opens on the sky, titled and stamped as pr-starmap’s', () => {
    const { element } = render();

    expect(element.querySelector('app-starmap-sky')).not.toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Review Queue');
    expect(element.querySelector('.stamp')?.textContent).toContain('me/a · 2 open · refreshed');
    expect(element.querySelector('.lg')?.textContent).toContain('0 cannot merge');
  });

  it('counts the unclaimed issues in the legend, and shows or hides their comets', () => {
    const { fixture, element, http } = render();
    const at = new Date().toISOString();
    const open = (number: number, comet: boolean) => ({
      number,
      title: `Issue ${number}`,
      url: `https://github.com/me/a/issues/${number}`,
      labels: [],
      assignees: [],
      author: null,
      createdAt: at,
      updatedAt: at,
      closedAt: null,
      stateReason: null,
      comet,
      prs: comet ? [] : [7],
    });
    http.expectOne('/api/issues?repo=me/a').flush({
      generatedAt: at,
      repo: 'me/a',
      days: 60,
      total: { open: 2, closed: 0, comets: 1 },
      open: [open(3, true), open(4, false)],
      closed: [],
    });
    fixture.detectChanges();
    const chip = Array.from(element.querySelectorAll<HTMLButtonElement>('.lg')).find((b) =>
      b.textContent?.includes('unclaimed'),
    );

    expect(chip?.textContent).toContain('1 unclaimed issue');
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
    chip?.click();
    fixture.detectChanges();
    expect(chip?.getAttribute('aria-pressed')).toBe('false');
  });

  it('leaves dismissed pull requests out, and lists the rest by bucket', () => {
    const { fixture, element, button } = render();

    button('List')?.click();
    fixture.detectChanges();

    expect(Array.from(element.querySelectorAll('h3')).map((h) => h.textContent?.trim())).toEqual([
      'RuinaChecks failing · 1',
      'VigiliaWaiting on you · 1',
    ]);
    expect(element.textContent).not.toContain('Change 11');
  });

  it('narrows the sky and list with a legend chip, and back', () => {
    const { fixture, element, button } = render();
    button('List')?.click();
    const chip = Array.from(element.querySelectorAll<HTMLButtonElement>('.lg')).find((b) =>
      b.textContent?.includes('checks failing'),
    );

    chip?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('section').length).toBe(1);
    chip?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('section').length).toBe(2);
  });

  it('shows the log sky’s own title and what to do when none is charted', () => {
    const { fixture, element, http } = render('logs');
    http.expectOne('/api/logs?repo=me/a').flush({ configured: false, reason: 'not-set' });
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toBe('Log Sky');
    expect(element.querySelector('.stamp')?.textContent).toBe('no logs yet');
    expect(element.querySelector('.state')?.textContent).toContain('No logs charted yet.');
  });

  it('lists the issues as pr-starmap does, with its stamp, legend and chips', () => {
    const { fixture, element, http, button } = render('issues');
    flushIssues(http);
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toBe('Issues');
    expect(element.querySelector('.stamp')?.textContent).toContain(
      'me/a · 2 open · 0 closed in 60 days',
    );
    expect(element.querySelector('h3')?.textContent).toContain('2 · 1 with nobody on it');
    expect(element.querySelector('.comet-mark')?.textContent).toContain('comet · nobody on it');
    expect(element.querySelector('a.prchip')?.getAttribute('href')).toBe(
      'https://github.com/me/a/pull/3',
    );

    element.querySelector<HTMLButtonElement>('.lg')?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('li.issue').length).toBe(1);
    element.querySelector<HTMLButtonElement>('.lg')?.click();
    fixture.detectChanges();

    button('#7')?.click();
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=7');
    http.expectOne('/api/edit?repo=me/a&number=7');
    http.expectOne('/api/labels?repo=me/a');
    expect(element.querySelector('app-pr-screen')).not.toBeNull();
  });

  it('charts the issues as the nursery under the docked bar, and reads one in the window', () => {
    const { fixture, element, http, button } = render('issues/map');
    flushIssues(http);
    fixture.detectChanges();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    expect(element.querySelector('.issuedock app-issue-bar')).not.toBeNull();
    expect(element.querySelector('.listview')).toBeNull();
    sky.pickedIssue.emit({ issue: anIssue(1), look: 'globule', jets: [], colour: '#9fe8ff' });
    fixture.detectChanges();
    expect(element.querySelector('app-issue-card .bucketname')?.textContent).toBe(
      'Globule — nobody on it',
    );

    button('Open')?.click();
    fixture.detectChanges();
    http.expectOne('/api/issue?repo=me/a&number=1');
    expect(element.querySelector('app-issue-window')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('app-issue-window')).toBeNull();
    expect(element.querySelector('app-issue-card')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('app-issue-card')).toBeNull();
  });

  it('opens a star’s card, and its full screen from Open; Esc closes them in turn', () => {
    const { fixture, element, http, button } = render();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.picked.emit(7);
    fixture.detectChanges();
    expect(element.querySelector('.prno')?.textContent).toBe('#7');
    button('Open')?.click();
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=7');
    http.expectOne('/api/edit?repo=me/a&number=7');
    http.expectOne('/api/labels?repo=me/a');
    expect(element.querySelector('app-pr-screen')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('app-pr-screen')).toBeNull();
    expect(element.querySelector('.prno')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('.prno')).toBeNull();
  });

  it('snoozes a pull request for a week from its card, then reads the queue again', () => {
    const { fixture, http, button } = render();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;
    sky.picked.emit(9);
    fixture.detectChanges();

    button('Snooze 7d')?.click();

    const post = http.expectOne('/api/triage');
    expect(post.request.body).toEqual({ repo: 'me/a', number: 9, action: 'snooze', days: 7 });
    post.flush({});
    http.expectOne('/api/queue?repo=me/a');
  });

  it('pings softly when a comet is picked, as it does for a star', () => {
    const { fixture } = render();
    const ping = vi.spyOn(TestBed.inject(StarmapSound), 'ping');
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.pickedComet.emit({ key: 'me/a#4' } as never);

    expect(ping).toHaveBeenCalledWith(false);
  });

  it('offers a visitor to the hosted preview no triage to change', () => {
    const { fixture, http, button } = render();
    http.expectOne('/api/session').flush({ access: 'visitor', signIn: '/api/auth/login' });
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.picked.emit(7);
    fixture.detectChanges();

    expect(button('Open')).toBeDefined();
    expect(button('Snooze 7d')).toBeUndefined();
    expect(button('Dismiss')).toBeUndefined();
  });
});
