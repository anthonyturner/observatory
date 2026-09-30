import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ContextChart } from '../charts/agent-context';

/** B: every run a dot at its peak context, with each agent's median. */
@Component({
  selector: 'app-agent-context-view',
  template: `
    @let c = chart();
    <svg
      [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
      role="img"
      aria-label="Peak context of each run, by agent"
    >
      @if (c.band; as band) {
        <rect
          class="band"
          [attr.x]="band.x"
          [attr.y]="band.y"
          [attr.width]="band.width"
          [attr.height]="band.height"
        />
      }
      @for (line of c.grid; track $index) {
        <line
          class="grid"
          [attr.x1]="line.x1"
          [attr.x2]="line.x2"
          [attr.y1]="line.y1"
          [attr.y2]="line.y2"
        />
      }
      @if (c.window; as line) {
        <line
          class="window"
          [attr.x1]="line.x1"
          [attr.x2]="line.x2"
          [attr.y1]="line.y1"
          [attr.y2]="line.y2"
        />
      }
      @if (c.windowLabel; as label) {
        <text class="window-label" [attr.x]="label.x" [attr.y]="label.y">{{ label.text }}</text>
      }
      @for (text of c.axis; track $index) {
        <text [attr.x]="text.x" [attr.y]="text.y" [attr.text-anchor]="text.anchor">
          {{ text.text }}
        </text>
      }
      @for (row of c.rows; track row.id) {
        <text
          class="name mark"
          [class.dim]="picked() && picked() !== row.id"
          [attr.x]="c.labelX"
          [attr.y]="row.y + 4"
          text-anchor="end"
        >
          {{ row.label }}
        </text>
      }
      @for (dot of c.dots; track dot.id) {
        <circle
          class="dot mark"
          [class.dim]="picked() && picked() !== dot.group"
          [attr.cx]="dot.cx"
          [attr.cy]="dot.cy"
          r="4.5"
          [style.fill]="dot.colour"
          [attr.data-tip]="dot.tip"
        />
      }
      @for (row of c.rows; track row.id) {
        <line
          class="median"
          [attr.x1]="row.median.x1"
          [attr.x2]="row.median.x2"
          [attr.y1]="row.median.y1"
          [attr.y2]="row.median.y2"
        />
      }
    </svg>
  `,
  styleUrl: './agent-chart.css',
  styles: `
    :host {
      --chart-min-width: 440px;
    }
    .band {
      fill: var(--agent-window-band);
    }
    .window {
      stroke: var(--warm);
      stroke-dasharray: 3 3;
    }
    .window-label {
      font-size: 10px;
      fill: var(--warm);
    }
    .dot {
      stroke: var(--void);
      stroke-width: 1.5;
    }
    .median {
      stroke: var(--ink);
      stroke-width: 2;
      stroke-linecap: round;
      pointer-events: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentContextView {
  readonly chart = input.required<ContextChart>();
  readonly picked = input<string | null>(null);
}
