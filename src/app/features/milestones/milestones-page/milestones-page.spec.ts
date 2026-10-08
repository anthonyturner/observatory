import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BARE_REPORT, RAW_REPORT } from '../../../core/milestones/testing/milestones-fixture';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { QUIET_TABS } from '../../../shared/project-tabs/quiet-tabs';
import { MilestonesPage } from './milestones-page';

function render(body: object = RAW_REPORT, width = 1400) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ owner: 'me', repo: 'app' })) },
      },
      { provide: ELEMENT_SIZE, useValue: () => of({ width, height: 900 }) },
      { provide: PlanetPortraits, useValue: { painter: () => signal(null) } },
      { provide: QUIET_TABS, useValue: [] },
    ],
  });
  const fixture = TestBed.createComponent(MilestonesPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne('/api/milestones?repo=me/app').flush(body);
  fixture.detectChanges();
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

const text = (element: Element | null | undefined): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('MilestonesPage', () => {
  it('opens on the sky under the Milestones tab, each planet a link to its milestone', () => {
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Milestones');
    expect(element.querySelector('.stamp')?.textContent).toBe('me/app · 3 open milestones');
    expect(
      element.querySelector('app-project-tabs a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/p/me/app/milestones');
    const planets = [...element.querySelectorAll<HTMLAnchorElement>('app-transit-sky a.body')];
    expect(planets.map((planet) => planet.getAttribute('href'))).toEqual([
      'https://github.com/me/app/milestone/1',
      'https://github.com/me/app/milestone/2',
      'https://github.com/me/app/milestone/3',
    ]);
    expect(planets[0].getAttribute('aria-label')).toMatch(/^Beta: 3 of 5 done, due .+ overdue\./);
  });

  it('lists each milestone with its progress and date, and its items in a fold', () => {
    const { fixture, element } = render();
    element.querySelectorAll<HTMLButtonElement>('.views button')[1].click();
    fixture.detectChanges();

    const cards = [...element.querySelectorAll('app-milestone-card')];
    expect(cards.map((card) => text(card.querySelector('h3')))).toEqual([
      'Beta',
      'Launch',
      'Someday',
      'Alpha',
    ]);
    expect(text(cards[1].querySelector('.words'))).toBe('9 of 10 done · 90% · 1 open · 9 closed');
    expect(text(cards[0].querySelector('.standing'))).toBe('· overdue');
    const items = [...cards[0].querySelectorAll<HTMLAnchorElement>('details li a')];
    expect(items.map((item) => item.getAttribute('href'))).toEqual([
      'https://github.com/me/app/issues/11',
      'https://github.com/me/app/pull/21',
    ]);
    expect(text(cards[0].querySelector('summary'))).toBe('5 items');
  });

  it('lists the latest discussions beside, by category, with their answer state', () => {
    const { element } = render();

    const panel = element.querySelector('aside.panel');
    expect(text(panel?.querySelector('.count'))).toBe('latest 3 of 12 discussions');
    expect([...(panel?.querySelectorAll('h3') ?? [])].map(text)).toEqual(['Q&A', 'Ideas']);
    expect(text(panel?.querySelector('li .answer'))).toBe('Answered');
    expect(panel?.querySelector('li a')?.getAttribute('href')).toBe(
      'https://github.com/me/app/discussions/7',
    );
  });

  it('puts the discussions after the milestones in the list on a narrow screen', () => {
    const { fixture, element } = render(RAW_REPORT, 420);
    expect(element.querySelector('aside.panel')).toBeNull();

    element.querySelectorAll<HTMLButtonElement>('.views button')[1].click();
    fixture.detectChanges();

    const section = element.querySelector('.listview section.discussions');
    expect(text(section?.querySelector('h2'))).toBe('Discussions');
    expect(section?.querySelectorAll('li').length).toBe(3);
  });

  it('says plainly when a project has no milestones and Discussions off', () => {
    const { element } = render(BARE_REPORT);

    expect(text(element.querySelector('.state strong'))).toBe('No milestones');
    expect(text(element.querySelector('aside.panel .none'))).toBe(
      'Discussions are off for this project.',
    );
  });

  it('asks GitHub afresh on Refresh', () => {
    const { fixture, http, element } = render();
    const refresh = [...element.querySelectorAll<HTMLButtonElement>('.tools > button')].find(
      (button) => button.textContent?.trim() === 'Refresh',
    );
    refresh?.click();
    fixture.detectChanges();

    http.expectOne('/api/milestones?repo=me/app&fresh=1').flush(RAW_REPORT);
  });
});
