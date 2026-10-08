import { TestBed } from '@angular/core/testing';
import { HelpState } from '../../../shared/help/help-state';
import { BED_RECORDINGS } from '../sound/space-bed';
import { HELP } from './help-content';
import { StarmapHelp } from './starmap-help';

function render() {
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

  it('credits every space recording on the Review Queue card, with its source', () => {
    const card = HELP['prs-map'].rows.find(([name]) => name === 'Space recordings')?.[1] ?? '';

    for (const { mission, credit, source } of BED_RECORDINGS) {
      expect(card).toContain(mission);
      expect(card).toContain(credit);
      expect(card).toContain(source);
    }
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
});
