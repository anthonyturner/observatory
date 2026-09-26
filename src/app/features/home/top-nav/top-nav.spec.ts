import { TestBed } from '@angular/core/testing';
import { HelpState } from '../help/help-state';
import { TopNav } from './top-nav';

describe('TopNav', () => {
  it('opens help from the ? button and shows it pressed', () => {
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Help"]',
    );

    button?.click();
    fixture.detectChanges();

    expect(TestBed.inject(HelpState).isOpen()).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });
});
