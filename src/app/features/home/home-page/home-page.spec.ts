import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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

describe('HomePage', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CORE_RENDERER, useValue: () => NO_CANVAS },
        { provide: SKY_CANVAS, useValue: () => NO_SKY },
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

  it('puts the projects below the HUD, in the main landmark', () => {
    expect(render().querySelector('main app-fleet-section')).not.toBeNull();
  });
});
