import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
        useValue: { paramMap: of(convertToParamMap({ owner: 'me', repo: 'a' })) },
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
  it('opens on the star map, with the camera’s tools', () => {
    const { element } = render('map');

    expect(element.querySelector('app-star-chart')).not.toBeNull();
    expect(element.querySelector('.list')).toBeNull();
    expect(element.querySelector('app-orrery-tools')).not.toBeNull();
  });

  it('reads the queue of the repository in the address, blocked first', () => {
    const { element } = render();

    expect(element.querySelector('.stamp')?.textContent).toContain('me/a · 2 open');
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
