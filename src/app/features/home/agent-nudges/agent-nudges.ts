import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AgentFocus } from '../../../core/agent-usage/agent-focus';
import { Nudge, NudgeKind } from '../../../core/agent-usage/agent-nudges';
import { AgentReminders } from '../../../core/agent-usage/agent-reminders';

/** The signal each kind of nudge reads, as a readout's tag names it. */
const TAGS: Readonly<Record<NudgeKind, string>> = {
  'near-limit': 'Context',
  'busy-day': 'Load',
  pricier: 'Cost',
  rework: 'Rework',
  'skipped-qa': 'QA gap',
};

/** Nudges from the agent runs, under the status line, drawn as the HUD's own
 *  readouts: a bracketed frame, a live marker, the signal's tag, what happened.
 *  Each opens the chart, or the change, that shows it. */
@Component({
  selector: 'app-agent-nudges',
  template: `
    @if (reminders.nudges().length) {
      <ul aria-label="Agent nudges">
        @for (nudge of reminders.nudges(); track nudge.id) {
          <li class="readout">
            <button type="button" class="open" (click)="open(nudge)">
              <span class="readout__marker" aria-hidden="true"></span>
              <span class="readout__tag">{{ tags[nudge.kind] }}</span>
              <span class="text">{{ nudge.text }}</span>
            </button>
            <button
              type="button"
              class="close"
              [attr.aria-label]="'Dismiss until tomorrow: ' + nudge.text"
              title="Dismiss until tomorrow"
              (click)="reminders.dismiss(nudge.kind)"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    /* Stacked like an alert log, each as wide as its words, within the HUD's middle. */
    ul {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      max-width: 620px;
      margin: 0 auto;
      padding: 0;
      list-style: none;
    }

    /* The HUD's readout (styles/readout.css), in amber. */
    li {
      --readout-accent: var(--nudge-bracket);
      --readout-frame: var(--nudge-frame);
      --readout-scan: var(--nudge-scan);
      --readout-edge-lit: var(--warm-edge);
      --readout-fill: var(--panel-strong);
      display: flex;
      align-items: stretch;
    }

    button {
      border: 0;
      background: transparent;
      color: var(--ink);
      font: inherit;
      cursor: pointer;
    }

    .open {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 6px 12px 6px 11px;
      text-align: left;
    }

    .text {
      font-size: 12px;
      line-height: 1.35;
    }

    .close {
      display: grid;
      place-items: center;
      width: 30px;
      border-left: 1px solid var(--nudge-frame);
      font-family: var(--font-mono);
      font-size: 14px;
      color: var(--warm);
    }

    .open:hover,
    .open:focus-visible,
    .close:hover,
    .close:focus-visible {
      background: var(--flow-tint);
    }

    button:focus-visible {
      outline: 1px solid var(--ink);
      outline-offset: -3px;
    }

    @media (max-width: 720px) {
      .open {
        min-height: 44px;
      }

      .close {
        width: 44px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentNudges {
  protected readonly reminders = inject(AgentReminders);
  private readonly focus = inject(AgentFocus);
  private readonly router = inject(Router);
  protected readonly tags = TAGS;

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
