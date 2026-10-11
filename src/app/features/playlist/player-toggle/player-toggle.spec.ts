import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlayerVisibility } from '../../../core/playlist/player-visibility';
import { PlayerToggle } from './player-toggle';

/** The toggle beside a stand-in for the player, which holds one focusable control. */
@Component({
  imports: [PlayerToggle],
  template: `
    <div id="player"><button type="button" id="inside">Play</button></div>
    <app-player-toggle controls="player" />
  `,
})
class Shell {}

function render() {
  localStorage.clear();
  const fixture = TestBed.createComponent(Shell);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const toggle = element.querySelector<HTMLButtonElement>('app-player-toggle button');
  if (!toggle) throw new Error('No toggle');
  const inside = element.querySelector<HTMLButtonElement>('#inside');
  if (!inside) throw new Error('No player control');
  return { fixture, element, toggle, inside, visibility: TestBed.inject(PlayerVisibility) };
}

describe('PlayerToggle', () => {
  afterEach(() => localStorage.clear());

  it('is named, and points at the player it shows and hides', () => {
    const { toggle } = render();
    expect(toggle.getAttribute('aria-label')).toBe('Music player');
    expect(toggle.getAttribute('aria-controls')).toBe('player');
    expect(toggle.textContent?.trim()).toBe('♪');
  });

  it('says whether the player is shown, and what pressing it will do', () => {
    const { fixture, toggle } = render();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.title).toBe('Hide the music player');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.title).toBe('Show the music player');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('hides and shows the player for the rest of the app', () => {
    const { fixture, toggle, visibility } = render();
    toggle.click();
    fixture.detectChanges();
    expect(visibility.isShown()).toBe(false);
    toggle.click();
    expect(visibility.isShown()).toBe(true);
  });

  it('takes the focus when the player hides with focus inside it', () => {
    const { fixture, toggle, inside, visibility } = render();
    inside.focus();
    expect(document.activeElement).toBe(inside);
    visibility.toggle();
    fixture.detectChanges();
    expect(document.activeElement).toBe(toggle);
  });

  it('leaves the focus alone when it is elsewhere', () => {
    const { fixture, toggle, visibility } = render();
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    visibility.toggle();
    fixture.detectChanges();
    expect(document.activeElement).toBe(elsewhere);
    expect(document.activeElement).not.toBe(toggle);
    elsewhere.remove();
  });
});
