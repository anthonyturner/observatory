import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PROJECT_TABS, ProjectTabs, projectTabLink } from './project-tabs';
import { TAB_BADGES, TabBadge } from './tab-badge';

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
      ['Journal', '/p/me/app/journal'],
      ['Library', '/p/me/app/library'],
      ['Security', '/p/me/app/security'],
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      'page',
      null,
      null,
      null,
      null,
    ]);
  });

  it('shows a badge’s count on its tab, read out after the name, and none for a count of none', () => {
    const counts: Record<string, number | null> = { 'me/app': 3, 'me/calm': 0 };
    const badge: TabBadge = {
      tabId: 'security',
      noun: 'open alert',
      count: (repo) => of(counts[repo] ?? null),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TAB_BADGES, useValue: [badge] }],
    });
    const fixture = TestBed.createComponent(ProjectTabs);
    fixture.componentRef.setInput('repo', 'me/app');
    fixture.componentRef.setInput('current', 'queue');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const security = () => [...host.querySelectorAll('a')].at(-1);
    expect(security()?.querySelector('.badge')?.textContent).toBe('3');
    expect(security()?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Security 3, 3 open alerts');

    fixture.componentRef.setInput('repo', 'me/calm');
    fixture.detectChanges();
    expect(security()?.querySelector('.badge')).toBeNull();
  });
});
