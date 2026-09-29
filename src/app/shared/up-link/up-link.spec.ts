import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UpLink } from './up-link';

describe('UpLink', () => {
  it('links up to the level above under its name', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(UpLink);
    fixture.componentRef.setInput('to', '/orrery');
    fixture.componentRef.setInput('label', 'All projects');
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('/orrery');
    expect(link?.textContent).toContain('All projects');
  });
});
