import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AgentUsageFeed } from '../../core/agent-usage/agent-usage-feed';
import { TipAt, UsageTip } from '../charts/usage-tip/usage-tip';
import { issueFromBranch, lanesChart, runsFor } from './agent-lanes-chart';

/** D: how one change went through the agent pipeline. Draws nothing when no
 *  agent run is tied to the change, so a screen without one stays as it was. */
@Component({
  selector: 'app-agent-lanes',
  imports: [UsageTip],
  template: `
    @if (chart(); as c) {
      <section class="lanes" aria-labelledby="lanes-title">
        <h3 id="lanes-title">
          Agent pipeline
          <span>{{ c.lanes.length }} runs · {{ c.totalTokens }} tokens · {{ c.span }}</span>
        </h3>
        <p class="use">
          Use it when a change took too long or cost too much: the gaps are waits between hand-offs,
          and ↻ marks a stage that ran again.
        </p>
        <div class="scroll">
          <svg
            [attr.viewBox]="'0 0 ' + c.width + ' ' + c.height"
            role="img"
            aria-label="Agent runs on this change over time"
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
            @for (path of c.handoffs; track $index) {
              <path class="handoff" [attr.d]="path" />
            }
            @for (lane of c.lanes; track lane.id) {
              <text class="name" [attr.x]="c.labelX" [attr.y]="lane.y + 4" text-anchor="end">
                {{ lane.agent }}
              </text>
              <rect
                class="bar"
                [attr.x]="lane.x"
                [attr.y]="lane.y - 8"
                [attr.width]="lane.width"
                height="16"
                rx="4"
                [style.fill]="lane.colour"
                [attr.data-tip]="lane.tip"
              />
              <text
                class="label"
                [class.repeat]="lane.isRepeat"
                [class.inside]="lane.labelInside"
                [attr.x]="lane.label.x"
                [attr.y]="lane.label.y"
                [attr.text-anchor]="lane.label.anchor"
              >
                {{ lane.label.text }}
              </text>
            }
          </svg>
        </div>
      </section>
      <app-usage-tip [tip]="tip()" />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .lanes {
      display: grid;
      gap: 8px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--edge-soft);
    }
    h3 {
      margin: 0;
      font-family: var(--font-condensed);
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink);
    }
    h3 span {
      margin-left: 8px;
      font-family: var(--font-mono);
      font-weight: 400;
      font-size: 10.5px;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .use {
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted);
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
      min-width: 480px;
    }
    .scroll {
      overflow-x: auto;
    }
    text {
      font-family: var(--font-mono);
      font-size: 10px;
      fill: var(--muted);
    }
    .name {
      font-size: 11px;
      fill: var(--ink-soft);
    }
    .label {
      font-size: 10.5px;
      fill: var(--ink-soft);
      pointer-events: none;
    }
    .label.inside {
      fill: var(--void);
    }
    .label.repeat {
      fill: var(--warm);
    }
    .grid {
      stroke: var(--edge-soft);
    }
    .handoff {
      fill: none;
      stroke: var(--faint);
      stroke-width: 1.2;
      stroke-dasharray: 3 3;
    }
    .bar {
      cursor: default;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(pointermove)': 'pointAt($event)', '(pointerleave)': 'tip.set(null)' },
})
export class AgentLanes {
  readonly repo = input.required<string>();
  /** The issue the change is for, when the screen knows it. */
  readonly issue = input<number | null>(null);
  /** The pull request's branch, when there is one. */
  readonly branch = input<string | null>(null);

  private readonly runs = inject(AgentUsageFeed).runs;
  protected readonly tip = signal<TipAt | null>(null);
  protected readonly chart = computed(() =>
    lanesChart(
      runsFor(this.runs(), {
        repo: this.repo(),
        issue: this.issue() ?? issueFromBranch(this.branch()),
      }),
    ),
  );

  /** A bar's `data-tip` shows beside the pointer. */
  protected pointAt(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const text = target?.closest('[data-tip]')?.getAttribute('data-tip');
    this.tip.set(text ? { text, pointer: { x: event.clientX, y: event.clientY } } : null);
  }
}
