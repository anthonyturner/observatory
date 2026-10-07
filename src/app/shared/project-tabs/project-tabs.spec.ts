import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PROJECT_TABS, ProjectTabs, projectTabLink } from './project-tabs';

describe('projectTabLink', () => {
  it('puts the queue at the project’s own route and every other screen below it', () => {
    const [queue, releases] = PROJECT_TABS;
    expect(projectTabLink('me/app', queue)).toBe('/p/me/app');
    expect(projectTabLink('me/app', releases)).toBe('/p/me/app/releases');
  });
});

describe('ProjectTabs', () => {
  it('links every screen of the project and marks the current one as the page', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProjectTabs);
    fixture.componentRef.setInput('repo', 'me/app');
    fixture.componentRef.setInput('current', 'releases');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const links = [...host.querySelectorAll('a')];
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Project screens');
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Queue', '/p/me/app'],
      ['Releases', '/p/me/app/releases'],
      ['Actions', '/p/me/app/actions'],
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });
});
