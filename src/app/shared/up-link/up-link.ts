import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The way back up to the level above, as the pill every screen puts above its title. */
@Component({
  selector: 'app-up-link',
  imports: [RouterLink],
  template: `<a [routerLink]="to()"><span aria-hidden="true">&lsaquo;</span> {{ label() }}</a>`,
  styleUrl: './up-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpLink {
  readonly to = input.required<string>();
  readonly label = input.required<string>();
}
