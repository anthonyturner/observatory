import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UpLink } from './up-link';

function render(guide: string | null): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(UpLink);
  fixture.componentRef.setInput('to', '/orrery');
  fixture.componentRef.setInput('label', 'All projects');
  fixture.componentRef.setInput('guide', guide);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('UpLink', () => {
  it('links up to the level above under its name', () => {
    const link = render('releases').querySelector('a');

    expect(link?.getAttribute('href')).toBe('/orrery');
    expect(link?.textContent).toContain('All projects');
  });

  it('links to the screen’s part of the Guide beside it', () => {
    const guide = render('releases').querySelector('a.guide');

    expect(guide?.getAttribute('href')).toBe('/guide#releases');
    expect(guide?.textContent).toBe('Guide');
  });

  it('leaves the Guide link off the Guide itself', () => {
    expect(render(null).querySelector('a.guide')).toBeNull();
  });
});
