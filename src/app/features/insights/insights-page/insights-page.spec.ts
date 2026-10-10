import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ELEMENT_WIDTH } from '../../../shared/element-width/element-width';
import { InsightsPage } from './insights-page';

const READ_AT = '2026-10-08T12:00:00Z';
const hoursBefore = (hours: number): string =>
  new Date(Date.parse(READ_AT) - hours * 3_600_000).toISOString();
const PART = { status: 'read', note: null };
const SERIES = { count: 3, uniques: 1, days: [{ day: hoursBefore(24), count: 3, uniques: 1 }] };

const REPORT = {
  generatedAt: READ_AT,
  repo: 'me/app',
  weeks: 12,
  commits: {
    ...PART,
    weeks: [
      { weekStart: hoursBefore(200), total: 4, days: [4, 0, 0, 0, 0, 0, 0] },
      { weekStart: hoursBefore(40), total: 9, days: [0, 9, 0, 0, 0, 0, 0] },
    ],
  },
  contributors: {
    status: 'counting',
    note: 'GitHub is still counting the contributors. Check again in a minute.',
    people: [],
  },
  pulls: {
    ...PART,
    finished: [
      { number: 4, openedAt: hoursBefore(10), finishedAt: hoursBefore(4), fate: 'merged' },
    ],
  },
  traffic: { ...PART, views: SERIES, clones: SERIES },
};

function render() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ELEMENT_WIDTH, useValue: () => of(600) },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ owner: 'me', repo: 'app' })) },
      },
    ],
  });
  const fixture = TestBed.createComponent(InsightsPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

const headings = (element: HTMLElement): (string | undefined)[] =>
  [...element.querySelectorAll('h3')].map((each) => each.firstChild?.textContent?.trim());

describe('InsightsPage', () => {
  it('charts each part, each with a table view, under its tab', () => {
    const { fixture, http, element } = render();
    expect(element.querySelector('.state')?.textContent).toContain('Reading the insights');

    http.expectOne('/api/insights?repo=me/app').flush(REPORT);
    http.expectOne('/api/agents?repo=me/app').flush({ since: null, attributed: 0, agents: [] });
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toBe('Insights');
    expect(element.querySelector('.stamp')?.textContent).toBe('me/app · 13 commits in 12 weeks');
    expect(headings(element)).toEqual([
      'Commits',
      'Cycle time',
      'Contributors',
      'Agents',
      'Traffic',
    ]);
    expect(element.querySelectorAll('app-commit-stars circle')).toHaveLength(2);
    expect(element.querySelectorAll('details summary')).toHaveLength(3);
    expect(element.querySelector('[data-tip]')?.getAttribute('data-tip')).toContain('4 commits');
    expect(element.textContent).toContain('GitHub is still counting the contributors');
    expect(element.querySelector('.state')).toBeNull();
  });

  it('asks GitHub again past the cache while it is still counting', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/insights?repo=me/app').flush(REPORT);
    http.expectOne('/api/agents?repo=me/app').flush({ agents: [] });
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.counting button')?.click();

    http.expectOne('/api/insights?repo=me/app&fresh=1').flush({
      ...REPORT,
      contributors: {
        ...PART,
        people: [{ login: 'me', isBot: false, commits: 13, additions: 9, deletions: 1 }],
      },
    });
    fixture.detectChanges();
    expect(element.querySelector('.counting')).toBeNull();
    expect(element.querySelectorAll('details summary')).toHaveLength(4);
  });

  it('says plainly when the project cannot be read', () => {
    const { fixture, http, element } = render();
    http
      .expectOne('/api/insights?repo=me/app')
      .flush({ error: 'no star map' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(element.querySelector('.state strong')?.textContent).toBe('No such project');
    expect(element.querySelector('main')).toBeNull();
  });
});
