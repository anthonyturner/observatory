import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabStrip, TabStripTab, tabIndexAfter } from './tab-strip';

const TABS: readonly TabStripTab[] = [
  { id: 'icloud', label: 'iCloud', note: '3', spokenNote: ', 3 unread', isBad: false },
  { id: 'gmail', label: 'Gmail', note: 'off', spokenNote: ', not set up', isBad: false },
];

@Component({
  imports: [TabStrip],
  template: `<app-tab-strip
    name="mail"
    label="Mailbox"
    panelId="mail-panel"
    [tabs]="tabs"
    [selected]="selected()"
    (selectedChange)="selected.set($event)"
  />`,
})
class Host {
  readonly tabs = TABS;
  readonly selected = signal('icloud');
}

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  document.body.append(element);
  const tabs = () => Array.from(element.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const press = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement ?? tabs()[0]).dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  return { fixture, element, tabs, press };
}

describe('TabStrip', () => {
  it('is a tab list whose tabs name their panel, with only the selected one a tab stop', () => {
    const { element, tabs } = render();

    expect(element.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Mailbox');
    expect(tabs().map((tab) => tab.id)).toEqual(['mail-tab-icloud', 'mail-tab-gmail']);
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1]);
    expect(tabs()[0].getAttribute('aria-controls')).toBe('mail-panel');
    element.remove();
  });

  it('says each tab’s state after its name', () => {
    const { element, tabs } = render();

    expect(tabs()[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('iCloud 3, 3 unread');
    expect(tabs()[0].querySelector('b')?.getAttribute('aria-hidden')).toBe('true');
    element.remove();
  });

  it('moves and selects with the arrow keys, wrapping, and focuses the tab it lands on', () => {
    const { element, tabs, press } = render();
    tabs()[0].focus();

    const event = press('ArrowRight');

    expect(event.defaultPrevented).toBe(true);
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs()[1]);
    press('ArrowRight');
    expect(document.activeElement).toBe(tabs()[0]);
    expect(press('a').defaultPrevented).toBe(false);
    element.remove();
  });

  it('selects a tab that is clicked', () => {
    const { fixture, element, tabs } = render();

    tabs()[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selected()).toBe('gmail');
    element.remove();
  });
});

describe('tabIndexAfter', () => {
  it('wraps the arrows, and jumps to the ends with Home and End', () => {
    expect(tabIndexAfter('ArrowLeft', 0, 3)).toBe(2);
    expect(tabIndexAfter('ArrowRight', 2, 3)).toBe(0);
    expect(tabIndexAfter('Home', 2, 3)).toBe(0);
    expect(tabIndexAfter('End', 0, 3)).toBe(2);
    expect(tabIndexAfter('Enter', 0, 3)).toBeNull();
  });
});
