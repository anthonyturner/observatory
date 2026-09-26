import { TestBed } from '@angular/core/testing';
import { CoreChips } from './core-chips';

describe('CoreChips', () => {
  function render(lit: string) {
    const fixture = TestBed.createComponent(CoreChips);
    fixture.componentRef.setInput('lit', lit);
    fixture.detectChanges();
    return fixture;
  }

  const chips = (element: HTMLElement) => [...element.querySelectorAll('li')];

  it('lists the states in order, the lit one current', () => {
    const element = render('working').nativeElement as HTMLElement;

    expect(chips(element).map((chip) => chip.textContent?.trim())).toEqual([
      'Idle',
      'Listening',
      'Working',
      'Speaking',
      'Error',
    ]);
    expect(
      chips(element)
        .filter((chip) => chip.getAttribute('aria-current') === 'true')
        .map((chip) => chip.dataset['chip']),
    ).toEqual(['working']);
  });

  it('moves the light as the state changes', () => {
    const fixture = render('idle');

    fixture.componentRef.setInput('lit', 'error');
    fixture.detectChanges();

    const lit = (fixture.nativeElement as HTMLElement).querySelector('[aria-current="true"]');
    expect(lit?.getAttribute('data-chip')).toBe('error');
  });
});
