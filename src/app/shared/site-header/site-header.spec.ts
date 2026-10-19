import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, NEVER, map } from 'rxjs';
import { ELEMENT_SIZE } from '../element-size/element-size';
import { NavSection } from './nav-section';
import { SiteHeader } from './site-header';

@Component({ template: '' })
class Page {}

@Component({
  imports: [SiteHeader],
  template: `
    <app-site-header [screens]="screens" [exits]="exits" title="app">
      <button siteHeaderTool class="tool" type="button">Run</button>
      <span siteHeaderChip class="chip">4% wk</span>
    </app-site-header>
  `,
})
class Host {
  screens: readonly NavSection[] = [];
  exits: readonly NavSection[] = [];
}

const SCREENS: readonly NavSection[] = [
  { id: 'queue', label: 'Queue', link: '/p/me/app' },
  { id: 'releases', label: 'Releases', link: '/p/me/app/releases', isCurrent: true },
  { id: 'actions', label: 'Actions', link: '/p/me/app/actions' },
  {
    id: 'security',
    label: 'Security',
    link: '/p/me/app/security',
    badge: { shown: '3', spoken: '3 open alerts' },
  },
  { id: 'depth', label: 'Depth', link: '/p/me/app/depth' },
  { id: 'milestones', label: 'Milestones', link: '/p/me/app/milestones', isQuiet: true },
];

const EXITS: readonly NavSection[] = [
  { id: 'all', label: 'All projects', link: '/orrery' },
  { id: 'guide', label: 'Guide', link: '/guide', fragment: 'releases' },
];

/** Widths the fake browser gives each part, in px. */
interface Widths {
  inner: number;
  readonly logo: number;
  readonly end: number;
  readonly more: number;
  readonly link: number;
}

/** The bar's room for the links is `inner` less the logo, the 80px the name keeps, the controls and 1px. */
const WIDTHS: Widths = { inner: 2000, logo: 150, end: 100, more: 60, link: 100 };
const ROOM_FOR = (links: number): number => 150 + 80 + 100 + 1 + links * 100 + 60;

function mount(
  options: {
    screens?: readonly NavSection[];
    exits?: readonly NavSection[];
    inner?: number;
  } = {},
) {
  const widths = { ...WIDTHS, inner: options.inner ?? WIDTHS.inner };
  const measured = new BehaviorSubject(undefined);
  const widthOf = (element: Element): number => {
    const has = (name: string) => element.classList.contains(name);
    if (has('inner')) return widths.inner;
    if (has('logo')) return widths.logo;
    if (has('end')) return widths.end;
    if (has('more')) return widths.more;
    if (has('link')) return widths.link;
    return 36;
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: Page }]),
      {
        provide: ELEMENT_SIZE,
        useValue: (element: Element) =>
          measured.pipe(map(() => ({ width: widthOf(element), height: 44 }))),
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.screens = options.screens ?? SCREENS;
  fixture.componentInstance.exits = options.exits ?? EXITS;
  document.body.append(fixture.nativeElement);
  settle(fixture);
  const host = fixture.nativeElement as HTMLElement;
  const query = <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  return {
    fixture,
    host,
    header: query('app-site-header'),
    bar: query('.bar'),
    more: query<HTMLButtonElement>('button.more'),
    menuButton: query<HTMLButtonElement>('button.menu-toggle'),
    panel: query('.panel'),
    resize: (inner: number) => {
      widths.inner = inner;
      measured.next(undefined);
      settle(fixture);
    },
    barLinks: () => [...host.querySelectorAll<HTMLAnchorElement>('nav.links a.link')],
    shown: () =>
      [...host.querySelectorAll<HTMLAnchorElement>('nav.links a.link:not(.folded)')].map((link) =>
        words(link),
      ),
    folded: () =>
      [...host.querySelectorAll<HTMLAnchorElement>('.panel .folded-links a')].map((link) =>
        words(link),
      ),
    exits: () => [...host.querySelectorAll<HTMLAnchorElement>('.panel .exits a')],
  };
}

