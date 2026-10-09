import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE_LINK } from '../../core/guide/guide-link';

/**
 * The pills every screen puts above its title: the way back up to the level
 * above, and the way to this screen's part of the Guide, so the Guide is one
 * step from anywhere.
 */
@Component({
  selector: 'app-up-link',
  imports: [RouterLink],
  template: `<a class="up" [routerLink]="to()"
      ><span aria-hidden="true">&lsaquo;</span> {{ label() }}</a
    >
    @if (guide(); as part) {
      <a class="guide" [routerLink]="guideLink" [fragment]="part">Guide</a>
    }`,
  styleUrl: './up-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpLink {
  readonly to = input.required<string>();
  readonly label = input.required<string>();
  /** The anchor of this screen's part of the Guide, such as `releases`; null on the Guide itself. */
  readonly guide = input.required<string | null>();

  protected readonly guideLink = GUIDE_LINK;
}
