import { TestBed } from '@angular/core/testing';
import { HelpState } from './help-state';

describe('HelpState', () => {
  it('starts closed, toggles open and shut, and closes', () => {
    const help = TestBed.inject(HelpState);
    expect(help.isOpen()).toBe(false);

    help.toggle();
    expect(help.isOpen()).toBe(true);

    help.close();
    expect(help.isOpen()).toBe(false);
  });
});
