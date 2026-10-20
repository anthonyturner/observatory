import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { PageVisibility } from '../../../core/presence/page-visibility';
import { QueueFeed } from '../../../core/queue/queue-feed';
import { signal } from '@angular/core';
import type { MockInstance } from 'vitest';
import { AMBIENT_PLAYER } from '../../../core/sound/sound-preference';
import { anIssue } from '../../../core/issues/testing/issues-fixture';
import { PrScreen } from '../pr-screen/pr-screen';
import { StarmapSound } from '../sound/starmap-sound';
import { StarmapSky } from '../starmap-sky/starmap-sky';
import { WipLimitSetting } from '../wip-limit/wip-limit-setting';
import { LOG_FIXTURE, LOG_FIXTURE_WITH_OLDER } from '../../../core/logs/testing/log-fixture';
import { VideoBackground } from '../../../core/playlist/video-background';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { StarmapPage } from './starmap-page';

const pull = (number: number, bucket: string, extra: Record<string, unknown> = {}) => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/a/pull/${number}`,
  isDraft: false,
  bucket,
  closes: [number + 100],
  failingChecks: 0,
  flakyChecks: [],
  additions: 12,
  deletions: 1,
  idleDays: 2,
  ageDays: 5,
  isSeen: false,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
  ...extra,
});

const items = [
  pull(7, 'failing'),
  pull(9, 'unreviewed'),
  pull(11, 'unreviewed', { hidden: { reason: 'dismissed' } }),
];

function render(
  fragment: string | null = null,
  query: Record<string, string> = {},
  queued: readonly object[] = items,
) {
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
        provide: ELEMENT_SIZE,
        useValue: (element: Element) =>
          of({ width: 400, height: element.classList.contains('hud') ? 220 : 44 }),
      },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ owner: 'me', repo: 'a' })),
          fragment: fragments,
          snapshot: { queryParamMap: convertToParamMap(query) },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(StarmapPage);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http
    .expectOne('/api/queue?repo=me/a')
    .flush({ generatedAt: new Date().toISOString(), repo: 'me/a', items: queued });
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
    expect(element.querySelector('app-starmap-header h2')?.textContent).toBe('Review Queue');
    expect(element.querySelector('.stamp')?.textContent).toContain('me/a · 2 open · refreshed');
    expect(element.querySelector('.lg')?.textContent).toContain('0 cannot merge');
  });

  it('publishes the heights of its top chrome and its tools, for the panels and lists to clear', () => {
    render();
    const root = document.documentElement.style;

    expect([
      root.getPropertyValue('--hud-top-height'),
      root.getPropertyValue('--tools-height'),
    ]).toEqual(['220px', '44px']);
  });

  it('leaves the timeline to its own toggle, whatever the Tools drawer does', () => {
    localStorage.setItem('observatory.timeline', 'open');
    const { fixture, element, http, button } = render();
    const row = (day: string) => ({ day, open: 2, opened: [], merged: [], closed: [] });
    http.expectOne('/api/ledger?repo=me/a').flush({
      generatedAt: new Date().toISOString(),
      rows: [row('2026-10-01'), row('2026-10-02')],
      titles: {},
      finished: [],
      mergedBranches: [],
    });
    fixture.detectChanges();
    const tools = element.querySelector<HTMLButtonElement>('.toolsbutton') as HTMLButtonElement;
    expect(element.querySelector('app-timeline')).not.toBeNull();

    tools.click();
    fixture.detectChanges();
    expect(tools.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('app-timeline')).not.toBeNull();

    button('Timeline')?.click();
    fixture.detectChanges();
    expect(tools.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('app-timeline')).toBeNull();

    tools.click();
    fixture.detectChanges();
    tools.click();
    fixture.detectChanges();
    expect(element.querySelector('app-timeline')).toBeNull();
  });

  it('sends the live agents in this repository to the sky as satellites', () => {
    const { fixture, element, http } = render(null, {}, [
      pull(7, 'failing', { branch: 'feat/7-thing', base: 'main' }),
    ]);
    const agent = (session: string, repo: string, branch: string) => ({
      session,
      agentId: null,
      state: 'working',
      lastActiveAt: new Date().toISOString(),
      repo,
      branch,
      title: session,
    });
    http.expectOne('/api/live-agents').flush({
      agents: [
        agent('on-pr', 'me/a', 'feat/7-thing'),
        agent('loose', 'me/a', 'main'),
        agent('elsewhere', 'me/other', 'feat/7-thing'),
      ],
    });
    fixture.detectChanges();

    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;
    expect(sky.satellites().map((each) => [each.name, each.pr])).toEqual([
      ['on-pr', 7],
      ['loose', null],
    ]);
    expect(element.querySelector('app-starmap-sky')).not.toBeNull();
  });

  it('lets the playlist video through beneath the stars while Video is on', () => {
    const { fixture, element } = render();
    const sky = element.querySelector('app-starmap-sky');
    const video = element.querySelector('app-video-sky');
    expect(video?.classList).toContain('dimmed');
    expect(sky?.classList).not.toContain('see-through');

    TestBed.inject(VideoBackground).toggle();
    fixture.detectChanges();
    expect(sky?.classList).toContain('see-through');
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

  it('nudges past the work-in-progress limit, drafts aside, and lets go under a raised one', () => {
    localStorage.setItem('observatory.wip-limit', '2');
    const { fixture, element } = render(null, {}, [
      ...items,
      pull(13, 'unreviewed', { isDraft: true }),
    ]);
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    expect(element.querySelector('app-wip-notice [role="status"]')?.textContent).toContain(
      '3 open, past your limit of 2',
    );
    expect(sky.cometsFaded()).toBe(true);
    TestBed.inject(WipLimitSetting).set(3);
    fixture.detectChanges();

    expect(element.querySelector('app-wip-notice [role="status"]')).toBeNull();
    expect(sky.cometsFaded()).toBe(false);
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

    expect(element.querySelector('app-starmap-header h2')?.textContent).toBe('Log Sky');
    expect(element.querySelector('.stamp')?.textContent).toBe('no logs yet');
    expect(element.querySelector('.state')?.textContent).toContain('No logs charted yet.');
  });

  describe('the Log Sky’s Clear', () => {
    function logSky(access: string, snapshot: object = LOG_FIXTURE) {
      const page = render('logs');
      page.http.expectOne('/api/session').flush({ access, signIn: null });
      page.http.expectOne('/api/logs?repo=me/a').flush(snapshot);
      page.fixture.detectChanges();
      return page;
    }

    it('is the owner’s on this machine: Clear records now, and the sky is read again', () => {
      const { fixture, http, button } = logSky('local');

      button('Clear')?.click();
      const clear = http.expectOne('/api/logs/clear');
      expect(clear.request.method).toBe('POST');
      clear.flush({ clearedAt: '2026-09-26T09:45:00' });
      http
        .expectOne('/api/logs?repo=me/a&fresh=1')
        .flush({ ...LOG_FIXTURE, clearedAt: '2026-09-26T09:45:00' });
      fixture.detectChanges();

      expect(button('Reset')).toBeDefined();
      expect(fixture.nativeElement.querySelector('.stamp')?.textContent).toContain('cleared');
    });

    it('is shown to no one off this machine', () => {
      for (const access of ['owner', 'visitor']) {
        const { button } = logSky(access);

        expect(button('Clear'), access).toBeUndefined();
        TestBed.resetTestingModule();
      }
    });

    it('gives every viewer Show N older, and only the owner on this machine Clear', () => {
      for (const access of ['local', 'owner', 'visitor']) {
        const { button } = logSky(access, LOG_FIXTURE_WITH_OLDER);

        expect(button('Show 3 older'), access).toBeDefined();
        expect(button('Clear') !== undefined, access).toBe(access === 'local');
        TestBed.resetTestingModule();
      }
    });

    it('has Refresh read the logs afresh', () => {
      const { fixture, http, button } = logSky('local');

      button('Refresh')?.click();
      fixture.detectChanges();

      http.expectOne('/api/logs?repo=me/a&fresh=1').flush(LOG_FIXTURE);
    });
  });

  it('lists the issues as pr-starmap does, with its stamp, legend and chips', () => {
    const { fixture, element, http, button } = render('issues');
    flushIssues(http);
    fixture.detectChanges();

    expect(element.querySelector('app-starmap-header h2')?.textContent).toBe('Issues');
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
    expect(element.querySelector('app-issue-card')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('app-issue-window')).toBeNull();
  });

  it('previews a star’s card, and its full screen from Open in its place; Esc closes it', () => {
    const { fixture, element, http, button } = render();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.previewed.emit(7);
    fixture.detectChanges();
    expect(element.querySelector('.prno')?.textContent).toBe('#7');
    button('Open')?.click();
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=7');
    http.expectOne('/api/edit?repo=me/a&number=7');
    http.expectOne('/api/labels?repo=me/a');
    expect(element.querySelector('app-pr-screen')).not.toBeNull();
    expect(element.querySelector('app-star-card')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('app-pr-screen')).toBeNull();
  });

  it('snoozes a pull request for a week from its card, then reads the queue again', () => {
    const { fixture, http, button } = render();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;
    sky.previewed.emit(9);
    fixture.detectChanges();

    button('Snooze 7d')?.click();

    const post = http.expectOne('/api/triage');
    expect(post.request.body).toEqual({ repo: 'me/a', number: 9, action: 'snooze', days: 7 });
    post.flush({});
    http.expectOne('/api/queue?repo=me/a');
  });

  it('records a look at the head the screen shows, and keeps the old one to compare with', () => {
    const looked = 'a'.repeat(40);
    const head = 'b'.repeat(40);
    const { fixture, http } = render(null, {}, [pull(7, 'failing', { lookedSha: looked })]);
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;
    sky.picked.emit(7);
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=7').flush({
      number: 7,
      title: 'Change 7',
      url: 'https://github.com/me/a/pull/7',
      bucket: 'failing',
      head: 'feat/7',
      base: 'main',
      state: 'open',
      headOid: head,
    });
    http.expectOne('/api/edit?repo=me/a&number=7');
    http.expectOne('/api/labels?repo=me/a');
    fixture.detectChanges();
    http.expectOne(`/api/since-look?repo=me/a&base=${looked}&head=${head}`);

    const post = http.expectOne('/api/triage');
    expect(post.request.body).toEqual({ repo: 'me/a', number: 7, action: 'look', sha: head });
    post.flush({});
    http.expectOne('/api/queue?repo=me/a').flush({
      generatedAt: new Date().toISOString(),
      repo: 'me/a',
      items: [pull(7, 'failing', { lookedSha: head })],
    });
    fixture.detectChanges();

    const screen = fixture.debugElement.query(By.directive(PrScreen)).componentInstance as PrScreen;
    expect(screen.lookedSha()).toBe(looked);
  });

  it('opens a clicked star’s full screen at once, and keeps the sky behind it still', () => {
    const { fixture, element, http } = render();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.picked.emit(7);
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=7');
    http.expectOne('/api/edit?repo=me/a&number=7');
    http.expectOne('/api/labels?repo=me/a');
    expect(element.querySelector('app-pr-screen')).not.toBeNull();

    sky.previewed.emit(9);
    fixture.detectChanges();
    expect(element.querySelector('app-star-card')).toBeNull();
  });

  it('closes a comet’s hover card when its Open button opens the issue window', () => {
    const { fixture, element, http, button } = render();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;
    sky.previewedComet.emit({
      issue: 4,
      title: 'Stalled',
      url: 'https://github.com/me/a/issues/4',
      labels: [],
      ageDays: 3,
      idleDays: 2,
    });
    fixture.detectChanges();

    button('Open')?.click();
    fixture.detectChanges();

    http.expectOne('/api/issue?repo=me/a&number=4');
    expect(element.querySelector('app-issue-window')).not.toBeNull();
    expect(element.querySelector('app-comet-card')).toBeNull();
  });

  it('opens a clicked comet’s issue, pinging softly as a star does', () => {
    const { fixture, element, http } = render();
    const ping = vi.spyOn(TestBed.inject(StarmapSound), 'ping');
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.pickedComet.emit({
      issue: 4,
      title: 'Stalled',
      url: 'https://github.com/me/a/issues/4',
      labels: [],
      ageDays: 3,
      idleDays: 2,
    });
    fixture.detectChanges();

    expect(ping).toHaveBeenCalledWith(false);
    http.expectOne('/api/issue?repo=me/a&number=4');
    expect(element.querySelector('app-issue-window')).not.toBeNull();
  });

  it('sends a meteor to each shown pull request with new commits since you looked', () => {
    const changed = (number: number, newCommits: number | null, extra = {}) =>
      pull(number, 'unreviewed', { lookedSha: 'abc', sinceLook: { newCommits }, ...extra });
    const { fixture } = render(null, {}, [
      changed(7, 3),
      changed(9, null),
      pull(11, 'unreviewed'),
      changed(13, 2, { hidden: { reason: 'dismissed' } }),
    ]);
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    expect(sky.meteors()).toEqual([
      { repo: 'me/a', pr: 7, commits: 3 },
      { repo: 'me/a', pr: 9, commits: null },
    ]);
  });

  it('crackles, panned to the star and shifted by its fall, when a meteor lands', () => {
    const { fixture } = render();
    const crackle = vi.spyOn(TestBed.inject(StarmapSound), 'crackle');
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.meteorLanded.emit({ pr: 7, pan: -0.4, strength: 0.5, doppler: 1.1 });

    expect(crackle).toHaveBeenCalledWith(-0.4, 0.5, 7, 1.1);
  });

  it('offers a visitor to the hosted preview no triage to change', () => {
    const { fixture, http, button } = render();
    http.expectOne('/api/session').flush({ access: 'visitor', signIn: '/api/auth/login' });
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;

    sky.previewed.emit(7);
    fixture.detectChanges();

    expect(button('Open')).toBeDefined();
    expect(button('Snooze 7d')).toBeUndefined();
    expect(button('Dismiss')).toBeUndefined();
  });

  describe('Next star', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('names the pick, flies to it with its card, then opens its screen', () => {
      const { fixture, element, http, button } = render();
      expect(button('Next star')?.title).toBe(
        'Next star (n): #7 Change 7 — Checks failing, idle 2 days',
      );

      button('Next star')?.click();
      fixture.detectChanges();
      expect(element.querySelector('.prno')?.textContent).toBe('#7');
      expect(element.querySelector('app-pr-screen')).toBeNull();

      vi.advanceTimersByTime(900);
      fixture.detectChanges();
      http.expectOne('/api/pull?repo=me/a&number=7');
      http.expectOne('/api/edit?repo=me/a&number=7');
      http.expectOne('/api/labels?repo=me/a');
      expect(element.querySelector('app-pr-screen')).not.toBeNull();
    });

    it('goes on n, and opens no screen once its card is closed in the meantime', () => {
      const { fixture, element } = render();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
      fixture.detectChanges();
      expect(element.querySelector('.prno')?.textContent).toBe('#7');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      vi.advanceTimersByTime(900);
      fixture.detectChanges();

      expect(element.querySelector('.prno')).toBeNull();
      expect(element.querySelector('app-pr-screen')).toBeNull();
    });
  });

  it('runs a review sprint: its stars lit, opened ones reviewed, then a summary', () => {
    const { fixture, element, button } = render();
    const sky = fixture.debugElement.query(By.directive(StarmapSky))
      .componentInstance as StarmapSky;
    const starting = (words: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('app-sprint-panel button')).find((b) =>
        b.textContent?.replace(/\s+/g, ' ').trim().startsWith(words),
      );

    button('Sprint')?.click();
    fixture.detectChanges();
    expect(starting('15 min')?.textContent).toContain('2 PRs');

    starting('15 min')?.click();
    fixture.detectChanges();
    expect(sky.filter()).toBe('sprint');
    expect(sky.litPrs()).toEqual([7, 9]);
    expect(element.querySelector('[role="timer"] .left')?.textContent).toBe('15:00');
    expect(button('Sprint')?.disabled).toBe(true);

    starting('#9')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-pr-screen')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    starting('End sprint')?.click();
    fixture.detectChanges();

    expect(element.querySelector('app-sprint-panel [role="status"]')?.textContent).toBe(
      '0 merged · 1 reviewed · 1 skipped',
    );
    starting('Done')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-sprint-panel')).toBeNull();
    expect(sky.filter()).toBeNull();
  });

  it('opens a pull request’s screen, or an issue’s window, from the link', () => {
    expect(render(null, { pr: '7' }).element.querySelector('app-pr-screen')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(render(null, { issue: '12' }).element.querySelector('app-issue-window')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(render(null, { pr: 'x' }).element.querySelector('app-pr-screen')).toBeNull();
  });

  describe('a pull request leaving the sky', () => {
    const squashed = {
      state: 'MERGED',
      title: 'Change 7',
      ending: { how: 'squash', threads: { resolved: 1, unresolved: 0 }, closes: [107] },
    };

    /** The page open on pull request 7, with the tab in view; the queue is then read again without it. */
    function leaving(query: Record<string, string> = {}) {
      TestBed.overrideProvider(PageVisibility, { useValue: { isHidden: signal(false) } });
      const page = render(null, query);
      page.http.expectOne('/api/history?repo=me/a').flush({ repo: 'me/a', frames: [] });
      page.fixture.detectChanges();
      const sky = page.fixture.debugElement.query(By.directive(StarmapSky))
        .componentInstance as StarmapSky;
      const play = vi.spyOn(sky, 'play');
      const feed = page.fixture.debugElement.injector.get(QueueFeed);
      const readWithout = (...gone: number[]) => {
        feed.refresh('me/a');
        page.http.expectOne('/api/queue?repo=me/a').flush({
          generatedAt: new Date().toISOString(),
          repo: 'me/a',
          items: items.filter((each) => !gone.includes(each.number)),
        });
        page.fixture.detectChanges();
      };
      const answer = (number: number, body: object) => {
        page.http.expectOne(`/api/pull-state?repo=me/a&number=${number}`).flush(body);
        page.fixture.detectChanges();
      };
      return { ...page, play, readWithout, answer };
    }

    const departures = (play: MockInstance<StarmapSky['play']>) =>
      play.mock.calls.flatMap(([events]) => events.map((each) => [each.kind, each.pr]));

    it('plays on the refresh that notices it, and on every one after', () => {
      const { play, readWithout, answer } = leaving();

      readWithout(7);
      answer(7, squashed);
      expect(departures(play)).toEqual([['squashed', 7]]);

      readWithout(7, 9);
      answer(9, { state: 'CLOSED', title: 'Change 9' });
      expect(departures(play)).toEqual([
        ['squashed', 7],
        ['closed', 9],
      ]);
    });

    it('does not play for a pull request that was put away before it closed', () => {
      const { http, play, readWithout } = leaving();

      readWithout(11);

      http.expectNone('/api/pull-state?repo=me/a&number=11');
      expect(departures(play)).toEqual([]);
    });

    it('takes along the system its star carried', () => {
      const { play, readWithout, answer } = leaving();

      readWithout(7);
      answer(7, squashed);

      const [event] = play.mock.calls.flatMap(([events]) => events);
      expect(event.departure?.system.planets.map((planet) => planet.issue)).toEqual([107]);
      expect(event.departure?.ending?.closes).toEqual([107]);
    });

    it('holds one that left under a pull request’s screen until it closes', () => {
      const { fixture, play, readWithout, answer } = leaving({ pr: '7' });

      readWithout(7);
      answer(7, squashed);
      expect(departures(play)).toEqual([]);

      fixture.debugElement.query(By.directive(PrScreen)).componentInstance.closed.emit();
      fixture.detectChanges();

      expect(departures(play)).toEqual([['squashed', 7]]);
    });

    it('reads the queue at once when the screen merges the pull request', () => {
      const { fixture, http } = leaving({ pr: '7' });

      fixture.debugElement.query(By.directive(PrScreen)).componentInstance.merged.emit();

      http.expectOne('/api/queue?repo=me/a&fresh=1');
    });
  });
});
