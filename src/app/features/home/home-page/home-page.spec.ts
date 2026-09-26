import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CORE_RENDERER } from '../../../core/instrument/core-tokens';
import { CoreRenderer } from '../../../core/instrument/core-renderer';
import { HomePage } from './home-page';

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
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CORE_RENDERER, useValue: () => NO_CANVAS },
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

  it('puts the projects below the HUD, in the main landmark', () => {
    expect(render().querySelector('main app-fleet-section')).not.toBeNull();
  });
});
