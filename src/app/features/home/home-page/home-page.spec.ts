import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CORE_RENDERER } from '../../../core/instrument/core-tokens';
import { CoreRenderer } from '../../../core/instrument/core-renderer';
import { MUSIC_CANVAS, MusicCanvas } from '../../../core/music-sync/music-painter';
import { SKY_CANVAS, SkyCanvas } from '../../../core/sky/sky-painter';
import { HelpState } from '../../../shared/help/help-state';
import { HomePage } from './home-page';

const NO_SKY: SkyCanvas = {
  canDraw: () => false,
  setComets: () => undefined,
  flare: () => undefined,
  setView: () => undefined,
  setTrailSpeed: () => undefined,
  paint: () => undefined,
  dispose: () => undefined,
};

const NO_MUSIC: MusicCanvas = {
  canDraw: () => false,
  setScene: () => undefined,
  setTheme: () => undefined,
  paint: () => undefined,
  clear: () => undefined,
  dispose: () => undefined,
};

/** jsdom has no canvas to draw on. */
const NO_CANVAS: CoreRenderer = {
  mount: () => undefined,
  canDraw: () => false,
  setProjects: () => undefined,
  setView: () => undefined,
  frame: () => undefined,
  dispose: () => undefined,
};

describe('HomePage', () => {
  function render(): HTMLElement {
    return renderFixture().nativeElement as HTMLElement;
  }

  function renderFixture() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CORE_RENDERER, useValue: () => NO_CANVAS },
        { provide: SKY_CANVAS, useValue: () => NO_SKY },
        { provide: MUSIC_CANVAS, useValue: () => NO_MUSIC },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    return fixture;
  }

  /** Answers every mail read made so far with `answer`. */
  function answerMail(answer: (account: string) => object | null): void {
    const http = TestBed.inject(HttpTestingController);
    for (const request of http.match((each) => each.url === '/api/mail')) {
      const account = request.request.params.get('account') ?? '';
      const body = answer(account);
      if (body) request.flush(body);
      else request.flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
    }
  }

  it('stacks the HUD sections in reading order: core, ask, vitals, skills', () => {
    const order = Array.from(render().querySelectorAll('.hud-body > *')).map((el) =>
      el.tagName.toLowerCase(),
    );

    expect(order).toEqual([
      'app-core-panel',
      'app-ask-panel',
      'app-vitals-panel',
      'app-skills-panel',
    ]);
  });

  it('explains Home, comets and fog included, in its help card', () => {
    const element = render();
    TestBed.inject(HelpState).toggle();
    TestBed.tick();

    const terms = Array.from(element.querySelectorAll('app-help-card dt')).map((dt) =>
      dt.textContent?.trim(),
    );
    expect(element.querySelector('#help-title')?.textContent).toBe('Home');
    expect(terms).toContain('Comets');
    expect(terms).toContain('Fog');
  });

  it('puts the news, the projects, then the agents below the HUD, in the main landmark', () => {
    const sections = Array.from(render().querySelectorAll('main > *')).map((each) =>
      each.tagName.toLowerCase(),
    );
    expect(sections).toEqual(['app-news-section', 'app-fleet-section', 'app-agents-section']);
  });

  it('puts Mail above the news once the local API answers for it', async () => {
    const fixture = renderFixture();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-mail-section')).toBeNull();

    answerMail((account) => ({ account, state: 'off', settings: ['A', 'B'] }));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('app-mail-section')).not.toBeNull();
    });

    const sections = Array.from(element.querySelectorAll('main > *')).map((each) =>
      each.tagName.toLowerCase(),
    );
    expect(sections[0]).toBe('app-mail-section');
    expect(sections[1]).toBe('app-news-section');
    expect(
      Array.from(element.querySelectorAll('.jumps a')).map((link) => link.textContent?.trim())[0],
    ).toContain('Mail');
  });

  it('never shows Mail where the site has none, as hosted', async () => {
    const fixture = renderFixture();

    answerMail(() => null);
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-mail-section')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="#mail"]')).toBeNull();
  });
});
