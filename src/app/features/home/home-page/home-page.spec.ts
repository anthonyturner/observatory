import { HighContrastMode, HighContrastModeDetector } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CORE_RENDERER } from '../../../core/instrument/core-tokens';
import { CoreRenderer } from '../../../core/instrument/core-renderer';
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
 *  about 0.4 s alone, and passed the 5 s default under a loaded full suite; later
 *  renders take about 0.15 s. 15 s keeps three times the slowest first render seen. */
const COLD_FIRST_RENDER_MS = 15_000;

describe('HomePage', { timeout: COLD_FIRST_RENDER_MS }, () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CORE_RENDERER, useValue: () => NO_CANVAS },
        { provide: SKY_CANVAS, useValue: () => NO_SKY },
        { provide: HighContrastModeDetector, useClass: NoForcedColours },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
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
});
