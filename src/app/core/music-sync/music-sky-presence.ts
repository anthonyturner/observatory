import { Injectable } from '@angular/core';
import { holds } from '../presence/holds';

/** Whether the page on show has a music sky, for the playlist bar, which outlives
 *  pages, to offer the sky's controls only where they do something. */
@Injectable({ providedIn: 'root' })
export class MusicSkyPresence {
  private readonly skies = holds();

  readonly isShown = this.skies.isHeld;

  /** A music sky arriving on the page; call the returned function as it leaves. */
  hold(): () => void {
    return this.skies.hold();
  }
}
