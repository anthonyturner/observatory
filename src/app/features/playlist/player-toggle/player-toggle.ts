import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { PlayerVisibility } from '../../../core/playlist/player-visibility';

/** The round ♪ button in the bottom-right corner that shows the player or puts it
 *  away, leaving only itself. Hiding with focus inside the player hands the focus to
 *  this button, since the player's own controls go out of reach. */
@Component({
  selector: 'app-player-toggle',
  templateUrl: './player-toggle.html',
  styleUrl: './player-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerToggle {
  protected readonly visibility = inject(PlayerVisibility);
  /** The id of the player this button shows and hides. */
  readonly controls = input.required<string>();
  private readonly document = inject(DOCUMENT);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  constructor() {
    // An effect runs before the render that makes the player inert, while the
    // focused control can still be told from the page.
    effect(() => {
      if (this.visibility.isShown()) return;
      untracked(() => {
        const player = this.document.getElementById(this.controls());
        if (player?.contains(this.document.activeElement)) this.button().nativeElement.focus();
      });
    });
  }
}
