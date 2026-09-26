import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HelpState } from './help-state';

/** Opens and closes the page's help card, as ? does. */
@Component({
  selector: 'app-help-button',
  template: `<button
    type="button"
    title="What this page shows (?)"
    [attr.aria-pressed]="help.isOpen()"
    (click)="help.toggle()"
  >
    <span aria-hidden="true">?</span> Help
  </button>`,
  styleUrl: './help-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpButton {
  protected readonly help = inject(HelpState);
}
