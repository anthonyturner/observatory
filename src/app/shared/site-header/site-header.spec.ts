import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { ELEMENT_SIZE } from '../element-size/element-size';
import { NavSection } from './nav-section';
import { SiteHeader } from './site-header';

@Component({ template: '' })
class Page {}

@Component({
  imports: [SiteHeader],
  template: `
    <app-site-header [sections]="sections" title="app">
      <p class="row-content">the wide row</p>
      <button siteHeaderTool class="tool" type="button">Run</button>
    </app-site-header>
  `,
})
class Host {
  sections: readonly NavSection[] = [];
}

const SECTIONS: readonly NavSection[] = [
  { id: 'all', label: 'All projects', link: '/orrery' },
  { id: 'guide', label: 'Guide', link: '/guide', fragment: 'releases' },
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

function mount(sections: readonly NavSection[] = SECTIONS) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: Page }]),
      { provide: ELEMENT_SIZE, useValue: () => NEVER },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.sections = sections;
  document.body.append(fixture.nativeElement);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host,
    header: host.querySelector('app-site-header') as HTMLElement,
    button: host.querySelector('button.toggle') as HTMLButtonElement,
    menu: host.querySelector('.menu') as HTMLElement,
    links: [...host.querySelectorAll<HTMLAnchorElement>('nav a')],
  };
}

const words = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

describe('SiteHeader', () => {
  afterEach(() => document.body.replaceChildren());

  it('puts a logo that goes Home first, named for a screen reader and titled by the page', () => {
    const { host } = mount();
    const logo = host.querySelector<HTMLAnchorElement>('a.logo');

    expect(logo?.getAttribute('href')).toBe('/');
    expect(logo?.getAttribute('aria-label')).toBe('Observatory, Home');
    expect(logo?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(words(host.querySelector('.title'))).toBe('app');
    expect(host.querySelector('.title')?.getAttribute('title')).toBe('app');
  });

  it('shows no title when the page gives none', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ELEMENT_SIZE, useValue: () => NEVER }],
    });
    const fixture = TestBed.createComponent(SiteHeader);
    fixture.componentRef.setInput('sections', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.title')).toBeNull();
  });

  it('has one disclosure button for the menu, which is plain links and not a role="menu"', () => {
    const { fixture, host, button, menu } = mount();

    expect(host.querySelectorAll('button.toggle')).toHaveLength(1);
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe(menu.id);
    expect(words(button)).toContain('Menu');
    expect(host.querySelector('[role]')).toBeNull();

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('lists the sections in the order given, marking the current one as the page', () => {
    const { links } = mount();

    expect(links.map((link) => [words(link), link.getAttribute('aria-current')])).toEqual([
      ['All projects', null],
      ['Guide', null],
      ['Queue', null],
      ['Releases', 'page'],
      ['Security 3, 3 open alerts', null],
      ['Milestones , nothing here yet', null],
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/orrery',
      '/guide#releases',
      '/p/me/app',
      '/p/me/app/releases',
      '/p/me/app/security',
      '/p/me/app/milestones',
    ]);
    expect(links[5].classList).toContain('quiet');
  });

  it('shows a dot on the closed button while a section has a badge, and says which', () => {
    const { button } = mount();

    expect(button.querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
    expect(words(button)).toBe('☰Menu, Security: 3 open alerts');
  });

  it('shows no dot and says nothing extra when no section has a badge', () => {
    const { button } = mount(SECTIONS.filter((section) => !section.badge));

    expect(button.querySelector('.dot')).toBeNull();
    expect(words(button)).toBe('☰Menu');
  });

  it('holds the page’s row, and the projected tool in the menu, mounted whether it is open or not', () => {
    const { fixture, host, button, menu } = mount();
    const tool = host.querySelector('button.tool');

    expect(host.querySelector('.row p.row-content')).not.toBeNull();
    expect(menu.querySelector('nav')?.nextElementSibling?.contains(tool ?? null)).toBe(true);

    button.click();
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();
    expect(host.querySelector('button.tool')).toBe(tool);
  });

  it('opens its menu by a class the stylesheet shows it by, and lifts the bar above the page', () => {
    const { fixture, header, button, menu } = mount();

    button.click();
    fixture.detectChanges();
    expect(menu.classList).toContain('open');
    expect(header.classList).toContain('open');

    button.click();
    fixture.detectChanges();
    expect(menu.classList).not.toContain('open');
    expect(header.classList).not.toContain('open');
  });

  it('closes when a link is chosen, leaving focus on the button', () => {
    const { fixture, button, links } = mount();
    button.click();
    fixture.detectChanges();

    links[2].click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('closes on any navigation, such as the browser back button', async () => {
    const { fixture, button } = mount();
    button.click();
    fixture.detectChanges();

    await TestBed.inject(Router).navigateByUrl('/p/me/app/depth');
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
