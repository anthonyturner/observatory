import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { PlaylistPlacement } from './core/playlist/playlist-placement';
import { ELEMENT_SIZE } from './shared/element-size/element-size';

const NOTHING = { width: 0, height: 0 };
const STRIP = { width: 240, height: 26 };
const BAR = { width: 560, height: 84 };

/** Nothing floats over the bar before the first play. */
const sizeOf = (element: Element) => {
  if (element.hasAttribute('data-playlist-above')) return NOTHING;
  return element.localName === 'app-status-strip' ? STRIP : BAR;
};

function render() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ELEMENT_SIZE,
        useValue: (element: Element) => of(sizeOf(element)),
      },
    ],
  });
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('App', () => {
  it('hosts the routed page', () => {
    const { element } = render();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });

  it('keeps the playlist outside the routed page, so it plays on across pages', () => {
    const { element } = render();
    const bar = element.querySelector('app-transport-bar');
    expect(bar).not.toBeNull();
    expect(bar?.closest('router-outlet')).toBeNull();
  });

  it('keeps the notices outside the routed page, so they show on every page', () => {
    const { element } = render();
    const stack = element.querySelector('app-notice-stack');
    expect(stack).not.toBeNull();
    expect(stack?.closest('router-outlet')).toBeNull();
  });

  it('keeps the status strip, with usage in it, outside the routed page', () => {
    const { element } = render();
    const usage = element.querySelector('app-status-strip app-usage-fact');
    expect(usage).not.toBeNull();
    expect(usage?.closest('router-outlet')).toBeNull();
  });

  it('moves the playlist clear of the task dock while a page says it is open', () => {
    const { fixture, element } = render();
    const foot = element.querySelector('.playlist');
    expect(foot?.classList).not.toContain('playlist--beside-dock');
    TestBed.inject(PlaylistPlacement).setBesideDock(true);
    fixture.detectChanges();
    expect(foot?.classList).toContain('playlist--beside-dock');
  });

  it("tells every page the playlist's size, for their tools to keep clear of it", async () => {
    const { fixture } = render();
    await fixture.whenStable();
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--playlist-height')).toBe('84px');
    // jsdom's window is 1024px wide, under twice the bar's 560px: the tools stack above it.
    expect(style.getPropertyValue('--playlist-clear-right')).toBe('20px');
    expect(style.getPropertyValue('--playlist-clear-bottom')).toBe('84px');
    expect(style.getPropertyValue('--playlist-reach')).toBe('84px');
  });

  it("tells every page the status strip's height, for their top HUD to keep below it", async () => {
    const { fixture } = render();
    await fixture.whenStable();
    expect(document.documentElement.style.getPropertyValue('--status-strip-height')).toBe('26px');
  });
});
