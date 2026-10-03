import { HighContrastMode, HighContrastModeDetector } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CORE_RENDERER } from '../../../core/instrument/core-tokens';
import { CoreRenderer } from '../../../core/instrument/core-renderer';
import { MUSIC_CANVAS, MusicCanvas } from '../../../core/music-sync/music-painter';
import { SKY_CANVAS, SkyCanvas } from '../../../core/sky/sky-painter';
import { PlaylistPlacement } from '../../../core/playlist/playlist-placement';
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
  setSound: () => undefined,
  setMilkdropPreset: () => undefined,
  announce: () => undefined,
  setMilkdropOpacity: () => undefined,
  setBeatStrength: () => undefined,
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

/** jsdom has no forced-colours mode to detect, and the CDK's probe for one runs
 *  getComputedStyle, which in jsdom matches every selector of every Home stylesheet. */
@Injectable()
class NoForcedColours extends HighContrastModeDetector {
  override getHighContrastMode(): HighContrastMode {
    return HighContrastMode.NONE;
  }
}

/** The first render in this file builds the whole Home tree from cold: jsdom parses
 *  every Home stylesheet and V8 compiles every component for the first time. That is
 *  about 0.4 s alone, against 0.15 s for a later render, but it reached 5.5 s in a
 *  full suite on a loaded machine and failed the 5 s default. 15 s is nearly three
 *  times that, and still fails a render that hangs. */
const COLD_FIRST_RENDER_MS = 15_000;

describe('HomePage', { timeout: COLD_FIRST_RENDER_MS }, () => {
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
        { provide: HighContrastModeDetector, useClass: NoForcedColours },
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

  it('leaves the playlist to the app shell, and lets go of the dock space on leaving', () => {
    const fixture = renderFixture();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-transport-bar')).toBeNull();
    const placement = TestBed.inject(PlaylistPlacement);
    expect(placement.isBesideDock()).toBe(false);
    placement.setBesideDock(true);
    fixture.destroy();
    expect(placement.isBesideDock()).toBe(false);
  });
});
