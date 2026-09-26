import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AgentCard, AgentsReport } from '../../../core/agents/agents-report';

/** "40 min", "6.0 h", "2.5 days", or "—". */
export function hours(h: number | null): string {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`;
}

/** One bar of a card: how many, of how many, in what colour. */
export interface AgentBar {
  readonly label: string;
  readonly n: number;
  readonly pct: number;
  readonly colour: string;
}

export function agentBars(card: AgentCard): AgentBar[] {
  const bar = (label: string, n: number, colour: string): AgentBar => {
    const pct = card.opened ? Math.round((n / card.opened) * 100) : 0;
    return { label, n, pct: Math.max(pct, n ? 4 : 0), colour };
  };
  return [
    bar('merged', card.merged, 'var(--ok)'),
    bar('still open', card.open, 'var(--sev-waiting)'),
    bar('open and conflicting', card.conflicting, 'var(--bad)'),
    bar('close no issue', card.unlinked, 'var(--meh)'),
  ];
}

/** "3 pull requests attributed since Sep 20. Click a card…", or how cards come to be. */
export function agentsSub(report: AgentsReport | null, locale?: string): string {
  if (!report?.agents.length) {
    return 'No handoffs recorded yet. The capture hooks record each pull request an agent opens; cards appear once there are some.';
  }
  const since = report.since
    ? ` since ${new Date(report.since).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`
    : '';
  return `${report.attributed} pull request${report.attributed === 1 ? '' : 's'} attributed${since}. Click a card to light only that agent's stars.`;
}

/** pr-starmap's agent report cards: how each agent's pull requests fare once handed back. */
@Component({
  selector: 'app-agents-panel',
  templateUrl: './agents-panel.html',
  styleUrl: './agents-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsPanel {
  readonly report = input<AgentsReport | null>(null);
  /** The agent whose stars alone are lit, if any. */
  readonly lit = input<string | null>(null);
  readonly light = output<string>();

  protected readonly sub = computed(() => agentsSub(this.report()));
  protected readonly cards = computed(() =>
    (this.report()?.agents ?? []).map((card) => ({
      card,
      bars: agentBars(card),
      foot: `median ${hours(card.medianMergeHours)} to merge · median ${card.medianLines == null ? '—' : Math.round(card.medianLines).toLocaleString()} lines`,
    })),
  );
}
