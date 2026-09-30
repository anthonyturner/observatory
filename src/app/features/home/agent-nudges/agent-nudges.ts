import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AgentFocus } from '../../../core/agent-usage/agent-focus';
import { Nudge } from '../../../core/agent-usage/agent-nudges';
import { AgentReminders } from '../../../core/agent-usage/agent-reminders';

/** Nudges from the agent runs, under the status line: each says what happened
 *  and opens the chart, or the change, that shows it. */
@Component({
  selector: 'app-agent-nudges',
  template: `
    @if (reminders.nudges().length) {
      <ul aria-label="Agent nudges">
        @for (nudge of reminders.nudges(); track nudge.id) {
          <li>
            <button type="button" class="open" (click)="open(nudge)">{{ nudge.text }}</button>
            <button
              type="button"
              class="close"
              [attr.aria-label]="'Dismiss until tomorrow: ' + nudge.text"
              title="Dismiss until tomorrow"
              (click)="reminders.dismiss(nudge.kind)"
            >
              ×
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    ul {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: inline-flex;
      align-items: stretch;
      overflow: hidden;
      border: 1px solid var(--warm);
      border-radius: 999px;
      background: var(--panel);
    }
    button {
      border: 0;
      background: transparent;
      color: var(--ink);
      font: inherit;
      font-size: 11.5px;
      cursor: pointer;
    }
    .open {
      padding: 4px 6px 4px 12px;
      text-align: left;
    }
    .close {
      padding: 0 10px;
      color: var(--warm);
    }
    button:hover,
    button:focus-visible {
      background: var(--flow-tint);
    }
    @media (max-width: 720px) {
      button {
        min-height: 44px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentNudges {
  protected readonly reminders = inject(AgentReminders);
  private readonly focus = inject(AgentFocus);
  private readonly router = inject(Router);

  protected open(nudge: Nudge): void {
    const { target } = nudge;
    if (target.kind === 'issue') {
      const [owner, repo] = target.repo.split('/');
      void this.router.navigate(['/p', owner, repo], { queryParams: { issue: target.issue } });
      return;
    }
    this.focus.show({
      chart: target.chart,
      agent: target.agent,
      project: target.project,
      day: target.day,
    });
  }
}
