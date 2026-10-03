import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { PlaylistPlacement } from './core/playlist/playlist-placement';
import { ELEMENT_SIZE } from './shared/element-size/element-size';

function render() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ELEMENT_SIZE, useValue: () => of({ width: 560, height: 84 }) },
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
    expect(style.getPropertyValue('--playlist-width')).toBe('560px');
    expect(style.getPropertyValue('--playlist-height')).toBe('84px');
  });
});
