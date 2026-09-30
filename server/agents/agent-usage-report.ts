import { join } from 'node:path';
import { rememberProjects, resolveProject } from '../usage/checkout-projects.ts';
import type { ProjectOf } from '../usage/project-usage.ts';
import { dayKeys, windowStart } from '../usage/token-days.ts';
import { SESSION_LOGS_DIR, USAGE_DIR } from '../usage/usage-paths.ts';
import { type EntryStore, jsonEntryStore } from '../usage/file-cache.ts';
import { RUN_CACHE_VERSION, type RawAgentRun, runsSince } from './agent-runs.ts';

/** Days of runs the report covers, today included: the usage view's month. */
export const AGENT_REPORT_DAYS = 30;

/** One subagent run, matched to its project and, where it says, its issue. */
export interface AgentRun extends Omit<RawAgentRun, 'cwd' | 'startedAt' | 'endedAt'> {
  /** The agent without its plugin namespace (`agent-playbook:dev` is `dev`), or `unknown`. */
  readonly agent: string;
  readonly project: string;
  readonly repo: string | null;
  /** From the description ("issue 442", "#442"), else the branch (`feat/217-…`); null when neither says. */
  readonly issue: number | null;
  /** The pull request the task names ("QA review PR 648"), or null. */
  readonly pull: number | null;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
}

/** One agent's runs, added up. */
export interface AgentTotals {
  readonly agent: string;
  readonly runs: number;
  readonly workTokens: number;
  readonly averageWorkTokens: number;
  readonly peakContextMax: number;
  readonly peakContextAverage: number;
  readonly toolUses: number;
  readonly averageDurationMs: number;
}

export interface ProjectAgents {
  readonly project: string;
  readonly repo: string | null;
  readonly agents: readonly AgentTotals[];
}

/** What `GET /api/agent-usage` returns. */
export interface AgentUsageReport {
  readonly generatedAt: string;
  readonly days: number;
  /** The first day covered, as YYYY-MM-DD in local time. */
  readonly from: string;
  /** Newest first. */
  readonly runs: readonly AgentRun[];
  /** Every agent across all projects, most work first. */
  readonly agents: readonly AgentTotals[];
  readonly projects: readonly ProjectAgents[];
}

export interface AgentUsageSources {
  readonly logsDir: string;
  readonly cache: EntryStore<RawAgentRun | null>;
  readonly projectOf: ProjectOf;
}

export const DEFAULT_AGENT_SOURCES: AgentUsageSources = {
  logsDir: SESSION_LOGS_DIR,
  cache: jsonEntryStore(join(USAGE_DIR, 'agent-runs.json'), RUN_CACHE_VERSION),
  projectOf: resolveProject,
};

const NAMESPACE = /^[^:]*:/;
/** A branch named for its issue, as this workflow names them: `<type>/<n>-<topic>`. */
const BRANCH_ISSUE = /^[a-z]+\/(\d+)-/i;
/** "PR #623", "PR 648", "PRs #12", "PR: #12", "pull request #20", "pull-request 9". */
const PULL_REF = /\b(?:PRs?|pull[\s-]?requests?)\s*:?\s*#?(\d+)\b/gi;
/** "issue 442" or "#442", once the pull-request references are taken out. */
const DESCRIBED_ISSUE = /\bissue\s*#?(\d+)\b|#(\d+)\b/i;

/** The pull request a run's task names, as a qa review does: "QA review PR 648". */
export function pullOf(description: string): number | null {
  const match = new RegExp(PULL_REF.source, 'i').exec(description);
  return match ? Number(match[1]) : null;
}

/** `agent-playbook:dev` and `dev` are one agent; a run that names none is `unknown`. */
export function agentNameOf(agentType: string | null): string {
  return agentType?.replace(NAMESPACE, '') || 'unknown';
}

/** Agents that plan a change before its branch exists: whatever branch is checked
 *  out while they run belongs to some other change. */
