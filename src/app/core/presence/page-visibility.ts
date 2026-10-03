import { DOCUMENT, Injectable, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

/** Whether the tab is hidden: in the background, or its window minimised. */
@Injectable({ providedIn: 'root' })
export class PageVisibility {
  private readonly document = inject(DOCUMENT);
  private readonly hidden = signal(this.document.hidden);

  readonly isHidden: Signal<boolean> = this.hidden.asReadonly();

  constructor() {
    fromEvent(this.document, 'visibilitychange')
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.hidden.set(this.document.hidden));
  }
}
