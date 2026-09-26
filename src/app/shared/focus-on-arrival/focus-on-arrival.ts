import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Takes the focus as soon as its element is drawn, so a keyboard lands where
 *  the next step is: Stay here, or a proposal's heading. */
@Directive({ selector: '[appFocusOnArrival]' })
export class FocusOnArrival {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => host.nativeElement.focus());
  }
}
