import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavSection } from '../site-header/nav-section';
import {
  PROJECT_TABS,
  ProjectTabs,
  guidePartOf,
  projectTabAt,
  projectTabLink,
} from './project-tabs';

describe('projectTabLink', () => {
  it('puts the queue at the project’s own route and every other screen below it', () => {
    const [queue, releases] = PROJECT_TABS;
    expect(projectTabLink('me/app', queue)).toBe('/p/me/app');
    expect(projectTabLink('me/app', releases)).toBe('/p/me/app/releases');
  });
});

describe('projectTabAt', () => {
  it('finds the screen below a project’s route, the Queue at the route itself', () => {
    expect(projectTabAt('')?.id).toBe('queue');
    expect(projectTabAt('security')?.id).toBe('security');
    expect(projectTabAt('nowhere')).toBeUndefined();
  });
});

describe('guidePartOf', () => {
  it('names a screen’s part of the Guide after the screen, the Queue’s after the Review Queue', () => {
    const part = (path: string): string | undefined => {
      const tab = projectTabAt(path);
      return tab && guidePartOf(tab);
    };

    expect(part('')).toBe('review-queue');
    expect(part('releases')).toBe('releases');
  });
});

describe('ProjectTabs', () => {
  const tabs: readonly NavSection[] = [
    { id: 'queue', label: 'Queue', link: '/p/me/app' },
    { id: 'releases', label: 'Releases', link: '/p/me/app/releases', isCurrent: true },
    {
      id: 'security',
      label: 'Security',
      link: '/p/me/app/security',
      badge: { shown: '3', spoken: '3 open alerts' },
    },
    { id: 'milestones', label: 'Milestones', link: '/p/me/app/milestones', isQuiet: true },
  ];

  function mount(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProjectTabs);
    fixture.componentRef.setInput('tabs', tabs);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const words = (element: Element) => element.textContent?.replace(/\s+/g, ' ').trim();

  it('links every section it is given and marks the current one as the page', () => {
    const host = mount();
    const links = [...host.querySelectorAll('a')];

    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Project screens');
    expect(
      links.map((link) => [link.getAttribute('href'), link.getAttribute('aria-current')]),
    ).toEqual([
      ['/p/me/app', null],
      ['/p/me/app/releases', 'page'],
      ['/p/me/app/security', null],
      ['/p/me/app/milestones', null],
    ]);
  });

  it('shows a badge’s count on its tab, read out after the name', () => {
    const security = mount().querySelector('a[href$="/security"]');

    expect(security?.querySelector('.badge')?.textContent).toBe('3');
    expect(security && words(security)).toBe('Security 3, 3 open alerts');
  });

  it('lets a tab recede for a project with nothing on it, and says so to a screen reader', () => {
    const host = mount();
    const milestones = host.querySelector('a[href$="/milestones"]');

    expect(milestones?.classList).toContain('quiet');
    expect(milestones && words(milestones)).toBe('Milestones , nothing here yet');
    expect(host.querySelectorAll('a.quiet')).toHaveLength(1);
  });

  it('has no menu of its own: it is a row, and the site header folds the same sections below 1200px', () => {
    const host = mount();

    expect(host.querySelector('button')).toBeNull();
  });
});
