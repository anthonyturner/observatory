import { Directive, inject } from '@angular/core';
import { HelpState } from './help-state';

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

/** The page's help keys: ? opens and closes the card, Esc closes it. Keys
 *  typed into a field belong to the field, and a key another handler has
 *  used, such as Esc throwing a recording away, is left to it. Listening on
 *  the window rather than the document lets every document handler go first. */
@Directive({
  selector: '[appHelpShortcuts]',
  host: { '(window:keydown)': 'onKeydown($event)' },
})
export class HelpShortcuts {
  private readonly help = inject(HelpState);

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || isTyping(event)) return;
    if (event.key === '?') {
      event.preventDefault();
      this.help.toggle();
    } else if (event.key === 'Escape') {
      this.help.close();
    }
  }
}

function isTyping(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest(TEXT_ENTRY) !== null;
}
