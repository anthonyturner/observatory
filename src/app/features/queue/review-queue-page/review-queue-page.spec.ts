import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { PullPanel } from '../pull-panel/pull-panel';
import { ReviewQueuePage } from './review-queue-page';

const items = [
  {
    number: 7,
    title: 'Fix the build',
    url: 'https://github.com/me/a/pull/7',
    isDraft: false,
    bucket: 'failing',
    closes: [2],
    failingChecks: 1,
    additions: 12,
    deletions: 1,
    idleDays: 2,
    ageDays: 5,
    isSeen: false,
    hidden: null,
  },
  {
    number: 9,
    title: 'Tidy the docs',
    url: 'https://github.com/me/a/pull/9',
    isDraft: true,
    bucket: 'unreviewed',
    closes: [4],
    failingChecks: 0,
    additions: 30,
    deletions: 3,
    idleDays: 1,
    ageDays: 1,
    isSeen: false,
    hidden: null,
  },
  {
    number: 11,
    title: 'Old idea',
    url: 'https://github.com/me/a/pull/11',
    isDraft: false,
    bucket: 'unreviewed',
    closes: [],
    failingChecks: 0,
    additions: 3,
    deletions: 0,
    idleDays: 40,
    ageDays: 60,
    isSeen: true,
    hidden: { reason: 'dismissed' },
  },
];

function render(view: 'map' | 'list' = 'list') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ owner: 'me', repo: 'a' })),
          fragment: of(null),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ReviewQueuePage);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController)
    .expectOne('/api/queue?repo=me/a')
    .flush({ generatedAt: new Date().toISOString(), repo: 'me/a', items });
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  if (view === 'list') {
    Array.from(element.querySelectorAll<HTMLButtonElement>('.views button'))
      .find((button) => button.textContent?.trim() === 'List')
      ?.click();
    fixture.detectChanges();
  }
  return { fixture, element };
}

