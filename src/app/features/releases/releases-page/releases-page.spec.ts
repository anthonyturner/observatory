import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { ReleasesPage } from './releases-page';
import { releasesNote, releasesStamp, stateMessage } from './releases-words';

const NO_RELEASES = {
  generatedAt: '2026-10-07T00:00:00Z',
  repo: 'me/app',
  source: 'none',
  releases: [],
  unreleased: {
    notes: { source: 'changelog', markdown: '### Added\n\n- A releases screen.' },
    pulls: [
      {
        number: 484,
        title: 'Releases timeline',
        url: 'https://github.com/me/app/pull/484',
        mergedAt: '2026-10-06T10:00:00Z',
        author: 'me',
      },
    ],
  },
};

function render() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ owner: 'me', repo: 'app' })) },
      },
      { provide: ELEMENT_SIZE, useValue: () => of({ width: 1400, height: 900 }) },
      { provide: PlanetPortraits, useValue: { painter: () => signal(null) } },
    ],
  });
  const fixture = TestBed.createComponent(ReleasesPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

describe('ReleasesPage', () => {
  it('reads the project’s releases and shows the unreleased work with a note while there are none', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/releases?repo=me/app').flush(NO_RELEASES);
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toBe('Releases');
    expect(element.querySelector('.note')?.textContent).toContain('once one is cut');
    const comet = element.querySelector<HTMLButtonElement>('app-release-sky .body');
    expect(comet?.getAttribute('aria-label')).toContain('Unreleased');
    expect(comet?.getAttribute('aria-pressed')).toBe('true');
    const panel = element.querySelector('app-release-detail');
    expect(panel?.querySelector('h2')?.textContent).toBe('Unreleased');
    expect(panel?.querySelector('li a')?.getAttribute('href')).toBe(
      'https://github.com/me/app/pull/484',
    );
    expect(panel?.textContent).toContain('A releases screen.');
  });

  it('gives the same data as a list', () => {
    const { fixture, http, element } = render();
    http.expectOne('/api/releases?repo=me/app').flush(NO_RELEASES);
    fixture.detectChanges();

    const listButton = [...element.querySelectorAll<HTMLButtonElement>('.views button')].find(
      (button) => button.textContent?.trim() === 'List',
    );
    listButton?.click();
    fixture.detectChanges();

    expect(element.querySelector('app-release-sky')).toBeNull();
    const row = element.querySelector('app-release-list button');
    expect(row?.textContent).toContain('Unreleased');
    expect(row?.textContent).toContain('1 merged pull request');
  });

  it('says so when the releases cannot be read', () => {
    const { fixture, http, element } = render();
    http
      .expectOne('/api/releases?repo=me/app')
      .flush({ error: 'down' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(element.querySelector('.state')?.textContent).toContain('Could not read the releases');
  });
});

describe('releases words', () => {
  it('says where the releases came from', () => {
    expect(stateMessage({ status: 'missing' })?.headline).toBe('No such project');
    expect(releasesStamp('me/app', null)).toBe('me/app');
    expect(releasesNote(null)).toBeNull();
  });
});
