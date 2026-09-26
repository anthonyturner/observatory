import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BarItem, barRowsChart } from '../charts/bar-rows-chart';
import { UsageBarChart } from '../charts/usage-bar-chart/usage-bar-chart';
import { UsageSection } from '../usage-section/usage-section';

/** A section of horizontal bars, By project or Tools, with a note above. */
@Component({
  selector: 'app-usage-bars',
  imports: [UsageSection, UsageBarChart],
  template: `<app-usage-section [heading]="heading()" [small]="small()">
    @if (note(); as note) {
      <p class="note">{{ note }}</p>
    }
    <app-usage-bar-chart [chart]="chart()" [label]="label()" />
  </app-usage-section>`,
  styles: `
    :host {
      display: block;
    }
    .note {
      font-size: 12.5px;
      color: var(--muted);
      line-height: 1.55;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageBarsSection {
  readonly heading = input.required<string>();
  readonly small = input.required<string>();
  readonly note = input<string | null>(null);
  readonly items = input.required<readonly BarItem[]>();
  readonly width = input.required<number>();
  /** What the chart shows, for a screen reader. */
  readonly label = input.required<string>();

  protected readonly chart = computed(() => barRowsChart(this.items(), this.width()));
}
