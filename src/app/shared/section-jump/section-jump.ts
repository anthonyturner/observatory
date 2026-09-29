import { DOCUMENT, Injectable, inject } from '@angular/core';
import { MotionPreference } from '../../core/motion/motion-preference';

/** Moves Home between its sections from an in-page link. */
@Injectable({ providedIn: 'root' })
export class SectionJump {
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);

  /** Scrolls to the section, gliding unless motion is off, and moves focus there so the
   *  keyboard carries on from it. The address is left as it is. A modified or non-primary
   *  click keeps the browser's own behaviour. */
  follow(event: MouseEvent, id: string): void {
    const section = this.document.getElementById(id);
    if (!section || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: this.motion.isStill() ? 'auto' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }
}
