import { groupOf } from '../../../../core/agent-usage/agent-groups';
import { AgentRun } from '../../../../core/agent-usage/agent-usage-document';
import { localDayKey } from '../../../../core/usage/usage-format';

/** What the charts are narrowed to: a project, an agent group, a day. Null is all. */
export interface AgentFilter {
  readonly project: string | null;
  readonly agent: string | null;
  readonly day: string | null;
}

export const NO_FILTER: AgentFilter = { project: null, agent: null, day: null };

/** The runs that pass every part of the filter, in their order. */
export function runsMatching(runs: readonly AgentRun[], filter: AgentFilter): AgentRun[] {
  return runs.filter(
    (run) =>
      (!filter.project || run.project === filter.project) &&
      (!filter.agent || groupOf(run.agent).id === filter.agent) &&
      (!filter.day || localDayKey(Date.parse(run.endedAt)) === filter.day),
  );
}

/** A heading for the run list that says what it is showing. */
export function runsTitle(filter: AgentFilter, dayLabel: (day: string) => string): string {
  if (!filter.project && !filter.agent && !filter.day) return 'Latest runs';
  const who = filter.agent ? `${filter.agent} runs` : 'Runs';
  const where = filter.project ? ` in ${filter.project}` : '';
  const when = filter.day ? ` on ${dayLabel(filter.day)}` : '';
  return `${who}${where}${when}`;
}
