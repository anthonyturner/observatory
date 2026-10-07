import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CiMark, ciMarkOf } from './ci-mark';

describe('ciMarkOf', () => {
  it('colours the dot by the branch’s CI and names failing workflows', () => {
    expect(
      ciMarkOf('me/app', 'app', {
        repo: 'me/app',
        branch: 'main',
        state: 'failing',
        failing: ['CI'],
      }),
    ).toEqual({
      link: '/p/me/app/actions',
      colour: 'var(--ci-failing)',
      spoken: 'app: Actions, CI on main is failing (CI)',
    });
    expect(ciMarkOf('me/app', 'app', null).colour).toBe('var(--ci-none)');
  });
});

describe('CiMark', () => {
  it('asks for its project’s health and links to the Actions screen', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(CiMark);
    fixture.componentRef.setInput('repo', 'me/app');
    fixture.componentRef.setInput('name', 'app');
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .expectOne('/api/ci-health?repo=me/app')
      .flush({ repo: 'me/app', branch: 'main', state: 'passing', failing: [] });
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/p/me/app/actions');
    expect(link?.getAttribute('aria-label')).toBe('app: Actions, CI on main is passing');
  });
});
