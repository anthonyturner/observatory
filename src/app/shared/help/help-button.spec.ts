import { TestBed } from '@angular/core/testing';
import { HelpButton } from './help-button';
import { HelpState } from './help-state';

describe('HelpButton', () => {
  it('opens and closes the help card, and says which', () => {
    const fixture = TestBed.createComponent(HelpButton);
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    fixture.detectChanges();

    button?.click();
    fixture.detectChanges();
    expect(TestBed.inject(HelpState).isOpen()).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');

    button?.click();
    expect(TestBed.inject(HelpState).isOpen()).toBe(false);
  });
});
