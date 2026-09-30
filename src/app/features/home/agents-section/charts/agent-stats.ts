import { AgentGroup, AGENT_GROUPS, groupOf } from '../../../../core/agent-usage/agent-groups';
import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { formatTokens } from '../../../../core/usage/usage-format';

/** Claude's standard context window. Runs on a 1M-context model can pass it,
 *  and the logs do not say which window a run had, so it is a reference, not a limit. */
export const STANDARD_WINDOW = 200_000;

/** One chart group's runs, added up. */
export interface GroupTotals {
  readonly group: AgentGroup;
  readonly runs: readonly AgentRun[];
  readonly workTokens: number;
  readonly averageWorkTokens: number;
  readonly averagePeak: number;
  readonly maxPeak: number;
  readonly toolUses: number;
  readonly averageMinutes: number;
  /** The agents folded into it, most runs first: Other names what it holds. */
  readonly agents: readonly string[];
}

const sum = (runs: readonly AgentRun[], pick: (run: AgentRun) => number): number =>
  runs.reduce((total, run) => total + pick(run), 0);

/** Each group with any runs, in pipeline order. */
export function groupTotals(runs: readonly AgentRun[]): GroupTotals[] {
  return AGENT_GROUPS.flatMap((group) => {
    const mine = runs.filter((run) => groupOf(run.agent).id === group.id);
    if (!mine.length) return [];
    const counts = new Map<string, number>();
    for (const run of mine) counts.set(run.agent, (counts.get(run.agent) ?? 0) + 1);
    return [
      {
        group,
        runs: mine,
        workTokens: sum(mine, (run) => run.workTokens),
        averageWorkTokens: sum(mine, (run) => run.workTokens) / mine.length,
        averagePeak: sum(mine, (run) => run.peakContext) / mine.length,
        maxPeak: Math.max(...mine.map((run) => run.peakContext)),
        toolUses: sum(mine, (run) => run.toolUses),
        averageMinutes: sum(mine, (run) => run.durationMs) / mine.length / 60_000,
        agents: [...counts].sort((a, b) => b[1] - a[1]).map(([agent]) => agent),
      },
    ];
  });
}

/** "54 min", "1 h 12 min", "40 s". */
export function formatMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** The name a group shows: Other says which agents it holds. */
export function groupName(totals: GroupTotals): string {
  if (totals.group.id !== 'other') return totals.group.label;
  const shown = totals.agents.slice(0, 2).join(', ');
  return totals.agents.length > 2 ? `other (${shown}…)` : `other (${shown})`;
}

/** A group's tooltip: what it spent and how full its contexts got. */
export function groupTip(totals: GroupTotals): string {
  const runs = totals.runs.length;
  return [
    groupName(totals),
    `${formatTokens(totals.workTokens)} work tokens · ${runs} ${runs === 1 ? 'run' : 'runs'}`,
    `${formatTokens(totals.averageWorkTokens)} a run · ${formatMinutes(totals.averageMinutes)} a run`,
    `peak context ${formatTokens(totals.averagePeak)} on average, ${formatTokens(totals.maxPeak)} at most`,
    `${totals.toolUses} tool uses`,
  ].join('\n');
}

/** A round axis end a little past `value`: 1, 2 or 5 times a power of ten. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((each) => each * power >= value) ?? 10;
  return step * power;
}