describe('ReviewQueuePage', () => {
  beforeEach(() => localStorage.clear());

  it('opens on the star map, with the camera’s tools', () => {
    const { element } = render('map');

    expect(element.querySelector('app-starmap-sky')).not.toBeNull();
    expect(element.querySelector('.list')).toBeNull();
    expect(element.querySelector('app-orrery-tools')).not.toBeNull();
  });

  it('reads the queue of the repository in the address, blocked first', () => {
    const { element } = render();

    expect(element.querySelector('.pulls-stamp')?.textContent).toContain('me/a · 3 open');
    expect(Array.from(element.querySelectorAll('h2')).map((h) => h.textContent?.trim())).toEqual([
      'RuinaChecks failing · 1',
      'VigiliaWaiting on you · 1',
    ]);
    expect(element.querySelector('.github')?.getAttribute('href')).toBe(
      'https://github.com/me/a/pull/7',
    );
    expect(element.querySelector('.draft')?.textContent).toBe('draft');
  });

  it('filters to one bucket from the legend, and back', () => {
    const { fixture, element } = render();
    const failing = Array.from(element.querySelectorAll<HTMLButtonElement>('.legend button')).find(
      (button) => button.textContent?.includes('checks failing'),
    );

    failing?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('section').length).toBe(1);
    expect(failing?.getAttribute('aria-pressed')).toBe('true');

    failing?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('section').length).toBe(2);
  });

  it('keeps dismissed pull requests out until asked, and says why', () => {
    const { fixture, element } = render();
    const toggle = element.querySelector<HTMLButtonElement>('.hidden-toggle');

    expect(toggle?.textContent?.trim()).toBe('1 hidden · Show');
    expect(element.textContent).not.toContain('Old idea');

    toggle?.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Seen recently');
    expect(element.textContent).toContain('dismissed until it changes');
  });

  it('records a triage action from the panel, then reads the queue again', () => {
    const { fixture, element } = render();
    const http = TestBed.inject(HttpTestingController);

    element.querySelector<HTMLButtonElement>('li .open')?.click();
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=7');
    const panel = fixture.debugElement.query(By.directive(PullPanel))
      .componentInstance as PullPanel;
    expect(panel.triage()).toEqual({ isSeen: false, hidden: null });
    panel.triaged.emit({ action: 'snooze', days: 7 });

    const post = http.expectOne('/api/triage');
    expect(post.request.body).toEqual({ repo: 'me/a', number: 7, action: 'snooze', days: 7 });
    post.flush({ number: 7, isSeen: false, hidden: null });
    http.expectOne('/api/queue?repo=me/a');
  });

  it('shows what changed since you last looked, and clears it on Got it', () => {
    localStorage.setItem('observatory.lastSeen.me/a', String(Date.parse('2026-09-24T12:00:00Z')));
    const { fixture, element } = render();

    TestBed.inject(HttpTestingController)
      .expectOne('/api/history?repo=me/a')
      .flush({
        repo: 'me/a',
        frames: [
          {
            at: '2026-09-24T10:00:00Z',
            items: [
              { number: 7, title: 'Fix the build', bucket: 'unreviewed' },
              { number: 9, title: 'Tidy the docs', bucket: 'unreviewed' },
              { number: 11, title: 'Old idea', bucket: 'unreviewed' },
            ],
            departed: [],
          },
        ],
      });
    fixture.detectChanges();
    const card = element.querySelector('app-changes-card');
    expect(card?.textContent).toContain('1 change');
    expect(card?.textContent).toContain('Became blocked');

    card?.querySelector<HTMLButtonElement>('.ack')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-changes-card')).toBeNull();
    expect(Number(localStorage.getItem('observatory.lastSeen.me/a'))).toBeGreaterThan(
      Date.parse('2026-09-24T12:00:00Z'),
    );
  });

  it('shows which pull requests collide, in the stamp and the open panel', () => {
    const { fixture, element } = render();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/collisions?repo=me/a').flush({
      repo: 'me/a',
      check: 'checked',
      pairs: [{ a: 7, b: 9, files: ['src/a.ts'], conflicts: ['src/a.ts'] }],
    });
    fixture.detectChanges();
    expect(element.querySelector('.pulls-stamp')?.textContent).toContain('1 pair would conflict');

    element.querySelector<HTMLButtonElement>('li .open')?.click();
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=7');
    const panel = fixture.debugElement.query(By.directive(PullPanel))
      .componentInstance as PullPanel;
    expect(panel.collisions()).toEqual([{ other: 9, kind: 'conflict', files: ['src/a.ts'] }]);

    panel.picked.emit(9);
    fixture.detectChanges();
    http.expectOne('/api/pull?repo=me/a&number=9');
  });

  it('explains the star map from its Help button', () => {
    const { fixture, element } = render();

    element.querySelector<HTMLButtonElement>('app-help-button button')?.click();
    fixture.detectChanges();

    expect(element.querySelector('#help-title')?.textContent).toBe('Review queue');
    expect(element.querySelector('app-help-card')?.textContent).toContain('Threads');
  });

  it('keeps the sky and fogs it when a refresh fails', () => {
    const { fixture, element } = render();
    const http = TestBed.inject(HttpTestingController);
    expect(element.querySelector('app-fog-veil .veil')).toBeNull();

    element.querySelector<HTMLButtonElement>('li .open')?.click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(By.directive(PullPanel))
      .componentInstance as PullPanel;
    panel.triaged.emit({ action: 'seen' });
    http.expectOne('/api/triage').flush({});
    http
      .expectOne('/api/queue?repo=me/a')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'offline' });
    fixture.detectChanges();

    expect(element.querySelectorAll('li .open').length).toBe(2);
    expect(element.querySelector('.pulls-stamp')?.textContent).toContain('refresh failing');
    expect(element.querySelector('app-fog-veil .veil')).not.toBeNull();
  });

  it('leads back to Home and the Orrery', () => {
    const hrefs = Array.from(render().element.querySelectorAll('.links a')).map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toEqual(['/orrery', '/']);
  });

  it('opens a pull request’s panel from its row, and closes it', () => {
    const { fixture, element } = render();

    element.querySelector<HTMLButtonElement>('li .open')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-pull-panel')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectOne('/api/pull?repo=me/a&number=7');

    element.querySelector<HTMLButtonElement>('app-pull-panel .close')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-pull-panel')).toBeNull();
  });
});
