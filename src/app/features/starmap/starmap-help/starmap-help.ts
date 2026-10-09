import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE_LINK } from '../../../core/guide/guide-link';
import { HelpState } from '../../../shared/help/help-state';
import { HELP, HelpKey } from './help-content';

/**
 * pr-starmap's help card for the star map: one per screen and view, top right,
 * clear of the card and the legend so it can stay open while someone tries
 * what it describes. It describes the screen it opened on, so a new screen
 * closes it, and links to that screen's part of the Guide.
 */
@Component({
  selector: 'app-starmap-help',
  imports: [RouterLink],
  templateUrl: './starmap-help.html',
  styleUrl: './starmap-help.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarmapHelp {
  /** The screen and view on show, as pr-starmap keys its help: `prs-map`. */
  readonly screen = input.required<HelpKey>();

  protected readonly help = inject(HelpState);
  private openedOn: HelpKey | null = null;
  protected readonly card = computed(() => HELP[this.screen()]);
  protected readonly guideLink = GUIDE_LINK;

  constructor() {
    effect(() => {
      const open = this.help.isOpen();
      const screen = this.screen();
      untracked(() => {
        if (!open) {
          this.openedOn = null;
          return;
        }
        if (this.openedOn === null) this.openedOn = screen;
        else if (this.openedOn !== screen) this.help.close();
      });
    });
  }
}
