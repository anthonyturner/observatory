import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { DailyChart } from '../charts/agent-daily';

/** C: work tokens a day, stacked by agent; a day is a button that lists its runs. */
@Component({
  selector: 'app-agent-daily-view',
  template: `
    @let c = chart();
    <svg
      [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
      role="group"
      aria-label="Work tokens per day for the last 30 days, stacked by agent"
    >
      @for (line of c.grid; track $index) {
        <line
          class="grid"
          [attr.x1]="line.x1"
          [attr.x2]="line.x2"
          [attr.y1]="line.y1"
          [attr.y2]="line.y2"
        />
      }
      @for (text of c.axis; track $index) {
        <text [attr.x]="text.x" [attr.y]="text.y" [attr.text-anchor]="text.anchor">
          {{ text.text }}
        </text>
      }
      @if (c.picked; as box) {
        <rect
          class="picked"
          [attr.x]="box.x"
          [attr.y]="box.y"
          [attr.width]="box.width"
          [attr.height]="box.height"
          rx="5"
        />
      }
      @for (segment of c.segments; track $index) {
        <rect
          class="mark"
          [class.dim]="agent() && agent() !== segment.group"
          [attr.x]="segment.x"
          [attr.y]="segment.y"
          [attr.width]="segment.width"
          [attr.height]="segment.height"
          [attr.rx]="segment.isTop ? 3 : 0"
          [style.fill]="segment.colour"
        />
      }
      <line
        class="baseline"
        [attr.x1]="c.baseline.x1"
        [attr.x2]="c.baseline.x2"
        [attr.y1]="c.baseline.y1"
        [attr.y2]="c.baseline.y2"
      />
      @for (hit of c.hits; track hit.day) {
        <rect
          class="hit"
          [attr.x]="hit.x"
          [attr.y]="hit.y"
          [attr.width]="hit.width"
          [attr.height]="hit.height"
          [attr.data-tip]="hit.tip"
          tabindex="0"
          role="button"
          [attr.aria-label]="hit.tip"
          [attr.aria-pressed]="picked() === hit.day"
          (click)="pick.emit(hit.day)"
          (keydown.enter)="pick.emit(hit.day)"
          (keydown.space)="$event.preventDefault(); pick.emit(hit.day)"
        />
      }
    </svg>
  `,
  styleUrl: './agent-chart.css',
  styles: `
    :host {
      --chart-min-width: 720px;
    }
    .picked {
      fill: var(--flow-tint);
      stroke: var(--flow);
      stroke-width: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentDailyView {
  readonly chart = input.required<DailyChart>();
  readonly picked = input<string | null>(null);
  /** The agent lit elsewhere, lit here too. */
  readonly agent = input<string | null>(null);
  readonly pick = output<string>();

  constructor() {
    // Where the chart scrolls on a phone, it opens on today, not a month ago.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => (host.scrollLeft = host.scrollWidth));
  }
}
