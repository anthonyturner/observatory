import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HOME_HELP_ENTRIES, HOME_HELP_KEYS } from './help-content';
import { HelpState } from './help-state';

/** What Home's parts mean. Focus moves in when it opens and back to where it
 *  was when it closes. */
@Component({
  selector: 'app-help-card',
  imports: [A11yModule],
  templateUrl: './help-card.html',
  styleUrl: './help-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpCard {
  protected readonly help = inject(HelpState);
  protected readonly entries = HOME_HELP_ENTRIES;
  protected readonly keys = HOME_HELP_KEYS;
}