function settle(fixture: ComponentFixture<unknown>): void {
  fixture.detectChanges();
  TestBed.tick();
  fixture.detectChanges();
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
    fixture.componentRef.setInput('screens', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.title')).toBeNull();
  });

  describe('when every link fits', () => {
    it('shows all of them, in order, as the site navigation, marking the current one as the page', () => {
      const { host, barLinks, shown } = mount();

      expect(host.querySelector('nav.links')?.getAttribute('aria-label')).toBe('Site');
      expect(shown()).toEqual([
        'Queue',
        'Releases',
        'Actions',
        'Security 3, 3 open alerts',
        'Depth',
        'Milestones , nothing here yet',
      ]);
      expect(barLinks().map((link) => link.getAttribute('aria-current'))).toEqual([
        null,
        'page',
        null,
        null,
        null,
        null,
      ]);
      expect(barLinks().map((link) => link.getAttribute('href'))).toEqual(
        SCREENS.map((screen) => screen.link),
      );
      expect(barLinks()[5].classList).toContain('quiet');
      expect(barLinks()[5].querySelector('app-section-label')?.classList).toContain('recedes');
    });

    it('still has More, holding All projects and the Guide below the screens and nothing else', () => {
      const { more, menuButton, folded, exits, bar } = mount();

      expect(more.classList).not.toContain('inactive');
      expect(menuButton.classList).toContain('inactive');
      expect(bar.classList).not.toContain('menu');
      expect(words(more)).toBe('More');
      expect(folded()).toEqual([]);
      expect(exits().map((link) => [words(link), link.getAttribute('href')])).toEqual([
        ['All projects', '/orrery'],
        ['Guide', '/guide#releases'],
      ]);
    });

    it('shows no dot on More, and does not make it the current page', () => {
      const { more } = mount();

      expect(more.querySelector('.dot')).toBeNull();
      expect(more.getAttribute('aria-current')).toBeNull();
      expect(more.classList).not.toContain('current');
    });
  });

  describe('when some links do not fit', () => {
    it('gives them up from the right end, one at a time, and lists them in order behind More', () => {
      const { resize, shown, folded } = mount();

      resize(ROOM_FOR(5));
      expect(shown()).toHaveLength(5);
      expect(folded()).toEqual(['Milestones , nothing here yet']);

      resize(ROOM_FOR(4));
      expect(shown()).toHaveLength(4);
      expect(folded()).toEqual(['Depth', 'Milestones , nothing here yet']);

      resize(ROOM_FOR(3));
      expect(shown()).toEqual(['Queue', 'Releases', 'Actions']);
      expect(folded()).toEqual([
        'Security 3, 3 open alerts',
        'Depth',
        'Milestones , nothing here yet',
      ]);
    });

    it('never reorders: what is on the bar is always the first links, at every width', () => {
      const { resize, shown } = mount();
      const order = SCREENS.map((screen) => screen.label);

      for (let inner = 1100; inner >= 700; inner -= 25) {
        resize(inner);
        const labels = shown().map((text) => order.find((label) => text?.startsWith(label)));
        expect(labels).toEqual(order.slice(0, labels.length));
      }
    });

    it('takes the links back, in order, when there is room again', () => {
      const { resize, shown } = mount({ inner: ROOM_FOR(3) });
      expect(shown()).toHaveLength(3);

      resize(ROOM_FOR(6));
      expect(shown()).toHaveLength(6);
    });

    it('leaves More unmarked while the current screen is still on the bar', () => {
      const { resize, more } = mount();

      resize(ROOM_FOR(3));

      expect(more.getAttribute('aria-current')).toBeNull();
    });

    it('shows a dot on More, and says which screens have a count, when one is behind it', () => {
      const { resize, more } = mount();

      resize(ROOM_FOR(4));
      expect(more.querySelector('.dot')).toBeNull();

      resize(ROOM_FOR(3));
      expect(more.querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
      expect(words(more)).toBe('More , Security: 3 open alerts');
    });
  });

  describe('when the current page is behind More', () => {
    const SCREENS_ENDING_ON_CURRENT = SCREENS.map((screen) => ({
      ...screen,
      isCurrent: screen.id === 'milestones',
    }));

    it('gives More the current style and the current mark', () => {
      const { more } = mount({
        screens: SCREENS_ENDING_ON_CURRENT,
        inner: ROOM_FOR(3),
      });

      expect(more.getAttribute('aria-current')).toBe('true');
      expect(more.classList).toContain('current');
    });

    it('marks the current link inside the list as the page', () => {
      const { host } = mount({ screens: SCREENS_ENDING_ON_CURRENT, inner: ROOM_FOR(3) });

      expect(
        host.querySelector('.panel .folded-links a[aria-current="page"]')?.getAttribute('href'),
      ).toBe('/p/me/app/milestones');
    });
  });

  describe('when fewer than three links fit', () => {
    it('becomes one Menu button, with every screen and then the ways out behind it', () => {
      const { bar, more, menuButton, folded, shown, exits } = mount({ inner: ROOM_FOR(2) });

      expect(bar.classList).toContain('menu');
      expect(more.classList).toContain('inactive');
      expect(menuButton.classList).not.toContain('inactive');
      expect(shown()).toEqual([]);
      expect(folded()).toHaveLength(SCREENS.length);
      expect(folded()[0]).toBe('Queue');
      expect(exits().map((link) => words(link))).toEqual(['All projects', 'Guide']);
    });

    it('shows a dot on the Menu button and speaks the badges after its name', () => {
      const { menuButton } = mount({ inner: ROOM_FOR(2) });

      expect(menuButton.querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
      expect(words(menuButton)).toBe('☰Menu, Security: 3 open alerts');
    });

    it('shows no dot when no screen has a badge', () => {
      const { menuButton } = mount({
        screens: SCREENS.filter((screen) => !screen.badge),
        inner: ROOM_FOR(2),
      });

      expect(menuButton.querySelector('.dot')).toBeNull();
      expect(words(menuButton)).toBe('☰Menu');
    });

    it('is the Menu state at a narrow width and the links come back when it widens', () => {
      const { resize, bar } = mount();

      resize(390);
      expect(bar.classList).toContain('menu');

      resize(1440);
      expect(bar.classList).not.toContain('menu');
    });
  });

  describe('the list', () => {
    it('is plain links behind one disclosure button, not a role="menu"', () => {
      const { host, more, panel } = mount();

      expect(host.querySelector('[role]')).toBeNull();
      expect(more.type).toBe('button');
      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(more.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.closest('nav')?.getAttribute('aria-label')).toBe('Site');
    });

    it('opens by a class the stylesheet shows it by, and lifts the bar above the page', () => {
      const { fixture, header, more, panel } = mount();

      more.click();
      fixture.detectChanges();
      expect(more.getAttribute('aria-expanded')).toBe('true');
      expect(panel.classList).toContain('open');
      expect(header.classList).toContain('open');

      more.click();
      fixture.detectChanges();
      expect(panel.classList).not.toContain('open');
      expect(header.classList).not.toContain('open');
    });

    it('is opened by the Menu button in the Menu state', () => {
      const { fixture, menuButton, panel } = mount({ inner: ROOM_FOR(2) });

      expect(menuButton.getAttribute('aria-controls')).toBe(panel.id);
      menuButton.click();
      fixture.detectChanges();

      expect(menuButton.getAttribute('aria-expanded')).toBe('true');
      expect(panel.classList).toContain('open');
    });

    it('closes on Escape and returns focus to the button', () => {
      const { fixture, more } = mount();
      more.click();
      fixture.detectChanges();

      more.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(more);
    });

    it('closes when a link is chosen, leaving focus on the button', () => {
      const { fixture, more, exits } = mount();
      more.click();
      fixture.detectChanges();

      exits()[0].click();
      fixture.detectChanges();

      expect(more.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(more);
    });

    it('closes on any navigation, such as the browser back button', async () => {
      const { fixture, more } = mount();
      more.click();
      fixture.detectChanges();

      await TestBed.inject(Router).navigateByUrl('/p/me/app/depth');
      fixture.detectChanges();

      expect(more.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes when a resize moves the bar between More and the Menu', () => {
      const { fixture, more, resize } = mount();
      more.click();
      fixture.detectChanges();
      expect(more.getAttribute('aria-expanded')).toBe('true');

      resize(ROOM_FOR(2));

      expect(fixture.nativeElement.querySelector('.panel')?.classList).not.toContain('open');
    });
  });

  it('holds the page’s tool and chip in the bar, mounted whether the bar is a row or a Menu', () => {
    const { host, resize } = mount();
    const tool = host.querySelector('button.tool');
    const chip = host.querySelector('.chip');

    expect(tool?.closest('.end')).not.toBeNull();
    expect(chip?.closest('.end')).not.toBeNull();

    resize(390);
    resize(1440);
    expect(host.querySelector('button.tool')).toBe(tool);
    expect(host.querySelector('.chip')).toBe(chip);
  });

  it('draws no links until the bar and every link have been measured', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ELEMENT_SIZE, useValue: () => NEVER }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.screens = SCREENS;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bar')?.classList).not.toContain('measured');
  });

  it('draws the links once they have been measured', () => {
    const { bar } = mount();

    expect(bar.classList).toContain('measured');
  });

  it('keeps the name its floor and no more, so a link is given up before the name is cut shorter', () => {
    const { header } = mount();

    expect(header.style.getPropertyValue('--title-floor')).toBe('80px');
  });
});
