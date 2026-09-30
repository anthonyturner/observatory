import { AgentRun } from '../agent-usage-document';

/** Noon on 30 September 2026, local time: "now" for agent tests. */
export const AGENT_NOW = new Date(2026, 8, 30, 12, 0).getTime();
const HOUR = 3_600_000;

/** A finished run an hour before AGENT_NOW, with any field replaced. */
export function agentRun(id: string, more: Partial<AgentRun> = {}): AgentRun {
  return {
    id,
    agent: 'dev',
    description: `Task ${id}`,
    project: 'observatory',
    repo: 'me/observatory',
    branch: 'main',
    issue: null,
    pull: null,
    startedAt: new Date(AGENT_NOW - 2 * HOUR).toISOString(),
    endedAt: new Date(AGENT_NOW - HOUR).toISOString(),
    durationMs: HOUR,
    model: 'claude-opus-5-5',
    toolUses: 10,
    workTokens: 100_000,
    peakContext: 80_000,
    ...more,
  };
}

/** A run that ended `hoursAgo` before AGENT_NOW, taking `minutes`. */
export function runEndingAt(
  id: string,
  hoursAgo: number,
  minutes: number,
  more: Partial<AgentRun> = {},
): AgentRun {
  const end = AGENT_NOW - hoursAgo * HOUR;
  return agentRun(id, {
    startedAt: new Date(end - minutes * 60_000).toISOString(),
    endedAt: new Date(end).toISOString(),
    durationMs: minutes * 60_000,
    ...more,
  });
}