const PLANNING_AGENTS = new Set(['pm', 'refine', 'ux-design']);

/** The issue a run worked on: the one its task names, else, for an agent that
 *  works on the change's own branch, the one that branch is named for. */
export function issueOf(agent: string, branch: string | null, description: string): number | null {
  // A pull request's number is not its issue's.
  const described = DESCRIBED_ISSUE.exec(description.replace(PULL_REF, ' '));
  if (described) return Number(described[1] ?? described[2]);
  if (PLANNING_AGENTS.has(agent)) return null;
  const named = BRANCH_ISSUE.exec(branch ?? '');
  return named ? Number(named[1]) : null;
}

/** Each agent's runs added up, most work first. */
export function totalsOf(runs: readonly AgentRun[]): AgentTotals[] {
  const byAgent = new Map<string, AgentRun[]>();
  for (const run of runs) byAgent.set(run.agent, [...(byAgent.get(run.agent) ?? []), run]);
  return [...byAgent]
    .map(([agent, mine]): AgentTotals => {
      const sum = (pick: (run: AgentRun) => number): number =>
        mine.reduce((total, run) => total + pick(run), 0);
      return {
        agent,
        runs: mine.length,
        workTokens: sum((run) => run.workTokens),
        averageWorkTokens: sum((run) => run.workTokens) / mine.length,
        peakContextMax: Math.max(...mine.map((run) => run.peakContext)),
        peakContextAverage: sum((run) => run.peakContext) / mine.length,
        toolUses: sum((run) => run.toolUses),
        averageDurationMs: sum((run) => run.durationMs) / mine.length,
      };
    })
    .sort((a, b) => b.workTokens - a.workTokens);
}

/** A raw run named, placed in its project and tied to its issue. */
export function agentRunOf(raw: RawAgentRun, projectOf: ProjectOf): AgentRun {
  const { cwd, startedAt, endedAt, ...rest } = raw;
  const project = projectOf(cwd);
  return {
    ...rest,
    agent: agentNameOf(raw.agentType),
    project: project.name,
    repo: project.repo,
    issue: issueOf(agentNameOf(raw.agentType), raw.branch, raw.description),
    pull: pullOf(raw.description),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs: Math.max(0, endedAt - startedAt),
  };
}

/** The runs that ended in the window, newest first, with totals overall and per project. */
export function agentUsageFrom(
  raws: readonly RawAgentRun[],
  projectOf: ProjectOf,
  now: number,
): AgentUsageReport {
  const from = windowStart(now, AGENT_REPORT_DAYS);
  const runs = raws
    .filter((raw) => raw.endedAt >= from && raw.endedAt <= now)
    .map((raw) => agentRunOf(raw, projectOf))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  const byProject = new Map<string, AgentRun[]>();
  for (const run of runs) {
    const key = run.repo ?? `~${run.project}`;
    byProject.set(key, [...(byProject.get(key) ?? []), run]);
  }
  return {
    generatedAt: new Date(now).toISOString(),
    days: AGENT_REPORT_DAYS,
    from: dayKeys(now, AGENT_REPORT_DAYS)[0],
    runs,
    agents: totalsOf(runs),
    projects: [...byProject.values()]
      .map((mine) => ({ project: mine[0].project, repo: mine[0].repo, agents: totalsOf(mine) }))
      .sort((a, b) => sumWork(b.agents) - sumWork(a.agents)),
  };
}

const sumWork = (agents: readonly AgentTotals[]): number =>
  agents.reduce((total, agent) => total + agent.workTokens, 0);

/** A month of subagent runs from the session logs on this machine. */
export async function agentUsageReport(
  sources = DEFAULT_AGENT_SOURCES,
  now = Date.now(),
): Promise<AgentUsageReport> {
  const raws = await runsSince(sources.logsDir, windowStart(now, AGENT_REPORT_DAYS), sources.cache);
  return agentUsageFrom(raws, rememberProjects(sources.projectOf), now);
}
