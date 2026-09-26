import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AMBIENT_PLAYER } from '../../../core/sound/sound-preference';
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

describe('StarmapPage', () => {
  beforeEach(() => localStorage.clear());

  it('opens on the sky, titled and stamped as pr-starmap’s', () => {
    const { element } = render();

    expect(element.querySelector('app-starmap-sky')).not.toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Review Queue');
    expect(element.querySelector('.stamp')?.textContent).toContain('me/a · 2 open · refreshed');
    expect(element.querySelector('.lg')?.textContent).toContain('0 cannot merge');
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
    const { element } = render('logs');

    expect(element.querySelector('h1')?.textContent).toBe('Log Sky');
    expect(element.querySelector('.state')?.textContent).toContain('No logs charted yet.');
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
    expect(element.querySelector('app-pull-panel')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(element.querySelector('app-pull-panel')).toBeNull();
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
});
