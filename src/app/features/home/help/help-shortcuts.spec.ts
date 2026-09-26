import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HelpShortcuts } from './help-shortcuts';
import { HelpState } from './help-state';

@Component({
  imports: [HelpShortcuts],
  template: '<div appHelpShortcuts><input /></div>',
})
class Host {}

describe('HelpShortcuts', () => {
  function setUp() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input');
    return { help: TestBed.inject(HelpState), input: input as HTMLInputElement };
  }

  const press = (key: string, target: EventTarget = document) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  it('toggles help with ? and closes it with Escape', () => {
    const { help } = setUp();

    press('?');
    expect(help.isOpen()).toBe(true);

    press('Escape');
    expect(help.isOpen()).toBe(false);
  });

  it('leaves ? typed into a field alone', () => {
    const { help, input } = setUp();

    press('?', input);

    expect(help.isOpen()).toBe(false);
  });
});
