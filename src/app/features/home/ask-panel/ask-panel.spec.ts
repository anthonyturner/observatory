import { TestBed } from '@angular/core/testing';
import { AskPanel } from './ask-panel';

describe('AskPanel', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AskPanel);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('holds the voice controls, then the ask bar', () => {
    const parts = Array.from(render().querySelectorAll('app-voice-controls, app-ask-bar')).map(
      (part) => part.tagName.toLowerCase(),
    );

    expect(parts).toEqual(['app-voice-controls', 'app-ask-bar']);
  });

  it('says plainly that the assistant is not connected yet', () => {
    expect(render().querySelector('[role="status"]')?.textContent).toContain('Not connected yet');
  });

  it('draws a level line of dashes, each with its own share of the level', () => {
    const dashes = render().querySelectorAll<HTMLElement>('.level i');

    expect(dashes.length).toBe(36);
    expect(dashes[0].style.getPropertyValue('--k')).not.toBe('');
  });
});
