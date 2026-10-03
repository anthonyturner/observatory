import { Injectable, Signal, signal } from '@angular/core';

/** What the shell's fixed parts keep clear of: Home's task dock, while it is open
 *  beside the page. The playlist bar at the foot and the notices under the clock
 *  both step aside for it. The page that has one says so. */
@Injectable({ providedIn: 'root' })
export class PlaylistPlacement {
  private readonly besideDock = signal(false);

  readonly isBesideDock: Signal<boolean> = this.besideDock.asReadonly();

  setBesideDock(isBesideDock: boolean): void {
    this.besideDock.set(isBesideDock);
  }
}
