import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SectionJump } from './section-jump';

/** Home's first screen, which the Top link returns to. */
export const TOP_ID = 'top';

/** Back up to Home's first screen from a section further down. */
@Component({
  selector: 'app-top-link',
  template: `<a
    class="top-link"
    href="#${TOP_ID}"
    title="Back to the top: vitals, skills and Ask"
    (click)="jump.follow($event, '${TOP_ID}')"
    >Top <span aria-hidden="true">&uarr;</span></a
  >`,
  styles: `
    :host {
      margin-left: auto;
    }
    .top-link {
      color: var(--muted);
      font-size: 12px;
      text-decoration: none;
    }
    .top-link span {
      color: var(--flow);
    }
    .top-link:hover,
    .top-link:focus-visible {
      color: var(--ink);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopLink {
  protected readonly jump = inject(SectionJump);
}
