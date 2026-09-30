import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Orrery } from '../charts/agent-orrery';

/** F: the agents as moons round a small core; a moon is a button that lights its agent. */
@Component({
  selector: 'app-agent-orrery-view',
  template: `
    @let o = orrery();
    <svg
      [attr.viewBox]="'0 0 ' + o.size + ' ' + o.size"
      role="group"
      aria-label="Agents as moons round a core: bigger moons did more work; the arc round each is its average peak context"
    >
      <defs>
        <radialGradient id="agent-core">
          <stop offset="0%" stop-color="var(--ink)" stop-opacity="1" />
          <stop offset="35%" stop-color="var(--flow)" stop-opacity="0.55" />
          <stop offset="100%" stop-color="var(--flow)" stop-opacity="0" />
        </radialGradient>
      </defs>
      @for (moon of o.moons; track moon.id) {
        <ellipse
          class="orbit"
          [attr.cx]="o.centre"
          [attr.cy]="o.centre"
          [attr.rx]="moon.orbitX"
          [attr.ry]="moon.orbitY"
        />
      }
      <circle [attr.cx]="o.centre" [attr.cy]="o.centre" r="52" fill="url(#agent-core)" />
      <circle [attr.cx]="o.centre" [attr.cy]="o.centre" r="12" class="core" />
      @for (moon of o.moons; track moon.id) {
        <g
          class="mark pickable"
          [class.dim]="picked() && picked() !== moon.id"
          [attr.transform]="'translate(' + moon.x + ' ' + moon.y + ')'"
          [attr.data-tip]="moon.tip"
          tabindex="0"
          role="button"
          [attr.aria-label]="moon.label"
          [attr.aria-pressed]="picked() === moon.id"
          (click)="pick.emit(moon.id)"
          (keydown.enter)="pick.emit(moon.id)"
          (keydown.space)="$event.preventDefault(); pick.emit(moon.id)"
        >
          <circle class="arc-track" [attr.r]="moon.arcRadius" />
          <circle
            class="arc"
            [attr.r]="moon.arcRadius"
            [style.stroke]="moon.colour"
            [attr.stroke-dasharray]="moon.arcDash"
            transform="rotate(-90)"
          />
          <circle [attr.r]="moon.radius" [style.fill]="moon.colour" class="moon" />
          <circle [attr.r]="moon.arcRadius + 6" class="hit-area" />
          <text class="name" [attr.y]="-moon.arcRadius - 7" text-anchor="middle">
            {{ moon.label }}
          </text>
        </g>
      }
    </svg>
  `,
  styleUrl: './agent-chart.css',
  styles: `
    svg {
      max-width: 360px;
      margin: 0 auto;
    }
    .orbit {
      fill: none;
      stroke: var(--edge-soft);
    }
    .core {
      fill: var(--ink);
    }
    .arc-track {
      fill: none;
      stroke: var(--edge-soft);
      stroke-width: 2;
    }
    .arc {
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .moon {
      stroke: var(--void);
      stroke-width: 2;
    }
    .hit-area {
      fill: transparent;
    }
    .name {
      font-size: 11px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentOrreryView {
  readonly orrery = input.required<Orrery>();
  readonly picked = input<string | null>(null);
  readonly pick = output<string>();
}
