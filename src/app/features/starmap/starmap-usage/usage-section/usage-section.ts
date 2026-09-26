import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One part of the Usage screen under its heading, as pr-starmap's list
 *  sections are: an italic title with a small line of context. */
@Component({
  selector: 'app-usage-section',
  template: `<section>
    <h3>
      {{ heading() }}<small>{{ small() }}</small>
    </h3>
    <ng-content />
  </section>`,
  styleUrl: './usage-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageSection {
  readonly heading = input.required<string>();
  readonly small = input('');
}
