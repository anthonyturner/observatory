import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AgentChart, AgentFocus } from '../../../core/agent-usage/agent-focus';
import { AgentReminders } from '../../../core/agent-usage/agent-reminders';

/** The review's steps, in the order they are best taken. */
const STEPS: readonly { chart: AgentChart; title: string; why: string }[] = [
  {
    chart: 'daily',
    title: 'Tokens by day',
    why: 'which days were busy, and which agent drove them',
  },
  { chart: 'rank', title: 'Who spends the tokens', why: 'each agent against last week' },
  { chart: 'context', title: 'How full each context gets', why: 'any agent near its limit' },
];

/** The weekly Agent review: three charts to look at, then Done for this week,
 *  or Remind me Monday. It shows only while a review is due. */
@Component({
  selector: 'app-agent-review-card',
  template: `
    @if (reminders.due()) {
      <aside class="card" role="region" aria-labelledby="review-title">
        <h2 id="review-title">Agent review</h2>
        <p class="lead">This week’s look at what your agents cost. Each step opens its chart.</p>
        <ol>
          @for (step of steps; track step.chart) {
            <li>
              <button type="button" (click)="focus.show({ chart: step.chart })">
                <b>{{ step.title }}</b> <span>{{ step.why }}</span>
              </button>
            </li>
          }
        </ol>
        <div class="actions">
          <button type="button" class="primary" (click)="reminders.done()">
            Done for this week
          </button>
          <button type="button" (click)="reminders.snooze()">Remind me Monday</button>
        </div>
      </aside>
    }
  `,
  styles: `
    .card {
      position: fixed;
      bottom: calc(76px + env(safe-area-inset-bottom, 0px));
      left: 20px;
      z-index: 6;
      display: grid;
      gap: 10px;
      width: min(340px, calc(100vw - 32px));
      padding: 14px 16px;
      border: 1px solid var(--flow);
      border-radius: 14px;
      background: var(--glass-card);
      /* It floats over the HUD's columns, whose words must not show through. */
      backdrop-filter: blur(14px) saturate(120%);
      box-shadow: var(--shadow-card);
    }
    h2 {
      margin: 0;
      font-family: var(--font-serif);
      font-style: italic;
      font-weight: 400;
      font-size: 21px;
      color: var(--ink);
    }
    .lead {
      margin: 0;
      font-size: 12.5px;
      color: var(--muted);
    }
    ol {
      display: grid;
      gap: 6px;
      margin: 0;
      padding-left: 20px;
      color: var(--flow);
      font-family: var(--font-mono);
      font-size: 11px;
    }
    li button {
      display: grid;
      gap: 1px;
      width: 100%;
      padding: 4px 6px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      text-align: left;
      font: inherit;
      cursor: pointer;
    }
    li button:hover,
    li button:focus-visible {
      background: var(--flow-tint);
    }
    li b {
      font-family: var(--font-sans);
      font-weight: 500;
      font-size: 13px;
      color: var(--ink);
    }
    li span {
      font-family: var(--font-sans);
      font-size: 12px;
      color: var(--muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .actions button {
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid var(--edge-soft);
      border-radius: 8px;
      background: var(--panel);
      color: var(--ink);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .actions .primary {
      border-color: var(--flow);
      background: var(--flow-tint);
    }
    @media (max-width: 720px) {
      .card {
        bottom: calc(128px + env(safe-area-inset-bottom, 0px));
        left: 16px;
      }
      .actions button {
        min-height: 44px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentReviewCard {
  protected readonly reminders = inject(AgentReminders);
  protected readonly focus = inject(AgentFocus);
  protected readonly steps = STEPS;
}
