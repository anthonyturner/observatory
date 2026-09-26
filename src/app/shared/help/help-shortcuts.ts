import { Directive, inject } from '@angular/core';
import { HelpState } from './help-state';

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

/** The page's help keys: ? opens and closes the card, Esc closes it. Keys
 *  typed into a field belong to the field. */
@Directive({
  selector: '[appHelpShortcuts]',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class HelpShortcuts {
  private readonly help = inject(HelpState);

  protected onKeydown(event: KeyboardEvent): void {
    if (isTyping(event)) return;
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
