import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HelpState } from '../../../shared/help/help-state';
import { HELP } from './help-content';
import { StarmapHelp } from './starmap-help';

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(StarmapHelp);
  fixture.componentRef.setInput('screen', 'prs-map');
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    help: TestBed.inject(HelpState),
  };
}

describe('StarmapHelp', () => {
  it('shows pr-starmap’s card for the screen on show', () => {
    const { fixture, element, help } = render();

    help.toggle();
    fixture.detectChanges();

    expect(element.querySelector('h2')?.textContent).toBe('Review Queue');
    expect(element.querySelectorAll('li').length).toBe(HELP['prs-map'].rows.length);
    expect(element.querySelector('li b')?.textContent).toBe('Star');
  });

  it('closes when the screen changes, as its words no longer fit', () => {
    const { fixture, help } = render();
    help.toggle();
    fixture.detectChanges();

    fixture.componentRef.setInput('screen', 'logs-map');
    fixture.detectChanges();

    expect(help.isOpen()).toBe(false);
  });

  it('opens on whichever screen is showing', () => {
    const { fixture, element, help } = render();
    fixture.componentRef.setInput('screen', 'usage-list');
    fixture.detectChanges();

    help.toggle();
    fixture.detectChanges();

    expect(element.querySelector('h2')?.textContent).toBe('Usage');
  });

  it('links to the showing screen’s part of the Guide', () => {
    const { fixture, element, help } = render();
    fixture.componentRef.setInput('screen', 'issues-map');
    help.toggle();
    fixture.detectChanges();

    expect(element.querySelector('a.guide')?.getAttribute('href')).toBe('/guide#issues');
  });
});
