import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { groupOf } from '../../../../core/agent-usage/agent-groups';
import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { ageOf, formatTokens } from '../../../../core/usage/usage-format';
import { formatMinutes } from '../charts/agent-stats';

/** "3h ago", or "just now" for a run that has only now ended. */
const endedAgo = (iso: string, now: number): string => {
  const age = ageOf(iso, now);
  return age === 'now' ? 'just now' : `${age} ago`;
};

/** Runs shown before "Show all". */
const FIRST_RUNS = 12;

/** The runs behind whatever the charts are filtered to, newest first. */
@Component({
  selector: 'app-agent-runs-list',
  template: `
    <table>
      <thead>
        <tr>
          <th scope="col">Agent</th>
          <th scope="col">What it did</th>
          <th scope="col">Project</th>
          <th scope="col" class="num">Tokens</th>
          <th scope="col" class="num">Peak context</th>
          <th scope="col" class="num">Time</th>
          <th scope="col" class="num">Ended</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.id) {
          <tr>
            <td><span class="swatch" [style.background]="row.colour"></span>{{ row.agent }}</td>
            <td class="what">{{ row.description }}</td>
            <td>{{ row.project }}</td>
            <td class="num">{{ row.tokens }}</td>
            <td class="num">{{ row.peak }}</td>
            <td class="num">{{ row.time }}</td>
            <td class="num">{{ row.ended }}</td>
          </tr>
        } @empty {
          <tr>
            <td colspan="7" class="empty">No runs match.</td>
          </tr>
        }
      </tbody>
    </table>
    @if (hidden() > 0) {
      <button type="button" class="more" (click)="showAll.set(true)">
        Show all {{ runs().length }} runs
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--edge-soft);
      text-align: left;
      white-space: nowrap;
    }
    th {
      font-family: var(--font-mono);
      font-weight: 500;
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    td {
      color: var(--ink-soft);
    }
    .num {
      text-align: right;
    }
    .what {
      white-space: normal;
      min-width: 180px;
      color: var(--ink);
    }
    .swatch {
      display: inline-block;
      width: 9px;
      height: 9px;
      margin-right: 7px;
      border-radius: 2px;
      vertical-align: 0;
    }
    .empty {
      text-align: center;
      color: var(--muted);
    }
    .more {
      margin-top: 10px;
      padding: 6px 12px;
      border: 1px solid var(--edge-soft);
      border-radius: 8px;
      background: var(--panel);
      color: var(--flow);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .more:hover {
      border-color: var(--flow);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentRunsList {
  readonly runs = input.required<readonly AgentRun[]>();
  /** When "now" is, for how long ago each run ended. */
  readonly now = input.required<number>();

  protected readonly showAll = signal(false);
  protected readonly hidden = computed(() =>
    this.showAll() ? 0 : Math.max(0, this.runs().length - FIRST_RUNS),
  );
  protected readonly rows = computed(() =>
    this.runs()
      .slice(0, this.showAll() ? undefined : FIRST_RUNS)
      .map((run) => ({
        id: run.id,
        agent: run.agent,
        colour: groupOf(run.agent).colour,
        description:
          [run.issue !== null ? `#${run.issue}` : '', run.description]
            .filter(Boolean)
            .join(' · ') || '—',
        project: run.project,
        tokens: formatTokens(run.workTokens),
        peak: formatTokens(run.peakContext),
        time: formatMinutes(run.durationMs / 60_000),
        ended: endedAgo(run.endedAt, this.now()),
      })),
  );
}
