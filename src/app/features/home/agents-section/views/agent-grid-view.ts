import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProjectGrid } from '../charts/agent-grid';

/** Which project and agent a cell stands for. */
export interface GridPick {
  readonly project: string;
  readonly agent: string;
}

/** E: agents by project; a cell is a button that filters the other charts to it. */
@Component({
  selector: 'app-agent-grid-view',
  template: `
    @let c = chart();
    <svg
      [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
      role="group"
      aria-label="Work tokens per agent and project"
    >
      @for (text of c.columns; track $index) {
        <text class="name" [attr.x]="text.x" [attr.y]="text.y" text-anchor="middle">
          {{ text.text }}
        </text>
      }
      @for (text of c.rows; track $index) {
        <text class="name" [attr.x]="text.x" [attr.y]="text.y" text-anchor="end">
          {{ text.text }}
        </text>
      }
      @for (cell of c.cells; track cell.project + cell.agent) {
        <rect
          class="cell pickable"
          [class.picked]="cell.isPicked"
          [attr.x]="cell.x"
          [attr.y]="cell.y"
          [attr.width]="cell.width"
          [attr.height]="cell.height"
          rx="4"
          [style.fill]="cell.fill"
          [attr.data-tip]="cell.tip"
          tabindex="0"
          role="button"
          [attr.aria-label]="cell.tip"
          [attr.aria-pressed]="cell.isPicked"
          (click)="pick.emit({ project: cell.project, agent: cell.agent })"
          (keydown.enter)="pick.emit({ project: cell.project, agent: cell.agent })"
          (keydown.space)="
            $event.preventDefault(); pick.emit({ project: cell.project, agent: cell.agent })
          "
        />
        @if (cell.label) {
          <text
            class="figure"
            [class.dark]="cell.ink === 'dark'"
            [attr.x]="cell.x + cell.width / 2"
            [attr.y]="cell.y + cell.height / 2 + 4"
            text-anchor="middle"
          >
            {{ cell.label }}
          </text>
        }
      }
    </svg>
  `,
  styleUrl: './agent-chart.css',
  styles: `
    :host {
      --chart-min-width: 440px;
    }
    .cell {
      stroke: transparent;
      stroke-width: 2;
    }
    .cell:hover {
      stroke: var(--edge);
    }
    .cell.picked {
      stroke: var(--ink);
    }
    .figure {
      font-size: 10.5px;
      fill: var(--ink);
      pointer-events: none;
    }
    .figure.dark {
      fill: var(--void);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentGridView {
  readonly chart = input.required<ProjectGrid>();
  readonly pick = output<GridPick>();
}
