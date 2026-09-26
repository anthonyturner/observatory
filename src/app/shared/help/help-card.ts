import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { HelpEntry, HelpKey } from './help-entry';
import { HelpState } from './help-state';

/** What a page's parts mean. Focus moves in when it opens and back to where it
 *  was when it closes; leaving the page closes it. */
@Component({
  selector: 'app-help-card',
  imports: [A11yModule],
  templateUrl: './help-card.html',
  styleUrl: './help-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpCard {
  protected readonly help = inject(HelpState);
  readonly title = input.required<string>();
  readonly entries = input.required<readonly HelpEntry[]>();
  readonly keys = input.required<readonly HelpKey[]>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.help.close());
  }
}
