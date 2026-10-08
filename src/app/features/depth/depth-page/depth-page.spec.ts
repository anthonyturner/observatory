import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DepthPage } from './depth-page';

const module = (file: string, implementation: number, interfaceSize: number, verdict: string) => ({
  file,
  folder: file.slice(0, file.lastIndexOf('/')),
  implementation,
  interfaceSize,
  depth: implementation / interfaceSize,
  verdict,
  principle: verdict === 'shallow' ? 'shallow-modules' : 'deep-modules',
});

const REPORT = {
  repo: 'me/app',
  scannedAt: '2026-10-08T12:00:00.000Z',
  modules: [
    module('src/queue/engine.ts', 160, 4, 'deep'),
    module('src/queue/feed.ts', 20, 5, 'balanced'),
    module('src/queue/index.ts', 1, 9, 'shallow'),
    module('src/mail/inbox.ts', 30, 3, 'balanced'),
  ],
  principles: [
    { id: 'deep-modules', title: 'Make modules deep', idea: 'Hide a lot of work.' },
    {
      id: 'shallow-modules',
      title: 'Avoid shallow modules',
      idea: 'A thin wrapper hides nothing.',
    },
  ],
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
    ],
  });
  const fixture = TestBed.createComponent(DepthPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, http, element };
}

function readyPage() {
  const page = render();
  page.http.expectOne('/api/depth?repo=me/app').flush(REPORT);
  page.fixture.detectChanges();
  return page;
}

const planets = (element: HTMLElement) => [
  ...element.querySelectorAll<SVGGElement>('g[data-planet]'),
];

describe('DepthPage', () => {
  it('draws every module of the project as a planet, on the Depth tab', () => {
    const { element } = readyPage();

    expect(element.querySelector('h1')?.textContent).toBe('Depth');
    expect(
      element.querySelector('app-project-tabs a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/p/me/app/depth');
    expect(planets(element)).toHaveLength(4);
    expect(element.querySelector('.stamp')?.textContent).toContain('me/app · 4 modules');
  });

  it('shows the numbers and the principle of a planet when the pointer reaches it', () => {
    const { fixture, element } = readyPage();
    expect(element.querySelector('.hint')).not.toBeNull();

    const shallow = planets(element).find((planet) =>
      planet.getAttribute('aria-label')?.startsWith('src/queue/index.ts'),
    );
    shallow?.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();

    const panel = element.querySelector('.panel');
    expect(panel?.querySelector('h2')?.textContent).toBe('index.ts');
    expect(panel?.textContent).toContain('Shallow');
    expect(panel?.querySelector('dd')?.textContent).toContain('1');
    expect(panel?.querySelector('.principle h3')?.textContent).toBe('Avoid shallow modules');
    expect(panel?.querySelector('.principle p')?.textContent).toBe('A thin wrapper hides nothing.');
  });

  it('shows the same panel when a planet takes keyboard focus', () => {
    const { fixture, element } = readyPage();

    planets(element)[0].dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(element.querySelector('.panel h2')?.textContent).toBe('inbox.ts');
    expect(element.querySelector('.panel .principle h3')?.textContent).toBe('Make modules deep');
  });

  it('keeps one planet in the tab order and walks the rest with the arrow keys', () => {
    const { fixture, element } = readyPage();
    expect(planets(element).map((planet) => planet.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
    ]);

    planets(element)[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();

    expect(planets(element).map((planet) => planet.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
      '-1',
    ]);
  });

  it('narrows the sky by path and by verdict, counting what each verdict would show', () => {
    const { fixture, element } = readyPage();
    const input = element.querySelector<HTMLInputElement>('.filter input');
    if (!input) throw new Error('no filter');

    input.value = 'queue';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(planets(element)).toHaveLength(3);
    const chips = [...element.querySelectorAll('[aria-label="Verdict"] button')].map((chip) =>
      chip.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(chips).toEqual(['All 3', 'Deep 1', 'Balanced 1', 'Shallow 1']);

    const shallowChip = element.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Verdict"] button',
    )[3];
    shallowChip.click();
    fixture.detectChanges();

    expect(planets(element)).toHaveLength(1);
    expect(shallowChip.getAttribute('aria-pressed')).toBe('true');
  });

  it('gives the same modules as a list, shallowest first', () => {
    const { fixture, element } = readyPage();

    const listButton = [...element.querySelectorAll<HTMLButtonElement>('.views button')].find(
      (button) => button.textContent?.trim() === 'List',
    );
    listButton?.click();
    fixture.detectChanges();

    expect(planets(element)).toHaveLength(0);
    const rows = [...element.querySelectorAll('app-depth-list button')];
    expect(rows.map((row) => row.querySelector('b')?.textContent)).toEqual([
      'index.ts',
      'feed.ts',
      'inbox.ts',
      'engine.ts',
    ]);
  });

  it('says so when nothing matches', () => {
    const { fixture, element } = readyPage();
    const input = element.querySelector<HTMLInputElement>('.filter input');
    if (!input) throw new Error('no filter');

    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(planets(element)).toHaveLength(0);
    expect(element.querySelector('.state')?.textContent).toContain('No module matches');
  });

  it('says there is no clone when the API answers not found', () => {
    const { fixture, http, element } = render();
    http
      .expectOne('/api/depth?repo=me/app')
      .flush({ error: 'No local clone' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(element.querySelector('.state')?.textContent).toContain('No clone of this project here');
    expect(element.querySelector('.panel')).toBeNull();
  });

  it('reads the files again when asked', () => {
    const { fixture, http, element } = readyPage();

    element.querySelector<HTMLButtonElement>('.abtn.quiet')?.click();
    fixture.detectChanges();

    http.expectOne('/api/depth?repo=me/app&fresh=1').flush(REPORT);
    fixture.detectChanges();
    expect(planets(element)).toHaveLength(4);
  });
});
