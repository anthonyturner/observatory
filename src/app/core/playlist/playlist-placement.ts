import { Injectable, Signal, signal } from '@angular/core';

/** What the playlist bar keeps clear of at the foot of the page: Home's task
 *  dock, while it is open beside the page. The page that has one says so. */
@Injectable({ providedIn: 'root' })
export class PlaylistPlacement {
  private readonly besideDock = signal(false);

  readonly isBesideDock: Signal<boolean> = this.besideDock.asReadonly();

  setBesideDock(isBesideDock: boolean): void {
    this.besideDock.set(isBesideDock);
  }
}
