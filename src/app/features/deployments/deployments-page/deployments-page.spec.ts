import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RAW_REPORT } from '../../../core/deployments/testing/deployments-fixture';
import { ELEMENT_SIZE } from '../../../shared/element-size/element-size';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import { DeploymentsPage } from './deployments-page';

function render(body: object = RAW_REPORT) {
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
  const fixture = TestBed.createComponent(DeploymentsPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne('/api/deployments?repo=me/app').flush(body);
  fixture.detectChanges();
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

describe('DeploymentsPage', () => {
  it('opens on the sky, each light a link to its site', () => {
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Deployments');
    expect(element.querySelector('.stamp')?.textContent).toBe('me/app · 2 environments');
    const lights = [...element.querySelectorAll<HTMLAnchorElement>('app-launch-sky a.body')];
    expect(lights.map((light) => light.getAttribute('href'))[0]).toBe('https://app-5.vercel.app');
    expect(lights[0].getAttribute('aria-label')).toContain('Production, ready');
  });

  it('lists each environment with its latest deployment first, linked to its site and commit', () => {
    const { fixture, element } = render();
    element.querySelectorAll<HTMLButtonElement>('.views button')[1].click();
    fixture.detectChanges();

    const headings = [...element.querySelectorAll('app-deploy-list h2')];
    expect(headings.map((heading) => heading.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Production production',
      'Preview',
    ]);
    const latest = element.querySelector('app-deploy-list li.latest');
    expect(latest?.textContent).toContain('Ready');
    expect(latest?.querySelector('.links a')?.getAttribute('href')).toBe(
      'https://app-5.vercel.app',
    );
    expect(latest?.querySelector('.meta a')?.getAttribute('href')).toBe(
      `https://github.com/me/app/commit/${'5'.padEnd(40, 'a')}`,
    );
  });

  it('says so when nothing has been deployed', () => {
    const { element } = render({ ...RAW_REPORT, environments: [] });

    expect(element.querySelector('.state strong')?.textContent).toBe('No deployments yet');
  });

  it('asks GitHub afresh on Refresh', () => {
    const { fixture, http, element } = render();
    const refresh = [...element.querySelectorAll<HTMLButtonElement>('.tools > button')].find(
      (button) => button.textContent?.trim() === 'Refresh',
    );
    refresh?.click();
    fixture.detectChanges();

    http.expectOne('/api/deployments?repo=me/app&fresh=1').flush(RAW_REPORT);
  });
});
