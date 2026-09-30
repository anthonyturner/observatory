import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RankChart } from '../charts/agent-rank';

/** A: the ranked bars, each row a button that lights its agent. */
@Component({
  selector: 'app-agent-rank-view',
  template: `
    @let c = chart();
    <svg
      [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
      role="group"
      aria-label="Work tokens by agent, most first"
    >
      @for (row of c.rows; track row.id) {
        <g class="mark" [class.dim]="picked() && picked() !== row.id">
          <text class="name" [attr.x]="c.labelX" [attr.y]="row.y + 21" text-anchor="end">
            {{ row.label }}
          </text>
          <rect
            [attr.x]="c.barX"
            [attr.y]="row.y + 9"
            [attr.width]="row.barWidth"
            height="16"
            rx="4"
            [style.fill]="row.colour"
          />
          <text class="value" [attr.x]="c.barX + row.barWidth + 8" [attr.y]="row.y + 19">
            {{ row.value }}
          </text>
          <text class="faint" [attr.x]="c.barX + row.barWidth + 8" [attr.y]="row.y + 32">
            {{ row.detail }}
          </text>
        </g>
        <rect
          class="hit"
          x="0"
          [attr.y]="row.y"
          [attr.width]="c.width"
          [attr.height]="c.rowHeight"
          [attr.data-tip]="row.tip"
          tabindex="0"
          role="button"
          [attr.aria-label]="row.label + ': ' + row.value + ', ' + row.detail"
          [attr.aria-pressed]="picked() === row.id"
          (click)="pick.emit(row.id)"
          (keydown.enter)="pick.emit(row.id)"
          (keydown.space)="$event.preventDefault(); pick.emit(row.id)"
        />
      }
    </svg>
  `,
  styleUrl: './agent-chart.css',
  styles: `
    :host {
      --chart-min-width: 440px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentRankView {
  readonly chart = input.required<RankChart>();
  readonly picked = input<string | null>(null);
  readonly pick = output<string>();
}
